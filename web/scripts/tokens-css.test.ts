// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTokensCss, type DesignTokens } from './tokens-css.mjs';

const tokens: DesignTokens = {
  color: {
    tokens: [
      { name: 'papel', value: { papel: '#F3ECDF', grafite: '#232323' } },
      { name: 'neutro', value: { papel: '#A89A82' } },
    ],
  },
  type: {
    groups: [
      {
        family: 'display',
        styles: [
          {
            name: 'titulo-pagina',
            fontSize: '32px',
            lineHeight: '40px',
            fontWeight: 600,
            fontStyle: 'normal',
            letterSpacing: '-0.01em',
          },
        ],
      },
      {
        family: 'body',
        styles: [
          {
            name: 'pergunta',
            fontSize: '22px',
            lineHeight: '30px',
            fontWeight: 400,
            fontStyle: 'italic',
          },
        ],
      },
    ],
  },
  spacing: { tokens: [{ name: 'space-4', value: '16px' }] },
  radius: { tokens: [{ name: 'radius-md', value: '8px' }] },
  shadow: {
    tokens: [
      { name: 'sombra-repouso', value: { papel: '0 1px 2px red', grafite: '0 1px 2px blue' } },
    ],
  },
};

function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `block ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('generateTokensCss', () => {
  const css = generateTokensCss(tokens);

  it('defines papel values, spacing, radius and type styles on :root', () => {
    const root = block(css, ':root');
    expect(root).toContain('--papel: #F3ECDF;');
    expect(root).toContain('--sombra-repouso: 0 1px 2px red;');
    expect(root).toContain('--space-4: 16px;');
    expect(root).toContain('--radius-md: 8px;');
    expect(root).toContain('--type-titulo-pagina: normal 600 32px/40px var(--font-display);');
    expect(root).toContain('--type-titulo-pagina-tracking: -0.01em;');
    expect(root).toContain('--type-pergunta: italic 400 22px/30px var(--font-body);');
  });

  it('defines grafite values under the explicit theme selector', () => {
    const grafite = block(css, '[data-theme="grafite"]');
    expect(grafite).toContain('--papel: #232323;');
    expect(grafite).toContain('--sombra-repouso: 0 1px 2px blue;');
  });

  it('follows the system dark preference unless papel is chosen explicitly', () => {
    const start = css.indexOf('@media (prefers-color-scheme: dark)');
    expect(start).toBeGreaterThanOrEqual(0);
    const media = css.slice(start);
    expect(media).toContain(':root:not([data-theme="papel"]) {');
    expect(media).toContain('--papel: #232323;');
  });

  it('falls back to the papel value when a token has no grafite value', () => {
    expect(block(css, '[data-theme="grafite"]')).toContain('--neutro: #A89A82;');
    expect(css.slice(css.indexOf('@media'))).toContain('--neutro: #A89A82;');
  });
});

describe('committed tokens.css', () => {
  it('is up to date with design-system/tokens.json (run `pnpm tokens`)', () => {
    const source = JSON.parse(
      readFileSync(new URL('../design-system/tokens.json', import.meta.url), 'utf8'),
    ) as DesignTokens;
    const committed = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

    expect(committed).toBe(generateTokensCss(source));
  });
});
