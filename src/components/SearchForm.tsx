export function SearchForm({ defaultValue = '', className }: { defaultValue?: string; className?: string }) {
  return (
    <form action="/search" role="search" className={className}>
      <label className="sr-only" htmlFor="search-q">
        Buscar productos
      </label>
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
        <input id="search-q" name="q" defaultValue={defaultValue} placeholder="Buscar…" className="input pl-9" autoComplete="off" />
      </div>
    </form>
  );
}
