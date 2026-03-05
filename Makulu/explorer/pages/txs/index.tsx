import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiFetch } from '@/lib/api';
import { EXPLORER_TITLE } from '@/lib/constants';
import type { ApiTx } from '@/lib/types';
import HashDisplay from '@/components/HashDisplay';
import { TxStatusBadge } from '@/components/Badges';
import ErrorState from '@/components/ErrorState';
import Loading from '@/components/Loading';

export default function TransactionsPage() {
  const [searchHash, setSearchHash] = useState('');
  const [tx, setTx] = useState<ApiTx | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const hash = searchHash.trim();
    if (!hash) return;
    router.push(`/txs/${hash}`);
  };

  return (
    <>
      <Head><title>Transactions | {EXPLORER_TITLE}</title></Head>
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>

      <div className="card p-6 mb-6">
        <p className="text-[var(--color-text-secondary)] mb-4">
          Search for a transaction by its hash, or view transactions within a specific block.
        </p>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={searchHash}
            onChange={(e) => setSearchHash(e.target.value)}
            placeholder="Enter transaction hash (0x...)"
            className="flex-1 px-4 py-2 text-sm rounded-lg
              bg-[var(--color-bg-primary)] border border-[var(--color-border)]
              text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
              focus:outline-none focus:border-litho-400 focus:ring-1 focus:ring-litho-400"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-litho-500 text-white rounded-lg hover:bg-litho-600 transition-colors text-sm font-medium"
          >
            Search
          </button>
        </form>
      </div>

      <div className="card p-6 text-center text-[var(--color-text-muted)]">
        <p>To see recent transactions, visit the <Link href="/blocks" className="text-litho-400 hover:text-litho-300">Blocks</Link> page
          and click on a block to see its transactions.</p>
      </div>
    </>
  );
}
