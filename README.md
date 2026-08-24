# Recompry Storefront Starter

Tienda online lista para personalizar, construida **solo** sobre el [API público de Recompry](https://api.recompry.com/docs)
(estilo Hydrogen/Dawn de Shopify). Next.js 16 (App Router, React 19, TypeScript estricto, Tailwind) desplegada en
**Cloudflare Workers** con OpenNext.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/GreenStudio-Ventures/recompry-storefront-starter)

Qué incluye:

| Ruta | Qué hace | Endpoints del API |
|---|---|---|
| `/` | Branding, categorías, destacados y sedes | `GET /v1/store`, `/v1/products`, `/v1/locations`, `/v1/categories` |
| `/c/[slug]` | Categoría paginada por cursor | `GET /v1/products?category=` |
| `/search?q=` | Búsqueda tolerante a tildes/typos | `GET /v1/search` |
| `/p/[slug]` | Producto: galería, variantes, extras, suscripción, lista de espera | `GET /v1/products/{slug}?include=variants,modifiers,subscription_plans` |
| `/cart` | Carrito local (localStorage) con totales reales, cupón, propina, modo de entrega | `POST /v1/cart/quote` |
| `/checkout` | Cobertura de envío, datos, pago (contraentrega o tarjeta Wompi) | `POST /v1/shipping/quote`, `POST /v1/orders`, `GET /v1/payments/config`, `POST /v1/orders/{id}/payments` |
| `/track/[code]` | Seguimiento público con línea de tiempo (auto-refresh) | `GET /v1/tracking/{code}` |
| `/account` | Login OTP por email, perfil, pedidos, direcciones, suscripciones, puntos, créditos, lista de espera | `POST /v1/auth/otp/*`, `GET /v1/customers/me`, `…/addresses`, `GET /v1/orders?customer=me`, `/v1/subscriptions`, `/v1/loyalty/balance`, `/v1/credits`, `/v1/waitlist` |
| `/api/webhooks/recompry` | Receptor de webhooks con verificación HMAC y dedupe | `X-Recompry-Signature` |

## 1. Consigue tus keys

En el dashboard del negocio (**app.recompry.com → Configuración → API keys**) emite:

- una **publishable key** `rcp_pk_…` (solo lectura: tienda, catálogo, búsqueda, cotizaciones, tracking), y
- una **secret key** `rcp_sk_…` con los scopes que use tu tienda: `orders:read`, `orders:write`, `customers:read`,
  `customers:write`, `payments:write`, `subscriptions:read`, `subscriptions:write`, `loyalty:read`.

Empieza con keys `*_test_*`: son de **solo lectura** sobre los datos reales (el catálogo se ve, pero crear órdenes
responde 403 — es lo esperado). Cambia a `*_live_*` para vender. Guía completa: <https://api.recompry.com/docs>.

## 2. Variables de entorno

```bash
cp .env.example .env.local     # next dev
cp .env.example .dev.vars      # wrangler dev / npm run preview
```

| Variable | Dónde se usa | Descripción |
|---|---|---|
| `RECOMPRY_PUBLISHABLE_KEY` | Servidor (render) | `rcp_pk_*`. Lecturas públicas. Puedes duplicarla como `NEXT_PUBLIC_RECOMPRY_PUBLISHABLE_KEY` si quieres llamar al API directo desde el browser (es segura: CORS `*`, sin escritura). |
| `RECOMPRY_SECRET_KEY` | Solo route handlers | `rcp_sk_*`. **Nunca** llega al browser (`src/lib/recompry/server.ts` importa `server-only`). |
| `NEXT_PUBLIC_RECOMPRY_API_URL` | Ambos | Base del API (`https://api.recompry.com`). |
| `RECOMPRY_WEBHOOK_SECRET` | Webhook | `whsec_…` que devuelve `POST /v1/webhook-endpoints` una sola vez. |

Nunca commitees `.env*` (solo `.env.example` está versionado).

## 3. Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest (verificación HMAC de webhooks)
npm run lint
```

Estructura:

```
src/
  app/                    # rutas (App Router) + route handlers en app/api/*
  components/             # UI (Tailwind), carrito, checkout, cuenta, tracking
  lib/recompry/           # SDK tipado (index.ts + schema.d.ts), client.ts (pk), server.ts (sk),
                          # session.ts (cookie del comprador), webhooks.ts (HMAC), errors.ts (envelope)
  lib/cart/               # carrito en localStorage + hook de cotización
  lib/store.ts            # lecturas cacheadas por request (store, categorías, productos)
