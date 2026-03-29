import type { AppProps } from 'next/app';
import Layout from '@/components/Layout';
import { WalletProvider } from '@/context/WalletContext';
import '@/styles/globals.css';

export default function ExplorerApp({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </WalletProvider>
  );
}
