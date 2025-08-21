/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg']
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost', 'res.cloudinary.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    // Enable optimization in production
    unoptimized: process.env.NODE_ENV !== 'production',
  },
  // Do not inline secrets; read at runtime from process.env
}

export default nextConfig
