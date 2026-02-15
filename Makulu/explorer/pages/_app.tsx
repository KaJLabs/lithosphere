import type { AppProps } from 'next/app';

export default function ExplorerApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
