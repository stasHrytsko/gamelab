import './styles.css';
import games from 'virtual:games';
import { coverFor } from './covers';
import { gameCard } from './game-card';
import { siteHeader } from './nav';
import { escapeHtml, formatDate, posts } from './posts';

// Игры на полке главной — по порядку. Чего нет в сборке, пропускаем;
// если не набралось четырёх, добираем из общего списка.
const SHELF = ['the-gap', 'the-dig', 'sprout', 'block-market'];
// Арты в коллаже первого экрана.
const COLLAGE = ['the-gap', 'the-dig', 'sprout', 'arrow-flip'];

const shelf = [
  ...SHELF.flatMap((path) => games.filter((game) => game.path === path)),
  ...games.filter((game) => !SHELF.includes(game.path)),
].slice(0, 4);
const collage = COLLAGE.filter((path) => games.some((game) => game.path === path));
const post = posts[0];

function collageBlock(): string {
  return collage
    .map((path, index) => `
      <a class="collage-item collage-item--${index + 1}" href="/${path}/" tabindex="-1" aria-hidden="true">
        <img src="${coverFor(path)}" alt="">
      </a>`)
    .join('');
}

function gamesBlock(): string {
  if (shelf.length === 0) return '<p class="empty-note">Games are on the way.</p>';
  return `<div class="game-shelf">${shelf.map((game) => gameCard(game)).join('')}</div>`;
}

function blogBlock(): string {
  if (post === undefined) return '<p class="empty-note">First post is coming soon.</p>';
  return `
    <a class="feature-card post-feature" href="/blog/#${post.slug}">
      <span class="new-badge">New</span>
      <div class="feature-body">
        <p class="feature-meta"><time datetime="${post.date}">${formatDate(post.date)}</time> · ${escapeHtml(post.tag)}</p>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
      <span class="arrow-button" aria-hidden="true">→</span>
    </a>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="site-shell home-shell">
    ${siteHeader()}

    <main>
      <section class="home-block hero" id="about" aria-labelledby="about-title">
        <div class="hero-copy">
          <p class="eyebrow"><span></span>Stas Hrytsko · Valencia</p>
          <h1 id="about-title">Hi, I’m Stas<span>.</span></h1>
          <p class="hero-lead">By day I help teams ship products. In the evenings I build small puzzle games — and check whether they’re actually fun.</p>
          <p class="hero-sub">${games.length} playable prototypes so far. Each one is a single mechanic, built fast and tested on real players.</p>
          <div class="hero-actions">
            <a class="play-button" href="/games/">Play the games <b>▶</b></a>
            <a class="text-button" href="/blog/">Read the blog <b>→</b></a>
          </div>
        </div>
        <div class="hero-collage" aria-hidden="true">${collageBlock()}</div>
      </section>

      <section class="home-block" id="games" aria-labelledby="games-title">
        <h2 class="block-title" id="games-title">Games</h2>
        ${gamesBlock()}
        <a class="more-link" href="/games/">More <b>→</b></a>
      </section>

      <section class="home-block" id="blog" aria-labelledby="blog-title">
        <h2 class="block-title" id="blog-title">Blog</h2>
        ${blogBlock()}
        <a class="more-link" href="/blog/">More <b>→</b></a>
      </section>

      <section class="home-block contacts-block" id="contacts" aria-labelledby="contacts-title">
        <div class="contacts-intro">
          <h2 id="contacts-title">Contacts</h2>
          <p>You can find me here.</p>
        </div>
        <div class="contact-links">
          <a href="https://github.com/stasHrytsko" target="_blank" rel="noreferrer"><span>GH</span>GitHub <b>↗</b></a>
          <a href="https://es.linkedin.com/in/stas-hrytsko" target="_blank" rel="noreferrer"><span>in</span>LinkedIn <b>↗</b></a>
          <span class="contact-placeholder" title="Behance link to be added"><span>Bē</span>Behance <b>·</b></span>
          <span class="contact-placeholder" title="Email address to be added"><span>@</span>Email <b>·</b></span>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <p>Stazzi — ideas, games & blog.</p>
      <a href="#about">Back to top <span>↑</span></a>
    </footer>
  </div>`;

// Подсвечиваем пункт шапки, чей блок сейчас посередине экрана.
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.topbar nav a[data-nav]');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset['nav'] === entry.target.id));
  });
}, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll<HTMLElement>('.home-block').forEach((section) => navObserver.observe(section));

// Коллаж чуть следует за курсором — слои двигаются с разной глубиной.
const collageNode = document.querySelector<HTMLElement>('.hero-collage');
const canHover = window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;
if (collageNode !== null && canHover) {
  const hero = collageNode.closest<HTMLElement>('.hero');
  hero?.addEventListener('pointermove', (event) => {
    const box = hero.getBoundingClientRect();
    collageNode.style.setProperty('--px', String((event.clientX - box.left) / box.width - .5));
    collageNode.style.setProperty('--py', String((event.clientY - box.top) / box.height - .5));
  });
  hero?.addEventListener('pointerleave', () => {
    collageNode.style.setProperty('--px', '0');
    collageNode.style.setProperty('--py', '0');
  });
}
