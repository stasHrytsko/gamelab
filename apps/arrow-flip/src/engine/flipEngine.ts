import { SIZE, type Block, type Dir, type FailReason, type GameState, type Level, type Status } from './types.ts';

/**
 * Правила хода — порт `applyMove` из `tools/arrow-flip-solver.mjs` (§4 спеки).
 * Блок едет по стрелке клетка за клеткой; все блоки, задетые гранью хотя бы
 * одной клеткой пути (включая старт и упор в конце), поворачиваются на 90° по
 * часовой ровно один раз; сам движущийся блок не поворачивается.
 */

const DELTA: Record<Dir, readonly [number, number]> = {
  '^': [-1, 0],
  '>': [0, 1],
  v: [1, 0],
  '<': [0, -1],
};
const ROTATE: Record<Dir, Dir> = { '^': '>', '>': 'v', v: '<', '<': '^' };

const key = (row: number, col: number): string => `${String(row)},${String(col)}`;
const inside = (row: number, col: number): boolean => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

function occupied(blocks: readonly Block[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of blocks) map.set(key(b.row, b.col), b.id);
  return map;
}

export interface Touch {
  readonly id: string;
  /** Индекс клетки пути (0 — стартовая), на которой блок был задет впервые. */
  readonly pathIndex: number;
  /** true — блок, в который движущийся упёрся спереди, а не задел сбоку. */
  readonly front: boolean;
}

export interface Move {
  readonly blockId: string;
  readonly dir: Dir;
  readonly from: readonly [number, number];
  /** null — блок ушёл за край. */
  readonly to: readonly [number, number] | null;
  readonly steps: number;
  readonly exited: boolean;
  readonly path: readonly (readonly [number, number])[];
  readonly touches: readonly Touch[];
}

export interface MoveOutcome {
  readonly blocks: readonly Block[];
  readonly move: Move;
}

/** Считает исход тапа по blockId без применения. null — тап недопустим (§4). */
export function planMove(blocks: readonly Block[], blockId: string): MoveOutcome | null {
  const mover = blocks.find((b) => b.id === blockId);
  if (mover === undefined) return null;
  const occ = occupied(blocks);
  const [dr, dc] = DELTA[mover.dir];
  let row = mover.row;
  let col = mover.col;
  let steps = 0;
  let exited = false;
  const path: [number, number][] = [[row, col]];

  for (;;) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (!inside(nextRow, nextCol)) { exited = true; break; }
    const hit = occ.get(key(nextRow, nextCol));
    if (hit !== undefined && hit !== blockId) break;
    row = nextRow;
    col = nextCol;
    steps += 1;
    path.push([row, col]);
  }
  if (!exited && steps === 0) return null;

  const touches: Touch[] = [];
  const seen = new Set<string>();
  path.forEach(([r, c], pathIndex) => {
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as const) {
      const hit = occ.get(key(nr, nc));
      if (hit === undefined || hit === blockId || seen.has(hit)) continue;
      seen.add(hit);
      const front = !exited && pathIndex === path.length - 1 && nr === row + dr && nc === col + dc;
      touches.push({ id: hit, pathIndex, front });
    }
  });

  const nextBlocks: Block[] = [];
  for (const b of blocks) {
    if (b.id === blockId) {
      if (!exited) nextBlocks.push({ ...b, row, col });
    } else {
      const touch = touches.find((t) => t.id === b.id);
      nextBlocks.push(touch === undefined ? b : { ...b, dir: ROTATE[b.dir] });
    }
  }

  return {
    blocks: nextBlocks,
    move: {
      blockId,
      dir: mover.dir,
      from: [mover.row, mover.col],
      to: exited ? null : [row, col],
      steps,
      exited,
      path,
      touches,
    },
  };
}

export function legalMoves(blocks: readonly Block[]): MoveOutcome[] {
  const out: MoveOutcome[] = [];
  for (const b of blocks) {
    const outcome = planMove(blocks, b.id);
    if (outcome !== null) out.push(outcome);
  }
  return out;
}

/** Блок может уйти за край прямо сейчас, ничего не задев обязательно. */
export function isExitReady(blocks: readonly Block[], blockId: string): boolean {
  const mover = blocks.find((b) => b.id === blockId);
  if (mover === undefined) return false;
  const occ = occupied(blocks);
  const [dr, dc] = DELTA[mover.dir];
  let row = mover.row + dr;
  let col = mover.col + dc;
  while (inside(row, col)) {
    if (occ.has(key(row, col))) return false;
    row += dr;
    col += dc;
  }
  return true;
}

export const hasAnyMove = (blocks: readonly Block[]): boolean => blocks.some((b) => planMove(blocks, b.id) !== null);

/** Блок вплотную перед стрелкой — тот, кого коротко подсвечивает недопустимый тап (§4, §7). */
export function frontNeighbor(blocks: readonly Block[], blockId: string): string | null {
  const mover = blocks.find((b) => b.id === blockId);
  if (mover === undefined) return null;
  const [dr, dc] = DELTA[mover.dir];
  const row = mover.row + dr;
  const col = mover.col + dc;
  if (!inside(row, col)) return null;
  return occupied(blocks).get(key(row, col)) ?? null;
}

