import type { NextConfig } from 'next';

// Cabeceras de defensa en profundidad: el checkout captura PAN/CVC en la propia página
// (PaymentStep), así que como mínimo no debe poder enmarcarse (clickjacking) ni filtrar la
// URL por Referer. La CSP se limita a directivas que Next respeta sin nonces: una CSP completa
// de `script-src` exige generar un nonce por request (proxy/middleware) y queda fuera del
// alcance del starter.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  // Las imágenes del API ya llegan optimizadas ({ thumb, md, lg } en WebP), así que no
  // pasamos por el optimizador de Next (que además no corre en Cloudflare Workers).
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
