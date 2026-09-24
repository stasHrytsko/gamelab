import { createState, resolveSwipe } from '../engine/taxiEngine.ts';
import type { Direction, LevelState, PassengerState } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/loadLevels.ts';
import { Board } from './board.ts';
import { wait } from './feedback.ts';
import { arrowIcon, glyph, icon, taxiCar } from './icons.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

function mostUrgent(passengers: readonly PassengerState[]): PassengerState | undefined {
  return passengers
    .filter((passenger) => passenger.status === 'waiting')
    .sort((a, b) => a.patience - b.patience)[0];
}

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="slide">${taxiCar('blue', '', 90)}</div>${arrowIcon('arrow')}<div class="hole"></div>${arrowIcon('arrow')}
    <div class="pax" style="--c:var(--ui-blue)"><span class="num">3</span><span class="mark">${glyph('blue', '')}</span></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Сдвигай такси пальцем в соседнюю пустую клетку.</span></li>
    <li><b>2</b><span>Подай такси того же цвета и знака к пассажиру, пока его число не стало нулём.</span></li>
    <li><b>3</b><span>Каждый сдвиг отнимает у всех ждущих по одному.</span></li>
    <li><b>4</b><span>Такси с пассажиром сразу уезжает и оставляет пустую клетку.</span></li>
  </ol>`;

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber - 1);
  let state: LevelState = createState(level);

  const el = document.createElement('main');
  el.className = 'screen';
  el.dataset['testid'] = 'game';
  el.dataset['level'] = String(levelNumber);
  el.dataset['moves'] = '0';
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-levels" aria-label="К уровням">${icon.levels}</button>
      <h2>Уровень ${String(levelNumber)}</h2><div class="spacer"></div>
    </div>
    <div class="queue" data-testid="queue"></div>
    <div class="stage"></div>
    <button class="help-fab" data-testid="help" aria-label="Как играть">?</button>`;
  const queueEl = el.querySelector<HTMLElement>('.queue');
  const stage = el.querySelector<HTMLElement>('.stage');
  if (queueEl === null || stage === null) throw new Error('game screen markup');

  let popupOpen = false;
  let lastCount = -1;
  let previous: string[] = [];

  const renderQueue = (): void => {
    const tokens = state.passengers
      .map((passenger) => {
        if (passenger.status === 'served') return `<span class="q served">${icon.check}</span>`;
        if (passenger.status === 'left') return `<span class="q left">${icon.cross}</span>`;
        if (passenger.status === 'waiting') return `<span class="q waiting c-${passenger.color}">${glyph(passenger.color, '')}</span>`;
        return '<span class="q queued"></span>';
      })
      .join('');
    const left = state.passengers.length - state.served;
    queueEl.innerHTML = `${tokens}<span class="count${left !== lastCount && lastCount !== -1 ? ' bump' : ''}" data-testid="left">${String(left)}</span>`;
    // Анимация «пришёл/развезён» только у тех, кто поменялся.
    queueEl.querySelectorAll<HTMLElement>('.q').forEach((token, index) => {
      token.dataset['status'] = state.passengers[index]?.status ?? '';
      if (previous[index] === token.dataset['status']) token.style.animation = 'none';
    });
    previous = state.passengers.map((passenger) => passenger.status);
    lastCount = left;
  };

  const board = new Board(state, {
    canMove: (taxiId, direction) =>
      state.status === 'playing' && resolveSwipe(level, state, { type: 'swipe-taxi', taxiId, direction }).valid,
    commit: (taxiId, direction) => play(taxiId, direction),
  });
  stage.append(board.el);
  renderQueue();

  const observer = new ResizeObserver(() => board.fit(stage.clientWidth, stage.clientHeight));
  observer.observe(stage);

  async function play(taxiId: string, direction: Direction): Promise<void> {
    const before = state;
    const outcome = resolveSwipe(level, before, { type: 'swipe-taxi', taxiId, direction });
    if (!outcome.valid || outcome.to === null) {
      board.setLocked(false);
      return;
    }
    const moved = before.taxis.find((taxi) => taxi.id === taxiId);
    const urgent = mostUrgent(before.passengers);
    log({
      type: 'move', level: levelNumber, color: moved?.color ?? '?', urgent: urgent?.color ?? null,
      waiting: before.passengers.filter((p) => p.status === 'waiting').map((p) => p.color),
    });
    state = outcome.state;
    el.dataset['moves'] = String(state.moves);

    await board.moveTaxi(taxiId, outcome.to);
    for (const passenger of state.passengers) {
      if (passenger.status === 'waiting' && before.passengers.find((p) => p.id === passenger.id)?.status === 'waiting') {
        board.setPatience(passenger);
      }
    }

    const byId = (id: string): PassengerState | undefined => before.passengers.find((p) => p.id === id);
    const manual = outcome.pickups.find((pickup) => !pickup.automatic);
    if (manual !== undefined) {
      const passenger = byId(manual.passengerId);
      if (passenger !== undefined) await board.pickup(manual.taxiId, passenger);
    }
    renderQueue();

    if (state.status === 'failed') {
      const leaving = state.passengers.filter((passenger) => passenger.status === 'left');
      await Promise.all(leaving.map((passenger) => board.passengerLeaves(passenger)));
      log({ type: 'level_fail', level: levelNumber, moves: state.moves, reason: 'passenger_timeout' });
      showLose();
      return;
    }

    for (const id of outcome.activatedPassengerIds) {
      const passenger = state.passengers.find((p) => p.id === id);
      if (passenger === undefined) continue;
      board.addPassenger({ ...passenger, status: 'waiting', patience: passenger.initialPatience });
    }
    for (const pickup of outcome.pickups.filter((p) => p.automatic)) {
      const passenger = state.passengers.find((p) => p.id === pickup.passengerId);
      if (passenger !== undefined) await board.pickup(pickup.taxiId, passenger);
    }

    if (state.status === 'won') {
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber, moves: state.moves });
      await wait(150);
      await board.celebrate();
      showWin();
      return;
    }
    board.setLocked(popupOpen);
  }

  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    board.setLocked(true);
    openPopup(el, content, actions.map((action) => ({
      ...action,
      run: () => {
        popupOpen = false;
        onClose?.();
        action.run();
      },
    })), testId);
  }

  function showWin(): void {
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Все пассажиры развезены</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Все пассажиры развезены</p>`,
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
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Неудача</h2><p class="sub">Пассажир не дождался</p>`,
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
      () => {
        markHowToPlaySeen();
        if (state.status === 'playing') board.setLocked(false);
      },
    );
  }

  el.querySelector('[data-testid="to-levels"]')?.addEventListener('click', toLevels);
  el.querySelector('[data-testid="help"]')?.addEventListener('click', () => {
    if (popupOpen || state.status !== 'playing') return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  log({ type: 'level_start', level: levelNumber });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    board.setLocked(true);
    popupOpen = true;
    setTimeout(showHowToPlay, 350);
  }

  return { el, destroy: () => observer.disconnect() };
}
