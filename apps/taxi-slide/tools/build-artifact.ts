/**
 * Сборка одним HTML-файлом для превью-артефакта на claude.ai, пока нет Vercel:
 *   npx tsx tools/build-artifact.ts
 * Скрипт, стили и шрифты — внутри файла; маршрут живёт в памяти.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, 'dist-artifact');
execSync('npx vite build --outDir dist-artifact --base ./ --emptyOutDir', {
  cwd: app,
  stdio: 'inherit',
  env: { ...process.env, VITE_ROUTER: 'memory' },
});

const assets = join(out, 'assets');
const files = readdirSync(assets);
const find = (ext: string): string => {
  const name = files.find((file) => file.endsWith(ext));
  if (name === undefined) throw new Error(`no ${ext} in build`);
  return readFileSync(join(assets, name), 'utf8');
};

const css = find('.css').replace(/url\(\.?\/?(?:assets\/)?([^)]+\.ttf)\)/g, (_match, font: string) => {
  const data = readFileSync(join(assets, font)).toString('base64');
  return `url(data:font/ttf;base64,${data})`;
});
const js = find('.js').replaceAll('</script', '<\\/script');

const page = `<title>Такси-пятнашки</title>
<style>${css}</style>
<div id="app"></div>
<script type="module">${js}</script>
`;
writeFileSync(join(out, 'taxi-slide.html'), page);
process.stdout.write(`dist-artifact/taxi-slide.html: ${String(Math.round(page.length / 1024))} KB\n`);
