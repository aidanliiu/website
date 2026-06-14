// Hero mark: always follows the cursor; its fill color flips from
// white to black as the page brightens while scrolling.
const hero = document.querySelector('.hero');
const heroMark = document.querySelector('.hero-mark');

if (hero && heroMark) {
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let markX = mouseX;
  let markY = mouseY;
  let progress = 0;

  const lerp = (a, b, t) => a + (b - a) * t;

  const render = () => {
    // Mark eases toward the cursor with a noticeable trailing delay; only
    // its color shifts instantly as the page brightens.
    markX = lerp(markX, mouseX, 0.07);
    markY = lerp(markY, mouseY, 0.07);
    const c = Math.round(lerp(244, 17, progress)); // #f4f4f2 -> #111111
    heroMark.style.transform = `translate(${markX - 9}px, ${markY - 9}px)`;
    heroMark.style.backgroundColor = `rgb(${c}, ${c}, ${c})`;
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  document.addEventListener('mouseleave', () => {
    mouseX = window.innerWidth / 2;
    mouseY = window.innerHeight / 2;
  });

  // Hero glow + page brightens to white over several scrolls.
  // The hero is 2.4x viewport tall, so this plays out across the
  // full scrollable distance of the hero and reaches pure white
  // exactly as the hero scrolls out — no seam with the section below.
  let scrollTicking = false;
  const updateHeroGlow = () => {
    const rect = hero.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrollRange = rect.height - vh;
    const raw = Math.min(Math.max(-rect.top / scrollRange, 0), 1);
    progress = 1 - Math.pow(1 - raw, 2); // ease-out

    // Saturate the white fade slightly before the hero's true end so
    // sub-pixel rounding near the boundary never leaves a sliver of the
    // dark hero background visible above the next section.
    const fadeProgress = Math.min(progress / 0.96, 1);

    hero.style.setProperty('--glow-scale', (0.25 + progress * 1.65).toFixed(3));
    hero.style.setProperty('--glow-opacity', progress.toFixed(3));
    hero.style.setProperty('--fade-opacity', Math.pow(fadeProgress, 2).toFixed(3));
    hero.style.setProperty('--content-opacity', Math.max(1 - progress, 0).toFixed(3));

    // Hide the cursor mark as the hero scrolls out so it never sits on top
    // of the next section's text.
    const markFade = 1 - Math.min(Math.max((progress - 0.85) / 0.15, 0), 1);
    heroMark.style.opacity = markFade.toFixed(3);

    scrollTicking = false;
  };

  updateHeroGlow();

  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(updateHeroGlow);
      scrollTicking = true;
    }
  }, { passive: true });
}

// Smooth, momentum-style scrolling: wheel input accumulates into a target
// scroll position that the page eases toward every frame, so scrolling
// flows continuously instead of jumping in discrete steps.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

  let target = window.scrollY;
  let current = window.scrollY;
  let ticking = false;

  const clamp = (v) => Math.min(Math.max(v, 0), maxScroll());

  const step = () => {
    // Single, slightly slow ease toward the target — a Lenis-style
    // smooth-scroll feel: each wheel notch nudges the target, and the
    // page glides the rest of the way there over several frames.
    current += (target - current) * 0.085;
    if (Math.abs(target - current) < 0.05) {
      current = target;
    }
    window.scrollTo(0, current);
    if (current !== target) {
      requestAnimationFrame(step);
    } else {
      ticking = false;
    }
  };

  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Normalize delta across input devices/browsers (line vs pixel mode)
    // and cap it so a single large notch doesn't cause a visible jump —
    // the easing then smooths the rest of the way.
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 18; // line mode
    else if (e.deltaMode === 2) delta *= window.innerHeight; // page mode
    delta = Math.max(Math.min(delta, 100), -100);

    target = clamp(target + delta);
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(step);
    }
  }, { passive: false });

  window.addEventListener('resize', () => {
    target = clamp(target);
  });

  // Route anchor-link clicks through the same easing loop.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      const dest = document.querySelector(id);
      if (!dest) return;
      e.preventDefault();
      const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      target = clamp(dest.getBoundingClientRect().top + window.scrollY - offset);
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(step);
      }
    });
  });

  // Keep target in sync if the user scrolls via keyboard, scrollbar drag,
  // or anchor links.
  window.addEventListener('scroll', () => {
    if (!ticking) {
      target = window.scrollY;
      current = window.scrollY;
    }
  }, { passive: true });
})();

