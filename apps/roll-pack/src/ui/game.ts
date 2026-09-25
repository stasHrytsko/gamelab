import { createState, fits, place } from '../engine/rollEngine.ts';
import type { DieIndex, GameState } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { Board } from './board.ts';
import { vibrate, wait } from './feedback.ts';
import { dieFace, icon, PLANK_COLOR, plankTile } from './icons.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

const ROLL_MS = 250;
// Кубики всегда случайны (§5): никаких зёрен и заготовленных бросков.
const random = (): number => Math.random();

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="die demo-die c-yellow">${dieFace(3)}</div>
    ${icon.arrow.replace('class=""', 'class="arrow"')}
    <div class="demo-plank">${plankTile(3)}</div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Выбери один из трёх кубиков — число равно длине планки.</span></li>
    <li><b>2</b><span>Перетащи планку и отпусти над ровным участком.</span></li>
    <li><b>3</b><span>Планка ложится только туда, где под ней нет ступенек.</span></li>
    <li><b>4</b><span>Заполни фигуру целиком. Если ни одно число никуда не ложится — попытка проиграна.</span></li>
  </ol>`;

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  let state: GameState = createState(level, random);
  let selected: DieIndex | null = null;
  let popupOpen = false;
  let busy = false;
  let rollShownAt = performance.now();
  let dieSwitches = 0;

  const el = document.createElement('main');
  el.className = 'screen';
  el.dataset['testid'] = 'game';
  el.dataset['level'] = String(levelNumber);
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-levels" aria-label="К уровням">${icon.levels}</button>
      <h2>Уровень ${String(levelNumber)}</h2><div class="spacer"></div>
    </div>
    <div class="stage"></div>
    <div class="tray" data-testid="dice"></div>
    <button class="help-fab" data-testid="help" aria-label="Как играть">?</button>`;
  const stage = el.querySelector<HTMLElement>('.stage');
  const trayEl = el.querySelector<HTMLElement>('.tray');
  if (stage === null || trayEl === null) throw new Error('game screen markup');
  const tray: HTMLElement = trayEl;

  const board = new Board(level.cap, { commit: (x) => void commit(x) });
  stage.append(board.el);
  const observer = new ResizeObserver(() => board.fit(stage.clientWidth, stage.clientHeight));
  observer.observe(stage);

  const syncData = (): void => {
    el.dataset['heights'] = state.heights.join(',');
    el.dataset['dice'] = state.dice.join(',');
    el.dataset['status'] = state.status;
    el.dataset['planks'] = String(state.planksPlaced);
  };

  function renderDice(rolling: boolean): void {
    tray.innerHTML = state.dice
      .map((value, i) => {
        const usable = fits(state.heights, state.cap, value);
        const cls = [
          'die', `c-${PLANK_COLOR[value] ?? 'blue'}`,
          usable ? '' : 'dead', selected === i ? 'selected' : '', rolling ? 'rolling' : '',
        ].join(' ');
        return `<button class="${cls}" data-die="${String(i)}" data-testid="die-${String(i)}" data-value="${String(value)}" aria-label="Кубик ${String(value)}" style="animation-delay:${String(i * 60)}ms">${dieFace(value)}</button>`;
      })
      .join('');
    syncData();
  }

  function locked(): boolean {
    return popupOpen || busy || state.status !== 'playing';
  }

  function applyLock(): void {
    board.setLocked(locked());
    el.toggleAttribute('data-busy', locked());
  }

  tray.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-die]');
    if (button === null || locked()) return;
    const index = Number(button.dataset['die']) as DieIndex;
    const value = state.dice[index];
    if (!fits(state.heights, state.cap, value)) {
      button.classList.remove('shake-x');
      void button.offsetWidth;
      button.classList.add('shake-x');
      vibrate(20);
      return;
    }
    if (selected === index) {
      selected = null;
      board.select(null, state.heights);
    } else {
      if (selected !== null) dieSwitches += 1;
      selected = index;
      board.select(value, state.heights);
    }
    renderDice(false);
  });

  async function commit(x: number): Promise<void> {
    if (selected === null || locked()) return;
    const die = selected;
    const before = state;
    const outcome = place(before, die, x, random);
    if (!outcome.valid) return;
    busy = true;
    applyLock();
    log({
      type: 'move', level: levelNumber, dice: [...before.dice], chosen: before.dice[die], x,
      heights: [...before.heights], dieSwitches, decisionMs: Math.round(performance.now() - rollShownAt),
    });

    state = outcome.state;
    selected = null;
    await board.drop(x);
    for (const row of outcome.completedRows) await board.flashRow(row);
    board.setHeights(state.heights);

    if (state.status === 'won') {
      renderDice(false);
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber, planks: state.planksPlaced });
      await board.celebrate();
      busy = false;
      showWin();
      return;
    }

    renderDice(true);
    await wait(ROLL_MS);
    rollShownAt = performance.now();
    dieSwitches = 0;

    if (state.status === 'failed') {
      tray.classList.add('shake-x');
      board.showNoFit();
      vibrate([30, 60, 30]);
      log({ type: 'level_fail', level: levelNumber, planks: state.planksPlaced, reason: 'no_fit', heights: [...state.heights], dice: [...state.dice] });
      await wait(900);
      busy = false;
      showLose();
      return;
    }
    busy = false;
    applyLock();
  }

  const replay = (): void => {
    // Тот же адрес: go() перерисует экран, и попытка начнётся с нового броска.
    go(`#/level/${String(levelNumber)}`);
  };
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    applyLock();
    openPopup(el, content, actions.map((action) => ({
      ...action,
      run: () => {
        popupOpen = false;
        onClose?.();
        applyLock();
        action.run();
      },
    })), testId);
  }

  function showWin(): void {
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Фигура заполнена целиком</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Фигура заполнена целиком</p>`,
      [
        { id: 'next', html: `Следующий уровень ${icon.arrow}`, className: 'btn-success', run: () => go(`#/level/${String(levelNumber + 1)}`) },
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-win',
    );
  }

  function showLose(): void {
    popup(
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Нет места</h2><p class="sub">Ни одно число не легло</p>`,
      [
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-primary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-lose',
    );
  }

  function showHowToPlay(): void {
    popup(
      HOW_TO_PLAY,
      [{ id: 'ok', html: 'Понятно!', className: 'btn-primary', run: () => undefined }],
      'popup-help',
      () => markHowToPlaySeen(),
    );
  }

  el.querySelector('[data-testid="to-levels"]')?.addEventListener('click', toLevels);
  el.querySelector('[data-testid="help"]')?.addEventListener('click', () => {
    if (locked()) return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  renderDice(true);
  applyLock();
  log({ type: 'level_start', level: levelNumber });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    applyLock();
    setTimeout(showHowToPlay, 350);
  }

  return { el, destroy: () => observer.disconnect() };
}
