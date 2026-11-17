import { readFileSync, writeFileSync } from 'node:fs';
import { generateTokensCss } from './tokens-css.mjs';

const source = new URL('../design-system/tokens.json', import.meta.url);
const target = new URL('../src/styles/tokens.css', import.meta.url);

writeFileSync(target, generateTokensCss(JSON.parse(readFileSync(source, 'utf8'))));
