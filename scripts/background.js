/* ============================================================
 * background.js — minimal, low-power ambient drift
 * Goals:
 *   - sparse slow-moving particles, no O(N^2) link drawing
 *   - no global "sweep" stripe
 *   - throttle to ~30fps and pause when tab hidden / page scrolled
 *     out of viewport to avoid heating the device
 * ============================================================ */

(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse  = window.matchMedia('(pointer: coarse)').matches; // mobile -> even fewer

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let running = true;
  let lastT = 0;
  const FPS = 30;
  const FRAME_MS = 1000 / FPS;

  function resize() {
    // cap DPR to 1 to drastically cut fill rate cost
    dpr = 1;
    W = canvas.clientWidth = window.innerWidth;
    H = canvas.clientHeight = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

  function initParticles() {
    // Far fewer particles than before, scale only mildly with screen area
    const base = coarse ? 14 : 26;
    const target = Math.min(base, Math.floor((W * H) / 90000));
    particles = [];
    for (let i = 0; i < target; i++) {
      particles.push(spawn(true));
    }
  }

  function spawn(initial) {
    return {
      x: initial ? Math.random() * W : -10,
      y: Math.random() * H,
      vx: 0.08 + Math.random() * 0.18,        // slower
      vy: (Math.random() - 0.5) * 0.02,
      r: Math.random() * 1.1 + 0.5,
      a: 0.35 + Math.random() * 0.35
    };
  }

  function step(t) {
    if (!running) { lastT = t; return requestAnimationFrame(step); }

    if (t - lastT < FRAME_MS) return requestAnimationFrame(step);
    lastT = t;

    ctx.clearRect(0, 0, W, H);

    // single pass: just dots, no connection lines, no glow ring
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x > W + 20) {
        particles[i] = spawn(false);
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 122, ${p.a * 0.55})`;
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  // pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  // pause when canvas not in viewport (most of the time it isn't on long pages)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) running = e.isIntersecting;
    }, { threshold: 0 });
    io.observe(canvas);
  }

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(resize, 150);
  }, { passive: true });

  resize();
  if (reduced) {
    // draw once and stop
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 122, ${p.a * 0.5})`;
      ctx.fill();
    }
  } else {
    requestAnimationFrame(step);
  }
})();