// ============================================================
// Sticky activity stack: as the user scrolls through the section,
// the intro text shrinks away while the first card grows out from
// the center; each following card then falls in from the bottom
// and lands on top of the previous one.
// ============================================================
(() => {
  const section = document.querySelector('.stack-section');
  const intro = document.querySelector('.stack-intro');
  const cards = document.querySelectorAll('.stack-card');
  if (!section || !cards.length) return;

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

  let ticking = false;

  const update = () => {
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrolled = clamp01(-rect.top / (rect.height - vh || 1));
    // Animations finish slightly before the section ends, so there's a
    // bit of extra scroll on the last card's landed state before the
    // page moves on to the next section.
    const total = scrolled * (cards.length + 0.8);

    cards.forEach((card, i) => {
      // Each card occupies its own unit of "total" progress: card i is
      // fully held (p=0) until total reaches i, animates while total is
      // in [i, i+1], and is fully landed (p=1) by the time the next
      // card begins — so only one card animates at a time and every
      // held card sits at the exact same stacked position.
      const p = clamp01(total - i);
      card.style.setProperty('--p', p.toFixed(3));

      // Once a card has landed, keep tracking progress past it — this
      // drives a continued "growing toward the viewer" push as the next
      // card arrives on top, so finished cards feel like they're looming
      // larger / drifting off the front of the screen rather than just
      // sitting still underneath.
      const exitP = clamp01(total - (i + 1));
      const exitScale = exitP * 0.18;

      if (i === 0) {
        // First card grows out from the center, replacing the intro text.
        card.style.setProperty('--ty', '0px');
        card.style.setProperty('--scale', (0.05 + p * 0.95 + exitScale).toFixed(3));
      } else {
        // Later cards start lower, seen edge-on as a thin squashed sliver
        // near the bottom of the viewport, then unsquash and fall into
        // place on top of the previous card.
        const ease = p * p * (3 - 2 * p); // smoothstep for a softer landing
        // Rotation/squash eases in much faster (cubic) so the card stays
        // a thin sliver for most of its approach, then unfolds flat only
        // at the very end of the fall.
        const rxEase = p * p * p;
        card.style.setProperty('--ty', `${(1 - ease) * 48}vh`);
        // No horizontal offset — cards stack directly on top of each other.
        card.style.setProperty('--tx', '0px');
        card.style.setProperty('--scale', (1 + exitScale).toFixed(3));
        // Rotate in 3D so the card leans back into the stack at rest, then
        // unfolds flat as it lands. Held cards (p=0) all share the same
        // -48deg tilt and 48vh offset, so they recede behind one another
        // like a fanned deck, then flatten to face the viewer as they land.
        card.style.setProperty('--rx', `${-(1 - rxEase) * 48}deg`);
        // Push held cards back in depth so the fanned stack reads as a
        // receding deck; landed cards (p=1) sit flush at tz=0.
        card.style.setProperty('--tz', `${-(1 - ease) * (cards.length - i) * 18}px`);
      }
      // Opacity ramps to fully solid very quickly (within the first
      // quarter of the card's fall) so it covers the stacked cards
      // beneath it almost immediately, rather than staying see-through
      // for most of the animation.
      card.style.opacity = clamp01(p * 4).toFixed(3);
      card.style.zIndex = String(i + 1);
    });

    if (intro) {
      const p0 = clamp01(total - 0);
      // "My works" stays fully visible, split apart on either side of the
      // card so the card never covers it.
      intro.style.setProperty('--intro-opacity', '1');
      intro.style.setProperty('--intro-scale', (1 - p0 * 0.3 + p0 * p0 * 0.25).toFixed(3));
      intro.style.setProperty('--intro-split', `${(p0 * 280).toFixed(1)}px`);
    }

    ticking = false;
  };

  update();
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', update);
})();

