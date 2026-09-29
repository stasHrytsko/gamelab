import type { Cells } from '../engine/catalog.ts';
import { sizeOf } from '../engine/catalog.ts';

/** Фигура из тайлов кита; размер клетки — переменная --u (наследуется), цвет — класс c-N. */
export function pieceHtml(cells: Cells, color: number, extra = ''): string {
  const { w, h } = sizeOf(cells);
  const filled = new Set(cells.map(([r, c]) => r * w + c));
  let tiles = '';
  for (let i = 0; i < w * h; i += 1) tiles += filled.has(i) ? `<i class="tile c-${String(color)}"></i>` : '<i></i>';
  return `<div class="pc ${extra}" style="--w:${String(w)};--h:${String(h)}">${tiles}</div>`;
}
