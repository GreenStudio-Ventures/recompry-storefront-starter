import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Las imágenes del API ya llegan optimizadas ({ thumb, md, lg } en WebP), así que no
  // pasamos por el optimizador de Next (que además no corre en Cloudflare Workers).
  images: { unoptimized: true },
};

export default nextConfig;
