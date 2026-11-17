import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RootLayout, { metadata } from './layout';

// next/font is compiled by the Next.js SWC plugin, which does not run under Vitest.
vi.mock('next/font/google', () => {
  const font = (variable: string) => () => ({ variable: `${variable}-class` });
  return {
    Fraunces: font('display'),
    Spectral: font('body'),
    Work_Sans: font('ui'),
  };
});

// The root layout renders <html>, which cannot be mounted inside a Testing
// Library container, so the markup is rendered the way the server does it.
describe('RootLayout', () => {
  it('declares the pt-BR language, the font variables and renders the page content', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>content</p>
      </RootLayout>,
    );

    expect(html).toMatch(/^<html lang="pt-BR" class="display-class body-class ui-class">/);
    expect(html).toMatch(/<body><p>content<\/p><div role="status"[^>]*><\/div><\/body>/);
  });

  it('defines the app title and description', () => {
    expect(metadata).toEqual({
      title: 'Bouléplan',
      description: 'Gerenciador pessoal de iniciativas e tarefas.',
    });
  });
});
