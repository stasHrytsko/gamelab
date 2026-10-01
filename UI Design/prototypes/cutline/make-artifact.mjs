// Собирает mockup.html в один самодостаточный HTML для публикации артефактом:
// токены кита и Poppins встраиваются внутрь (data:), теги документа снимаются —
// обёртку <html>/<head>/<body> артефакт добавляет сам.
// Запуск: node make-artifact.mjs <путь-к-выходному-файлу>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = join(here, '..', '..');
const html = readFileSync(join(here, 'mockup.html'), 'utf8');
const tokens = readFileSync(join(kit, 'design-tokens.css'), 'utf8').replace(
  /url\("\.\/fonts\/([^"]+)"\)/g,
  (_, f) => `url("data:font/ttf;base64,${readFileSync(join(kit, 'fonts', f)).toString('base64')}")`,
);
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
  .replace(/<meta[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="\.\.\/\.\.\/design-tokens\.css">/, `<style>\n${tokens}\n</style>`);
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(process.argv[2] ?? join(here, 'cutline-artifact.html'), head.trim() + '\n' + body.trim() + '\n');
