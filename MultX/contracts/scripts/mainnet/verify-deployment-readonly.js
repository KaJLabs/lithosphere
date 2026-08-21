const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { validateDeploymentManifest } = require('./validate-deployment-manifest');

const BRIDGE_ABI = [
  'function owner() view returns (address)',
  'function pauseGuardian() view returns (address)',
  'function paused() view returns (bool)',
  'function signaturesRequired() view returns (uint256)',
  'function validators(uint256) view returns (address)',
  'function getValidators() view returns (address[])',
  'function getValidatorCount() view returns (uint256)',
  'function supportedTokens(address) view returns (bool)',
  'function supportedRoutes(address,uint256) view returns (bool)',
  'function dailyCap(address) view returns (uint256)',
  'function dailyVolume(address) view returns (uint256)',
  'function releaseVolume(address) view returns (uint256)',
  'function nonce() view returns (uint256)',
];

const WRAPPED_ABI = [
  'function originChainId() view returns (uint256)',
  'function originToken() view returns (address)',
  'function bridge() view returns (address)',
  'function totalSupply() view returns (uint256)',
];

const LOCKED_TOPIC = ethers.utils.id('TokensLocked(bytes32,address,address,uint256,uint256,uint256)');
const RELEASED_TOPIC = ethers.utils.id('TokensReleased(bytes32,address,address,uint256,uint256,address,address)');
const ROUTE_INTERFACE = new ethers.utils.Interface([
  'event SupportedRouteSet(address indexed token,uint256 indexed targetChain,bool supported)',
]);
const ROUTE_TOPIC = ROUTE_INTERFACE.getEventTopic('SupportedRouteSet');
const LOG_BLOCK_RANGE = 2_000;

const sha256Code = (code) => crypto.createHash('sha256')
  .update(Buffer.from(code.slice(2), 'hex'))
  .digest('hex');

async function verifyExactValidatorSet(bridge, expected, chainName, blockTag) {
  const [countValue, completeSet] = await Promise.all([
    bridge.getValidatorCount({ blockTag }),
    bridge.getValidators({ blockTag }),
  ]);
  const count = Number(countValue.toString());
  if (count !== expected.length || completeSet.length !== expected.length) {
    throw new Error(`${chainName} live validator count ${count} does not equal manifest count ${expected.length}`);
  }
  if (completeSet.some((item, index) => item.toLowerCase() !== expected[index].toLowerCase())) {
    throw new Error(`${chainName} bridge validator set mismatch`);
  }
  return completeSet;
}

async function getLogsByTopics(provider, address, fromBlock, toBlock, topics) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_BLOCK_RANGE) {
    const end = Math.min(toBlock, start + LOG_BLOCK_RANGE - 1);
    logs.push(...await provider.getLogs({
      address,
      fromBlock: start,
      toBlock: end,
      topics,
    }));
  }
  return logs;
}

async function getBridgeActivityLogs(provider, address, fromBlock, toBlock) {
  return getLogsByTopics(provider, address, fromBlock, toBlock, [[LOCKED_TOPIC, RELEASED_TOPIC]]);
}

async function verifyPristineBridgeHistory(provider, bridge, chain, verificationBlock) {
  const nonce = await bridge.nonce({ blockTag: verificationBlock });
  if (!nonce.isZero()) throw new Error(`${chain.name} bridge nonce is not zero before canary`);
  const activity = await getBridgeActivityLogs(
    provider,
    chain.bridge.address,
    chain.bridge.deploymentBlock,
    verificationBlock,
  );
  if (activity.length !== 0) {
    throw new Error(`${chain.name} bridge has historical lock/release activity before canary`);
  }
}

async function verifyRouteUniverse(provider, bridge, asset, manifest, chain, blockTag) {
  const configuredLogs = await getLogsByTopics(
    provider,
    chain.bridge.address,
    chain.bridge.deploymentBlock,
    blockTag,
    [ROUTE_TOPIC],
  );
  const configuredTargets = configuredLogs
    .map((log) => ROUTE_INTERFACE.parseLog(log))
    .filter((event) => event.args.token.toLowerCase() === asset.address.toLowerCase())
    .map((event) => event.args.targetChain.toString());
  const routeTargets = [...new Set(manifest.chains
    .map((candidate) => String(candidate.chainId))
    .filter((target) => target !== String(chain.chainId))
    .concat(configuredTargets))];
  const states = await Promise.all(routeTargets.map(async (targetChain) => ({
    targetChain,
    enabled: await bridge.supportedRoutes(asset.address, targetChain, { blockTag }),
    expected: asset.targetChainIds.map(String).includes(targetChain),
  })));
  if (states.some(({ enabled, expected }) => enabled !== expected)) {
    throw new Error(`${chain.name} ${asset.symbol} on-chain routes do not exactly match the approved production universe`);
  }
}

