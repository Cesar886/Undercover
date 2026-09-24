import nextPWA from 'next-pwa';
import defaultRuntimeCaching from 'next-pwa/cache.js';

const withPWA = nextPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /\/(?:api\/image-admin(?:\/|\?|$)|imagenes-dnewjlfe99474ef8wu-admin(?:\/|\?|$))/,
      handler: 'NetworkOnly',
    },
    ...defaultRuntimeCaching,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mantine/core', '@mantine/hooks'],
  async headers() {
    return [
      {
        source: '/imagenes-dnewjlfe99474ef8wu-admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/image-admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Next.js 14 exposes this option under experimental.
  // Prevent Next.js from bundling packages with native binaries.
  experimental: {
    serverComponentsExternalPackages: [
      '@imgly/background-removal-node',
      'onnxruntime-node',
      'sharp',
      'node-webpmux',
    ],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // webpack-level externals — runs before Next.js module resolution.
      // Required for packages that use native .node binaries (ONNX, sharp).
      const natives = ['@imgly/background-removal-node', 'onnxruntime-node', 'sharp', 'node-webpmux'];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        ...natives,
      ];
    }
    return config;
  },
};

export default withPWA(nextConfig);
