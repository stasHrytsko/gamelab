// Список игр витрины: каждая папка apps/<slug>/ с файлом game.json.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('..', import.meta.url));
const APPS = join(REPO, 'apps');
const FIELDS = ['idea', 'path', 'title', 'genre', 'pitch'];
// Витрина сама занимает эти имена в корне сайта.
const RESERVED = new Set(['assets', 'index.html']);

export function readGames() {
  const games = [];
  for (const slug of readdirSync(APPS).sort()) {
    const file = join(APPS, slug, 'game.json');
    if (!existsSync(file)) continue;
    const game = JSON.parse(readFileSync(file, 'utf8'));
    for (const f of FIELDS) {
      if (game[f] === undefined || game[f] === '') throw new Error(`apps/${slug}/game.json: нет поля "${f}"`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game.path) || RESERVED.has(game.path)) {
      throw new Error(`apps/${slug}/game.json: path "${game.path}" — только a-z, 0-9 и дефис`);
    }
    const twin = games.find((g) => g.path === game.path);
    if (twin) throw new Error(`apps/${slug} и apps/${twin.slug}: одинаковый path "${game.path}"`);
    games.push({ slug, idea: game.idea, path: game.path, title: game.title, genre: game.genre, pitch: game.pitch });
  }
  return games.sort((a, b) => a.idea - b.idea);
}
