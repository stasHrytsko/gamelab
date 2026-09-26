// Вибрация есть только на Android; iOS молча игнорирует navigator.vibrate.
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // нет вибромотора или запрещено
  }
}

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, reducedMotion() ? Math.min(ms, 40) : ms));
