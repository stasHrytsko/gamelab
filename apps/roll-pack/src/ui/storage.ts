import { LEVEL_COUNT } from '../levels/levels.ts';

export interface Progress {
  readonly passed: readonly number[];
  readonly howToPlaySeen: boolean;
}

const KEY = 'build-pack:progress:v1';
const EMPTY: Progress = { passed: [], howToPlaySeen: false };

// Приватный режим и встроенные браузеры мессенджеров могут запрещать
// localStorage: тогда прогресс живёт до закрытия вкладки.
let memory: Progress = EMPTY;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return memory;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    memory = {
      passed: Array.isArray(parsed.passed) ? parsed.passed.filter((n) => Number.isInteger(n)) : [],
      howToPlaySeen: parsed.howToPlaySeen === true,
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

export function markPassed(level: number): void {
  const progress = loadProgress();
  if (progress.passed.includes(level)) return;
  save({ ...progress, passed: [...progress.passed, level].sort((a, b) => a - b) });
}

export function markHowToPlaySeen(): void {
  save({ ...loadProgress(), howToPlaySeen: true });
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
