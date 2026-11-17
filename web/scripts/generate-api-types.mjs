import { writeFileSync } from 'node:fs';
import { generateApiTypes } from './api-types.mjs';

const source = new URL('../../contract/openapi.json', import.meta.url);
const target = new URL('../src/api/schema.d.ts', import.meta.url);

writeFileSync(target, await generateApiTypes(source));
