import { LinkButton } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="text-6xl font-black text-slate-200">404</p>
      <h1 className="mt-2 text-xl font-bold">No encontramos esa página</h1>
      <p className="mt-2 text-sm text-slate-600">Puede que el producto ya no esté publicado o que el enlace esté mal.</p>
      <LinkButton href="/" className="mt-6">
        Volver al inicio
      </LinkButton>
    </div>
  );
}
