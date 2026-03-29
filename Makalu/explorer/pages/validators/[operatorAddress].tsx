import Head from 'next/head';
import Link from 'next/link';
import { EXPLORER_TITLE } from '@/lib/constants';

export default function ValidatorDetailPage() {
  return (
    <>
      <Head><title>Validator | {EXPLORER_TITLE}</title></Head>
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-6">
        <Link href="/" className="hover:text-litho-400">Home</Link><span>/</span>
        <Link href="/validators" className="hover:text-litho-400">Validators</Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Validator Details</h1>
      <div className="card p-8 text-center text-[var(--color-text-muted)]">
        <p className="mb-2">Individual validator detail pages are coming soon.</p>
        <Link href="/validators" className="text-litho-400 hover:text-litho-300">View all validators &rarr;</Link>
      </div>
    </>
  );
}
