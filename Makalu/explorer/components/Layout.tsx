import { ReactNode } from 'react';

import { NETWORK } from '@/lib/network';

import Footer from './Footer';
import Header from './Header';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={`network-shell min-h-screen flex flex-col ${NETWORK.isMainnet ? 'network-mainnet' : 'network-testnet'}`}>
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
