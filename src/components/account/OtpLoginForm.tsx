'use client';

// Login OTP por email en dos pasos: POST /api/auth/otp/send → POST /api/auth/otp/verify.
// El route handler guarda la sesión en una cookie httpOnly; el browser nunca ve el token.
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Field } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { safeNextPath } from '@/lib/safe-next';

export function OtpLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await callApi('/api/auth/otp/send', { body: { email } });
      setStep('code');
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await callApi('/api/auth/otp/verify', { body: { email, token } });
      // `router.push` a un destino externo hace navegación MPA: se re-sanea aunque la página ya lo hizo.
      router.push(safeNextPath(next));
      router.refresh();
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={send} className="card space-y-4 p-5">
        <Field label="Correo" htmlFor="login-email">
          <input id="login-email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </Field>
        <ErrorBanner error={error} />
        <Button type="submit" className="w-full" loading={loading}>Enviarme un código</Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="card space-y-4 p-5">
      <p className="text-sm text-slate-600">Enviamos un código a <strong>{email}</strong>. Revisa también el spam.</p>
      <Field label="Código" htmlFor="login-code">
        <input id="login-code" className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" required minLength={4} maxLength={16} value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" />
      </Field>
      <ErrorBanner error={error} />
      <Button type="submit" className="w-full" loading={loading}>Entrar</Button>
      <button type="button" className="w-full text-center text-sm text-slate-500 hover:underline" onClick={() => setStep('email')}>Cambiar correo o pedir otro código</button>
    </form>
  );
}
