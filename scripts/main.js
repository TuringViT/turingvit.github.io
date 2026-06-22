/* ============================================================
 * main.js — orchestration
 *  - reveal-on-scroll for sections
 *  - animated counters for [data-count]
 *  - layer stack rendering for the architecture section
 *  - patch-canvas grid generation for resolution cards
 *  - copy-to-clipboard for BibTeX
 *  - subtle 3D tilt on .tilt cards
 * ============================================================ */

(function () {
  /* ---------- Reveal on scroll ---------- */
  const revealTargets = document.querySelectorAll(
    '.section-head, .pillar, .arch-figure, .arch-stack, .arch-formulas, ' +
    '.flow-step, .data-figs figure, .res-card, .result-card, .results-compare, .vision-card'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealTargets.forEach(el => revealIO.observe(el));

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      const dur = 1400;
      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        const v = target * eased;
        el.textContent = prefix + v.toFixed(decimals) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = prefix + target.toFixed(decimals) + suffix;
      }
      requestAnimationFrame(tick);
      counterIO.unobserve(el);
    });
  }, { threshold: 0.4 });
  counters.forEach(c => counterIO.observe(c));

  /* ---------- Layer stack ---------- */
  const stack = document.getElementById('layerStack');
  if (stack) {
    // Show 3 Turing Blocks (18L) by default — keeps the visualization compact
    const layout = [];
    const blocks = 3;
    for (let b = 0; b < blocks; b++) {
      for (let i = 0; i < 5; i++) layout.push('TLA');
      layout.push('MHA');
    }
    layout.forEach((kind, idx) => {
      const row = document.createElement('div');
      row.className = `lyr ${kind.toLowerCase()}`;
      row.innerHTML = `
        <span class="ix">L${String(idx + 1).padStart(2, '0')}</span>
        <span class="lab">${kind === 'TLA' ? 'Turing Linear Attention' : 'Vanilla Multi-Head Attention'}</span>
        <span class="pill">${kind}</span>`;
      // staggered fade-in
      row.style.opacity = '0';
      row.style.transform = 'translateX(-8px)';
      row.style.transition = 'opacity .5s ease, transform .5s ease';
      stack.appendChild(row);
      setTimeout(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateX(0)';
      }, 60 + idx * 35);
    });
  }

  /* ---------- Patch canvases (resolution viz) ---------- */
  document.querySelectorAll('.patch-canvas').forEach((el) => {
    const cols = parseInt(el.dataset.cols, 10);
    const rows = parseInt(el.dataset.rows, 10);
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    const total = cols * rows;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const cell = document.createElement('span');
      // staggered animation delay
      cell.style.animationDelay = `${(i % cols) * 0.04 + Math.floor(i / cols) * 0.03}s`;
      // random initial brightness
      cell.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
      frag.appendChild(cell);
    }
    el.appendChild(frag);
  });

  /* ---------- Copy BibTeX ---------- */
  const copyBtn = document.getElementById('copyCite');
  const citeText = document.getElementById('citeText');
  if (copyBtn && citeText) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(citeText.innerText.trim());
        const old = copyBtn.textContent;
        copyBtn.textContent = 'Copied ✓';
        copyBtn.style.color = '#7af9ff';
        setTimeout(() => {
          copyBtn.textContent = old;
          copyBtn.style.color = '';
        }, 1600);
      } catch (e) { /* ignore */ }
    });
  }

  /* ---------- Subtle 3D tilt for .tilt cards ---------- */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) {
    document.querySelectorAll('.tilt').forEach((card) => {
      let raf = 0;
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (py - 0.5) * -6;
        const ry = (px - 0.5) * 8;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `translateY(-4px) perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ---------- Smooth-scroll active link highlight ---------- */
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = ['pillars', 'architecture', 'latency', 'data', 'results', 'vision']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      navLinks.forEach((a) => {
        const active = a.getAttribute('href') === '#' + id;
        a.style.color = active ? '#fff' : '';
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => navIO.observe(s));
})();
