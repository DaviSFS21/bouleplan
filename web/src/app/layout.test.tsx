import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout, { metadata } from './layout';

// O layout raiz renderiza <html>, que não cabe dentro do container do Testing
// Library; por isso a marcação é gerada no formato do servidor.
describe('RootLayout', () => {
  it('declara o idioma pt-BR e renderiza o conteúdo da página', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>conteúdo</p>
      </RootLayout>,
    );

    expect(html).toMatch(/^<html lang="pt-BR">/);
    expect(html).toContain('<body><p>conteúdo</p></body>');
  });

  it('define título e descrição da aplicação', () => {
    expect(metadata).toEqual({
      title: 'Bouléplan',
      description: 'Gerenciador pessoal de iniciativas e tarefas.',
    });
  });
});
