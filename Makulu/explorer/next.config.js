/** @type {import('next').NextConfig} */
// API_INTERNAL_URL is the server-side proxy target (Docker service name).
// NEXT_PUBLIC_* vars are client-side only and must NOT be used as proxy destinations
// because they get baked in as the external domain (https://makalu.litho.ai/...)
// which the container cannot route back to itself.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://api:4000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
      {
        source: '/graphql',
        destination: `${API_INTERNAL_URL}/graphql`,
      },
    ];
  },
};

module.exports = nextConfig;
