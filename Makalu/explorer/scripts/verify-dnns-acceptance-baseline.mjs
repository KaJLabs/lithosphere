#!/usr/bin/env node

import {
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  concat,
  getAddress,
  keccak256,
  toUtf8Bytes,
} from 'ethers';

const RPC_URL = 'https://rpc-3.litho.ai';
const EXPECTED_CHAIN_ID = 900523n;
const REGISTRY_ADDRESS = '0x316dc15bF377F7187e5BE38BA19e673Ca823d1ab';
const EXPECTED_FORWARD_ADDRESS = '0xE9267bDf7084815B0754545049AE45FE744Aefa8';
const FORWARD_FIXTURES = [
  'litho.litho',
  'kamet.litho',
  'makalu.litho',
  'dex.litho',
  'treasury.litho',
  'team.litho',
  'faucet.litho',
  'quantts.litho',
  'bridge.litho',
];
const DNNS_README_URL = 'https://raw.githubusercontent.com/KaJLabs/DNNS/main/README.md';

const REGISTRY_ABI = ['function resolver(bytes32 node) view returns (address)'];
const RESOLVER_ABI = [
  'function addr(bytes32 node) view returns (address)',
  'function name(bytes32 node) view returns (string)',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function namehash(name) {
  let node = `0x${'00'.repeat(32)}`;
  for (const label of name.split('.').reverse()) {
    node = keccak256(concat([node, keccak256(toUtf8Bytes(label))]));
  }
  return node;
}

async function main() {
  const provider = new JsonRpcProvider(RPC_URL, {
    chainId: Number(EXPECTED_CHAIN_ID),
    name: 'lithosphere-kamet',
  });
  const network = await provider.getNetwork();
  assert(network.chainId === EXPECTED_CHAIN_ID, `RPC returned chain ID ${network.chainId}`);

  const registryCode = await provider.getCode(REGISTRY_ADDRESS);
  assert(registryCode !== '0x', 'DNNS registry has no deployed bytecode');
  const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

  const forwardFixtures = [];
  for (const name of FORWARD_FIXTURES) {
    const node = namehash(name);
    const resolverAddress = await registry.resolver(node);
    assert(resolverAddress !== ZeroAddress, `${name} has no resolver`);
    const resolver = new Contract(resolverAddress, RESOLVER_ABI, provider);
    const resolvedAddress = getAddress(await resolver.addr(node));
    assert(
      resolvedAddress === EXPECTED_FORWARD_ADDRESS,
      `${name} resolved to ${resolvedAddress}, expected ${EXPECTED_FORWARD_ADDRESS}`
    );
    forwardFixtures.push({ name, resolverAddress, resolvedAddress });
  }

  const reverseNode = namehash(`${EXPECTED_FORWARD_ADDRESS.toLowerCase().slice(2)}.addr.reverse`);
  const reverseResolverAddress = await registry.resolver(reverseNode);
  let reverseName = null;
  let reverseForwardVerified = false;
  if (reverseResolverAddress !== ZeroAddress) {
    const reverseResolver = new Contract(reverseResolverAddress, RESOLVER_ABI, provider);
    reverseName = await reverseResolver.name(reverseNode);
    assert(
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.litho$/.test(reverseName),
      `Reverse resolver returned an invalid v0 name: ${reverseName}`
    );
    const forwardNode = namehash(reverseName);
    const forwardResolverAddress = await registry.resolver(forwardNode);
    assert(forwardResolverAddress !== ZeroAddress, `${reverseName} has no forward resolver`);
    const forwardResolver = new Contract(forwardResolverAddress, RESOLVER_ABI, provider);
    reverseForwardVerified =
      getAddress(await forwardResolver.addr(forwardNode)) === EXPECTED_FORWARD_ADDRESS;
    assert(reverseForwardVerified, `${reverseName} does not resolve back to the fixture address`);
  }

  const documentationResponse = await fetch(DNNS_README_URL, {
    headers: { 'user-agent': 'lithosphere-dnns-acceptance-preflight/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  assert(documentationResponse.ok, `DNNS README returned HTTP ${documentationResponse.status}`);
  const documentation = await documentationResponse.text();
  const describesMakalu700777 = documentation.includes('EVM Chain ID: `700777`');
  const describesKamet900523 = documentation.includes('900523');
  const publishesVerifiedRegistryAddress = documentation
    .toLowerCase()
    .includes(REGISTRY_ADDRESS.toLowerCase());
  const externalBlockers = [];
  if (!reverseName) externalBlockers.push('stable reverse fixture is not configured');
  if (!describesKamet900523) externalBlockers.push('public documentation omits Kamet 900523');
  if (!publishesVerifiedRegistryAddress) {
    externalBlockers.push('public documentation omits the verified registry address');
  }

  console.log(
    JSON.stringify(
      {
        status: externalBlockers.length === 0 ? 'technical-pass' : 'external-blocked',
        checkedAt: new Date().toISOString(),
        deployment: {
          network: 'Kamet',
          evmChainId: Number(network.chainId),
          rpcUrl: RPC_URL,
          registryAddress: REGISTRY_ADDRESS,
          registryBytecodePresent: true,
        },
        forwardFixtures,
        reverseFixture: {
          address: EXPECTED_FORWARD_ADDRESS,
          resolverAddress: reverseResolverAddress,
          name: reverseName,
          configured: Boolean(reverseName),
          forwardVerified: reverseForwardVerified,
        },
        publicDocumentation: {
          repository: 'KaJLabs/DNNS',
          describesMakalu700777,
          describesKamet900523,
          publishesVerifiedRegistryAddress,
        },
        externalBlockers,
        transactionSubmitted: false,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`DNNS acceptance preflight failed: ${error.message}`);
  process.exitCode = 1;
});
