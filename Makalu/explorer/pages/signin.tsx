import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect, useState } from 'react';

import { EXPLORER_TITLE } from '@/lib/constants';
import { NETWORK } from '@/lib/network';

// Client-only: the SDK probes window/EIP-6963 on mount.
const ThanosSignIn = dynamic(() => import('@/components/ThanosSignIn'), { ssr: false });
const NetworkSetupCard = dynamic(() => import('@/components/NetworkSetupCard'), { ssr: false });

export default function SignInPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return (
    <>
      <Head>
        <title>Sign In | {EXPLORER_TITLE}</title>
      </Head>
      <div className="text-white">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              Authentication
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Sign in with Thanos</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-white/70">
              Authenticate with your Thanos wallet using a single signature (Sign-In With
              Ethereum). No transaction, no gas — just a signed message that proves you control
              your address on {NETWORK.label}.
            </p>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <ThanosSignIn />
            <p className="mt-5 text-xs leading-5 text-white/45">
              Don&apos;t have Thanos? The button links to the install page. Any Thanos wallet that
              announces itself via EIP-6963 (<code className="text-white/60">fi.thanos.wallet</code>)
              is detected automatically — for everyday connect + signing you can also use the wallet
              button in the header.
            </p>
          </section>

          <div className="mt-6">
            <NetworkSetupCard />
          </div>
        </div>
      </div>
    </>
  );
}
