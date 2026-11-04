import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      // projectRoot '..': os caminhos no lcov ficam relativos à raiz do monorepo
      // (web/src/...), que é de onde o SonarQube Cloud resolve os arquivos.
      reporter: ['text', ['lcov', { projectRoot: '..' }]],
      reportsDirectory: 'coverage',
      include: ['src/**'],
    },
  },
});
