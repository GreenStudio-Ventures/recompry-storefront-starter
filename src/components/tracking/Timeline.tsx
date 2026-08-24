import { cn } from '@/lib/cn';

const STAGES_PICKUP = [
  { key: 'received', label: 'Recibido' },
  { key: 'preparing', label: 'En preparación' },
  { key: 'ready', label: 'Listo para recoger' },
  { key: 'delivered', label: 'Entregado' },
];
const STAGES_DELIVERY = [
  { key: 'received', label: 'Recibido' },
  { key: 'preparing', label: 'En preparación' },
  { key: 'ready', label: 'Listo' },
  { key: 'on_the_way', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
];

/** Línea de tiempo del comprador a partir de `stage` (x-extensible-enum: tolera valores nuevos). */
export function Timeline({ stage, orderType }: { stage: string; orderType: string }) {
  const stages = orderType === 'DELIVERY_LOCAL' || orderType === 'SHIPMENT_NATIONAL' ? STAGES_DELIVERY : STAGES_PICKUP;
  if (stage === 'canceled') {
    return <p className="text-sm text-red-700">Este pedido fue cancelado.</p>;
  }
  const idx = stages.findIndex((s) => s.key === stage);
  const current = idx === -1 ? 0 : idx;
  return (
    <ol className="grid gap-4 sm:grid-cols-5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || active ? 'bg-brand' : 'bg-slate-200')} />
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold', done ? 'border-brand bg-brand text-brand-foreground' : active ? 'border-brand bg-white text-brand ring-4 ring-brand/15' : 'border-slate-200 bg-white text-slate-400')}>
                {done ? '✓' : i + 1}
              </div>
              <div className={cn('h-0.5 flex-1', i === stages.length - 1 ? 'bg-transparent' : done ? 'bg-brand' : 'bg-slate-200')} />
            </div>
            <span className={cn('mt-2 text-xs', active ? 'font-semibold text-slate-900' : 'text-slate-500')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
