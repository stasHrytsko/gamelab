import { escapeHtml } from './i18n.ts';

function inline(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function renderMarkdown(source: string): string {
  return source
    .split(/\r?\n\r?\n+/)
    .map((block) => {
      const clean = block.trim();
      const lines = clean.split(/\r?\n/);
      if (clean.startsWith('## ')) return `<h2>${inline(clean.slice(3))}</h2>`;
      if (clean.startsWith('### ')) return `<h3>${inline(clean.slice(4))}</h3>`;
      if (lines.every((line) => line.startsWith('- '))) {
        return `<ul>${lines.map((line) => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
      }
      if (lines.every((line) => line.startsWith('> '))) {
        return `<blockquote>${inline(clean.replace(/^> /gm, '').replace(/\r?\n/g, ' '))}</blockquote>`;
      }
      return `<p>${inline(clean.replace(/\r?\n/g, ' '))}</p>`;
    })
    .join('');
}
