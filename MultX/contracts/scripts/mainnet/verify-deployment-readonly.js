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
  'function supportedTokens(address) view returns (bool)',
  'function dailyCap(address) view returns (uint256)',
  'function releaseVolume(address) view returns (uint256)',
];

const WRAPPED_ABI = [
  'function originChainId() view returns (uint256)',
  'function originToken() view returns (address)',
  'function bridge() view returns (address)',
];

const sha256Code = (code) => crypto.createHash('sha256')
  .update(Buffer.from(code.slice(2), 'hex'))
  .digest('hex');

async function verifyDeploymentReadonly(manifest, providerFactory = (rpc) => new ethers.providers.JsonRpcProvider(rpc)) {
  validateDeploymentManifest(manifest);
  const results = [];
  for (const chain of manifest.chains) {
    const provider = providerFactory(chain.rpcHttps, chain.chainId);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== chain.chainId) throw new Error(`${chain.name} RPC reports chain ${network.chainId}`);

    const bridgeCode = await provider.getCode(chain.bridge.address);
    if (bridgeCode === '0x') throw new Error(`${chain.name} bridge has no bytecode`);
    if (sha256Code(bridgeCode) !== chain.bridge.runtimeSha256.toLowerCase()) {
      throw new Error(`${chain.name} bridge runtime SHA-256 mismatch`);
    }
    const bridge = new ethers.Contract(chain.bridge.address, BRIDGE_ABI, provider);
    const [owner, guardian, paused, threshold] = await Promise.all([
      bridge.owner(), bridge.pauseGuardian(), bridge.paused(), bridge.signaturesRequired(),
    ]);
    if (owner.toLowerCase() !== chain.bridge.owner.toLowerCase()) throw new Error(`${chain.name} bridge owner mismatch`);
    if (guardian.toLowerCase() !== chain.bridge.pauseGuardian.toLowerCase()) throw new Error(`${chain.name} pause guardian mismatch`);
    if (paused !== true) throw new Error(`${chain.name} bridge is not paused`);
    if (threshold.toNumber() !== 5) throw new Error(`${chain.name} threshold is not 5`);

    const liveValidators = await Promise.all(chain.bridge.validators.map((_, index) => bridge.validators(index)));
    if (liveValidators.some((item, index) => item.toLowerCase() !== chain.bridge.validators[index].toLowerCase())) {
      throw new Error(`${chain.name} bridge validator set mismatch`);
    }

    for (const asset of chain.assets) {
      const [supported, cap, released, code] = await Promise.all([
        bridge.supportedTokens(asset.address),
        bridge.dailyCap(asset.address),
        bridge.releaseVolume(asset.address),
        provider.getCode(asset.address),
      ]);
      if (!supported) throw new Error(`${chain.name} ${asset.symbol} is not supported by the bridge`);
      if (cap.toString() !== asset.dailyCapBaseUnits) throw new Error(`${chain.name} ${asset.symbol} daily cap mismatch`);
      if (!released.isZero()) throw new Error(`${chain.name} ${asset.symbol} release volume is not zero at deployment verification`);
      if (code === '0x' || sha256Code(code) !== asset.runtimeSha256.toLowerCase()) {
        throw new Error(`${chain.name} ${asset.symbol} runtime SHA-256 mismatch`);
      }

      if (asset.kind === 'wrapped') {
        const token = new ethers.Contract(asset.address, WRAPPED_ABI, provider);
        const [originChainId, originToken, immutableBridge] = await Promise.all([
          token.originChainId(), token.originToken(), token.bridge(),
        ]);
        if (originChainId.toNumber() !== 9005) throw new Error(`${chain.name} ${asset.symbol} origin chain mismatch`);
        if (originToken.toLowerCase() !== asset.originToken.toLowerCase()) throw new Error(`${chain.name} ${asset.symbol} origin token mismatch`);
        if (immutableBridge.toLowerCase() !== chain.bridge.address.toLowerCase()) {
          throw new Error(`${chain.name} ${asset.symbol} immutable bridge mismatch`);
        }
      }
    }

    results.push({ chainId: chain.chainId, bridge: chain.bridge.address, assets: chain.assets.length, status: 'verified-paused' });
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

module.exports = { sha256Code, verifyDeploymentReadonly };