// "My works" heading: the second word cycles through a short list of
// related nouns on a timer, sliding vertically like a flip board.
(() => {
  const track = document.querySelector('.intro-cycle-track');
  if (!track) return;
  const items = track.children;
  if (items.length < 2) return;

  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % items.length;
    track.style.transform = `translateY(-${idx * 1.3}em)`;
  }, 2200);
})();

// Generic reveal-on-scroll. Driven by a manual scroll/resize check rather
// than IntersectionObserver — simpler to reason about and avoids any
// edge cases with rootMargin/threshold on elements inside absolutely
// positioned / sticky containers (e.g. the "My works" stack heading).
const revealEls = Array.from(document.querySelectorAll('.reveal, .reveal-zoom, .reveal-stagger'));
const repeatableEls = Array.from(document.querySelectorAll('.reveal-zoom'));
let pendingReveal = revealEls.slice();

function checkReveals() {
  const vh = window.innerHeight;
  pendingReveal = pendingReveal.filter((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < vh * 0.92 && rect.bottom > 0) {
      el.classList.add('is-visible');
      return false;
    }
    return true;
  });

  // .reveal-zoom elements replay their zoom-in every time they're
  // scrolled out of view (above the viewport) and then back into view —
  // e.g. scrolling back to the top of the home page and down again.
  repeatableEls.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const inView = rect.top < vh * 0.92 && rect.bottom > 0;
    if (inView && !el.classList.contains('is-visible')) {
      el.classList.add('is-visible');
    } else if (!inView && rect.bottom < -150 && el.classList.contains('is-visible')) {
      // Scrolled well above the element — reset so the animation can
      // play again next time it comes into view. The larger buffer avoids
      // toggling on/off (and re-triggering the animation, which causes a
      // visible jitter/snap) from small back-and-forth scroll jiggles
      // right at the boundary.
      el.classList.remove('is-visible');
    }
  });

  if (pendingReveal.length === 0 && repeatableEls.length === 0) {
    window.removeEventListener('scroll', checkReveals);
    window.removeEventListener('resize', checkReveals);
  }
}

window.addEventListener('scroll', checkReveals, { passive: true });
window.addEventListener('resize', checkReveals);

// Defer the very first check until after layout has settled. Running it
// synchronously at script-load time can make absolutely-positioned /
// sticky elements (like the "My works" stack heading) report an
// "in view" bounding rect before the page has actually been scrolled,
// which would consume their zoom-in animation off-screen — leaving
// nothing left to play when the user actually scrolls to them.
requestAnimationFrame(() => requestAnimationFrame(checkReveals));

// Floating cards "drift toward viewer" as the intro section scrolls into view
const floatCards = document.querySelectorAll('.float-card');

const floatObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    } else if (entry.boundingClientRect.top > 0) {
      // scrolled back above viewport — reset so it can replay
      entry.target.classList.remove('is-visible');
    }
  });
}, { threshold: 0.2 });

floatCards.forEach((el) => floatObserver.observe(el));

// "Selected Works" divider: live mm:ss timer counting time on page.
const pageTimer = document.getElementById('page-timer');
if (pageTimer) {
  const startTime = Date.now();
  const updateTimer = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    pageTimer.textContent = `${mins}:${secs}`;
  };
  updateTimer();
  setInterval(updateTimer, 1000);
}

