'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { callApi } from '@/lib/browser-api';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await callApi('/api/auth/logout', { method: 'POST', body: {} });
        } finally {
          router.push('/');
          router.refresh();
        }
      }}
    >
      Cerrar sesión
    </Button>
  );
}
