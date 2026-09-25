import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const uiDesign = fileURLToPath(new URL('../../UI Design', import.meta.url));

// Превью ссылки в мессенджерах требует абсолютный адрес картинки. Vercel
// отдаёт боевой домен проекта в VERCEL_PROJECT_PRODUCTION_URL во время сборки.
function siteUrl(): Plugin {
  const host = process.env['VERCEL_PROJECT_PRODUCTION_URL'];
  const origin = host ? `https://${host}` : '';
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', origin),
  };
}

export default defineConfig({
  plugins: [siteUrl()],
  resolve: { alias: { '@ui': uiDesign } },
  server: { fs: { allow: ['.', uiDesign] } },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120_000 },
});
