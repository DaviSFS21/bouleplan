import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { AppNav } from './app-nav';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

afterEach(() => {
  navigateTo('/');
});

describe('AppNav', () => {
  it('is a navigation landmark of page links, not a tablist', () => {
    render(<AppNav />);

    expect(screen.getByRole('navigation', { name: 'Seções' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('links the board and the week, with the board active on the home page', () => {
    render(<AppNav />);

    const board = screen.getByRole('link', { name: 'Quadro' });
    const week = screen.getByRole('link', { name: 'Semana' });
    expect(board).toHaveAttribute('href', '/');
    expect(week).toHaveAttribute('href', '/semana');
    expect(board).toHaveAttribute('aria-current', 'page');
    expect(week).not.toHaveAttribute('aria-current');
  });

  it('links Introspecto after the week, with the notebook icon and its label', () => {
    navigateTo('/introspecto');
    render(<AppNav />);

    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual(['Quadro', 'Semana', 'Introspecto']);
    const link = screen.getByRole('link', { name: 'Introspecto' });
    expect(link).toHaveAttribute('href', '/introspecto');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.querySelector('svg')).toHaveClass('lucide-notebook');
    expect(screen.getByRole('link', { name: 'Semana' })).not.toHaveAttribute('aria-current');
  });

  it('marks Introspecto active whatever the query', () => {
    navigateTo('/introspecto?semana=2026-11-09');
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Introspecto' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Quadro' })).not.toHaveAttribute('aria-current');
  });

  it('marks the week active on its page, whatever the query', () => {
    navigateTo('/semana?semana=2026-11-16');
    render(<AppNav />);

    expect(screen.getByRole('link', { name: 'Semana' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Quadro' })).not.toHaveAttribute('aria-current');
  });

  it('follows the route', () => {
    render(<AppNav />);

    act(() => {
      navigateTo('/semana');
    });

    expect(screen.getByRole('link', { name: 'Semana' })).toHaveAttribute('aria-current', 'page');
  });
});
