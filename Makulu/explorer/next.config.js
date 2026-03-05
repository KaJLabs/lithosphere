/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  // No rewrites needed: browser calls /api/* which nginx routes
  // directly to the Fastify API on port 8080.
};

module.exports = nextConfig;
