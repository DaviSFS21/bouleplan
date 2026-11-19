import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { PHONE, setViewport } from '@/test/viewport';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

function order() {
  return Array.from(document.body.querySelectorAll('header, nav, main')).map((element) =>
    element.tagName.toLowerCase(),
  );
}

afterEach(() => {
  navigateTo('/');
});

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

  it('shows the lockup, the section links and an empty area for the account menu', () => {
    const { container } = render(
      <AppShell>
        <main>Página</main>
      </AppShell>,
    );

    const header = container.querySelector('header');
    expect(screen.getByRole('link', { name: 'Bouléplan' })).toHaveAttribute('href', '/');
    expect(header?.querySelectorAll('img')).toHaveLength(2);
    expect(header?.querySelector('[data-slot="account"]')).toBeEmptyDOMElement();
  });

  it('puts the bottom bar after the page on a phone, so it is not the first tab stop', () => {
    setViewport(PHONE);
    render(
      <AppShell>
        <main>Página</main>
      </AppShell>,
    );

    expect(order()).toEqual(['header', 'main', 'nav']);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Seções' }).className).toContain('bar');
  });

  it('names the current section in the compact top bar of a phone', () => {
    setViewport(PHONE);
    navigateTo('/semana?semana=2026-11-16');
    const { container } = render(
      <AppShell>
        <main>Página</main>
      </AppShell>,
    );

    expect(container.querySelector('header')).toHaveTextContent('Semana');
    expect(container.querySelector('header a')).toBeNull();
  });

  it('falls back to the board title on an unknown path', () => {
    setViewport(PHONE);
    navigateTo('/outra');
    const { container } = render(
      <AppShell>
        <main>Página</main>
      </AppShell>,
    );

    expect(container.querySelector('header')).toHaveTextContent('Quadro');
  });
});
