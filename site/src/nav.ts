// Общая шапка: About и Contact ведут к блокам главной, Games и Blog — на свои страницы.
export type NavItem = 'about' | 'games' | 'blog' | 'contacts';

const links: [NavItem, string, string][] = [
  ['about', '/#about', 'About'],
  ['games', '/games/', 'Games'],
  ['blog', '/blog/', 'Blog'],
  ['contacts', '/#contacts', 'Contact'],
];

export function siteHeader(active?: NavItem, extraClass = ''): string {
  return `
    <header class="topbar ${extraClass}">
      <a class="brand" href="/" aria-label="Stazzi, home">Stazzi<span>.</span></a>
      <nav aria-label="Main navigation">
        ${links.map(([id, href, label]) => `<a href="${href}" data-nav="${id}"${id === active ? ' class="is-active"' : ''}>${label}</a>`).join('')}
      </nav>
    </header>`;
}
