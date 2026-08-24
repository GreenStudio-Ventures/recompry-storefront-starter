import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';

export function Price({
  amount,
  compareAt,
  currency,
  className,
  size = 'md',
}: {
  amount: number | null | undefined;
  compareAt?: number | null;
  currency: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' };
  if (amount === null || amount === undefined) {
    return <span className={cn('text-slate-500', sizes[size], className)}>Precio a consultar</span>;
  }
  const hasDiscount = typeof compareAt === 'number' && compareAt > amount;
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', className)}>
      <span className={cn('font-bold tabular-nums', sizes[size], hasDiscount && 'text-red-600')}>{formatMoney(amount, currency)}</span>
      {hasDiscount ? <span className="text-xs text-slate-400 line-through tabular-nums">{formatMoney(compareAt, currency)}</span> : null}
    </span>
  );
}
