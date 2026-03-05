import Head from 'next/head';
import Link from 'next/link';
import { EXPLORER_TITLE } from '@/lib/constants';

export default function EvmTransactionDetailPage() {
  return (
    <>
      <Head><title>EVM Transaction Details | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">EVM transaction details coming soon</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            This page is under construction.
          </p>
          <Link href="/blocks" className="text-litho-400 hover:underline">
            Back to Blocks
          </Link>
        </div>
      </div>
    </>
  );
}
