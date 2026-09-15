'use client';

// Formularios por método de pago online. Cada uno arma el body de
// `POST /v1/orders/{id}/payments` (contrato: api/src/schemas/payments.ts, union discriminada por
// `method`) y se lo pasa al shell (PaymentStep), que es quien cobra, sondea y pinta el resultado.
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Notice, Spinner } from '@/components/ui';
import { callApi } from '@/lib/browser-api';
import type { CreatePaymentRequest, PaymentConfig, PseInstitution } from '@/lib/recompry/types';
import { tokenizeCardWithWompi } from '@/lib/wompi';
import { localMobile, paymentPhone } from './phone';

export type PayerContact = { email: string; full_name: string; phone: string };

type FormProps = {
  config: PaymentConfig;
  contact: PayerContact;
  paying: boolean;
  /** Texto del botón, con el monto ya formateado. */
  submitLabel: string;
  /**
   * URL a la que el banco devuelve al comprador (PSE/Bancolombia) o a la que vuelve el 3DS.
   * Es una función porque depende de `window.location` y estos formularios también se renderizan
   * en el servidor: se resuelve al enviar, ya en el browser.
   */
  returnUrl: () => string;
  onPay: (body: CreatePaymentRequest) => void;
  /** Fallos que ocurren ANTES del cobro (p. ej. tokenizar la tarjeta): los pinta el shell. */
  onError: (err: unknown) => void;
};

/** Casilla de aceptación del reglamento de Wompi (obligatoria si el API devolvió los permalinks). */
function AcceptanceCheck({ config, accepted, onChange }: { config: PaymentConfig; accepted: boolean; onChange: (v: boolean) => void }) {
  if (!config.acceptance_tokens) return null;
  const { acceptance_permalink, personal_data_auth_permalink } = config.acceptance_tokens;
  return (
    <label className="flex items-start gap-2 text-xs text-slate-600">
      <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Acepto el{' '}
        {acceptance_permalink ? <a className="underline" href={acceptance_permalink} target="_blank" rel="noreferrer">reglamento</a> : 'reglamento'}{' '}
        y la{' '}
        {personal_data_auth_permalink ? <a className="underline" href={personal_data_auth_permalink} target="_blank" rel="noreferrer">política de datos</a> : 'política de datos'}{' '}
        de Wompi.
      </span>
    </label>
  );
}

// --- Tarjeta -------------------------------------------------------------------------------------

// 3-D Secure v2 exige los datos del navegador del pagador para el device fingerprinting del emisor.
// Si algo falla se omite y el cobro sale sin 3DS en vez de romperse.
function collectBrowserInfo() {
  try {
    return {
      browser_color_depth: String(window.screen.colorDepth),
      browser_screen_height: String(window.screen.height),
      browser_screen_width: String(window.screen.width),
      browser_language: window.navigator.language,
      browser_user_agent: window.navigator.userAgent,
      browser_tz: String(new Date().getTimezoneOffset()),
    };
  } catch {
    return undefined;
  }
}

