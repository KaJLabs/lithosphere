/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },

  // Permanent redirects for common URL aliases (singular → plural routes).
  // External links and block explorers often use /tx/, /block/, etc.
  async redirects() {
    return [
      { source: '/tx/:hash',         destination: '/txs/:hash',         permanent: true },
      { source: '/transaction/:hash',destination: '/txs/:hash',         permanent: true },
      { source: '/block/:height',    destination: '/blocks/:height',    permanent: true },
      { source: '/validator/:addr',  destination: '/validators/:addr',  permanent: true },
      { source: '/contract/:addr',   destination: '/contracts/:addr',   permanent: true },
      { source: '/proposal/:id',     destination: '/proposals/:id',     permanent: true },
      { source: '/evm-tx/:hash',     destination: '/evm-txs/:hash',     permanent: true },
      { source: '/account/:addr',    destination: '/address/:addr',     permanent: true },
      { source: '/addr/:addr',       destination: '/address/:addr',     permanent: true },
    ];
  },

  // Proxy /api/* calls to the API service.
  // In Docker Compose the API container is reachable at http://api:4000.
  // In production, nginx handles routing — these rewrites are a fallback
  // so the explorer works correctly without an external reverse proxy.
  // In production, nginx routes /api/* to our API on :8080 (mapped from :4000).
  // These rewrites are a fallback for local dev where nginx isn't present.
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || 'http://api:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/graphql',
        destination: `${apiUrl}/graphql`,
      },
    ];
  },
};

module.exports = nextConfig;
