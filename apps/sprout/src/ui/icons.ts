const svg = (body: string, cls = ''): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const icon = {
  levels: svg('<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></g>'),
  back: svg('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  play: svg('<path d="M7 4.5v15c0 .8.9 1.3 1.6.8l11-7.5c.6-.4.6-1.2 0-1.6l-11-7.5C7.9 3.2 7 3.7 7 4.5z" fill="currentColor"/>'),
  lock: svg('<rect x="4.5" y="10.5" width="15" height="10.5" rx="3" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  cross: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>'),
  cup: svg('<path d="M7 3.5h10v6.5a5 5 0 01-10 0z" fill="currentColor"/><path d="M7 5.5H4.5a3 3 0 003 4.5M17 5.5h2.5a3 3 0 01-3 4.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.8" y="14.5" width="2.4" height="3.5" fill="currentColor"/><rect x="7.5" y="18" width="9" height="2.8" rx="1.2" fill="currentColor"/>'),
  arrow: svg('<path d="M4 12h14m-5-5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  replay: svg('<path d="M5 12a7 7 0 107-7H8.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10.5 2.5L8 5l2.5 2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  moves: svg('<g fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.5"/><rect x="9.5" y="3" width="5" height="5" rx="1.5"/><rect x="16" y="3" width="5" height="5" rx="1.5"/><rect x="3" y="9.5" width="5" height="5" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/><rect x="16" y="9.5" width="5" height="5" rx="1.5"/></g>'),
};

/** Игровые значки поля (§7): у каждого типа клетки своя форма, не только цвет. */
export const glyph = {
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C9 7 5.5 10.6 5.5 14.6a6.5 6.5 0 0013 0C18.5 10.6 15 7 12 2.5z" fill="currentColor"/><path d="M9 14.5a3 3 0 002.2 2.9" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-linecap="round"/></svg>',
  rock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 16 7.2 8.6l5.6-2.3 4.4 3.9-1.1 6.6-6.1 1.7z" fill="rgba(255,255,255,.34)"/><path d="M14.8 19.2 16.4 15.4l3.9.5.6 3.3-2.8 1.3z" fill="rgba(255,255,255,.26)"/></svg>',
  sprout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5v-8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M12 13c0-4-3-6.5-7.5-6.5C4.5 10.5 7.5 13 12 13z" fill="currentColor"/><path d="M12 11c0-3.6 2.8-6 7.5-6 0 3.8-3 6-7.5 6z" fill="currentColor"/></svg>',
  seed: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="6" ry="4.6" fill="currentColor"/><path d="M12 11.5V7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 8c0-2.6 2-4.3 5.2-4.3 0 2.7-2 4.3-5.2 4.3z" fill="currentColor"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19C5 10 10 5 20 4c0 10-5 15-15 15z" fill="currentColor"/><path d="M5 19l8-8" stroke="rgba(255,255,255,.45)" stroke-width="1.6" stroke-linecap="round"/></svg>',
  rays: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v2.6M4.9 4.9l1.8 1.8M19.1 4.9l-1.8 1.8M2 12h2.6M19.4 12H22"/></g></svg>',
  finger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 21c-1.6-1.2-4-4-4.6-5.4-.5-1 .6-2 1.6-1.4l1.9 1.3V5.8a1.4 1.4 0 012.8 0v5.4l4.9.9c1.2.2 2 1.3 1.9 2.5l-.6 4.3c-.1.9-.5 1.6-1.1 2.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 3.2 6 2M12 1.5V.3M15.4 3.2l1-1.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
