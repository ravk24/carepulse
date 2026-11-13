/** @type {import('next').NextConfig} */
const nextConfig = {
  // E2E tests build into a separate folder (see playwright.config.ts), so a test build that points
  // at the local Supabase can never be mistaken for the real build by a later `npm start`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // Serve AVIF where supported (much smaller than WebP for the large side images), WebP otherwise
    formats: ["image/avif", "image/webp"],
    // Optimized images are content-hashed by URL, so cache them for a year
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
};

export default nextConfig;
