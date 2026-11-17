import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/components/toast/toast';
import { createQueryClient } from '@/components/providers/providers';

export function renderWithQuery(ui: ReactElement) {
  const client = createQueryClient({ retry: false });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}
