import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, lookupAddress, resolveName } = vi.hoisted(() => ({
  push: vi.fn(),
  lookupAddress: vi.fn(),
  resolveName: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/dnns', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/dnns')>();
  return { ...original, lookupAddress, resolveName };
});

import DnnsName from '@/components/DnnsName';
import SearchBar from '@/components/SearchBar';
import { isDnnsName, namehash, normalizeDnnsName } from '@/lib/dnns';

beforeEach(() => {
  push.mockReset();
  lookupAddress.mockReset();
  resolveName.mockReset();
});

describe('DNNS integration', () => {
  it('recognizes .litho names case-insensitively and hashes deterministically', () => {
    expect(isDnnsName('Alice.LITHO')).toBe(true);
    expect(isDnnsName('alice.eth')).toBe(false);
    expect(isDnnsName('ab.litho')).toBe(false);
    expect(isDnnsName('sub.alice.litho')).toBe(false);
    expect(isDnnsName('-alice.litho')).toBe(false);
    expect(normalizeDnnsName(' Alice.LITHO ')).toBe('alice.litho');
    expect(namehash('alice.litho')).toMatch(/^0x[0-9a-f]{64}$/);
    expect(namehash('alice.litho')).toBe(namehash('alice.litho'));
  });

  it('resolves a .litho search into an address route', async () => {
    resolveName.mockResolvedValue('0x1111111111111111111111111111111111111111');
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(/block, tx, address/i), {
      target: { value: 'alice.litho' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!);
    await waitFor(() => {
      expect(resolveName).toHaveBeenCalledWith('alice.litho');
      expect(push).toHaveBeenCalledWith('/address/0x1111111111111111111111111111111111111111');
    });
  });

  it('shows an unset-name error without navigating', async () => {
    resolveName.mockResolvedValue(null);
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(/block, tx, address/i), {
      target: { value: 'missing.litho' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!);
    expect(await screen.findByText(/No address is set for missing\.litho/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('rejects a malformed .litho name without querying or navigating', async () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(/block, tx, address/i), {
      target: { value: 'sub.alice.litho' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!);
    expect(await screen.findByText(/Invalid \.litho name/)).toBeInTheDocument();
    expect(resolveName).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('reverse-resolves an EVM address for display', async () => {
    lookupAddress.mockResolvedValue('alice.litho');
    render(<DnnsName address="0x1111111111111111111111111111111111111111" />);
    expect(await screen.findByText('alice.litho')).toBeInTheDocument();
  });

  it('does not query reverse resolution for invalid addresses', () => {
    render(<DnnsName address="litho1invalid" />);
    expect(lookupAddress).not.toHaveBeenCalled();
  });
});
