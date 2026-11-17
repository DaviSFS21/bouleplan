import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { plannerWorld } from '@/test/planner-world';
import Week from './page';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

describe('Week', () => {
  it('renders the weekly planner', async () => {
    serveTaskApi(plannerWorld);

    renderWithQuery(<Week />);

    expect(await screen.findByRole('complementary', { name: 'Para planejar' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
