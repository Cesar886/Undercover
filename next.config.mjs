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
  serverExternalPackages: ['@imgly/background-removal-node', 'sharp', 'node-webpmux'],
};

export default withPWA(nextConfig);
