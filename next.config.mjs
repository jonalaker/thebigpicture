/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Increase body size limit for file uploads (2GB on AWS EC2)
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
}

export default nextConfig
