// Обложки игр — арт главного меню из UI Design/prototypes/<game>/assets/home-art,
// уменьшенный до 480px и сохранённый как src/covers/<path>.webp.
// Если обложки нет, берём og.png самой игры.
const files = import.meta.glob('./covers/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function coverFor(path: string): string {
  return files[`./covers/${path}.webp`] ?? `/${path}/og.png`;
}
