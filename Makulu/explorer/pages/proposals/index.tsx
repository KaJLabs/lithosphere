import Head from 'next/head';
import Link from 'next/link';
import { EXPLORER_TITLE } from '@/lib/constants';

export default function ProposalsPage() {
  return (
    <>
      <Head><title>Governance Proposals | {EXPLORER_TITLE}</title></Head>
      <h1 className="text-2xl font-bold mb-6">Governance Proposals</h1>
      <div className="card p-8 text-center text-[var(--color-text-muted)]">
        <p className="mb-2">Governance tracking is coming soon.</p>
        <Link href="/" className="text-litho-400 hover:text-litho-300">Back to explorer &rarr;</Link>
      </div>
    </>
  );
}
