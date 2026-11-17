'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function createQueryClient({ retry = 1 }: { retry?: number | false } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry, refetchOnWindowFocus: false, staleTime: 30_000 } },
  });
}

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
