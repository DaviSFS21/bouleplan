import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { serveIntrospectionApi } from '@/test/introspection-backend';
import { introspectoWorld } from '@/test/introspecto-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import Introspecto from './page';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

describe('Introspecto', () => {
  it('renders the weekly sheet', async () => {
    serveTaskApi(introspectoWorld);
    serveIntrospectionApi();

    renderWithQuery(<Introspecto />);

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fechar o Introspecto' })).toBeVisible();
  });
});
