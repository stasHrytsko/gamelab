import { LEVEL_COUNT } from '../levels/levels.ts';
import type { Stars } from '../engine/types.ts';

export interface Progress {
  readonly passed: readonly number[];
  /** Лучшие звёзды по уровню (§3). */
  readonly best: Readonly<Record<string, Stars>>;
  /** Сколько попыток начато на уровне — по нему выбирается раскладка (§5). */
  readonly attempts: Readonly<Record<string, number>>;
  readonly howToPlaySeen: boolean;
  /** Обучающая подсветка соседей уже показана (§7). */
  readonly clueTipSeen: boolean;
}

const KEY = 'excavation:progress:v1';
const EMPTY: Progress = { passed: [], best: {}, attempts: {}, howToPlaySeen: false, clueTipSeen: false };

// Приватный режим и встроенные браузеры мессенджеров могут запрещать
// localStorage: тогда прогресс живёт до закрытия вкладки.
let memory: Progress = EMPTY;

const record = <T>(value: unknown, ok: (v: unknown) => v is T): Record<string, T> =>
  value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, T] => ok(entry[1])))
    : {};
const isStars = (v: unknown): v is Stars => v === 0 || v === 1 || v === 2 || v === 3;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return memory;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    memory = {
      passed: Array.isArray(parsed.passed) ? parsed.passed.filter((n) => Number.isInteger(n)) : [],
      best: record(parsed.best, isStars),
      attempts: record(parsed.attempts, isCount),
      howToPlaySeen: parsed.howToPlaySeen === true,
      clueTipSeen: parsed.clueTipSeen === true,
    };
  } catch {
    // остаётся то, что в памяти
  }
  return memory;
}

function save(next: Progress): void {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // см. комментарий к memory
  }
}

/** Выход с ≥1★ (§5): уровень пройден, лучшие звёзды обновлены. */
export function markPassed(level: number, stars: Stars): void {
  const p = loadProgress();
  const key = String(level);
  save({
    ...p,
    passed: p.passed.includes(level) ? p.passed : [...p.passed, level].sort((a, b) => a - b),
    best: { ...p.best, [key]: Math.max(p.best[key] ?? 0, stars) as Stars },
  });
}

/** Начало попытки (§5): раскладка = attempts mod 20, затем attempts += 1. */
export function startAttempt(level: number, layouts: number): { layout: number; attempt: number } {
  const p = loadProgress();
  const key = String(level);
  const done = p.attempts[key] ?? 0;
  save({ ...p, attempts: { ...p.attempts, [key]: done + 1 } });
  return { layout: done % layouts, attempt: done + 1 };
}

export function markHowToPlaySeen(): void {
  save({ ...loadProgress(), howToPlaySeen: true });
}

export function markClueTipSeen(): void {
  save({ ...loadProgress(), clueTipSeen: true });
}

/** `?unlock=all` в адресе открывает все уровни на эту вкладку, для проверки. */
const unlockAll = new URLSearchParams(location.search).get('unlock') === 'all';

export function isUnlocked(level: number): boolean {
  if (unlockAll || level === 1) return true;
  return loadProgress().passed.includes(level - 1);
}

/** Первый непройденный уровень; после пятого — пятый. */
export function currentLevel(): number {
  const { passed } = loadProgress();
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    if (!passed.includes(level)) return level;
  }
  return LEVEL_COUNT;
}
