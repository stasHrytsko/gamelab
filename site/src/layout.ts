import { escapeHtml, pageUrl, t, type Lang, type Page } from './i18n.ts';

const ICONS = {
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.6v-2c-3.2.7-3.8-1.5-3.8-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.800C23.4 5.6 18.3.500 12 .500z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.900v5.700H9.300V9h3.400v1.600c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.500v6.200zM5.3 7.400a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.200zM7.1 20.500H3.600V9h3.500v11.500z"/></svg>',
  behance: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-family="Manrope, sans-serif" font-weight="800" font-size="15" fill="currentColor">Bē</text></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.500L20.5 7"/></svg>',
} as const;

const CONTACTS = [
  { icon: ICONS.github, label: 'GitHub', href: 'https://github.com/stasHrytsko' },
  { icon: ICONS.linkedin, label: 'LinkedIn', href: 'https://es.linkedin.com/in/stas-hrytsko' },
  { icon: ICONS.behance, label: 'Behance', href: '' },
  { icon: ICONS.mail, label: 'Email', href: '' },
] as const;

/** Оригами-горы и листья по краям футера (как на макете). */
const DECOR_L = '<svg viewBox="0 0 360 280" aria-hidden="true"><polygon points="0,280 0,150 70,90 150,280" fill="#cdb995"/><polygon points="70,90 150,280 60,280" fill="#bba67f"/><polygon points="60,280 128,120 220,280" fill="#5f8a6e"/><polygon points="128,120 220,280 150,280" fill="#4c7459"/><polygon points="170,280 230,190 300,280" fill="#d9c9a8"/><polygon points="230,190 300,280 250,280" fill="#c7b690"/><polygon points="20,215 40,160 62,214" fill="#e08a4d"/><polygon points="40,160 62,214 48,214" fill="#c9692f"/><polygon points="96,280 130,240 160,280" fill="#7fa58f"/></svg>';
const DECOR_R = '<svg viewBox="0 0 420 300" aria-hidden="true"><polygon points="420,300 420,40 300,300" fill="#dac9a7"/><polygon points="420,40 300,300 350,300" fill="#c8b78f"/><polygon points="150,300 270,80 390,300" fill="#5f8a6e"/><polygon points="270,80 390,300 310,300" fill="#4c7459"/><polygon points="30,300 90,200 160,300" fill="#cdb995"/><polygon points="90,200 160,300 110,300" fill="#bba67f"/><polygon points="170,300 200,230 232,300" fill="#e0aa3f"/><polygon points="200,230 232,300 214,300" fill="#c4902c"/><polygon points="230,300 255,255 282,300" fill="#e08a4d"/><polygon points="255,255 282,300 268,300" fill="#c9692f"/></svg>';

/** Оригами-треугольники рядом с логотипом (как на макете). */
export const BRAND_MARK = '<svg class="brand-mark" viewBox="0 0 46 40" aria-hidden="true"><polygon points="2,38 20,6 38,38" fill="#e08a4d"/><polygon points="20,6 38,38 28,38" fill="#c9692f"/><polygon points="22,38 34,16 46,38" fill="#6f9a86"/><polygon points="34,16 46,38 40,38" fill="#5a8571"/></svg>';

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'uk' : 'en';
}

export function header(lang: Lang, page: Page): string {
  const d = t(lang);
  const home = pageUrl(lang, 'home');
  const active = (p: Page): string => (page === p ? ' class="is-active" aria-current="page"' : '');
  return `
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="paper-rough" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2"/></filter><filter id=\"paper-rough-s\" x=\"-4%\" y=\"-8%\" width=\"108%\" height=\"116%\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.09\" numOctaves=\"2\" seed=\"3\" result=\"n\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"n\" scale=\"1.8\"/></filter></svg>
    <header class="topbar">
      <div class="wrap topbar-in">
        <a class="brand" href="${home}" aria-label="Stazzi">
          <span class="brand-row"><span class="brand-name">STAZZI</span>${BRAND_MARK}</span>
          <span class="brand-tag">${escapeHtml(d.tagline)}</span>
        </a>
        <nav class="nav" id="site-nav" aria-label="Main">
          <a href="${page === 'home' ? '#top' : home}" data-scroll="top"${page === 'home' ? ' class="is-active"' : ''}>${d.nav.about}</a>
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
  const items = CONTACTS.map((c) =>
    c.href === ''
      ? `<li class="contact is-soon"><span class="contact-icon">${c.icon}</span><span class="contact-label">${c.label}</span><em>${escapeHtml(d.soon)}</em></li>`
      : `<li><a class="contact" href="${c.href}" target="_blank" rel="noreferrer"><span class="contact-icon">${c.icon}</span><span class="contact-label">${c.label}</span><b aria-hidden="true">↗</b></a></li>`,
  ).join('');
  return `
    <footer class="footer" id="contacts">
      <div class="foot-decor foot-l">${DECOR_L}</div>
      <div class="foot-decor foot-r">${DECOR_R}</div>
      <div class="wrap">
        <div class="foot-contact">
          <h2>${d.contactsTitle}</h2>
          <p class="foot-lead">${d.contactsLead}</p>
          <ul class="contact-list">${items}</ul>
        </div>
      </div>
    </footer>`;
}

export function sectionHead(title: string, lead: string, id: string): string {
  return `
    <div class="section-head">
      <h2 id="${id}">${escapeHtml(title)}</h2>
      ${lead === '' ? '' : `<p>${escapeHtml(lead)}</p>`}
    </div>`;
}
