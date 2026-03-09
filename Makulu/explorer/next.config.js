/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  // Proxy /api/* calls to the API service.
  // In Docker Compose the API container is reachable at http://api:4000.
  // In production, nginx handles routing — these rewrites are a fallback
  // so the explorer works correctly without an external reverse proxy.
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
