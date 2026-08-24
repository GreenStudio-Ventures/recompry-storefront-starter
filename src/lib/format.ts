const formatters = new Map<string, Intl.NumberFormat>();

/** Dinero en la moneda de la tienda (`currency_code`), formato colombiano: `$ 12.500`. */
export function formatMoney(amount: number | null | undefined, currency = 'COP'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const key = currency;
  let fmt = formatters.get(key);
  if (!fmt) {
    const zeroDecimals = currency === 'COP';
    fmt = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: zeroDecimals ? 0 : 2,
      maximumFractionDigits: zeroDecimals ? 0 : 2,
    });
    formatters.set(key, fmt);
  }
  return fmt.format(amount);
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', ...opts }).format(d);
}

export function formatInterval(unit: string, count: number): string {
  const names: Record<string, [string, string]> = {
    day: ['día', 'días'],
    week: ['semana', 'semanas'],
    month: ['mes', 'meses'],
  };
  const [one, many] = names[unit] ?? [unit, unit];
  return count === 1 ? `cada ${one}` : `cada ${count} ${many}`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
