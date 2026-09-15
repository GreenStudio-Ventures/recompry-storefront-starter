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
| `/api/webhooks/recompry` | Receptor de webhooks (endpoints del API y Automatizaciones del dashboard) con verificación HMAC y dedupe | `X-Recompry-Signature` |

## 1. Consigue tus keys

> **Las keys son de Recompry, no de Supabase.** Un integrador nunca toca la base de datos: todo pasa por
> `https://api.recompry.com` con una key `rcp_…` que emite el dueño de la tienda.

**¿Solo quieres verlo correr?** `cp .env.example .env.local && npm run dev`: el archivo ya trae la key de la
**tienda demo pública** (Greenstudio Store, 690 productos reales, solo lectura). Catálogo, búsqueda, ficha de
producto, carrito y cotización de envío funcionan sin registrarte. El checkout no: necesita una key secreta tuya.

**Para vender necesitas tu propia tienda.** Tres situaciones:

| Tu caso | Qué hacer |
|---|---|
| Ya tienes tienda en Recompry | Entra a [app.recompry.com](https://app.recompry.com) → **Configuración → API keys** (menú visible para **owner/admin**) y emite las dos keys de abajo. |
| Construyes para un cliente | Pídele a quien administra la tienda que emita las keys y te las comparta. Los scopes se fijan al crear: dile que use el preset **«Ventas»**. |
| No tienes tienda todavía | Crea una en [app.recompry.com](https://app.recompry.com) (acceso por correo, sin contraseña) y completa el onboarding; al terminar eres owner y ya puedes emitir keys. |

En **Configuración → API keys** emite:

- una **publishable key** `rcp_pk_…`: scopes fijos de solo lectura (`store:read`, `catalog:read`, `shipping:read`) para
  tienda, catálogo, búsqueda, cotizaciones y tracking, y
- una **secret key** `rcp_sk_…`. Al crearla pulsa el preset **«Ventas»** (o marca los scopes a mano): marca `orders:write`,
  `customers:write`, `payments:write` y `subscriptions:write`. Los scopes de lectura (`store:read`, `catalog:read`,
  `inventory:read`, `shipping:read`, `orders:read`, `customers:read`, `subscriptions:read`, `loyalty:read`) van
  **siempre incluidos** y no se pueden quitar (el starter usa `store:read` para renovar la sesión y `catalog:read`
  para la lista de espera). Añade `webhooks:manage` a mano solo si vas a registrar endpoints de webhook por API (§4a).

Ten en cuenta:

- Los scopes se fijan al crear la key y no se editan después. Si la emitiste sin escrituras (o antes de que el formulario
  tuviera el selector de scopes: esas keys nacieron solo con `:read`), **emite una nueva** con los scopes correctos y
  revoca la anterior.
- Un **`403 insufficient_scope`** significa exactamente eso: a la key le falta el scope que exige el endpoint. La
  respuesta lo nombra (`error: "La key no tiene el scope orders:write."`, `details.required_scope`). No es un error de
  tu código ni del body.
- Empieza con keys `*_test_*`: son de **solo lectura** sobre los datos reales (el catálogo se ve, pero crear órdenes
  responde `403 test_token_readonly` — es lo esperado). Cambia a `*_live_*` para vender. Guía completa:
  <https://api.recompry.com/docs>.

## 2. Variables de entorno

```bash
cp .env.example .env.local     # next dev
cp .env.example .dev.vars      # wrangler dev / npm run preview
```

`.env.example` contiene **solo lo que tú configuras**:

| Variable | Dónde se usa | Descripción |
|---|---|---|
| `RECOMPRY_PUBLISHABLE_KEY` | Servidor (render) | `rcp_pk_*`. Lecturas públicas. Puedes duplicarla como `NEXT_PUBLIC_RECOMPRY_PUBLISHABLE_KEY` si quieres llamar al API directo desde el browser (es segura: CORS `*`, sin escritura). |
| `RECOMPRY_SECRET_KEY` | Solo route handlers | `rcp_sk_*` con los scopes de §1. **Nunca** llega al browser (`src/lib/recompry/server.ts` importa `server-only`). |
| `RECOMPRY_WEBHOOK_SECRET` | Webhook (opcional) | `whsec_…` que devuelve una sola vez `POST /v1/webhook-endpoints` o la Automatización del dashboard (§4). Sin él, `/api/webhooks/recompry` responde `500 webhook_not_configured`. |

La base del API (`https://api.recompry.com`) **no** va en `.env`: ya está como `NEXT_PUBLIC_RECOMPRY_API_URL` en `vars`
de `wrangler.jsonc`, y `src/lib/recompry/client.ts` usa ese mismo valor como fallback. Si necesitas apuntar a otro
entorno, elige **una** vía (no se mezclan):

- `NEXT_PUBLIC_RECOMPRY_API_URL=…` en `.env.local` / `.env.production`: Next la **inlinea en el build**; a partir de ahí
  el `vars` de `wrangler.jsonc` deja de tener efecto hasta que vuelvas a compilar.
- Cambiarla en `vars` de `wrangler.jsonc`: el Worker la lee en **runtime**, siempre que la variable NO estuviera
  definida en tu entorno al compilar.

Nunca la subas como secreto (ver §5). Nunca commitees `.env*` (solo `.env.example` y `.env.production.secrets.example`
están pensados para versionarse).

## 3. Desarrollo

Requiere **Node ≥ 20.12** (`engines` en `package.json`; `scripts/send-test-webhook.mjs` usa `process.loadEnvFile`).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest (webhooks: firma HMAC + ambos payloads; guardas OTP; órdenes invitadas…)
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
4. Pago online (Wompi) → `PaymentStep` lee `GET /v1/payments/config` (llave pública + ambiente) y pinta el formulario
   del método con el que se creó la orden (`PaymentForms.tsx`). Todos cobran por `POST /api/orders/{id}/payments` con
   `Idempotency-Key`:
   - **Tarjeta**: tokeniza en el browser y manda `browser_info` → el cobro se pide con **3-D Secure v2**. Mientras el
     pago esté `pending` sondea `GET …/payment` cada 2,5 s y monta `three_ds.render_html` en un iframe: BROWSER_INFO y
     FINGERPRINT ocultos (se ejecutan solos), CHALLENGE visible para que el comprador responda a su banco.
   - **PSE**: selector de banco (`GET /api/payments/pse-institutions`), tipo de persona, documento y contacto →
     llega `async_payment_url` → **navegación completa** al portal del banco.
   - **Nequi**: celular → el comprador aprueba el push en su app; no hay a dónde redirigir, solo se sondea.
   - **Botón Bancolombia**: solo cuentas personales (las empresariales van por PSE) → `async_payment_url` → redirect.
5. El banco devuelve al comprador a **`/pago/{order_id}?t={tracking_code}`** (`PaymentReturn.tsx`), que sondea hasta
   `final: true`. El retorno no trae nada fiable en la URL: la verdad siempre sale del sondeo, que además reconcilia la
   venta en el API. Aprobado → vacía el carrito y va a `/track`; rechazado → la orden quedó **anulada**, hay que hacer
   un pedido nuevo; si se agota el sondeo no se ofrece reintentar (el webhook de Wompi cierra el caso).

### Sesión del comprador

`POST /api/auth/otp/send` y `…/verify` envuelven `POST /v1/auth/otp/*`. El `access_token`/`refresh_token` se guarda en
la cookie httpOnly `rcp_buyer`; los route handlers lo pasan en `X-Buyer-Token`. Cuando vence, `/api/auth/refresh` lo
renueva con `POST /v1/auth/refresh` (los server components no pueden reescribir cookies, por eso existe
`<SessionRefresher/>`).

## 4. Webhooks

Recompry avisa a tu servidor cuando pasa algo con una orden. Hay **dos emisores** distintos, los dos firman con el
mismo header `X-Recompry-Signature`, y el receptor del starter (`/api/webhooks/recompry`) acepta ambos:

| | Webhook endpoints (API) | Automatizaciones (dashboard) |
|---|---|---|
| Dónde se configura | **Solo por API**: `POST /v1/webhook-endpoints`. No existe pantalla en el dashboard. | **Configuración → Automatizaciones** → regla con acción *webhook*. |
| Requisito | `rcp_sk_live_*` con `webhooks:manage` (las `*_test_*` solo listan y consultan). | Ser owner/admin **y** tener habilitado el módulo Automatizaciones en la organización (feature flag `automations`; si no ves el menú, pídelo a soporte). No usa API keys. |
| Eventos | `order.created`, `order.paid`, `order.stage_changed`, `subscription.created`, `subscription.canceled`, `subscription.cycle_dispatched`, `subscription.cycle_paid`, `ping`. | `order.created` y `order.stage_changed`, con condiciones por etapa, origen y tipo de pedido (`order.paid` hoy solo llega por los endpoints del API). |
| Payload | Envelope v1: `{ event_id, event, occurred_at, organization, data, api_version }`. | `{ event, order: { id, tracking_code, order_number, stage_from, stage_to, order_type, order_origin, source, total, currency, customer }, organization, sent_at }` — **sin `event_id`**. |
| Dedupe en el starter | por `event_id`. | por `event:order.id:stage_from:stage_to`. |
| Prueba e historial | `POST …/{id}/ping`, `GET …/{id}/deliveries`. | Sin ping; el historial de envíos (estado y último error) se ve en la misma pantalla de Automatizaciones. |

Ambos reintentan hasta 5 veces si no respondes 2xx en 10 s, por eso el dedupe. En ambos casos el secreto `whsec_…` se
muestra **una sola vez** al crear el endpoint o la regla: guárdalo en `RECOMPRY_WEBHOOK_SECRET` (cada endpoint/regla tiene
el suyo; el starter verifica contra uno solo).

### 4a. Endpoint por API

1. Registra el endpoint una vez. La key debe ser **live** y tener `webhooks:manage` (§1); `Idempotency-Key` es
   obligatorio (repetir la misma key con el mismo body devuelve el mismo endpoint y el mismo secret con 200, en vez de
   crear otro):

   ```bash
   curl -X POST https://api.recompry.com/v1/webhook-endpoints \
     -H "Authorization: Bearer rcp_sk_live_…" \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: $(uuidgen)" \
     -d '{"url":"https://TU-DOMINIO/api/webhooks/recompry","events":["order.created","order.paid","order.stage_changed"],"description":"Storefront"}'
   ```

   Respuesta `201`:

   ```json
   { "data": { "id": "…", "url": "https://TU-DOMINIO/api/webhooks/recompry", "events": ["order.created","order.paid","order.stage_changed"],
               "status": "enabled", "description": "Storefront", "secret": "whsec_…", "created_at": "…", "updated_at": null,
               "last_delivery_at": null, "last_failure_at": null } }
   ```

   Guarda `secret` en `RECOMPRY_WEBHOOK_SECRET` (si lo pierdes: `DELETE /v1/webhook-endpoints/{id}` y crea otro; no se
   puede rotar in-place). La URL debe ser `https://` y pública: `localhost`, `.local` e IP privadas responden 400 —
   para probar en tu máquina usa el script de §4c. Máximo 20 endpoints por organización.
2. Envía un `ping` real (no hace falta estar suscrito a `ping`):

   ```bash
   curl -X POST https://api.recompry.com/v1/webhook-endpoints/ID/ping -H "Authorization: Bearer rcp_sk_live_…"
   # 202 {"data":{"event":"ping","queued":1}}   ← llega en segundos con el envelope y la firma reales
   ```

3. Entregas y reintentos: `GET /v1/webhook-endpoints/{id}/deliveries` (paginado por cursor; `status` `pending` /
   `success` / `failed`, `last_error` con el código HTTP que devolviste o `timeout`). `PATCH …/{id}` cambia `url`,
   `events`, `status` (`disabled` descarta las entregas pendientes) o `description`.

### 4b. Automatización desde el dashboard

En **Configuración → Automatizaciones** crea una regla (p.ej. *cuando un pedido cambie de etapa*), elige la acción
**Disparar webhook** y pon `https://TU-DOMINIO/api/webhooks/recompry`. Al guardar, el dashboard muestra el secreto de
firma una sola vez: guárdalo en `RECOMPRY_WEBHOOK_SECRET`. Este mecanismo no envía `ping`: prueba con una orden real o
con `npm run webhook:test -- --automation` (§4c).

### 4c. Prueba local

Con `npm run dev` en una terminal y en otra:

```bash
npm run webhook:test                     # envelope v1 (ping) firmado → 200 {"received":true}
npm run webhook:test -- --automation     # payload de Automatización (sin event_id) → 200 {"received":true}
npm run webhook:test -- --bad-signature  # → 401 invalid_signature
npm run webhook:test -- --old            # timestamp de hace 1 h → 401 (replay)
```

El script lee `RECOMPRY_WEBHOOK_SECRET` de `.env.local` / `.dev.vars` (o del entorno) y acepta una URL como primer
argumento para apuntar a otro host.

La verificación (`src/lib/recompry/webhooks.ts`) firma `t + "." + body crudo` con HMAC-SHA256, rechaza `t` con más de
5 minutos de diferencia y compara en tiempo constante; `normalizeWebhookEvent()` reconoce los dos payloads y calcula la
clave de dedupe. El dedupe es en memoria (por isolate): para producción persiste las claves en KV/D1.

## 5. Deploy a Cloudflare Workers

```bash
npm run check          # gate: build OpenNext + tsc + tests + wrangler deploy --dry-run
npm run deploy         # build + wrangler deploy
```

Secretos en producción (nunca en `wrangler.jsonc` ni en `vars`):

```bash
cp .env.production.secrets.example .env.production.secrets   # SOLO secretos, con keys LIVE
npm run cf:secrets:bulk                                      # = wrangler secret bulk .env.production.secrets
```

`.env.production.secrets` está gitignored y debe contener únicamente `RECOMPRY_PUBLISHABLE_KEY`, `RECOMPRY_SECRET_KEY`
y, si recibes webhooks, `RECOMPRY_WEBHOOK_SECRET`. **Nunca** metas ahí variables `NEXT_PUBLIC_*`:
`NEXT_PUBLIC_RECOMPRY_API_URL` ya existe como binding en `vars`, Cloudflare rechaza un secreto con el mismo nombre que
una var ("binding name already in use") y, como `secret bulk` es una sola petición, **no se subiría ningún secreto**.

`wrangler.jsonc` no lleva `account_id`: usa el de tu sesión (`npx wrangler login`). Si tienes varias cuentas, agrégalo
ahí o exporta `CLOUDFLARE_ACCOUNT_ID`. `npm run preview` levanta el build real en `wrangler dev` (lee `.dev.vars`).

Con el botón **Deploy to Cloudflare** el repo se clona en tu cuenta y se despliega; después define los secretos en
*Workers → Settings → Variables and Secrets* (tipo **Secret**) y vuelve a desplegar. Los bindings de rate limit de
`wrangler.jsonc` (§6) se crean solos con el deploy.

## 6. Seguridad

Lo que el starter **ya implementa**:

- **Secret key solo en el servidor.** `src/lib/recompry/server.ts` importa `server-only` (el build falla si un client
  component lo importa); el browser solo habla con los route handlers `/api/*`, nunca con el API con la `rcp_sk_*`.
- **Sesión del comprador en cookie httpOnly** (`rcp_buyer`, `SameSite=Lax`, `Secure` en producción). Los tokens OTP
  nunca llegan al JavaScript del browser; los handlers los reenvían en `X-Buyer-Token`.
- **Órdenes invitadas ligadas al navegador.** Los ids (uuid) de las órdenes creadas sin sesión se guardan en la cookie
  httpOnly `rcp_guest_orders`; `/api/orders/{id}/payment` y `…/payments` solo aceptan uuids (nunca el consecutivo
  `order_number`, que es enumerable) y, sin sesión, solo los presentes en esa cookie. Con sesión, el API valida la
  propiedad vía `X-Buyer-Token`. Sin esto, cualquier visitante podría sondear o anular órdenes ajenas.
- **Webhooks verificados** (§4): HMAC sobre el body crudo, ventana de 5 minutos contra replay, comparación en tiempo
  constante y dedupe.
- **Cabeceras** (`next.config.ts`): `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy`
  y una CSP con `frame-ancestors 'none'`, `base-uri` y `form-action` (sin `script-src`: exigiría nonces por request).
- **Relay OTP limitado.** `/api/auth/otp/send` usa los bindings nativos de Workers Rate Limiting declarados en
  `wrangler.jsonc` (`ratelimits`): **3 envíos/min por correo** (`OTP_RATE_LIMITER_EMAIL`) y **10/min por IP**
  (`OTP_RATE_LIMITER_IP`) → `429 rate_limited` con `Retry-After`. En `next dev` no hay bindings y el guard deja pasar
  con un aviso en consola.
- **`Idempotency-Key` por intento de compra** y recotización completa en el API: ningún monto del browser se acepta.

Lo que **tú debes añadir** en producción:

- **Regla de Rate Limiting / WAF en Cloudflare** para `/api/auth/otp/send` (y, si quieres, `/api/orders`). El binding
  de Workers cuenta por ubicación de Cloudflare, no globalmente, y es la última línea de defensa, no la única.
  Opcionalmente añade **Turnstile** al formulario de login y verifica el token en ese handler (el starter no lo trae).
- **Dedupe persistente de webhooks** (KV/D1) si procesas efectos secundarios no idempotentes.
- **Rotación de keys**: revoca en el dashboard, emite una nueva y vuelve a correr `npm run cf:secrets:bulk`.
- Una **CSP completa** con nonces si tu tienda carga scripts de terceros.

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
  El 3DS ya está cableado (`browser_info` + iframe); si un emisor bloquea el reto dentro de un iframe anidado, el
  fallback es abrirlo en un popup (no implementado).
- Canje de créditos/puntos en el carrito (`credits_to_redeem_cents`, `loyalty_points_to_redeem`) no está expuesto en la UI.
- Direcciones guardadas no se usan aún en el checkout (solo texto libre geocodificado).
- Pedidos programados (`scheduled_for`) no tienen selector.
- Dedupe de webhooks en memoria (ver arriba).

## Troubleshooting

- **`sharp` falla al instalar en macOS** ("Attempting to build from source"): tienes un libvips global de Homebrew.
  Instala con `SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install` (sharp es opcional: Next no lo usa en Workers).
- **La tienda no carga / pantalla "La tienda no pudo cargar"**: revisa las keys en `.env.local` y el `code` que muestra
  (`invalid_api_key`, `insufficient_scope`…). Toda respuesta del API trae `request_id`; inclúyelo al pedir soporte.
- **403 al crear órdenes o pagar**: `test_token_readonly` = estás usando una key `*_test_*` (solo lectura).
  `insufficient_scope` = a la `rcp_sk_*` le falta el scope que nombra la respuesta (`orders:write`, `payments:write`,
  `customers:write`, `subscriptions:write`). Los scopes no se editan: emite una nueva key marcándolos (§1) y revoca la
  vieja. Pasa lo mismo con keys emitidas antes de que el dashboard tuviera el selector de scopes.
- **El comprador se desloguea al rato / la lista de espera responde 403**: la `rcp_sk_*` no tiene `store:read` (renueva
  la sesión con `POST /v1/auth/refresh`) o `catalog:read` (`/v1/waitlist`). Emite una key con todos los `:read` (§1).
- **Webhooks**: `401 invalid_signature` = el `whsec_…` no es el de ese endpoint/regla (cada uno tiene el suyo) o el
  reloj del servidor difiere más de 5 min; `400 invalid_event` = el body no es ni envelope v1 ni payload de
  Automatización; `500 webhook_not_configured` = falta `RECOMPRY_WEBHOOK_SECRET`.
- **`npm run cf:secrets:bulk` falla con "binding name already in use"**: `.env.production.secrets` incluye una variable
  `NEXT_PUBLIC_*` que ya está en `vars`. Déjalo solo con las tres claves de `.env.production.secrets.example` (§5).
- **`npm run webhook:test` dice que falta `process.loadEnvFile`**: Node < 20.12. Actualiza Node o exporta
  `RECOMPRY_WEBHOOK_SECRET` en el entorno.

## Licencia

MIT — ver [LICENSE](./LICENSE). Documentación del API: <https://api.recompry.com/docs> · Changelog: <https://api.recompry.com/docs/changelog>.
