/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Build naj ne pade zaradi lint opozoril (npr. <img> namesto next/image).
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
