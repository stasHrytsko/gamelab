export interface PopupAction {
  readonly id: string;
  readonly html: string;
  readonly className: string;
  readonly run: () => void;
}

/** Показывает попап поверх экрана; кнопка закрывает его и выполняет действие. */
export function openPopup(host: HTMLElement, content: string, actions: readonly PopupAction[], testId: string): () => void {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.dataset['testid'] = testId;
  scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${content}<div class="actions">${actions
    .map((action) => `<button class="btn ${action.className}" data-action="${action.id}">${action.html}</button>`)
    .join('')}</div></div>`;

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    scrim.classList.add('closing');
    setTimeout(() => scrim.remove(), 170);
  };
  scrim.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    const action = actions.find((candidate) => candidate.id === button?.dataset['action']);
    if (action === undefined) return;
    close();
    action.run();
  });
  host.append(scrim);
  return close;
}