// "Get to know me" heading: split into words so they can fade/slide
// in one at a time, staggered, as the section scrolls into view.
const linksHeading = document.getElementById('links-heading');
if (linksHeading) {
  let i = 0;
  const nodes = Array.from(linksHeading.childNodes);
  const frag = document.createDocumentFragment();

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split(/(\s+)/).forEach((chunk) => {
        if (chunk.trim() === '') {
          // Normalize any whitespace run (which may include newlines and
          // indentation from the HTML source) to a single space so word
          // gaps are consistent.
          if (chunk !== '') frag.appendChild(document.createTextNode(' '));
        } else {
          const span = document.createElement('span');
          span.className = 'word';
          span.style.setProperty('--i', i++);
          span.textContent = chunk;
          frag.appendChild(span);
        }
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Treat elements like <em>word</em> as a single word, keeping
      // the original tag for styling.
      const wrapper = document.createElement(node.tagName);
      wrapper.className = 'word';
      wrapper.style.setProperty('--i', i++);
      wrapper.textContent = node.textContent;
      frag.appendChild(wrapper);
    }
  });

  linksHeading.replaceChildren(frag);

  // Toggle (not just add) the class so the word-by-word animation
  // replays every time the heading scrolls into view, in either
  // scroll direction.
  const headingObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      linksHeading.classList.toggle('is-visible', entry.isIntersecting);
    });
  }, { threshold: 0.4 });
  headingObserver.observe(linksHeading);
}

