import type { Metadata } from 'next';
import { PaymentReturn } from '@/components/checkout/PaymentReturn';

// Retorno del banco (PSE / Botón Bancolombia) y del 3-D Secure. La URL la construye PaymentStep
// como `/pago/{order_id}?t={tracking_code}`: el id identifica la orden a consultar y el código de
// seguimiento evita tener que resolverlo otra vez para mandar al comprador a /track.
// El acceso lo sigue guardando `orderAccess` en /api/orders/[id]/payment (sesión o cookie de
// pedidos de este navegador), no esta URL.
export const metadata: Metadata = { title: 'Confirmando tu pago' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> };

export default async function PaymentReturnPage({ params, searchParams }: Props) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  return <PaymentReturn orderId={id} trackingCode={t?.trim() || null} />;
}
