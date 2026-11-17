import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { initiative, problemResponse } from '@/test/fixtures';
import { server } from '@/test/server';
import { ApiError } from './problem';
import { useCreateInitiative, useInitiatives } from './initiatives';

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  );
}

describe('useInitiatives', () => {
  it('loads the initiatives from GET /api/initiatives', async () => {
    server.use(http.get('*/api/initiatives', () => HttpResponse.json([initiative()])));

    const { result } = renderHook(() => useInitiatives(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([initiative()]);
    });
  });

  it('fails with an ApiError for a problem response', async () => {
    server.use(http.get('*/api/initiatives', () => problemResponse('internal', 500)));

    const { result } = renderHook(() => useInitiatives(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
    expect(result.current.error).toMatchObject({ status: 500, code: 'internal' });
  });
});

describe('useCreateInitiative', () => {
  it('posts the name, returns the created initiative and refreshes the list', async () => {
    const created = initiative({ id: '22222222-2222-4222-8222-222222222222', name: 'Horta' });
    const items = [initiative()];
    let body: unknown;
    server.use(
      http.get('*/api/initiatives', () => HttpResponse.json(items)),
      http.post('*/api/initiatives', async ({ request }) => {
        body = await request.json();
        items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const { result } = renderHook(
      () => ({ list: useInitiatives(), create: useCreateInitiative() }),
      {
        wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.create.mutateAsync('Horta');
    });

    expect(body).toEqual({ name: 'Horta' });
    expect(returned).toEqual(created);
    expect(result.current.list.data).toHaveLength(2);
  });

  it('rejects with the problem code on a 400', async () => {
    server.use(http.post('*/api/initiatives', () => problemResponse('initiative.name.blank')));

    const { result } = renderHook(() => useCreateInitiative(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('')).rejects.toMatchObject({
        status: 400,
        code: 'initiative.name.blank',
      });
    });
  });

  it('keeps the created initiative in the list when the refetch fails', async () => {
    const created = initiative({ id: '22222222-2222-4222-8222-222222222222', name: 'Horta' });
    let gets = 0;
    server.use(
      http.get('*/api/initiatives', () => {
        gets += 1;
        return gets === 1 ? HttpResponse.json([initiative()]) : problemResponse('internal', 500);
      }),
      http.post('*/api/initiatives', () => HttpResponse.json(created, { status: 201 })),
    );

    const { result } = renderHook(
      () => ({ list: useInitiatives(), create: useCreateInitiative() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(async () => {
      await result.current.create.mutateAsync('Horta');
    });

    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(result.current.list.data).toEqual([initiative(), created]);
  });

  it('does not duplicate an initiative the refetch already returned', async () => {
    const created = initiative({ id: '22222222-2222-4222-8222-222222222222', name: 'Horta' });
    const items = [initiative()];
    server.use(
      http.get('*/api/initiatives', () => HttpResponse.json(items)),
      http.post('*/api/initiatives', () => {
        if (!items.includes(created)) items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const { result } = renderHook(
      () => ({ list: useInitiatives(), create: useCreateInitiative() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    await act(async () => {
      await result.current.create.mutateAsync('Horta');
      await result.current.create.mutateAsync('Horta');
    });

    expect(result.current.list.data).toEqual([initiative(), created]);
  });
});
