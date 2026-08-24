import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Sin caché incremental: el storefront renderiza dinámico contra el API en cada request.
// Si quieres ISR/caché en el edge, agrega un binding R2/KV y configura `incrementalCache`
// (ver https://opennext.js.org/cloudflare/caching).
export default defineCloudflareConfig({
  enableCacheInterception: false,
});
