import './styles.css';
import { gameScreen, type RunParams, type Screen } from './ui/game.ts';
import { homeScreen } from './ui/screens.ts';

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
 * Для проверки: ?seed=N — та же партия, ?level=N — стартовать с N-го уровня,
 * ?goal=N — одна цель по линиям на все уровни.
 */
function runParams(): RunParams {
  const q = new URLSearchParams(location.search);
  const int = (name: string): number | null => {
    const raw = q.get(name);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const seed = int('seed');
  const level = int('level');
  const goal = int('goal');
  return {
    seed: seed ?? (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0,
    fixedSeed: seed !== null,
    level: level !== null && level >= 1 && level <= 12 ? level : 1,
    goal,
  };
}

function screenFor(hash: string): Screen {
  if (hash === '#/play') return gameScreen(go, runParams());
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
