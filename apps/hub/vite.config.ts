import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const uiDesign = fileURLToPath(new URL('../../UI Design', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@ui': uiDesign } },
  server: { fs: { allow: ['.', uiDesign] } },
  build: { target: 'es2020' },
});
