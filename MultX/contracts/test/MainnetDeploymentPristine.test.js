const { expect } = require('chai');
const { ethers } = require('ethers');
const {
  getBridgeActivityLogs,
  verifyPristineBridgeHistory,
  verifyRouteUniverse,
} = require('../scripts/mainnet/verify-deployment-readonly');

async function expectReject(promise, message) {
  let error;
  try { await promise; } catch (caught) { error = caught; }
  expect(error).to.be.instanceOf(Error);
  expect(error.message).to.include(message);
}

describe('mainnet pristine deployment verification', () => {
  const chain = {
    chainId: 9005,
    name: 'LITHO',
    bridge: { address: '0x1111111111111111111111111111111111111111', deploymentBlock: 100 },
  };

  it('checks the full deployment history in bounded RPC ranges', async () => {
    const ranges = [];
    const provider = {
      getLogs: async ({ fromBlock, toBlock }) => {
        ranges.push([fromBlock, toBlock]);
        return [];
      },
    };
    expect(await getBridgeActivityLogs(provider, chain.bridge.address, 100, 4_100)).to.deep.equal([]);
    expect(ranges).to.deep.equal([[100, 2_099], [2_100, 4_099], [4_100, 4_100]]);
  });

  it('rejects a non-zero bridge nonce even if current token state is clean', async () => {
    await expectReject(verifyPristineBridgeHistory(
      { getLogs: async () => [] },
      { nonce: async () => ethers.BigNumber.from(1) },
      chain,
      110,
    ), 'bridge nonce is not zero');
  });

  it('rejects any historical lock or release event', async () => {
    await expectReject(verifyPristineBridgeHistory(
      { getLogs: async () => [{ blockNumber: 105 }] },
      { nonce: async () => ethers.constants.Zero },
      chain,
      110,
    ), 'historical lock/release activity');
  });

  it('rejects an undeclared route inside the complete production universe', async () => {
    const manifest = { chains: [9005, 1, 56, 8453].map((chainId) => ({ chainId })) };
    const asset = { address: '0x2222222222222222222222222222222222222222', symbol: 'LITHO', targetChainIds: [1, 56] };
    const routeInterface = new ethers.utils.Interface([
      'event SupportedRouteSet(address indexed token,uint256 indexed targetChain,bool supported)',
    ]);
    const encoded = routeInterface.encodeEventLog(
      routeInterface.getEvent('SupportedRouteSet'),
      [asset.address, 999999, true],
    );
    const provider = { getLogs: async () => [{ ...encoded, address: chain.bridge.address }] };
    const bridge = { supportedRoutes: async (_token, target) => ['1', '56', '999999'].includes(target) };
    await expectReject(
      verifyRouteUniverse(provider, bridge, asset, manifest, chain, 110),
      'do not exactly match',
    );
  });
});
