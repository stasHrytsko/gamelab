// Сборка сайта: dist/ — портфолио, dist/<path>/ — каждая игра из apps/*/game.json.
// Игра, которая не собралась, пропускается: сайт выходит с остальными.
// Собранная игра кэшируется по хэшу исходников и пересобирается, только
// если её файлы (или общий UI Design, lockfile, этот скрипт) поменялись.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO, readGames } from './games.mjs';

const DIST = join(REPO, 'dist');
const CACHE = join(REPO, 'node_modules', '.cache', 'gamelab-site');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-artifact', 'test-results', 'playwright-report']);
const SHARED = ['UI Design', 'package-lock.json', 'tools/build-site.mjs', 'tools/games.mjs'];

function addTree(hash, abs) {
  if (statSync(abs).isDirectory()) {
    for (const name of readdirSync(abs).sort()) {
      if (!SKIP_DIRS.has(name)) addTree(hash, join(abs, name));
    }
    return;
  }
  hash.update(relative(REPO, abs)).update('\0').update(readFileSync(abs)).update('\0');
}

function sourceHash(slug) {
  const hash = createHash('sha1');
  hash.update(process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? '').update('\0');
  for (const p of [join('apps', slug), ...SHARED]) addTree(hash, join(REPO, p));
  return hash.digest('hex').slice(0, 16);
}

function run(bin, args, cwd, env = {}) {
  const entry = bin === 'tsc'
    ? join(REPO, 'node_modules', 'typescript', 'bin', 'tsc')
    : join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
  execFileSync(process.execPath, [entry, ...args], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

function buildGame(game) {
  const dir = join(CACHE, game.path);
  const out = join(dir, sourceHash(game.slug));
  if (existsSync(join(out, 'index.html'))) {
    console.log(`= ${game.path}: без изменений, из кэша`);
    return out;
  }
  console.log(`\n> ${game.path}: сборка apps/${game.slug}`);
  rmSync(dir, { recursive: true, force: true });
  const cwd = join(REPO, 'apps', game.slug);
  run('tsc', ['--noEmit'], cwd);
  run('vite', ['build', '--base', `/${game.path}/`, '--outDir', out, '--emptyOutDir'], cwd);
  return out;
}

const games = readGames();
const built = [];
const failed = [];
for (const game of games) {
  try {
    built.push({ game, out: buildGame(game) });
  } catch (err) {
    failed.push(game);
    console.error(`\n✗ ${game.path}: не собралась, на сайт не попадёт (${err.message.split('\n')[0]})`);
  }
}
if (built.length === 0) {
  console.error('\n✗ Ни одна игра не собралась.');
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
console.log('\n> витрина');
run('tsc', ['--noEmit'], join(REPO, 'site'));
run('vite', ['build', '--outDir', DIST, '--emptyOutDir'], join(REPO, 'site'), {
  HUB_GAMES: JSON.stringify(built.map((b) => b.game)),
});
for (const { game, out } of built) {
  mkdirSync(join(DIST, game.path), { recursive: true });
  cpSync(out, join(DIST, game.path), { recursive: true });
}
mkdirSync(join(DIST, 'server'), { recursive: true });
cpSync(join(REPO, 'site', 'worker.mjs'), join(DIST, 'server', 'index.js'));
mkdirSync(join(DIST, '.openai'), { recursive: true });
cpSync(join(REPO, '.openai', 'hosting.json'), join(DIST, '.openai', 'hosting.json'));

console.log(`\n✓ На сайте ${built.length} из ${games.length}: ${built.map((b) => '/' + b.game.path + '/').join(' ')}`);
if (failed.length > 0) {
  console.warn(`⚠ Не собрались и пропущены: ${failed.map((g) => `apps/${g.slug}`).join(', ')}`);
}