async function verifyDeploymentReadonly(manifest, providerFactory = (rpc) => new ethers.providers.JsonRpcProvider(rpc)) {
  validateDeploymentManifest(manifest);
  const results = [];
  for (const chain of manifest.chains) {
    const provider = providerFactory(chain.rpcHttps, chain.chainId);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== chain.chainId) throw new Error(`${chain.name} RPC reports chain ${network.chainId}`);
    const verificationBlock = await provider.getBlockNumber();
    const verificationHeader = await provider.getBlock(verificationBlock);
    if (!verificationHeader?.hash) throw new Error(`${chain.name} verification block hash is unavailable`);

    const bridgeCode = await provider.getCode(chain.bridge.address, verificationBlock);
    if (bridgeCode === '0x') throw new Error(`${chain.name} bridge has no bytecode`);
    if (sha256Code(bridgeCode) !== chain.bridge.runtimeSha256.toLowerCase()) {
      throw new Error(`${chain.name} bridge runtime SHA-256 mismatch`);
    }
    const bridge = new ethers.Contract(chain.bridge.address, BRIDGE_ABI, provider);
    const [owner, guardian, paused, threshold] = await Promise.all([
      bridge.owner({ blockTag: verificationBlock }),
      bridge.pauseGuardian({ blockTag: verificationBlock }),
      bridge.paused({ blockTag: verificationBlock }),
      bridge.signaturesRequired({ blockTag: verificationBlock }),
    ]);
    if (owner.toLowerCase() !== chain.bridge.owner.toLowerCase()) throw new Error(`${chain.name} bridge owner mismatch`);
    if (guardian.toLowerCase() !== chain.bridge.pauseGuardian.toLowerCase()) throw new Error(`${chain.name} pause guardian mismatch`);
    if (paused !== true) throw new Error(`${chain.name} bridge is not paused`);
    if (threshold.toNumber() !== 5) throw new Error(`${chain.name} threshold is not 5`);

    await verifyExactValidatorSet(bridge, chain.bridge.validators, chain.name, verificationBlock);
    await verifyPristineBridgeHistory(provider, bridge, chain, verificationBlock);

    for (const asset of chain.assets) {
      const [supported, cap, locked, released, code] = await Promise.all([
        bridge.supportedTokens(asset.address, { blockTag: verificationBlock }),
        bridge.dailyCap(asset.address, { blockTag: verificationBlock }),
        bridge.dailyVolume(asset.address, { blockTag: verificationBlock }),
        bridge.releaseVolume(asset.address, { blockTag: verificationBlock }),
        provider.getCode(asset.address, verificationBlock),
      ]);
      if (!supported) throw new Error(`${chain.name} ${asset.symbol} is not supported by the bridge`);
      await verifyRouteUniverse(provider, bridge, asset, manifest, chain, verificationBlock);
      if (cap.toString() !== asset.dailyCapBaseUnits) throw new Error(`${chain.name} ${asset.symbol} daily cap mismatch`);
      if (!locked.isZero()) throw new Error(`${chain.name} ${asset.symbol} lock volume is not zero at deployment verification`);
      if (!released.isZero()) throw new Error(`${chain.name} ${asset.symbol} release volume is not zero at deployment verification`);
      if (code === '0x' || sha256Code(code) !== asset.runtimeSha256.toLowerCase()) {
        throw new Error(`${chain.name} ${asset.symbol} runtime SHA-256 mismatch`);
      }

      if (asset.kind === 'wrapped') {
        const token = new ethers.Contract(asset.address, WRAPPED_ABI, provider);
        const [originChainId, originToken, immutableBridge, totalSupply] = await Promise.all([
          token.originChainId({ blockTag: verificationBlock }),
          token.originToken({ blockTag: verificationBlock }),
          token.bridge({ blockTag: verificationBlock }),
          token.totalSupply({ blockTag: verificationBlock }),
        ]);
        if (originChainId.toNumber() !== 9005) throw new Error(`${chain.name} ${asset.symbol} origin chain mismatch`);
        if (originToken.toLowerCase() !== asset.originToken.toLowerCase()) throw new Error(`${chain.name} ${asset.symbol} origin token mismatch`);
        if (immutableBridge.toLowerCase() !== chain.bridge.address.toLowerCase()) {
          throw new Error(`${chain.name} ${asset.symbol} immutable bridge mismatch`);
        }
        if (!totalSupply.isZero()) throw new Error(`${chain.name} ${asset.symbol} wrapped supply is not zero before canary`);
      }
    }

    results.push({
      chainId: chain.chainId,
      bridge: chain.bridge.address,
      assets: chain.assets.length,
      verificationBlock,
      verificationBlockHash: verificationHeader.hash,
      status: 'verified-paused-pristine',
    });
  }
  return results;
}

if (require.main === module) {
  const index = process.argv.indexOf('--manifest');
  if (index === -1 || !process.argv[index + 1] || !process.argv.includes('--confirm-transaction-free')) {
    console.error('Usage: node verify-deployment-readonly.js --manifest /path/manifest.json --confirm-transaction-free');
    process.exit(2);
  }
  if (process.env.DEPLOYER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY || process.env.MNEMONIC) {
    throw new Error('transaction-free verifier refuses signing credentials');
  }
  const file = path.resolve(process.argv[index + 1]);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  verifyDeploymentReadonly(manifest).then((results) => {
    console.log(JSON.stringify({ transactionFree: true, results }, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  getBridgeActivityLogs,
  getLogsByTopics,
  sha256Code,
  verifyDeploymentReadonly,
  verifyExactValidatorSet,
  verifyPristineBridgeHistory,
  verifyRouteUniverse,
};
