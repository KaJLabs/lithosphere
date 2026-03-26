import Head from 'next/head';
import Link from 'next/link';
import { EXPLORER_TITLE } from '@/lib/constants';

export default function EvmTransactionsPage() {
  return (
    <>
      <Head><title>Transactions | {EXPLORER_TITLE}</title></Head>
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>
      <div className="card p-8 text-center text-[var(--color-text-muted)]">
        <p className="mb-2">EVM transaction indexing is coming soon.</p>
        <Link href="/blocks" className="text-litho-400 hover:text-litho-300">View blocks &rarr;</Link>
      </div>
    </>
  );
}
