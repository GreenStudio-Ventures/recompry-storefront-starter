// Destino post-login (`?next=`) saneado. Comparar prefijos (`startsWith('/')`) no basta: el
// parser WHATWG trata `\` como `/` en esquemas especiales, así que `/\evil.com` pasa un guard
// ingenuo y el browser lo resuelve a `https://evil.com/` (open redirect justo tras autenticarse).
// Por eso normalizamos con `new URL()` contra un origen centinela y solo aceptamos rutas que
// sigan viviendo en ese origen.

const SENTINEL_ORIGIN = 'https://x.invalid';
const LOGIN_PATH = '/account/login';

export function safeNextPath(next: string | null | undefined, fallback = '/account'): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return fallback;
  let url: URL;
  try {
    url = new URL(next, SENTINEL_ORIGIN);
  } catch {
    return fallback;
  }
  // Si el parser cambió de origen, `next` era `//host`, `/\host`, un esquema, etc.
  if (url.origin !== SENTINEL_ORIGIN || !url.pathname.startsWith('/')) return fallback;
  // El parser colapsa `.`/`..` pero conserva segmentos vacíos: `/.//evil.com` queda con
  // pathname `//evil.com`, que como Location es protocol-relative => otro host. Tampoco
  // aceptamos `\` residual ni nada que, re-parseado, cambie de origen o de path.
  if (url.pathname.startsWith('//') || url.pathname.includes('\\')) return fallback;
  const result = `${url.pathname}${url.search}${url.hash}`;
  try {
    const again = new URL(result, SENTINEL_ORIGIN);
    if (again.origin !== SENTINEL_ORIGIN || again.pathname !== url.pathname) return fallback;
  } catch {
    return fallback;
  }
  // Volver al login desde el login produce un bucle de redirecciones.
  if (url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`)) return fallback;
  return result;
}