```

`src/lib/recompry/index.ts` y `schema.d.ts` son una copia de `@recompry/api-client` (openapi-fetch + tipos generados
desde `/v1/openapi.json`). Cuando el paquete esté en npm, instálalo y borra la copia.

### Cómo fluye una compra

1. El carrito vive en el browser (ids + cantidades). Cada cambio llama `POST /api/cart/quote` → `POST /v1/cart/quote`:
   el servidor calcula precios, descuentos, cupón, envío, propina e impuestos, y reporta `issues` (agotado, sin
   cobertura, cupón inválido…). **Ningún monto del cliente se acepta** salvo propina/canjes (acotados).
2. `/checkout` crea la orden con `POST /api/orders` (key secreta) enviando un header `Idempotency-Key` generado en el
   browser por intento: reintentar devuelve la misma orden; cambiar el body genera otra key.
3. Contraentrega → la orden queda confirmada y redirige a `/track/{tracking_code}`.
4. Tarjeta (Wompi) → `PaymentStep` lee `GET /v1/payments/config` (llave pública + ambiente), tokeniza la tarjeta en el
   browser y llama `POST /api/orders/{id}/payments`; si el pago queda `pending` (3DS) sondea `GET …/payment`.

### Sesión del comprador

`POST /api/auth/otp/send` y `…/verify` envuelven `POST /v1/auth/otp/*`. El `access_token`/`refresh_token` se guarda en
la cookie httpOnly `rcp_buyer`; los route handlers lo pasan en `X-Buyer-Token`. Cuando vence, `/api/auth/refresh` lo
renueva con `POST /v1/auth/refresh` (los server components no pueden reescribir cookies, por eso existe
`<SessionRefresher/>`).

## 4. Webhooks

1. Crea el endpoint (una vez, con una key que tenga `webhooks:manage`):

   ```bash
   curl -X POST https://api.recompry.com/v1/webhook-endpoints \
     -H "Authorization: Bearer rcp_sk_live_…" -H "Content-Type: application/json" \
     -H "Idempotency-Key: $(uuidgen)" \
     -d '{"url":"https://TU-DOMINIO/api/webhooks/recompry","events":["order.created","order.paid","order.stage_changed"]}'
   ```

   Guarda el `secret` (`whsec_…`) de la respuesta en `RECOMPRY_WEBHOOK_SECRET` — solo se muestra una vez.
2. Pruébalo localmente con `npm run dev` y, en otra terminal:

   ```bash
   npm run webhook:test                     # firma válida → 200 {"received":true}
   npm run webhook:test -- --bad-signature  # → 401 invalid_signature
   npm run webhook:test -- --old            # timestamp de hace 1 h → 401 (replay)
   ```

3. Desde el dashboard o con `POST /v1/webhook-endpoints/{id}/ping` puedes enviar un `ping` real; las entregas y
   reintentos se ven en `GET /v1/webhook-endpoints/{id}/deliveries`.

La verificación (`src/lib/recompry/webhooks.ts`) firma `t + "." + body crudo` con HMAC-SHA256, rechaza `t` con más de
5 minutos de diferencia y compara en tiempo constante. El dedupe por `event_id` es en memoria (por isolate): para
producción persiste los ids en KV/D1.

## 5. Deploy a Cloudflare Workers

```bash
npm run check          # gate: build OpenNext + tsc + tests + wrangler deploy --dry-run
npm run deploy         # build + wrangler deploy
```

Secretos en producción (nunca en `wrangler.jsonc`):

```bash
cp .env.example .env.production.secrets   # rellena con keys LIVE
npm run cf:secrets:bulk                   # = wrangler secret bulk .env.production.secrets
```

`wrangler.jsonc` no lleva `account_id`: usa el de tu sesión (`npx wrangler login`). Si tienes varias cuentas, agrégalo
ahí o exporta `CLOUDFLARE_ACCOUNT_ID`. `npm run preview` levanta el build real en `wrangler dev` (lee `.dev.vars`).

Con el botón **Deploy to Cloudflare** el repo se clona en tu cuenta y se despliega; después define los secretos en
*Workers → Settings → Variables* y vuelve a desplegar.

## Personalizar

- Colores: `GET /v1/store` → `branding.colors` alimenta las variables `--brand-*` (`src/lib/brand.ts`). Cambia la paleta
  base en `src/app/globals.css` y `tailwind.config.ts`.
- Modos de pedido y métodos de pago se leen de `online_order_types` / `payment_methods` de la tienda: la UI solo
  muestra lo que el negocio habilitó (`src/lib/store.ts`).
- Imágenes: el API entrega `{ thumb, md, lg }` en WebP; `<ApiImage/>` arma el `srcSet`. No hace falta el optimizador de Next.
- Moneda: `formatMoney()` usa `Intl.NumberFormat('es-CO')` con la `currency_code` de la tienda.

## Pendientes / TODO conocidos

- **Wompi**: `src/lib/wompi.ts` tokeniza con la llave pública contra `/v1/tokens/cards` de Wompi; verifica el flujo
  contra la documentación oficial o usa Wompi JS/Widget para reducir el alcance PCI. Falta el `session_id` anti-fraude.
- Solo `cash_on_delivery` y `wompi_cards` en el checkout; PSE, Nequi y Botón Bancolombia (`POST /v1/orders/{id}/payments`
  con `method: pse | nequi | bancolombia_button` y `async_payment_url`) no tienen UI todavía.
- Canje de créditos/puntos en el carrito (`credits_to_redeem_cents`, `loyalty_points_to_redeem`) no está expuesto en la UI.
- Direcciones guardadas no se usan aún en el checkout (solo texto libre geocodificado).
- Pedidos programados (`scheduled_for`) no tienen selector.
- Dedupe de webhooks en memoria (ver arriba).

## Troubleshooting

- **`sharp` falla al instalar en macOS** ("Attempting to build from source"): tienes un libvips global de Homebrew.
  Instala con `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install` (sharp es opcional: Next no lo usa en Workers).
- **La tienda no carga / pantalla "La tienda no pudo cargar"**: revisa las keys en `.env.local` y el `code` que muestra
  (`invalid_api_key`, `insufficient_scope`…). Toda respuesta del API trae `request_id`; inclúyelo al pedir soporte.
- **403 al crear órdenes**: estás usando una key `*_test_*` (solo lectura) o a la `rcp_sk_*` le falta `orders:write`.

## Licencia

MIT — ver [LICENSE](./LICENSE). Documentación del API: <https://api.recompry.com/docs> · Changelog: <https://api.recompry.com/docs/changelog>.
