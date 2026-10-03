import { escapeHtml, pageUrl, t, type Lang, type Page } from './i18n.ts';

const CONTACTS = [
  { glyph: 'GH', label: 'GitHub', href: 'https://github.com/stasHrytsko' },
  { glyph: 'in', label: 'LinkedIn', href: 'https://es.linkedin.com/in/stas-hrytsko' },
  { glyph: 'Bē', label: 'Behance', href: '' },
  { glyph: '@', label: 'Email', href: '' },
] as const;

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'uk' : 'en';
}

export function header(lang: Lang, page: Page): string {
  const d = t(lang);
  const home = pageUrl(lang, 'home');
  const active = (p: Page): string => (page === p ? ' class="is-active" aria-current="page"' : '');
  return `
    <header class="topbar">
      <div class="wrap topbar-in">
        <a class="brand" href="${home}" aria-label="Stazzi">
          <span class="brand-name">STAZZI</span>
          <span class="brand-tag">${escapeHtml(d.tagline)}</span>
        </a>
        <nav class="nav" id="site-nav" aria-label="Main">
          <a href="${page === 'home' ? '#top' : home}" data-scroll="top">${d.nav.about}</a>
          <a href="${pageUrl(lang, 'games')}"${active('games')}>${d.nav.games}</a>
          <a href="${pageUrl(lang, 'blog')}"${active('blog')}>${d.nav.blog}</a>
          <a href="${home}#contacts">${d.nav.contacts}</a>
        </nav>
        <div class="topbar-tools">
          <a class="lang-switch" data-lang-switch href="${pageUrl(otherLang(lang), page)}" hreflang="${otherLang(lang)}" lang="${otherLang(lang)}" aria-label="${escapeHtml(d.switchLabel)}">${escapeHtml(d.switchTo)}</a>
          <button class="burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="${escapeHtml(d.menu)}"><i></i><i></i><i></i></button>
        </div>
      </div>
    </header>`;
}

export function footer(lang: Lang): string {
  const d = t(lang);
  const links = CONTACTS.map((c) =>
    c.href === ''
      ? `<span class="contact is-soon" title="${escapeHtml(d.soon)}"><span class="contact-glyph">${c.glyph}</span>${c.label}<em>${escapeHtml(d.soon)}</em></span>`
      : `<a class="contact" href="${c.href}" target="_blank" rel="noreferrer"><span class="contact-glyph">${c.glyph}</span>${c.label}<b>↗</b></a>`,
  ).join('');
  return `
    <footer class="footer" id="contacts">
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <h2>${d.contactsTitle}</h2>
            <p>${d.contactsLead}</p>
          </div>
          <div class="contact-list">${links}</div>
        </div>
        <div class="footer-bottom">
          <p>${escapeHtml(d.footer)}</p>
          <a href="#top" data-scroll="top">↑ ${d.backTop}</a>
        </div>
      </div>
    </footer>`;
}

export function sectionHead(title: string, lead: string, id: string): string {
  return `
    <div class="section-head">
      <h2 id="${id}">${escapeHtml(title)}</h2>
      <p>${escapeHtml(lead)}</p>
    </div>`;
}

export function moreCard(href: string, label: string, more: string): string {
  return `
    <a class="more-card" href="${href}">
      <span class="more-label">${escapeHtml(more)}</span>
      <span class="more-sub">${escapeHtml(label)}</span>
      <b class="more-arrow" aria-hidden="true">→</b>
    </a>`;
}
