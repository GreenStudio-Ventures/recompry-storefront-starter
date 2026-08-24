// Cliente tipado del API público de Recompry (api.recompry.com).
//
// Copia local de `@recompry/api-client` (cf-re-sites/api/sdk) mientras el paquete no esté
// publicado en npm. Cuando lo esté: `npm i @recompry/api-client`, borra `index.ts` y
// `schema.d.ts` de esta carpeta e importa desde el paquete. `schema.d.ts` se genera con
// openapi-typescript desde https://api.recompry.com/v1/openapi.json.
import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export type { paths, components, operations } from './schema';

export type RecompryClientOptions = {
  /** `rcp_pk_*` (browser, solo lectura) o `rcp_sk_*` (servidor). */
  apiKey: string;
  /** access_token del comprador (Supabase Sites) para endpoints de cuenta. */
  buyerToken?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export function createRecompryClient(options: RecompryClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? 'https://api.recompry.com',
    fetch: options.fetch,
  });
  const auth: Middleware = {
    async onRequest({ request }) {
      request.headers.set('authorization', `Bearer ${options.apiKey}`);
      if (options.buyerToken) request.headers.set('x-buyer-token', options.buyerToken);
      return request;
    },
  };
  client.use(auth);
  return client;
}

export type RecompryClient = ReturnType<typeof createRecompryClient>;
