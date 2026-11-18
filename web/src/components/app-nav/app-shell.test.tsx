import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PHONE, setViewport } from '@/test/viewport';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

function order() {
  return Array.from(document.body.querySelectorAll('header, nav, main')).map((element) =>
    element.tagName.toLowerCase(),
  );
}

describe('AppShell', () => {
  it('puts the header navigation before the page on a desktop', () => {
    render(
      <AppShell>
        <main>Página</main>
      </AppShell>,
    );

    expect(order()).toEqual(['header', 'nav', 'main']);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('puts the bottom bar after the page on a phone, so it is not the first tab stop', () => {
    setViewport(PHONE);
    render(
      <AppShell>
        <main>Página</main>
      </AppShell>,
    );

    expect(order()).toEqual(['main', 'nav']);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Seções' }).className).toContain('bar');
  });
});
