import Head from 'next/head';
import Link from 'next/link';
import { EXPLORER_TITLE } from '@/lib/constants';

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page Not Found | {EXPLORER_TITLE}</title>
      </Head>
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl font-bold text-[var(--color-text-muted)] mb-4">404</div>
        <h1 className="text-xl font-semibold mb-2">Page Not Found</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-litho-400 text-white hover:bg-litho-500 transition-colors text-sm"
        >
          Back to Explorer
        </Link>
      </div>
    </>
  );
}
