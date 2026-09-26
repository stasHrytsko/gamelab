import { createState, resolveSwipe } from '../engine/slideEngine.ts';
import type { Direction, LevelState, GoalState } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/loadLevels.ts';
import { Board } from './board.ts';
import { wait } from './feedback.ts';
import { arrowIcon, glyph, icon, colorTile } from './icons.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

function mostUrgent(goals: readonly GoalState[]): GoalState | undefined {
  return goals
    .filter((goal) => goal.status === 'waiting')
    .sort((a, b) => a.countdown - b.countdown)[0];
}

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    ${colorTile('blue', 'slide')}${arrowIcon('arrow')}<div class="hole"></div>${arrowIcon('arrow')}
    <div class="goal" style="--c:var(--ui-blue)"><span class="num">3</span><span class="mark">${glyph('blue', '')}</span></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Сдвигай плитку пальцем в соседнюю пустую клетку.</span></li>
    <li><b>2</b><span>Подведи плитку того же цвета и знака к кружку-цели, пока его число не стало нулём.</span></li>
    <li><b>3</b><span>Каждый сдвиг отнимает у всех ждущих целей по одному.</span></li>
    <li><b>4</b><span>Плитка у своей цели сразу выезжает с поля и оставляет пустую клетку.</span></li>
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
    const tokens = state.goals
      .map((goal) => {
        if (goal.status === 'served') return `<span class="q served">${icon.check}</span>`;
        if (goal.status === 'left') return `<span class="q left">${icon.cross}</span>`;
        if (goal.status === 'waiting') return `<span class="q waiting c-${goal.color}">${glyph(goal.color, '')}</span>`;
        return '<span class="q queued"></span>';
      })
      .join('');
    const left = state.goals.length - state.served;
    queueEl.innerHTML = `${tokens}<span class="count${left !== lastCount && lastCount !== -1 ? ' bump' : ''}" data-testid="left">${String(left)}</span>`;
    // Анимация «появилась/закрыта» только у тех, кто поменялся.
    queueEl.querySelectorAll<HTMLElement>('.q').forEach((token, index) => {
      token.dataset['status'] = state.goals[index]?.status ?? '';
      if (previous[index] === token.dataset['status']) token.style.animation = 'none';
    });
    previous = state.goals.map((goal) => goal.status);
    lastCount = left;
  };

  const board = new Board(state, {
    canMove: (blockId, direction) =>
      state.status === 'playing' && resolveSwipe(level, state, { type: 'swipe-block', blockId, direction }).valid,
    commit: (blockId, direction) => play(blockId, direction),
  });
  stage.append(board.el);
  renderQueue();

  const observer = new ResizeObserver(() => board.fit(stage.clientWidth, stage.clientHeight));
  observer.observe(stage);

  async function play(blockId: string, direction: Direction): Promise<void> {
    const before = state;
    const outcome = resolveSwipe(level, before, { type: 'swipe-block', blockId, direction });
    if (!outcome.valid || outcome.to === null) {
      board.setLocked(false);
      return;
    }
    const moved = before.blocks.find((block) => block.id === blockId);
    const urgent = mostUrgent(before.goals);
    log({
      type: 'move', level: levelNumber, color: moved?.color ?? '?', urgent: urgent?.color ?? null,
      waiting: before.goals.filter((p) => p.status === 'waiting').map((p) => p.color),
    });
    state = outcome.state;
    el.dataset['moves'] = String(state.moves);

    await board.moveBlock(blockId, outcome.to);
    for (const goal of state.goals) {
      if (goal.status === 'waiting' && before.goals.find((p) => p.id === goal.id)?.status === 'waiting') {
        board.setCountdown(goal);
      }
    }

    const byId = (id: string): GoalState | undefined => before.goals.find((p) => p.id === id);
    const manual = outcome.matches.find((match) => !match.automatic);
    if (manual !== undefined) {
      const goal = byId(manual.goalId);
      if (goal !== undefined) await board.match(manual.blockId, goal);
    }
    renderQueue();

    if (state.status === 'failed') {
      const leaving = state.goals.filter((goal) => goal.status === 'left');
      await Promise.all(leaving.map((goal) => board.goalLeaves(goal)));
      log({ type: 'level_fail', level: levelNumber, moves: state.moves, reason: 'goal_timeout' });
      showLose();
      return;
    }

    for (const id of outcome.activatedGoalIds) {
      const goal = state.goals.find((p) => p.id === id);
      if (goal === undefined) continue;
      board.addGoal({ ...goal, status: 'waiting', countdown: goal.initialCountdown });
    }
    for (const match of outcome.matches.filter((p) => p.automatic)) {
      const goal = state.goals.find((p) => p.id === match.goalId);
      if (goal !== undefined) await board.match(match.blockId, goal);
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
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Все цели закрыты</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Все цели закрыты</p>`,
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
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Неудача</h2><p class="sub">Счётчик цели дошёл до нуля</p>`,
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
