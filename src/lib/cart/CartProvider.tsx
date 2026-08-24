'use client';

// Carrito local persistido en localStorage, expuesto como "external store" (useSyncExternalStore):
// el servidor renderiza un carrito vacío y el browser lo hidrata sin efectos ni setState.
// El total "de verdad" siempre sale de `POST /v1/cart/quote` (ver useCartQuote): aquí solo
// guardamos ids, cantidades y un snapshot para pintar de inmediato.
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { OrderMode } from '@/lib/recompry/types';
import { lineKey, type CartLine, type CartState, type CheckoutContext } from './types';

const STORAGE_KEY = 'recompry.cart.v1';

/** Lo que se persiste: el modo puede faltar hasta que el comprador elija uno (se aplica el default de la tienda). */
type StoredState = { lines: CartLine[]; context: Partial<CheckoutContext> };
const EMPTY: StoredState = { lines: [], context: {} };

let state: StoredState | null = null;
const listeners = new Set<() => void>();

function load(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return { lines: Array.isArray(parsed.lines) ? parsed.lines : [], context: parsed.context ?? {} };
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): StoredState {
  if (!state) state = load();
  return state;
}

function getServerSnapshot(): StoredState {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(updater: (s: StoredState) => StoredState) {
  state = updater(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage lleno o bloqueado: el carrito vive solo en memoria
  }
  listeners.forEach((l) => l());
}

type CartApi = {
  state: CartState;
  /** false durante el render del servidor / hidratación (el carrito aún no se leyó del browser). */
  hydrated: boolean;
  count: number;
  addLine: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
  setContext: (patch: Partial<CheckoutContext>) => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children, defaultMode }: { children: ReactNode; defaultMode: OrderMode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = useMemo<CartState>(
    () => ({ lines: stored.lines, context: { ...stored.context, mode: stored.context.mode ?? defaultMode } }),
    [stored, defaultMode],
  );
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const addLine = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = lineKey(line);
    update((s) => {
      const existing = s.lines.find((l) => l.key === key);
      const lines = existing
        ? s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(999, l.quantity + line.quantity) } : l))
        : [...s.lines, { ...line, key }];
      return { ...s, lines };
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    update((s) => ({
      ...s,
      lines: quantity <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity } : l)),
    }));
  }, []);

  const removeLine = useCallback((key: string) => update((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) })), []);
  const clear = useCallback(() => update((s) => ({ lines: [], context: { mode: s.context.mode, location_id: s.context.location_id } })), []);
  const setContext = useCallback((patch: Partial<CheckoutContext>) => update((s) => ({ ...s, context: { ...s.context, ...patch } })), []);

  const value = useMemo<CartApi>(
    () => ({
      state: current,
      hydrated,
      count: current.lines.reduce((n, l) => n + l.quantity, 0),
      addLine,
      setQuantity,
      removeLine,
      clear,
      setContext,
    }),
    [current, hydrated, addLine, setQuantity, removeLine, clear, setContext],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
