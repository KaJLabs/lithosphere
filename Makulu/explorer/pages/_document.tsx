import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && true)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
