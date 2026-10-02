import './styles.css';
import games from 'virtual:games';
import portrait from './assets/portrait.webp';
import { coverFor } from './covers';
import { siteHeader } from './nav';
import { escapeHtml, formatDate, posts } from './posts';

// Игра в блоке «New» на главной. Если её нет в сборке — берём последнюю из списка.
const FEATURED_GAME = 'the-gap';

const game = games.find((item) => item.path === FEATURED_GAME) ?? games.at(-1);
const post = posts[0];

function gameBlock(): string {
  if (game === undefined) return '<p class="empty-note">Games are on the way.</p>';
  return `
    <article class="feature-card game-feature">
      <a class="feature-picture" href="/${game.path}/" tabindex="-1" aria-hidden="true">
        <img src="${coverFor(game.path)}" alt="" loading="lazy">
        <span class="new-badge">New</span>
      </a>
      <div class="feature-body">
        <p class="feature-meta">${escapeHtml(game.genre)}</p>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.pitch)}</p>
        <a class="play-button" href="/${game.path}/">Play <b>▶</b></a>
      </div>
    </article>`;
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
      <section class="home-block about-block" id="about" aria-labelledby="about-title">
        <div class="about-card">
          <p class="eyebrow"><span></span>Independent game maker</p>
          <h1 id="about-title">My name is Stas<span>.</span></h1>
          <p class="about-lead">I make small games, prototypes and visual experiments — mostly to explore ideas, mix mechanics and see what happens.</p>
        </div>
        <figure class="photo-card">
          <img src="${portrait}" alt="Black-and-white portrait of Stas Hrytsko">
        </figure>
      </section>

      <section class="home-block" id="games" aria-labelledby="games-title">
        <h2 class="block-title" id="games-title">Games</h2>
        ${gameBlock()}
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
