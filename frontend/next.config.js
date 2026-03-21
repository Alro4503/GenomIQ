/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Optimizations of performance
  poweredByHeader: false,
  compress: true,

  // Configuration to redirect API requests to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*',
      }
    ];
  }
};

module.exports = nextConfig;