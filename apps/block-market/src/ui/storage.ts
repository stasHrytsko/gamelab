export interface Progress {
  /** Больше всего пройденных уровней подряд за один забег. */
  readonly best: number;
  readonly howToPlaySeen: boolean;
}

const KEY = 'block-market:progress:v1';
const EMPTY: Progress = { best: 0, howToPlaySeen: false };

// Приватный режим и встроенные браузеры мессенджеров могут запрещать
// localStorage: тогда прогресс живёт до закрытия вкладки.
let memory: Progress = EMPTY;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return memory;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    memory = { best: Number.isInteger(parsed.best) ? Math.max(0, parsed.best as number) : 0, howToPlaySeen: parsed.howToPlaySeen === true };
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

export function recordBest(levelsCleared: number): void {
  const progress = loadProgress();
  if (levelsCleared > progress.best) save({ ...progress, best: levelsCleared });
}

export function markHowToPlaySeen(): void {
  save({ ...loadProgress(), howToPlaySeen: true });
}
