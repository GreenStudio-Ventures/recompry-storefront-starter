import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { UiError } from '@/lib/browser-api';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary: 'bg-brand text-brand-foreground hover:opacity-90 shadow-sm',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};
const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  // `disabled` se desestructura y se aplica DESPUÉS del spread: dentro de `rest` el atributo del
  // caller pisaba a `loading` y dejaba el botón clicable mientras el cobro estaba en vuelo.
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest} disabled={disabled || loading}>
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    brand: 'bg-brand text-brand-foreground',
    info: 'bg-sky-100 text-sky-800',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Muestra un error del API: mensaje humano + `code` y `request_id` para soporte. */
export function ErrorBanner({ error, className, title }: { error: UiError | string | null | undefined; className?: string; title?: string }) {
  if (!error) return null;
  const e: UiError = typeof error === 'string' ? { message: error } : error;
  return (
    <div role="alert" className={cn('rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800', className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <p>{e.message}</p>
      {e.code || e.requestId ? (
        <p className="mt-1 font-mono text-[11px] text-red-600/80">
          {e.code ? <span>{e.code}</span> : null}
          {e.requestId ? <span> · {e.requestId}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warning' | 'success'; className?: string }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return <div className={cn('rounded-xl border p-4 text-sm', tones[tone], className)}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">🛍️</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
