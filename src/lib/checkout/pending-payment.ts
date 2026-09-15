// Marcador del pago en curso. Necesario porque PSE y el Botón Bancolombia SACAN al comprador del
// sitio (navegación completa al portal del banco): al volver —o al no volver y entrar otra vez a la
// tienda— el estado de React ya no existe, el carrito sigue lleno y el checkout crearía una SEGUNDA
// orden (y un segundo cobro) por la misma compra. Guardamos el puntero a la orden pendiente para
// poder ofrecer "continuar con el pago" en vez de empezar de cero.
//
// Vive solo en este navegador (localStorage, no sessionStorage: el comprador puede volver tras
// cerrar el navegador). Puede fallar o venir vacío (ventana privada, datos borrados), así que todo
// va en try/catch y la ausencia del marcador nunca rompe el checkout.

const KEY = 'recompry.pending_payment.v1';
/** Más allá de esto el marcador no sirve: la sesión del banco ya expiró y conviene pedir de nuevo. */
const MAX_AGE_MS = 2 * 60 * 60_000;

export type PendingPayment = {
  id: string;
  tracking_code: string | null;
  method: string;
  total: number;
  currency: string;
  /** epoch ms en que se inició el cobro. */
  at: number;
};

export function savePendingPayment(pending: Omit<PendingPayment, 'at'>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...pending, at: Date.now() } satisfies PendingPayment));
  } catch {
    // Sin almacenamiento el flujo sigue igual, solo sin la red de seguridad.
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPayment>;
    if (typeof parsed?.id !== 'string' || !parsed.id || typeof parsed.at !== 'number') {
      clearPendingPayment();
      return null;
    }
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      clearPendingPayment();
      return null;
    }
    return {
      id: parsed.id,
      tracking_code: typeof parsed.tracking_code === 'string' ? parsed.tracking_code : null,
      method: typeof parsed.method === 'string' ? parsed.method : '',
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      currency: typeof parsed.currency === 'string' ? parsed.currency : 'COP',
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

export function clearPendingPayment(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}
