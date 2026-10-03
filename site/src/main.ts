import './styles.css';
import { renderBlog } from './pages/blog.ts';
import { renderGames } from './pages/games.ts';
import { renderHome } from './pages/home.ts';
import { pageUrl, t, type Lang, type Page } from './i18n.ts';

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');
const app: HTMLElement = root;
const lang: Lang = document.documentElement.lang === 'uk' ? 'uk' : 'en';
const page = (document.body.dataset['page'] ?? 'home') as Page;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setMeta(title: string, description: string): void {
  document.title = title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta !== null) meta.content = description;
}

function render(): void {
  const d = t(lang);
  if (page === 'blog') {
    const view = renderBlog(lang);
    app.innerHTML = view.html;
    setMeta(view.title, view.description);
  } else if (page === 'games') {
    app.innerHTML = renderGames(lang);
    setMeta(d.gamesPageTitle, d.gamesPageDesc);
  } else {
    app.innerHTML = renderHome(lang);
    setMeta(d.homeTitle, d.homeDesc);
  }
  activate();
}

function activate(): void {
  // Меню на телефоне.
  const burger = app.querySelector<HTMLButtonElement>('.burger');
  const nav = app.querySelector<HTMLElement>('.nav');
  const topbar = app.querySelector<HTMLElement>('.topbar');
  const setOpen = (open: boolean): void => {
    burger?.setAttribute('aria-expanded', String(open));
    topbar?.classList.toggle('menu-open', open);
  };
  burger?.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));

  // «About» и «Back to top» просто прокручивают к шапке.
  app.querySelectorAll<HTMLAnchorElement>('[data-scroll="top"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (link.getAttribute('href') !== '#top') return;
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  });

  // Переключатель языка остаётся на той же статье блога.
  const switcher = app.querySelector<HTMLAnchorElement>('[data-lang-switch]');
  if (switcher !== null) switcher.href = `${pageUrl(lang === 'en' ? 'uk' : 'en', page)}${page === 'blog' ? window.location.hash : ''}`;

  // Появление карточек.
  const cards = app.querySelectorAll<HTMLElement>('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    cards.forEach((node) => node.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    cards.forEach((node) => observer.observe(node));
  }

  // Фильтры блога.
  app.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = button.dataset['filter'] ?? 'all';
      app.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === button));
      app.querySelectorAll<HTMLElement>('.archive-row').forEach((row) => {
        row.hidden = selected !== 'all' && row.dataset['tag'] !== selected;
      });
    });
  });

  // Якорь на странице («Contacts»).
  if (window.location.hash === '#contacts') document.getElementById('contacts')?.scrollIntoView();
}

render();
if (page === 'blog') {
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}
