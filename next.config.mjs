/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    domains: [process.env.NEXT_PUBLIC_SUPABASE_KEY],
  },
};

export default nextConfig;