export function CardForm({ config, contact, paying, submitLabel, returnUrl, onPay, onError }: FormProps) {
  const [card, setCard] = useState({ number: '', exp_month: '', exp_year: '', cvc: '', card_holder: contact.full_name });
  const [email, setEmail] = useState(contact.email);
  const [installments, setInstallments] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [tokenizing, setTokenizing] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!config.public_key) return;
    setTokenizing(true);
    try {
      // Si Wompi rechaza la tarjeta aquí (número inválido, vencida…) lanza: sin este catch el
      // clic no producía nada visible.
      const token = await tokenizeCardWithWompi(config.public_key, config.environment, card);
      onPay({
        method: 'card',
        token,
        installments,
        // phone es opcional aquí y tiene minLength 7: un valor corto (p.ej. de un buyer viejo) tumba el cobro con 400.
        customer: { email: email.trim(), full_name: card.card_holder.trim(), phone: paymentPhone(contact.phone) },
        redirect_url: returnUrl(),
        browser_info: collectBrowserInfo(),
      });
    } catch (err) {
      onError(err);
    } finally {
      setTokenizing(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      {config.environment === 'sandbox' ? <Notice tone="warning">Ambiente sandbox: usa tarjetas de prueba de Wompi.</Notice> : null}
      <Field label="Número de tarjeta" htmlFor="card-number">
        <input id="card-number" className="input" inputMode="numeric" autoComplete="cc-number" required value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4242 4242 4242 4242" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Mes" htmlFor="card-mm"><input id="card-mm" className="input" required maxLength={2} placeholder="MM" value={card.exp_month} onChange={(e) => setCard({ ...card, exp_month: e.target.value })} /></Field>
        <Field label="Año" htmlFor="card-yy"><input id="card-yy" className="input" required maxLength={4} placeholder="AA" value={card.exp_year} onChange={(e) => setCard({ ...card, exp_year: e.target.value })} /></Field>
        <Field label="CVC" htmlFor="card-cvc"><input id="card-cvc" className="input" required maxLength={4} inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></Field>
      </div>
      <Field label="Titular" htmlFor="card-holder"><input id="card-holder" className="input" required value={card.card_holder} onChange={(e) => setCard({ ...card, card_holder: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Correo del comprobante" htmlFor="card-email"><input id="card-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Cuotas" htmlFor="card-inst"><input id="card-inst" type="number" min={1} max={48} className="input" value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 1)} /></Field>
      </div>
      <AcceptanceCheck config={config} accepted={accepted} onChange={setAccepted} />
      <Button type="submit" size="lg" className="w-full" loading={paying || tokenizing} disabled={config.acceptance_tokens ? !accepted : false}>{submitLabel}</Button>
      <p className="text-center text-xs text-slate-400">El monto lo fija la tienda (grand_total de la orden); la tarjeta se tokeniza con la llave pública de Wompi. Tu banco puede pedir una verificación (3-D Secure).</p>
    </form>
  );
}

// --- PSE -----------------------------------------------------------------------------------------

const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'TI', 'PP'] as const;

export function PseForm({ config, contact, paying, submitLabel, returnUrl, onPay }: FormProps) {
  const [banks, setBanks] = useState<PseInstitution[] | null>(null);
  const [bank, setBank] = useState('');
  const [userType, setUserType] = useState<0 | 1>(0);
  const [idType, setIdType] = useState<(typeof LEGAL_ID_TYPES)[number]>('CC');
  const [legalId, setLegalId] = useState('');
  const [email, setEmail] = useState(contact.email);
  const [fullName, setFullName] = useState(contact.full_name);
  const [phone, setPhone] = useState(localMobile(contact.phone));
  const [accepted, setAccepted] = useState(false);

  // La lista sale de Wompi vía el API (`GET /v1/payments/pse-institutions`); llega vacía si la
  // tienda no habilitó PSE. El API la marca cacheable 1 h, así que no la re-pedimos por intento.
  useEffect(() => {
    callApi<PseInstitution[]>('/api/payments/pse-institutions').then(setBanks).catch(() => setBanks([]));
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    onPay({
      method: 'pse',
      financial_institution_code: bank,
      user_type: userType,
      user_legal_id_type: idType,
      user_legal_id: legalId.trim(),
      // PSE exige nombre y teléfono; el API los normaliza a 57 + 10 dígitos y responde
      // 400 customer_phone_required si no puede resolverlos por ningún lado.
      customer: { email: email.trim(), full_name: fullName.trim(), phone: localMobile(phone) },
      redirect_url: returnUrl(),
    });
  }

  if (!banks) return <div className="flex justify-center py-10 text-slate-400"><Spinner className="h-7 w-7" /></div>;
  if (!banks.length) return <Notice tone="warning">No pudimos cargar la lista de bancos de PSE. Elige otro método de pago o vuelve a intentarlo en unos minutos.</Notice>;

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <Field label="Banco" htmlFor="pse-bank">
        <select id="pse-bank" className="input" required value={bank} onChange={(e) => setBank(e.target.value)}>
          <option value="" disabled>Elige tu banco</option>
          {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="Pagas como" htmlFor="pse-user-type">
        <select id="pse-user-type" className="input" value={userType} onChange={(e) => setUserType(Number(e.target.value) === 1 ? 1 : 0)}>
          <option value={0}>Persona natural</option>
          <option value={1}>Persona jurídica (empresa)</option>
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Documento" htmlFor="pse-id-type">
          <select id="pse-id-type" className="input" value={idType} onChange={(e) => setIdType(e.target.value as (typeof LEGAL_ID_TYPES)[number])}>
            {LEGAL_ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Número" htmlFor="pse-legal-id">
            <input id="pse-legal-id" className="input" inputMode="numeric" required minLength={3} maxLength={30} value={legalId} onChange={(e) => setLegalId(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Nombre completo" htmlFor="pse-name"><input id="pse-name" className="input" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Correo" htmlFor="pse-email"><input id="pse-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Celular" htmlFor="pse-phone" hint="10 dígitos">
          {/* Sin maxLength: `localMobile` ya deja 10 dígitos, y truncar el texto crudo rompía
              pegar "+57 300 111 2233". */}
          <input id="pse-phone" className="input" inputMode="numeric" required pattern="\d{10}" value={phone} onChange={(e) => setPhone(localMobile(e.target.value))} />
        </Field>
      </div>
      <AcceptanceCheck config={config} accepted={accepted} onChange={setAccepted} />
      <Button type="submit" size="lg" className="w-full" loading={paying} disabled={config.acceptance_tokens ? !accepted : false}>{submitLabel}</Button>
      <p className="text-center text-xs text-slate-400">Te llevamos al portal de tu banco para autorizar el débito. Puede tardar unos segundos.</p>
    </form>
  );
}

// --- Nequi ---------------------------------------------------------------------------------------

export function NequiForm({ config, contact, paying, submitLabel, onPay }: FormProps) {
  const [phone, setPhone] = useState(localMobile(contact.phone));
  const [email, setEmail] = useState(contact.email);
  const [accepted, setAccepted] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    onPay({
      method: 'nequi',
      phone_number: phone,
      customer: { email: email.trim(), full_name: contact.full_name.trim() || undefined },
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <Field label="Celular Nequi" htmlFor="nequi-phone" hint="10 dígitos; recibirás la solicitud en tu app">
        <input id="nequi-phone" className="input" inputMode="numeric" required pattern="3\d{9}" value={phone} onChange={(e) => setPhone(localMobile(e.target.value))} placeholder="3001112233" />
      </Field>
      {/* Obligatorio: el API pide `customer.email` en cualquier cobro con Wompi. */}
      <Field label="Correo del comprobante" htmlFor="nequi-email">
        <input id="nequi-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <AcceptanceCheck config={config} accepted={accepted} onChange={setAccepted} />
      <Button type="submit" size="lg" className="w-full" loading={paying} disabled={config.acceptance_tokens ? !accepted : false}>{submitLabel}</Button>
      <p className="text-center text-xs text-slate-400">Abre tu app Nequi para aprobar el cobro. No cierres esta página mientras tanto.</p>
    </form>
  );
}

// --- Botón Bancolombia ---------------------------------------------------------------------------

export function BancolombiaForm({ config, contact, paying, submitLabel, returnUrl, onPay }: FormProps) {
  const [email, setEmail] = useState(contact.email);
  const [accepted, setAccepted] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    onPay({
      method: 'bancolombia_button',
      customer: { email: email.trim(), full_name: contact.full_name.trim() || undefined, phone: paymentPhone(contact.phone) },
      redirect_url: returnUrl(),
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      {/* Wompi solo acepta `user_type: PERSON` en BANCOLOMBIA_TRANSFER: las cuentas de empresa
          tienen que pagar por PSE (allí sí existe persona jurídica). */}
      <Notice tone="info">Solo para cuentas personales de Bancolombia. Si pagas con una cuenta empresarial, usa PSE.</Notice>
      {/* Obligatorio: el API pide `customer.email` en cualquier cobro con Wompi. */}
      <Field label="Correo del comprobante" htmlFor="banco-email">
        <input id="banco-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <AcceptanceCheck config={config} accepted={accepted} onChange={setAccepted} />
      <Button type="submit" size="lg" className="w-full" loading={paying} disabled={config.acceptance_tokens ? !accepted : false}>{submitLabel}</Button>
      <p className="text-center text-xs text-slate-400">Te llevamos a la Sucursal Virtual de Bancolombia para autorizar la transferencia.</p>
    </form>
  );
}
