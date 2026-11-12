/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve AVIF where supported (much smaller than WebP for the large side images), WebP otherwise
    formats: ["image/avif", "image/webp"],
    // Optimized images are content-hashed by URL, so cache them for a year
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
};

export default nextConfig;
