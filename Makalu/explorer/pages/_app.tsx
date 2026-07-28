import Layout from '@/components/Layout';
import NetworkSwitchModal from '@/components/NetworkSwitchModal';
import { WalletProvider } from '@/context/WalletContext';

import type { AppProps } from 'next/app';
import '@/styles/globals.css';

export default function ExplorerApp({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      {/* Global network-switch modal — shown on every page when wallet is on wrong chain */}
      <NetworkSwitchModal />
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </WalletProvider>
  );
}
