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
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.8 3.4 4.8 5.6 4.8 10.6A4.8 4.8 0 0112 18a4.8 4.8 0 01-4.8-4.9c0-2.2 1.2-3.7 2.3-4.8.2 1.6 1 2.7 2 3.1C11 8.6 11 5.4 12 2.5z" fill="currentColor"/><path d="M12 21.5c-2 0-3.3-1.3-3.3-3 0-1.5 1-2.4 1.9-3.3.2 1 .8 1.6 1.4 1.8.6-1.2 1.6-1.9 2.1-3.3.8 1.3 1.3 2.4 1.3 4.1 0 2.1-1.4 3.7-3.4 3.7z" fill="rgba(255,255,255,.55)"/></svg>',
  house: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2 12 4l8.5 7.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M6 10.5V19a1 1 0 001 1h3.5v-5h3v5H17a1 1 0 001-1v-8.5" fill="currentColor"/></svg>',
  brick: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M3 8h18M3 16h18M9 3v5M15 8v8M9 16v5"/></g></svg>',
  ember: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="1.8" fill="currentColor"/><circle cx="13.5" cy="12" r="1.4" fill="currentColor"/><circle cx="16" cy="16.5" r="1.6" fill="currentColor"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 11-2-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M19 3v4h-4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  finger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 21c-1.6-1.2-4-4-4.6-5.4-.5-1 .6-2 1.6-1.4l1.9 1.3V5.8a1.4 1.4 0 012.8 0v5.4l4.9.9c1.2.2 2 1.3 1.9 2.5l-.6 4.3c-.1.9-.5 1.6-1.1 2.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 3.2 6 2M12 1.5V.3M15.4 3.2l1-1.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
