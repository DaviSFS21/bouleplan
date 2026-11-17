// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateApiTypes } from './api-types.mjs';

describe('committed API schema types', () => {
  it('are up to date with contract/openapi.json (run `pnpm api:types`)', async () => {
    const contract = new URL('../../contract/openapi.json', import.meta.url);
    const committed = readFileSync(new URL('../src/api/schema.d.ts', import.meta.url), 'utf8');

    expect(committed).toBe(await generateApiTypes(contract));
  });
});
