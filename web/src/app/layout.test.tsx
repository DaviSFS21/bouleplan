import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout, { metadata } from './layout';

// The root layout renders <html>, which cannot be mounted inside a Testing
// Library container, so the markup is rendered the way the server does it.
describe('RootLayout', () => {
  it('declares the pt-BR language and renders the page content', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>content</p>
      </RootLayout>,
    );

    expect(html).toMatch(/^<html lang="pt-BR">/);
    expect(html).toContain('<body><p>content</p></body>');
  });

  it('defines the app title and description', () => {
    expect(metadata).toEqual({
      title: 'Bouléplan',
      description: 'Gerenciador pessoal de iniciativas e tarefas.',
    });
  });
});
