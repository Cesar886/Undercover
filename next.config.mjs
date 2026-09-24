import nextPWA from 'next-pwa';

const withPWA = nextPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mantine/core', '@mantine/hooks'],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Prevent Next.js from bundling packages with native binaries
  serverExternalPackages: ['@imgly/background-removal-node', 'onnxruntime-node', 'sharp', 'node-webpmux'],
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
