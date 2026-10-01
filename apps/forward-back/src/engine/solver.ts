// Солвер для подбора и проверки уровней. В игру не входит (в бандл не попадает).
import { capturedBy, legalSteps, modesOf } from './forwardEngine.ts';
import type { Cell, Dir, Enemy, Mode } from './types.ts';

export interface Position {
  readonly hero: Cell;
  readonly enemies: readonly Enemy[];
}

export interface Action {
  readonly dir: Dir;
  readonly mode: Mode;
  readonly count: number;
  /** Были ли на этом шаге обе линии (настоящий выбор вперёд/назад). */
  readonly choice: boolean;
}

const key = (p: Position): string => `${String(p.hero.row)}${String(p.hero.col)}:${p.enemies.map((e) => e.id).join(',')}`;

function actions(p: Position): { action: Action; next: Position }[] {
  const out: { action: Action; next: Position }[] = [];
  for (const info of legalSteps(p)) {
    const modes = modesOf(info);
    for (const mode of modes) {
      const gone = new Set(capturedBy(info, mode));
      out.push({
        action: { dir: info.dir, mode, count: gone.size, choice: modes.length === 2 },
        next: { hero: info.to, enemies: p.enemies.filter((e) => !gone.has(e.id)) },
      });
    }
  }
  return out;
}

export interface Solution {
  readonly length: number;
  readonly path: readonly Action[];
}

/** Кратчайшее решение; `greedy: true` — разрешены только ходы с максимальным взятием на каждом шаге. */
export function solve(start: Position, limit: number, greedy = false): Solution | null {
  let frontier: { pos: Position; path: Action[] }[] = [{ pos: start, path: [] }];
  const seenAlways = new Set<string>([key(start)]);
  for (let depth = 1; depth <= limit; depth += 1) {
    const nextFrontier: typeof frontier = [];
    // Жадному режиму нужна уникальность только внутри слоя; обычному BFS — по всему поиску.
    const seen = greedy ? new Set<string>() : seenAlways;
    for (const { pos, path } of frontier) {
      let options = actions(pos);
      if (greedy) {
        const best = Math.max(0, ...options.map((o) => o.action.count));
        options = options.filter((o) => o.action.count === best);
      }
      for (const { action, next } of options) {
        if (next.enemies.length === 0) return { length: depth, path: [...path, action] };
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        nextFrontier.push({ pos: next, path: [...path, action] });
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

/** Сколько различных кратчайших решений (до `cap`), чтобы отсеять уровни с единственной очевидной линией. */
export function countOptimal(start: Position, optimum: number, cap = 50): number {
  let count = 0;
  const walk = (pos: Position, left: number): void => {
    if (count >= cap) return;
    for (const { next } of actions(pos)) {
      if (next.enemies.length === 0) {
        if (left === 1) count += 1;
      } else if (left > 1) walk(next, left - 1);
    }
  };
  walk(start, optimum);
  return count;
}
