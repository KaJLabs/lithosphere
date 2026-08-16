import { useRouter } from 'next/router';
import { useState } from 'react';

import { isDnnsName, resolveName } from '@/lib/dnns';
import { isEvmAddress, isBech32Address, isValidatorAddress } from '@/lib/format';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const q = query.trim();
    if (!q) return;

    // DNNS name (e.g. alice.litho) → resolve to an address on Kamet, then route.
    if (q.toLowerCase().endsWith('.litho')) {
      if (!isDnnsName(q)) {
        setError('Invalid .litho name. Use one label of at least 3 letters, numbers, or hyphens.');
        return;
      }
      setResolving(true);
      try {
        const addr = await resolveName(q);
        if (addr) {
          router.push(`/address/${addr}`);
          setQuery('');
        } else {
          setError(`No address is set for ${q.toLowerCase()}`);
        }
      } catch {
        setError('Name resolution is unavailable right now.');
      } finally {
        setResolving(false);
      }
      return;
    }

    if (/^\d+$/.test(q)) {
      router.push(`/blocks/${q}`);
    } else if (q.startsWith('0x') && q.length === 66) {
      router.push(`/txs/${q}`);
    } else if (isEvmAddress(q)) {
      router.push(`/address/${q}`);
    } else if (isValidatorAddress(q)) {
      router.push(`/validators/${q}`);
    } else if (isBech32Address(q)) {
      router.push(`/address/${q}`);
    } else if (q.length === 64) {
      router.push(`/txs/${q}`);
    } else {
      router.push(`/txs/${q}`);
    }

    setQuery('');
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <div className="flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by block, tx, address, or name.litho..."
          className="w-full sm:w-56 lg:w-64 xl:w-72 min-w-0 px-4 py-2 pr-10 text-sm rounded-lg
            bg-[var(--color-bg-primary)] border border-[var(--color-border)]
            text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
            focus:outline-none focus:border-litho-400 focus:ring-1 focus:ring-litho-400
            transition-colors"
        />
        <button
          type="submit"
          disabled={resolving}
          className="absolute right-2 p-1 text-[var(--color-text-muted)] hover:text-litho-400 disabled:opacity-50"
          aria-label="Search"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
      {(resolving || error) && (
        <div className={`absolute mt-1 text-xs ${error ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
          {resolving ? 'Resolving name…' : error}
        </div>
      )}
    </form>
  );
}