// ============================================================
// ============================================================
// Link info modal — clicking a card with a data-info attribute opens a
// short blurb about that link instead of (or before) navigating away.
// ============================================================
(() => {
  const modal = document.getElementById('info-modal');
  const body = document.getElementById('info-modal-body');
  if (!modal || !body) return;

  // Content keyed by each card's data-info attribute. Add more entries
  // here as info modals are wired up for other cards.
  const info = {
    art4hearts: {
      tag: 'Volunteering / Nonprofit',
      title: 'Art4Hearts International',
      body: `Art4Hearts International is a nonprofit that uses art as a way to bring
        comfort, healing, and connection to people facing trauma and
        adversity — running art-making workshops and community programs
        under the motto "creating smiles through art, one heart at a time."`,
      linkText: 'Visit art4heartsinternational.org ↗',
      linkHref: 'https://art4heartsinternational.org/',
      links: [
        { text: 'Instagram ↗', href: 'https://www.instagram.com/art4hearts' },
        { text: 'art4heartsinternational.org ↗', href: 'https://art4heartsinternational.org/' },
      ],
    },
    books: {
      tag: 'Reading list',
      title: 'Books',
      body: `Reading is one of my favorite ways to unwind, and these are
        the books I find myself recommending most. A mix of memoir,
        literary fiction, and historical storytelling — each one stuck
        with me long after I finished it. Here are a few favorites I keep
        coming back to:`,
      list: [
        'This Boy’s Life — Tobias Wolff',
        'Song of Solomon — Toni Morrison',
        'Homegoing — Yaa Gyasi',
        'All the Light We Cannot See — Anthony Doerr',
        'Short stories by F. Scott Fitzgerald',
      ],
    },
    food: {
      tag: 'Food',
      title: 'Favorite Restaurants',
      body: `I'm a bit obsessive about good food — I keep a running photo
        album of everything I eat, which has grown to over 250 photos at
        this point. One of my favorite spots is the Cupertino plaza, home
        to Yogurtland, Marufuku Ramen, and Harumi Sushi — pretty much a
        guaranteed good meal. Here's where to find more of my go-to places:`,
      links: [
        { text: 'My Google Maps list ↗', href: 'https://maps.app.goo.gl/BYuAG2xW6E6aQvM59' },
      ],
    },
    lift: {
      tag: 'Fitness',
      title: 'Weightlifting',
      body: `Basketball got me into the weight room, but lifting has
        become its own thing for me — I put in extra work outside of team
        practices, following my own push/pull/legs (PPL) split throughout
        the week. And yes, I mog my brother on every machine. Here's the
        actual routine I run:`,
      links: [
        { text: 'My PPL routine ↗', href: 'https://docs.google.com/document/d/18817g4gzQ7AMuSncTq-QOCjtzH-eZRZr/edit?usp=sharing&ouid=106465264769409867045&rtpof=true&sd=true' },
      ],
    },
    write: {
      tag: 'Writing',
      title: 'Writing',
      body: `Writing has become one of the things I take the most pride in
        outside of academics. Below are a couple of pieces — essays,
        in-class projects, and assessments — that I'm especially happy
        with. I'm always looking for ways to keep practicing and pushing my
        writing further:`,
      links: [
        { text: 'Piece 1 ↗', href: 'https://docs.google.com/document/d/1F9wYaebQ_mrBuzTv9wuOBZCY6AcvDSTIKRWUohhexB4/edit?usp=sharing' },
        { text: 'Piece 2 ↗', href: 'https://docs.google.com/document/d/1CGBZ9vGQ9GslL6Am5bcAS84JiwbfE7Q9uka8AbG44z4/edit?usp=sharing' },
      ],
    },
    wordle: {
      tag: 'Daily habit',
      title: 'Wordle & Connections',
      body: `Part of my morning routine — Wordle (guess a five-letter word
        in six tries) and Connections (sort sixteen words into four hidden
        categories) from the New York Times. I've played both every single
        day for a long time now, and keeping the streak alive has turned
        into a genuine point of pride.`,
      links: [
        { text: 'Wordle ↗', href: 'https://www.nytimes.com/games/wordle/index.html' },
        { text: 'Connections ↗', href: 'https://www.nytimes.com/games/connections' },
      ],
    },
  };

  const open = (key) => {
    const data = info[key];
    if (!data) return;
    const links = data.links || (data.linkHref ? [{ text: data.linkText, href: data.linkHref }] : []);
    const linksHtml = links.length
      ? `<div class="info-modal-links">${links
          .map((l) => `<a class="info-modal-link" href="${l.href}" target="_blank" rel="noopener">${l.text}</a>`)
          .join(' ')}</div>`
      : '';
    const listHtml = data.list
      ? `<ul class="info-modal-list">${data.list.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : '';
    body.innerHTML = `
      <span class="info-modal-tag">${data.tag}</span>
      <h3>${data.title}</h3>
      <p>${data.body}</p>
      ${listHtml}
      ${linksHtml}
    `;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  document.querySelectorAll('[data-info]').forEach((card) => {
    card.addEventListener('click', (e) => {
      const key = card.getAttribute('data-info');
      if (!info[key]) return;
      e.preventDefault();
      open(key);
    });
  });

  modal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
})();

// ============================================================
// "Get to know me" black box: a small rounded rectangle that grows to
// cover the entire screen as the links section scrolls into view, then
// stays as the full background for the rest of the section.
// ============================================================
(() => {
  const box = document.getElementById('links-box');
  const bg = document.querySelector('.links-box-bg');
  if (!box || !bg) return;

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const clampPx = (v, max) => Math.min(Math.max(v, 0), max);
  let ticking = false;

  const update = () => {
    const rect = box.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    // Grows as the box's top edge scrolls up into view (0 when the box
    // is one viewport-height below the top of the screen, 1 once its
    // top reaches the top of the viewport). Once fully grown — at the
    // very latest by the time the section reaches the top of the
    // viewport — it covers the entire page edge-to-edge and stays that
    // way for the rest of the scroll through the section.
    const enter = clamp01(((vh - rect.top) / vh) * 1.3);

    // Mirrors `enter`, but for the box's bottom edge scrolling up out of
    // view — ramps 0→1 as the section scrolls away, driving the shrink
    // and fade-out symmetrically with the grow/fade-in above.
    const exit = clamp01((((vh - rect.bottom) / vh) - 0.25) * 0.9);

    // Combined progress: grows in with `enter`, then shrinks back out
    // with `exit` — same curve, same speed, in reverse.
    const active = clamp01(enter - exit);

    // Full height from the very start, so the black background already
    // sits behind the heading/cards as soon as it's in view. It starts
    // already close to the full width of the screen, then expands the
    // rest of the way (its rounded corners flattening out) until it
    // covers the entire width of the screen — then reverses on the way out.
    const insetH = (1 - active) * vw * 0.01;
    // Keep the black top edge tracking just above the box's actual top
    // edge (small fixed gap) instead of a fraction of the viewport —
    // avoids a large empty gray gap before the heading.
    const insetTop = clampPx(rect.top - 120, vh);
    // Mirror the top gap on the bottom edge, so the black background
    // ends shortly after the cards instead of always filling to the
    // bottom of the viewport.
    const insetBottom = clampPx(vh - rect.bottom - 80, vh);
    const radius = (1 - active) * 48;
    bg.style.clipPath = `inset(${insetTop.toFixed(1)}px ${insetH.toFixed(1)}px ${insetBottom.toFixed(1)}px ${insetH.toFixed(1)}px round ${radius.toFixed(1)}px)`;

    // Fade in as the box enters and fade back out as it exits, synced
    // with the same `active` progress driving the expansion/shrink.
    bg.style.opacity = active.toFixed(3);
    ticking = false;
  };

  update();
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', update);
})();

// ============================================================
// "Get to know me" links grid: each button gets a randomized idle
// drift, then on hover it snaps toward the cursor (magnetic pull +
// slight tilt) while nearby buttons ease gently away.
// ============================================================
(() => {
  const grid = document.getElementById('links-grid');
  const buttons = Array.from(document.querySelectorAll('.link-btn'));
  if (!grid || !buttons.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  buttons.forEach((btn) => {
    const dx = (Math.random() - 0.5) * 16;
    const dy = (Math.random() - 0.5) * 16;
    const dr = (Math.random() - 0.5) * 2;
    const delay = Math.random() * -7;
    btn.style.setProperty('--drift-x', `${dx.toFixed(1)}px`);
    btn.style.setProperty('--drift-y', `${dy.toFixed(1)}px`);
    btn.style.setProperty('--drift-r', `${dr.toFixed(2)}deg`);
    btn.style.setProperty('--drift-delay', `${delay.toFixed(2)}s`);
  });

  if (reduceMotion) return;

  let activeBtn = null;

  buttons.forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      activeBtn = btn;
      grid.classList.add('is-hovering');
    });

    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const relX = (e.clientX - cx) / (rect.width / 2);
      const relY = (e.clientY - cy) / (rect.height / 2);

      btn.style.setProperty('--mx', `${(relX * 10).toFixed(1)}px`);
      btn.style.setProperty('--my', `${(relY * 10).toFixed(1)}px`);
      btn.style.setProperty('--mr', `${(relX * 1.5).toFixed(2)}deg`);

      btn.style.setProperty('--lx', `${(relX * 6).toFixed(1)}px`);
      btn.style.setProperty('--ly', `${(relY * 6).toFixed(1)}px`);
    });

    btn.addEventListener('mouseleave', () => {
      activeBtn = null;
      grid.classList.remove('is-hovering');
      btn.style.setProperty('--mx', '0px');
      btn.style.setProperty('--my', '0px');
      btn.style.setProperty('--mr', '0deg');
      btn.style.setProperty('--lx', '0px');
      btn.style.setProperty('--ly', '0px');
      buttons.forEach((b) => {
        b.style.setProperty('--px', '0px');
        b.style.setProperty('--py', '0px');
      });
    });
  });

  grid.addEventListener('mousemove', (e) => {
    if (!activeBtn) return;
    const gridRect = grid.getBoundingClientRect();
    const mx = e.clientX;
    const my = e.clientY;

    buttons.forEach((btn) => {
      if (btn === activeBtn) return;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const depth = parseFloat(btn.dataset.depth || '1');

      let dx = cx - mx;
      let dy = cy - my;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const maxDist = Math.max(gridRect.width, gridRect.height) * 0.6;
      const strength = Math.max(0, 1 - dist / maxDist);
      const push = strength * 14 * depth;

      const px = (dx / dist) * push;
      const py = (dy / dist) * push;

      btn.style.setProperty('--px', `${px.toFixed(1)}px`);
      btn.style.setProperty('--py', `${py.toFixed(1)}px`);
    });
  }, { passive: true });
})();

// Corgis running across the hero: each one wanders left/right at its own
// speed, occasionally stopping to rest, then picking a (possibly new)
// direction and pace again — like Google Colab's corgis but a bit more alive.
(() => {
  const track = document.querySelector('.corgi-track');
  if (!track) return;
  const corgis = Array.from(track.querySelectorAll('.corgi'));
  if (!corgis.length) return;

  const REF_SPEED = 100; // px/s — baseline used for leg/bob animation speed

  const state = corgis.map((el) => {
    const rtl = el.classList.contains('corgi--rtl');
    const width = el.offsetWidth || 68;
    const trackWidth = track.clientWidth || window.innerWidth;
    return {
      el,
      legs: el.querySelectorAll('.leg'),
      svg: el.querySelector('.corgi-svg'),
      width,
      dir: rtl ? -1 : 1,
      x: rtl ? trackWidth : -width,
      speed: 70 + Math.random() * 90,
      paused: false,
      pauseUntil: 0,
    };
  });

  const applyFacing = (c) => {
    c.el.classList.toggle('corgi--ltr', c.dir === 1);
    c.el.classList.toggle('corgi--rtl', c.dir === -1);
  };

  const applyPace = (c) => {
    const scale = REF_SPEED / c.speed;
    const duration = `${(0.5 * scale).toFixed(3)}s`;
    if (c.svg) c.svg.style.animationDuration = duration;
    c.legs.forEach((leg) => { leg.style.animationDuration = duration; });
  };

  state.forEach((c) => {
    applyFacing(c);
    applyPace(c);
  });

  let last = performance.now();

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const trackWidth = track.clientWidth || window.innerWidth;

    state.forEach((c) => {
      if (c.paused) {
        if (now >= c.pauseUntil) {
          c.paused = false;
          c.el.classList.remove('is-paused');
          // Pick a new pace, and sometimes a new direction, after resting.
          c.speed = 70 + Math.random() * 90;
          if (Math.random() < 0.5) {
            c.dir *= -1;
            applyFacing(c);
          }
          applyPace(c);
        }
      } else {
        c.x += c.dir * c.speed * dt;

        // Wrap around when fully off-screen.
        if (c.dir === 1 && c.x > trackWidth + 20) {
          c.x = -c.width - 20;
        } else if (c.dir === -1 && c.x < -c.width - 20) {
          c.x = trackWidth + 20;
        }

        // Small random chance per second to stop and rest a while.
        if (Math.random() < 0.12 * dt) {
          c.paused = true;
          c.pauseUntil = now + 1500 + Math.random() * 2500;
          c.el.classList.add('is-paused');
        } else if (Math.random() < 0.04 * dt) {
          // Occasionally turn around mid-stride without stopping.
          c.dir *= -1;
          applyFacing(c);
        }
      }

      c.el.style.left = `${c.x}px`;
    });

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
})();

// Page enter/exit zoom transition (Robin Clédière style), only for jumps
// into the "My works" stack section — not on the home page itself, and not
// for the links grid.
(() => {
  const root = document.documentElement;
  root.classList.remove('page-enter');

  const EXIT_MS = 450;

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    if (link.closest('.links-section')) return;

    const targetId = link.getAttribute('href').slice(1);
    if (targetId !== 'activities') return;

    const target = document.getElementById(targetId);
    if (!target) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      root.classList.add('page-exit');
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'instant' });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            root.classList.remove('page-exit');
          });
        });
      }, EXIT_MS);
    });
  });
})();
