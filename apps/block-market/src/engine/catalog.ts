import { CFG } from './config.ts';

export type Cells = readonly (readonly [number, number])[];

interface Def {
  readonly rows: readonly string[];
  /** Базовая цена замены; к ней прибавляется CFG.SWAP_ADD. */
  readonly price: number;
  readonly cls: 'help' | 'tetro' | 'penta-easy' | 'penta-hard';
}

// Порядок ключей важен: от него зависит сдача (tools/block-market-sim.mjs тот же).
const DEFS = {
  mono: { rows: ['#'], price: 5, cls: 'help' },
  domino: { rows: ['##'], price: 3, cls: 'help' },
  I3: { rows: ['###'], price: 3, cls: 'help' },
  L3: { rows: ['#.', '##'], price: 3, cls: 'help' },
  I4: { rows: ['####'], price: 5, cls: 'tetro' },
  O: { rows: ['##', '##'], price: 4, cls: 'tetro' },
  T: { rows: ['###', '.#.'], price: 4, cls: 'tetro' },
  S: { rows: ['.##', '##.'], price: 3, cls: 'tetro' },
  Z: { rows: ['##.', '.##'], price: 3, cls: 'tetro' },
  L: { rows: ['#.', '#.', '##'], price: 4, cls: 'tetro' },
  J: { rows: ['.#', '.#', '##'], price: 4, cls: 'tetro' },
  I5: { rows: ['#####'], price: 6, cls: 'penta-easy' },
  L5: { rows: ['#.', '#.', '#.', '##'], price: 4, cls: 'penta-easy' },
  P5: { rows: ['##', '##', '#.'], price: 4, cls: 'penta-easy' },
  V5: { rows: ['#..', '#..', '###'], price: 4, cls: 'penta-easy' },
  T5: { rows: ['###', '.#.', '.#.'], price: 4, cls: 'penta-hard' },
  U5: { rows: ['#.#', '###'], price: 3, cls: 'penta-hard' },
  Y5: { rows: ['.#', '##', '.#', '.#'], price: 4, cls: 'penta-hard' },
  N5: { rows: ['.#', '.#', '##', '#.'], price: 3, cls: 'penta-hard' },
  W5: { rows: ['#..', '##.', '.##'], price: 3, cls: 'penta-hard' },
  X5: { rows: ['.#.', '###', '.#.'], price: 3, cls: 'penta-hard' },
  F5: { rows: ['.##', '##.', '.#.'], price: 3, cls: 'penta-hard' },
  Z5: { rows: ['##.', '.#.', '.##'], price: 3, cls: 'penta-hard' },
} as const satisfies Record<string, Def>;

export type PieceType = keyof typeof DEFS;
export const TYPES = Object.keys(DEFS) as PieceType[];

/** Цвета фигур — индексы 1–5 (синий, коралловый, жёлтый, зелёный, фиолетовый). 9 — камень. */
export const COLOR_COUNT = 5;
export const STONE = 9;
export const colorOf = (type: PieceType): number => (TYPES.indexOf(type) % COLOR_COUNT) + 1;

export const swapPrice = (type: PieceType): number => DEFS[type].price + CFG.SWAP_ADD;

export function weightOf(type: PieceType, level: number): number {
  switch (DEFS[type].cls) {
    case 'help': return 0.8;
    case 'tetro': return 3;
    case 'penta-easy': return 0.6 + 0.2 * level;
    case 'penta-hard': return 0.4 + 0.5 * level;
  }
}

// ---------- геометрия ----------
const parse = (rows: readonly string[]): Cells => {
  const cells: [number, number][] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([y, x]); }));
  return cells;
};

export function normalize(cells: Cells): Cells {
  const my = Math.min(...cells.map((c) => c[0]));
  const mx = Math.min(...cells.map((c) => c[1]));
  return cells.map(([y, x]) => [y - my, x - mx] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export const cellsKey = (cells: Cells): string => cells.map((c) => c.join(',')).join(';');
const rot90 = (cells: Cells): Cells => cells.map(([y, x]) => [x, -y] as const);
const flipH = (cells: Cells): Cells => cells.map(([y, x]) => [y, -x] as const);

/** Поворот на 90° по часовой стрелке. */
export const rotate = (cells: Cells): Cells => normalize(rot90(cells));
/** Зеркало слева направо. */
export const mirror = (cells: Cells): Cells => normalize(flipH(cells));

export const baseCells = (type: PieceType): Cells => normalize(parse(DEFS[type].rows));

/** Все различимые ориентации в порядке, как их обходит сдача (парность с симулятором). */
export function dealtForms(type: PieceType): Cells[] {
  const base = baseCells(type);
  const forms = new Map<string, Cells>();
  let c: Cells = base;
  for (let f = 0; f < 2; f += 1) {
    for (let r = 0; r < 4; r += 1) {
      const nc = normalize(c);
      forms.set(cellsKey(nc), nc);
      c = rot90(c);
    }
    c = flipH(base);
  }
  return [...forms.values()];
}

export const sizeOf = (cells: Cells): { w: number; h: number } => ({
  w: Math.max(...cells.map((c) => c[1])) + 1,
  h: Math.max(...cells.map((c) => c[0])) + 1,
});
