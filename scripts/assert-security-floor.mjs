#!/usr/bin/env node
// Gate de check/deploy: aborta si el lockfile resuelve alguna copia de un paquete por debajo
// del piso de seguridad. Barrido 2026-10-25: next 16.1.6 tenía 38 avisos abiertos (CSRF y DoS
// de Server Actions, bypasses de middleware, RCE del 14-oct) y un `npm audit fix` o un merge
// pueden volver a bajar versiones sin que nadie lo note. Revisa TODAS las copias del lockfile,
// también las anidadas (node_modules/x/node_modules/next).
// Uso: node scripts/assert-security-floor.mjs [ruta/a/package-lock.json]
// Bypass consciente: SKIP_SECURITY_FLOOR=1 npm run deploy
import { readFileSync } from "node:fs";

// paquete → versión mínima sin avisos conocidos. Con { mayor: mínima } solo se exige en esas
// series (form-data 2.x/3.x no está afectado por el aviso de la 4.x).
const FLOOR = {
  next: "16.4.1", // avisos del 14-oct (RCE `use cache` / SVG, DoS de Server Actions CVE-2026-94482) y anteriores
  "@opennextjs/cloudflare": "1.20.2", // GHSA-2vc4-c4r6-p6v6: la caché saltaba el middleware con rutas codificadas
  wrangler: "4.114.0", // miniflare con sharp/undici/ws vulnerables hasta 4.113
  hono: "4.13.11", // parseBody sin límite de anidación, query después del fragmento, serveStatic
  zod: "4.6.6", // GHSA-mrhx-c7xc-m3w5: memoria al validar colecciones grandes
  "@modelcontextprotocol/sdk": "1.32.0", // GHSA-46jr-4wx8-v453 (memoria del servidor) y bearer de otro servicio
  "@supabase/auth-js": "2.70.0", // GHSA-8r88-6cj9-9fh5: rutas inseguras con input malformado
  dompurify: "3.4.17", // XSS en modo IN_PLACE (GHSA-mrv2-3pqr-j5jr y anteriores)
  sharp: "0.35.5", // librsvg CVE-2026-96889 + libvips/libheif
  postcss: "8.5.23", // XSS en stringify y lectura de archivos vía sourceMappingURL
  "proxy-addr": "2.0.8", // GHSA-jqcg-44mw-7w3h: suplantación de IP con IPv6 mapeada
  "form-data": { 4: "4.0.6" }, // GHSA-hmw2-7cc7-3qxx: inyección CRLF en multipart
};

if (process.env.SKIP_SECURITY_FLOOR === "1") {
  console.warn("⚠ SKIP_SECURITY_FLOOR=1: sin revisar el piso de seguridad, bajo tu responsabilidad.");
  process.exit(0);
}

function parse(version) {
  const [core, pre] = String(version).split("-", 2);
  const [major = 0, minor = 0, patch = 0] = core
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return { major, minor, patch, pre: Boolean(pre) };
}

function isBelow(version, minimum) {
  const a = parse(version);
  const b = parse(minimum);
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key];
  }
  return a.pre && !b.pre;
}

const lockfilePath = process.argv[2] ?? "package-lock.json";
const packages = JSON.parse(readFileSync(lockfilePath, "utf8")).packages ?? {};
const violations = [];
let checked = 0;

for (const [path, meta] of Object.entries(packages)) {
  if (!path || !meta?.version) continue;
  const name = meta.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
  const rule = FLOOR[name];
  if (!rule) continue;
  const minimum = typeof rule === "string" ? rule : rule[parse(meta.version).major];
  if (!minimum) continue;
  checked += 1;
  if (isBelow(meta.version, minimum)) violations.push(`${path} ${meta.version} (mínimo ${minimum})`);
}

if (violations.length > 0) {
  console.error(`✗ Abortado: ${lockfilePath} resuelve versiones por debajo del piso de seguridad:\n`);
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error(
    "\nSube esas versiones o rebasa la rama sobre el commit de seguridad del 2026-10-25.",
  );
  console.error("Bypass consciente: SKIP_SECURITY_FLOOR=1 npm run deploy");
  process.exit(1);
}

console.log(`✓ Piso de seguridad OK: ${checked} copias revisadas en ${lockfilePath}.`);
