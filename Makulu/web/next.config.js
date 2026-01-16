/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        source: '/graphql',
        destination: 'http://localhost:4000/graphql',
      },
    ];
  },
};

module.exports = nextConfig;
