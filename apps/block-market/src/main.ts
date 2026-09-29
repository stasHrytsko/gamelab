import './styles.css';
import { LEVEL_COUNT } from './levels/levels.ts';
import { gameScreen, type GameParams, type Screen } from './ui/game.ts';
import { homeScreen, levelsScreen } from './ui/screens.ts';
import { isUnlocked } from './ui/storage.ts';

// Маршруты в hash: ссылка вида /#/play открывается на любом статическом
// хостинге и во встроенных браузерах мессенджеров без настройки сервера.
const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

let current: Screen | null = null;

// Во встроенном превью (артефакт claude.ai) адрес страницы менять нельзя —
// там маршрут живёт в памяти. Сборка: VITE_ROUTER=memory.
const inMemory = import.meta.env['VITE_ROUTER'] === 'memory';
let memoryRoute = '#/';
const route = (): string => (inMemory ? memoryRoute : location.hash);

function go(next: string): void {
  if (inMemory) {
    memoryRoute = next;
    render();
  } else if (location.hash === next || (next === '#/' && location.hash === '')) render();
  else location.hash = next;
}

/**
 * Для проверки: ?seed=N — своё зерно вместо зерна уровня, ?goal=N — своя цель
 * по линиям (0 — уровень проходится всегда), ?unlock=all — открыть все уровни.
 */
function gameParams(level: number): GameParams {
  const q = new URLSearchParams(location.search);
  const int = (name: string): number | null => {
    const raw = q.get(name);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  return { level, seed: int('seed'), goal: int('goal') };
}

function screenFor(hash: string): Screen {
  const match = /^#\/level\/(\d+)$/.exec(hash);
  if (match !== null) {
    const n = Number(match[1]);
    if (n >= 1 && n <= LEVEL_COUNT && isUnlocked(n)) return gameScreen(go, gameParams(n));
    if (inMemory) memoryRoute = '#/levels';
    else history.replaceState(null, '', '#/levels');
    return { el: levelsScreen(go), destroy: () => undefined };
  }
  if (hash === '#/levels') return { el: levelsScreen(go), destroy: () => undefined };
  return { el: homeScreen(go), destroy: () => undefined };
}

function render(): void {
  current?.destroy();
  current = screenFor(route());
  root?.replaceChildren(current.el);
}

if (!inMemory) window.addEventListener('hashchange', render);
// iOS: щипок и двойной тап не должны масштабировать игру.
document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('dblclick', (event) => event.preventDefault());
render();
