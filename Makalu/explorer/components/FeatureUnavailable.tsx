import Head from 'next/head';

import { NETWORK } from '@/lib/network';

export default function FeatureUnavailable({ feature }: { feature: string }) {
  return (
    <>
      <Head>
        <title>{feature} unavailable | {NETWORK.explorerTitle}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <section className="mx-auto max-w-2xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center shadow-sm">
        <img src={NETWORK.logoPath} alt="LITHO" className="mx-auto h-16 w-16 rounded-full" />
        <h1 className="mt-5 text-3xl font-semibold">{feature} is not enabled</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">A verified {NETWORK.shortName} deployment has not been configured for this feature.</p>
      </section>
    </>
  );
}
