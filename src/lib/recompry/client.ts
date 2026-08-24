// Cliente con la key PUBLICABLE (rcp_pk_*): solo lectura (tienda, catálogo, búsqueda,
// cotizaciones, tracking). Sirve en server components y route handlers. Si defines
// NEXT_PUBLIC_RECOMPRY_PUBLISHABLE_KEY también funciona en el browser (la pk es segura
// de exponer: CORS * y sin escritura), pero este starter no lo necesita: todo lo dinámico
// pasa por route handlers para poder adjuntar la sesión del comprador (cookie httpOnly).
import { createRecompryClient, type RecompryClient } from './index';

// Base del API. Por defecto no hace falta configurarla. Para un entorno propio hay dos vías y NO
// se mezclan: si NEXT_PUBLIC_RECOMPRY_API_URL está en .env.local / .env.production al hacer el
// build, Next la inlinea en el bundle y el `vars` de wrangler.jsonc deja de tener efecto; si no
// está al compilar, el Worker la lee en runtime del binding `vars`. No la subas como secreto
// (`cf:secrets:bulk`): colisiona con el binding de `vars` del mismo nombre.
export const RECOMPRY_API_URL = process.env.NEXT_PUBLIC_RECOMPRY_API_URL || 'https://api.recompry.com';

let cached: RecompryClient | null = null;

function publishableKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_RECOMPRY_PUBLISHABLE_KEY || process.env.RECOMPRY_PUBLISHABLE_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta RECOMPRY_PUBLISHABLE_KEY. Emite una key rcp_pk_* en app.recompry.com → Configuración → API keys y ponla en .env.local',
    );
  }
  return apiKey;
}

/**
 * Cliente de lectura. Con `buyerToken` (access_token del comprador) los endpoints que lo
 * aceptan (p.ej. `POST /v1/cart/quote`) habilitan créditos/puntos del comprador.
 */
export function publicApi(buyerToken?: string | null): RecompryClient {
  if (buyerToken) return createRecompryClient({ apiKey: publishableKey(), baseUrl: RECOMPRY_API_URL, buyerToken });
  if (cached) return cached;
  cached = createRecompryClient({ apiKey: publishableKey(), baseUrl: RECOMPRY_API_URL });
  return cached;
}
