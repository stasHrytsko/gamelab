import { defineConfig, type Plugin } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
import { resolve } from 'node:path';
import { readGames } from '../tools/games.mjs';

// `virtual:games` — список игр из apps/*/game.json. Скрипт сборки сайта
// (tools/build-site.mjs) передаёт в HUB_GAMES только те, что собрались.
function games(): Plugin {
  const id = 'virtual:games';
  return {
    name: 'games',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) return undefined;
      const list = process.env['HUB_GAMES'] ?? JSON.stringify(readGames());
      return `export default ${list};`;
    },
  };
}

export default defineConfig({
  plugins: [sites(), games()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        blog: resolve(import.meta.dirname, 'blog/index.html'),
      },
    },
  },
});
