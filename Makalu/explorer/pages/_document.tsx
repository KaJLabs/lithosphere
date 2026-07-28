import { Html, Head, Main, NextScript } from 'next/document';

import { NETWORK } from '@/lib/network';

export default function Document() {
  return (
    <Html lang="en" data-network={NETWORK.mode}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content={NETWORK.defaultTheme === 'light' ? '#f4f7fb' : '#06080d'} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && ${NETWORK.defaultTheme === 'dark'})) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
        <link rel="icon" href={NETWORK.faviconPath} />
        <link rel="apple-touch-icon" href={NETWORK.faviconPath} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
