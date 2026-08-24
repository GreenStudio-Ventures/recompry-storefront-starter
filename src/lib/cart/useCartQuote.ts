'use client';

import { useEffect, useState } from 'react';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import type { CartQuote, CartQuoteRequest } from '@/lib/recompry/types';
import { buildQuoteRequest } from './quote';
import type { CartState } from './types';

/** Cotiza el carrito (debounced) cada vez que cambia. Sin efectos secundarios en el API. */
export function useCartQuote(state: CartState, enabled = true) {
  const request = buildQuoteRequest(state);
  const requestJson = JSON.stringify(request);
  // Resultado de la última cotización + el body que la produjo: `loading` se deriva comparando.
  const [last, setLast] = useState<{ for: string; quote: CartQuote | null; error: UiError | null }>({ for: '', quote: null, error: null });

  useEffect(() => {
    if (!enabled || requestJson === 'null') return;
    const body = JSON.parse(requestJson) as CartQuoteRequest;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const quote = await callApi<CartQuote>('/api/cart/quote', { body, signal: controller.signal });
        setLast({ for: requestJson, quote, error: null });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLast((prev) => ({ for: requestJson, quote: prev.quote, error: toUiError(err) }));
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestJson, enabled]);

  const active = enabled && request !== null;
  return {
    request,
    quote: active ? last.quote : null,
    error: active ? last.error : null,
    loading: active && last.for !== requestJson,
  };
}