export function createState(level: Level): GameState {
  return { level: level.id, blocks: level.blocks, moves: 0, moveLimit: level.moveLimit, status: 'playing', failReason: null };
}

function nextStatus(blocks: readonly Block[], moves: number, moveLimit: number): { status: Status; failReason: FailReason } {
  if (blocks.length === 0) return { status: 'won', failReason: null };
  if (moves >= moveLimit) return { status: 'failed', failReason: 'moves_exhausted' };
  if (!hasAnyMove(blocks)) return { status: 'failed', failReason: 'no_moves' };
  return { status: 'playing', failReason: null };
}

export interface TapResult {
  readonly state: GameState;
  readonly move: Move;
}

/** §4–5: применяет тап, порядок проверок — движение → повороты → moves+1 → победа → лимит → тупик. */
export function tap(state: GameState, blockId: string): TapResult | null {
  if (state.status !== 'playing') return null;
  const outcome = planMove(state.blocks, blockId);
  if (outcome === null) return null;
  const moves = state.moves + 1;
  const { status, failReason } = nextStatus(outcome.blocks, moves, state.moveLimit);
  return { state: { ...state, blocks: outcome.blocks, moves, status, failReason }, move: outcome.move };
}

/**
 * Trap-free (§6): из любого состояния, достижимого в пределах лимита,
 * уровень ещё выигрышен в оставшиеся ходы, и никакой ход не проигрывает.
 * Используется только для обучающих уровней и тестов — в игре не считается.
 */
export function isTrapFree(blocks: readonly Block[], moveLimit: number): boolean {
  const winMemo = new Map<string, boolean>();
  const stateKey = (bs: readonly Block[], left: number): string =>
    `${String(left)}|${[...bs].sort((a, b) => a.id.localeCompare(b.id)).map((b) => `${b.id}:${String(b.row)},${String(b.col)},${b.dir}`).join('|')}`;

  const winnable = (bs: readonly Block[], left: number): boolean => {
    if (bs.length === 0) return true;
    if (left === 0) return false;
    const k = stateKey(bs, left);
    const cached = winMemo.get(k);
    if (cached !== undefined) return cached;
    const result = legalMoves(bs).some((o) => winnable(o.blocks, left - 1));
    winMemo.set(k, result);
    return result;
  };
  const safe = (bs: readonly Block[], left: number): boolean => {
    if (bs.length === 0) return true;
    if (!winnable(bs, left)) return false;
    return legalMoves(bs).every((o) => safe(o.blocks, left - 1));
  };
  return safe(blocks, moveLimit);
}

/** Точный солвер (BFS по кратчайшему числу ходов). Только для тестов — не в игре. */
export function solve(blocks: readonly Block[], moveLimit: number): readonly string[] | null {
  const stateKey = (bs: readonly Block[]): string =>
    [...bs].sort((a, b) => a.id.localeCompare(b.id)).map((b) => `${b.id}:${String(b.row)},${String(b.col)},${b.dir}`).join('|');
  const queue: { blocks: readonly Block[]; path: string[] }[] = [{ blocks, path: [] }];
  const seen = new Set([stateKey(blocks)]);
  let head = 0;
  while (head < queue.length) {
    const node = queue[head];
    head += 1;
    if (node === undefined) break;
    if (node.path.length >= moveLimit) continue;
    for (const outcome of legalMoves(node.blocks)) {
      if (outcome.blocks.length === 0) return [...node.path, outcome.move.blockId];
      const k = stateKey(outcome.blocks);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ blocks: outcome.blocks, path: [...node.path, outcome.move.blockId] });
    }
  }
  return null;
}

/** Жадная стратегия: тапать только блоки, уже готовые к выходу (kill-критерий §1, §6, §8). */
export function greedySolves(blocks: readonly Block[], moveLimit: number): boolean {
  const stateKey = (bs: readonly Block[]): string =>
    [...bs].sort((a, b) => a.id.localeCompare(b.id)).map((b) => `${b.id}:${String(b.row)},${String(b.col)},${b.dir}`).join('|');
  const queue: { blocks: readonly Block[]; depth: number }[] = [{ blocks, depth: 0 }];
  const seen = new Set([stateKey(blocks)]);
  let head = 0;
  while (head < queue.length) {
    const node = queue[head];
    head += 1;
    if (node === undefined) break;
    if (node.depth >= moveLimit) continue;
    const ready = legalMoves(node.blocks).filter((o) => isExitReady(node.blocks, o.move.blockId));
    for (const outcome of ready) {
      if (outcome.blocks.length === 0) return true;
      const k = stateKey(outcome.blocks);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ blocks: outcome.blocks, depth: node.depth + 1 });
    }
  }
  return false;
}
