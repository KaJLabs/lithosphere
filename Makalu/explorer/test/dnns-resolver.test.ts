import { beforeEach, describe, expect, it, vi } from 'vitest';

const contract = vi.hoisted(() => ({
  resolver: vi.fn(),
  addr: vi.fn(),
  name: vi.fn(),
}));

vi.mock('ethers', async (importOriginal) => {
  const original = await importOriginal<typeof import('ethers')>();

  class MockJsonRpcProvider {}
  class MockContract {
    resolver = contract.resolver;
    addr = contract.addr;
    name = contract.name;
  }

  return {
    ...original,
    Contract: MockContract,
    JsonRpcProvider: MockJsonRpcProvider,
  };
});

import {
  DnnsResolutionError,
  lookupAddress,
  resolveName,
} from '@/lib/dnns';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const RESOLVER_ADDRESS = '0xc0F0849e09Df12E54fe4345ab4535B1F521f2190';
const OWNER_ADDRESS = '0xE9267bDf7084815B0754545049AE45FE744Aefa8';

beforeEach(() => {
  contract.resolver.mockReset();
  contract.addr.mockReset();
  contract.name.mockReset();
});

describe('DNNS resolver safety', () => {
  it('returns a checksummed forward address and null for an unset name', async () => {
    contract.resolver.mockResolvedValueOnce(RESOLVER_ADDRESS);
    contract.addr.mockResolvedValueOnce(OWNER_ADDRESS.toLowerCase());
    await expect(resolveName(' Makalu.LITHO ')).resolves.toBe(OWNER_ADDRESS);

    contract.resolver.mockResolvedValueOnce(ZERO_ADDRESS);
    await expect(resolveName('missing.litho')).resolves.toBeNull();
  });

  it('does not retain a process-lifetime negative result', async () => {
    contract.resolver
      .mockResolvedValueOnce(ZERO_ADDRESS)
      .mockResolvedValueOnce(RESOLVER_ADDRESS);
    contract.addr.mockResolvedValueOnce(OWNER_ADDRESS);

    await expect(resolveName('new-record.litho')).resolves.toBeNull();
    await expect(resolveName('new-record.litho')).resolves.toBe(OWNER_ADDRESS);
  });

  it('distinguishes an RPC failure from an unset name', async () => {
    contract.resolver.mockRejectedValueOnce(new Error('RPC unavailable'));
    await expect(resolveName('makalu.litho')).rejects.toBeInstanceOf(DnnsResolutionError);
  });

  it('accepts a reverse name only when it resolves back to the address', async () => {
    contract.resolver.mockResolvedValue(RESOLVER_ADDRESS);
    contract.name.mockResolvedValueOnce('Makalu.LITHO');
    contract.addr.mockResolvedValueOnce(OWNER_ADDRESS);

    await expect(lookupAddress(OWNER_ADDRESS)).resolves.toBe('makalu.litho');
  });

  it('rejects an unverified or out-of-scope reverse name', async () => {
    contract.resolver.mockResolvedValue(RESOLVER_ADDRESS);
    contract.name
      .mockResolvedValueOnce('makalu.litho')
      .mockResolvedValueOnce('example.eth');
    contract.addr.mockResolvedValueOnce('0x1111111111111111111111111111111111111111');

    await expect(lookupAddress(OWNER_ADDRESS)).resolves.toBeNull();
    await expect(lookupAddress(OWNER_ADDRESS)).resolves.toBeNull();
  });
});
