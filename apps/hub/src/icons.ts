import type { GameEntry } from './games.ts';

const svg = (body: string, cls = ''): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

const GLYPH: Readonly<Record<GameEntry['cover'][number], string>> = {
  red: '<circle cx="12" cy="12" r="9" fill="currentColor"/>',
  blue: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="currentColor"/>',
  yellow:
    '<path d="M12 3.2c.7 0 1.3.4 1.7 1l8 14c.8 1.4-.2 3-1.7 3H4c-1.5 0-2.5-1.6-1.7-3l8-14c.4-.6 1-1 1.7-1z" fill="currentColor"/>',
};

export const icon = {
  play: svg(
    '<path d="M7 4.5v15c0 .8.9 1.3 1.6.8l11-7.5c.6-.4.6-1.2 0-1.6l-11-7.5C7.9 3.2 7 3.7 7 4.5z" fill="currentColor"/>',
  ),
};

/** Декоративная обложка карточки: тайлы игры вперемешку с пустыми клетками. */
export function cover(colors: GameEntry['cover']): string {
  const cells = colors.flatMap((color) => [
    `<div class="tile c-${color}">${svg(GLYPH[color])}</div>`,
    '<div class="hole"></div>',
  ]);
  return `<div class="cover" aria-hidden="true">${cells.join('')}</div>`;
}
