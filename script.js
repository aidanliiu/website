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
    current += (target - current) * 0.09;
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
    delta = Math.max(Math.min(delta, 120), -120);

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
    const total = scrolled * cards.length;

    cards.forEach((card, i) => {
      const p = clamp01(total - i);
      card.style.setProperty('--p', p.toFixed(3));
      if (i === 0) {
        // First card grows out from the center, replacing the intro text.
        card.style.setProperty('--ty', '0px');
        card.style.setProperty('--scale', (0.05 + p * 0.95).toFixed(3));
      } else {
        // Later cards start lower and off to the side, next to the
        // previous card and seen edge-on as a thin line (hinged at their
        // top edge, rotated perpendicular), then slide in and fall
        // forward/down like a flap to land flat on top, covering the
        // previous card.
        const ease = p * p * (3 - 2 * p); // smoothstep for a softer landing
        const side = i % 2 === 0 ? -1 : 1;
        card.style.setProperty('--ty', `${(1 - ease) * 46}vh`);
        card.style.setProperty('--tx', `${(1 - ease) * side * 90}px`);
        card.style.setProperty('--scale', '1');
        card.style.setProperty('--rx', `${-(1 - ease) * 90}deg`);
        card.style.opacity = '1';
      }
      card.style.zIndex = String(i + 1);
    });

    if (intro) {
      const p0 = clamp01(total - 0);
      // Intro text shrinks but stays visible as the first card grows out.
      intro.style.setProperty('--intro-opacity', '1');
      // Shrink slightly at first, then settle back near the original size
      // as the words spread apart.
      intro.style.setProperty('--intro-scale', (1 - p0 * 0.3 + p0 * p0 * 0.25).toFixed(3));
      intro.style.setProperty('--intro-split', `${(p0 * 320).toFixed(1)}px`);
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

// Generic reveal-on-scroll
const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

revealEls.forEach((el) => revealObserver.observe(el));

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
