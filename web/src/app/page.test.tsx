import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import Home from './page';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

describe('Home', () => {
  it('renders the initiatives screen', async () => {
    server.use(http.get('*/api/initiatives', () => HttpResponse.json([])));

    renderWithQuery(<Home />);

    expect(await screen.findByRole('navigation', { name: 'Iniciativas' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Todas as tarefas' })).toBeVisible();
  });
});
