const withPWA = require('next-pwa')({
  dest: 'public',
  sw: 'sw.js',
  swSrc: 'src/sw.js',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*',     destination: 'http://localhost:3001/api/:path*' },
      { source: '/uploads/:path*', destination: 'http://localhost:3001/uploads/:path*' },
    ];
  },
};

module.exports = withPWA(nextConfig);
