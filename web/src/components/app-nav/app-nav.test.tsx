import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { AppNav } from './app-nav';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

afterEach(() => {
  navigateTo('/');
});

describe('AppNav', () => {
  it('links the board and the week, with the board active on the home page', () => {
    render(<AppNav />);

    const board = screen.getByRole('tab', { name: 'Quadro' });
    const week = screen.getByRole('tab', { name: 'Semana' });
    expect(board).toHaveAttribute('href', '/');
    expect(week).toHaveAttribute('href', '/semana');
    expect(board).toHaveAttribute('aria-selected', 'true');
    expect(board).toHaveAttribute('aria-current', 'page');
    expect(week).toHaveAttribute('aria-selected', 'false');
    expect(week).not.toHaveAttribute('aria-current');
  });

  it('marks the week active on its page, whatever the query', () => {
    navigateTo('/semana?semana=2026-11-16');
    render(<AppNav />);

    expect(screen.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Quadro' })).toHaveAttribute('aria-selected', 'false');
  });

  it('follows the route', () => {
    render(<AppNav />);

    act(() => {
      navigateTo('/semana');
    });

    expect(screen.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-selected', 'true');
  });
});
