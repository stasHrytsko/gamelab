import type { Color, Piece, Rule, Shape } from '../engine/types.ts';

// Фигура и клетка-правило (§7, §7.1): силуэт — форма, заливка — чистый цвет из токенов.

/** Силуэты в поле 100×100, подобраны на глаз под одинаковый визуальный вес (§7.1). */
const SHAPE: Record<Shape, (attrs: string) => string> = {
  o: (a) => `<circle cx="50" cy="50" r="45" ${a}/>`,
  s: (a) => `<rect x="9" y="9" width="82" height="82" rx="18" ${a}/>`,
  t: (a) => `<path d="M50 9 L93 86 L7 86 Z" stroke-linejoin="round" stroke-width="14" ${a}/>`,
};
const HIGHLIGHT: Record<Shape, readonly [number, number, number, number]> = { o: [34, 30, 13, 8], s: [32, 28, 14, 7], t: [46, 40, 8, 5] };
const TOKEN: Record<Color, string> = { B: 'blue', Y: 'yellow', C: 'coral' };
export const COLOR_NAME: Record<Color, string> = { B: 'синий', Y: 'жёлтый', C: 'коралловый' };
export const SHAPE_NAME: Record<Shape, string> = { o: 'круг', s: 'квадрат', t: 'треугольник' };

/** Градиенты фигур — один раз на документ. */
export function ensureDefs(): void {
  if (document.getElementById('ts-defs') !== null) return;
  const stops = (c: Color): string =>
    `<linearGradient id="ts-g${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, var(--ui-${TOKEN[c]}) 72%, white)"/><stop offset="1" style="stop-color:var(--ui-${TOKEN[c]})"/></linearGradient>`;
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg id="ts-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      ${stops('B')}${stops('Y')}${stops('C')}
    </defs></svg>`,
  );
}

/** Фигура: SVG 100×100, размер задаёт CSS. */
export function pieceSvg(piece: Piece, cls = ''): string {
  const c = piece[0] as Color;
  const s = piece[1] as Shape;
  const dark = `color-mix(in srgb, var(--ui-${TOKEN[c]}) 70%, black)`;
  const edge = SHAPE[s](`transform="translate(0 5)" fill="${dark}" stroke="${dark}"`);
  const body = SHAPE[s](`fill="url(#ts-g${c})" stroke="url(#ts-g${c})"`);
  const [hx, hy, rx, ry] = HIGHLIGHT[s];
  return `<svg class="piece ${cls}" viewBox="0 0 100 100" role="img" aria-label="${COLOR_NAME[c]} ${SHAPE_NAME[s]}" data-piece="${piece}">${edge}${body}<ellipse cx="${String(hx)}" cy="${String(hy)}" rx="${String(rx)}" ry="${String(ry)}" fill="rgba(255,255,255,.5)"/></svg>`;
}

/** Выдавленный контур для клетки-правила формы: фигура в него «вкладывается». */
export const outlineSvg = (s: Shape): string => `<svg class="emboss" viewBox="0 0 100 100" aria-hidden="true">${SHAPE[s]('')}</svg>`;

/** Класс и содержимое клетки по её правилу. */
export function ruleCell(rule: Rule): { cls: string; inner: string } {
  if (rule === '.') return { cls: 'joker', inner: '' };
  if (rule === 'B' || rule === 'Y' || rule === 'C') return { cls: `r${rule}`, inner: '' };
  return { cls: 'rshape', inner: outlineSvg(rule) };
}
