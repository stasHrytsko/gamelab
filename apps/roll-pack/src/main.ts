import './styles.css';
import { LEVEL_COUNT } from './levels/levels.ts';
import { gameScreen, type Screen } from './ui/game.ts';
import { homeScreen, levelsScreen } from './ui/screens.ts';
import { isUnlocked } from './ui/storage.ts';

// Маршруты в hash: ссылка вида /#/level/2 открывается на любом статическом
// хостинге и во встроенных браузерах мессенджеров без настройки сервера.
const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

let current: Screen | null = null;

function go(next: string): void {
  if (location.hash === next || (next === '#/' && location.hash === '')) render();
  else location.hash = next;
}

function screenFor(hash: string): Screen {
  const match = /^#\/level\/(\d+)$/.exec(hash);
  if (match !== null) {
    const n = Number(match[1]);
    if (n >= 1 && n <= LEVEL_COUNT && isUnlocked(n)) return gameScreen(n, go);
    history.replaceState(null, '', '#/levels');
    return { el: levelsScreen(go), destroy: () => undefined };
  }
  if (hash === '#/levels') return { el: levelsScreen(go), destroy: () => undefined };
  return { el: homeScreen(go), destroy: () => undefined };
}

function render(): void {
  current?.destroy();
  current = screenFor(location.hash);
  root?.replaceChildren(current.el);
}

window.addEventListener('hashchange', render);
// iOS: щипок и двойной тап не должны масштабировать игру.
document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('dblclick', (event) => event.preventDefault());
render();
