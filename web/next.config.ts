import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/:path*` }]);
  },
};

export default nextConfig;
