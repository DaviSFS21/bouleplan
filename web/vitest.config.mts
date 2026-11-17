import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// Deadline wording depends on the local date, so tests run in a fixed zone, not the machine's.
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      // projectRoot '..': lcov paths become relative to the monorepo root
      // (web/src/...), which is where SonarQube Cloud resolves files from.
      reporter: ['text', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage',
      include: ['src/**'],
      exclude: ['src/test/**'],
    },
  },
});
