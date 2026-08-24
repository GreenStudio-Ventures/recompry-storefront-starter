import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/tracking/AutoRefresh';
import { Timeline } from '@/components/tracking/Timeline';
import { Badge, LinkButton, Notice, SectionTitle } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { publicApi } from '@/lib/recompry/client';
import { isApiError, unwrap } from '@/lib/recompry/errors';
import type { Tracking } from '@/lib/recompry/types';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ nuevo?: string; pago?: string }> };

export const metadata: Metadata = { title: 'Seguimiento' };

const ORDER_TYPE_LABEL: Record<string, string> = {
  PICKUP: 'Recogida en tienda',
  DELIVERY_LOCAL: 'Domicilio',
  SHIPMENT_NATIONAL: 'Envío nacional',
  DINE_IN: 'En mesa',
  SELF_SERVE: 'Autoservicio',
};

export default async function TrackPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { nuevo, pago } = await searchParams;

  // GET /v1/tracking/{code}: vista pública sin datos personales ni montos (apta para compartir).
  let tracking: Tracking | null = null;
  let notFoundMessage: string | null = null;
  try {
    tracking = unwrap(await publicApi().GET('/v1/tracking/{tracking_code}', { params: { path: { tracking_code: code } } })).data;
  } catch (err) {
    if (isApiError(err) && err.status === 404) notFoundMessage = err.message;
    else throw err;
  }

  if (!tracking) {
    return (
      <div className="mx-auto max-w-md">
        <SectionTitle title="Pedido no encontrado" subtitle={notFoundMessage ?? undefined} />
        <p className="text-sm text-slate-600">Revisa el código <span className="font-mono">{code}</span> o pide uno nuevo a la tienda.</p>
        <LinkButton href="/track" variant="secondary" className="mt-4">Probar otro código</LinkButton>
      </div>
    );
  }

  const live = tracking.stage !== 'delivered' && tracking.stage !== 'canceled';

  return (
    <div className="mx-auto max-w-2xl">
      {nuevo ? (
        <Notice tone="success" className="mb-6">
          <p className="font-semibold">¡Pedido recibido{pago === 'aprobado' ? ' y pagado' : ''}!</p>
          <p>Guarda este enlace para seguir tu pedido: <span className="font-mono">/track/{tracking.tracking_code}</span></p>
        </Notice>
      ) : null}
      <SectionTitle
        title={`Pedido ${tracking.tracking_code}`}
        subtitle={`${ORDER_TYPE_LABEL[tracking.order_type] ?? tracking.order_type}${tracking.location?.name ? ` · ${tracking.location.name}` : ''}`}
        action={tracking.stage === 'canceled' ? <Badge tone="danger">Cancelado</Badge> : tracking.stage === 'delivered' ? <Badge tone="success">Entregado</Badge> : <Badge tone="info">En curso</Badge>}
      />
      <div className="card p-6">
        <Timeline stage={tracking.stage} orderType={tracking.order_type} />
        {tracking.eta && live ? <p className="mt-6 text-sm text-slate-600">Entrega estimada: <strong>{formatDate(tracking.eta)}</strong></p> : null}
        <p className="mt-1 text-xs text-slate-400">Actualizado {formatDate(tracking.updated_at)} · estado {tracking.fulfillment_status}</p>
      </div>
      <div className="card mt-4 p-6">
        <h3 className="font-semibold">Productos</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {tracking.items.map((it, i) => (
            <li key={i} className="flex justify-between"><span>{it.name}</span><span className="tabular-nums text-slate-500">×{it.quantity}</span></li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/" className="hover:underline">Volver a la tienda</Link> · <Link href="/account" className="hover:underline">Mis pedidos</Link>
      </p>
      {live ? <AutoRefresh seconds={20} /> : null}
    </div>
  );
}
