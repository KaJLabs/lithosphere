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
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || 'http://api:4000';
    return [
      // /_api/* is our internal proxy path. External nginx intercepts /api/*
      // and routes it to the validator's Fastify API on :8080. By using /_api/*
      // from the frontend, requests reach the Next.js server first (via nginx
      // routing / → :3100), which then rewrites them to our Express API on :4000.
      {
        source: '/_api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      // Also keep /api/* rewrite as fallback (works when nginx doesn't intercept)
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
