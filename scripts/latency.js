/* ============================================================
 * latency.js — interactive O(N²) vs O(N) chart
 * Renders two curves on a canvas. Vanilla ViT scales quadratically;
 * TuringViT scales near-linearly. A vertical marker tracks the
 * current sequence length controlled by the slider/presets.
 * ============================================================ */

(function () {
  const canvas = document.getElementById('latencyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const seqSlider = document.getElementById('seqSlider');
  const seqValue = document.getElementById('seqValue');
  const presets = document.querySelectorAll('.preset');
  const vitMs = document.getElementById('vitMs');
  const tvMs = document.getElementById('tvMs');
  const speedup = document.getElementById('speedup');
  const vitBar = document.getElementById('vitBar');
  const tvBar = document.getElementById('tvBar');

  const SEQ_MIN = 256;
  const SEQ_MAX = 16384;

  // calibration: at N=4096, vanilla ~ 100ms, TuringViT ~ 32ms (illustrative)
  // ViT:    a * N^2  with a chosen so f(4096)=100
  // TuringViT: b * N + small overhead
  const A_VIT = 100 / (4096 * 4096);            // ms / token^2
  const B_TV  = 0.0055;                          // ms / token
  const C_TV  = 8;                               // overhead ms

  function lat_vit(n) { return A_VIT * n * n; }
  function lat_tv(n)  { return B_TV * n + C_TV; }

  let W = 0, H = 0, dpr = 1;
  let animProgress = 0;     // 0..1 sweep on first reveal
  let revealed = false;
  let curSeq = parseInt(seqSlider.value, 10);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // log scale for sequence length, linear for ms (capped)
  function xOf(n) {
    const t = (Math.log(n) - Math.log(SEQ_MIN)) / (Math.log(SEQ_MAX) - Math.log(SEQ_MIN));
    return PAD_L + t * (W - PAD_L - PAD_R);
  }
  function yOf(ms) {
    const cap = Y_MAX;
    const t = Math.min(1, ms / cap);
    return (H - PAD_B) - t * (H - PAD_T - PAD_B);
  }

  const PAD_L = 60, PAD_R = 28, PAD_T = 24, PAD_B = 40;
  const Y_MAX = 1800; // ms ceiling for the chart

  function drawAxes() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;

    // y grid lines
    ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
    ctx.fillStyle = 'rgba(170,179,207,0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = [0, 200, 400, 800, 1200, 1600];
    for (const v of ySteps) {
      const y = yOf(v);
      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(W - PAD_R, y);
      ctx.stroke();
      ctx.fillText(v + ' ms', PAD_L - 8, y);
    }
    ctx.setLineDash([]);

    // x ticks (powers of 2)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = [256, 1024, 4096, 16384];
    for (const n of xTicks) {
      const x = xOf(n);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(x, PAD_T);
      ctx.lineTo(x, H - PAD_B);
      ctx.stroke();
      ctx.fillStyle = 'rgba(170,179,207,0.7)';
      ctx.fillText(formatN(n), x, H - PAD_B + 8);
    }

    // axis labels
    ctx.fillStyle = 'rgba(108,115,147,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('latency (ms)', PAD_L - 50, PAD_T - 12);
    ctx.textAlign = 'right';
    ctx.fillText('visual tokens (log)', W - PAD_R, H - PAD_B + 22);

    ctx.restore();
  }

  function formatN(n) {
    if (n >= 1024) return (n / 1024) + 'k';
    return n.toString();
  }

  function drawCurve(fn, color, glow, capProgress) {
    const start = SEQ_MIN;
    const end = SEQ_MIN + (SEQ_MAX - SEQ_MIN) * capProgress;
    ctx.save();

    // glow
    ctx.shadowBlur = 16;
    ctx.shadowColor = glow;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let first = true;
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // log-spaced sampling
      const n = Math.exp(Math.log(start) + t * (Math.log(end) - Math.log(start)));
      const ms = Math.min(fn(n), Y_MAX);
      const x = xOf(n);
      const y = yOf(ms);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // fill under curve
    ctx.lineTo(xOf(end), H - PAD_B);
    ctx.lineTo(xOf(start), H - PAD_B);
    ctx.closePath();
    ctx.shadowBlur = 0;
    const gradFill = ctx.createLinearGradient(0, PAD_T, 0, H - PAD_B);
    gradFill.addColorStop(0, color.replace('1)', '0.18)').replace('rgb(', 'rgba('));
    gradFill.addColorStop(1, color.replace('1)', '0.0)').replace('rgb(', 'rgba('));
    ctx.fillStyle = gradFill;
    ctx.fill();

    ctx.restore();
  }

  function drawMarker() {
    const x = xOf(curSeq);
    const yVit = yOf(Math.min(lat_vit(curSeq), Y_MAX));
    const yTv = yOf(Math.min(lat_tv(curSeq), Y_MAX));

    ctx.save();
    // vertical line
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x, PAD_T);
    ctx.lineTo(x, H - PAD_B);
    ctx.stroke();
    ctx.setLineDash([]);

    // dots
    drawDot(x, yVit, '#ff7a7a');
    drawDot(x, yTv, '#7af9ff');

    // labels
    ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff7a7a';
    const vitLabel = `${Math.round(lat_vit(curSeq))} ms`;
    let lx = x + 10;
    if (lx + 80 > W - PAD_R) lx = x - 90;
    ctx.fillText(vitLabel, lx, yVit - 8);
    ctx.fillStyle = '#7af9ff';
    ctx.fillText(`${Math.round(lat_tv(curSeq))} ms`, lx, yTv - 8);

    ctx.restore();
  }

  function drawDot(x, y, c) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.shadowBlur = 14;
    ctx.shadowColor = c;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawAxes();
    const p = revealed ? 1 : animProgress;
    drawCurve(lat_vit, 'rgba(255,122,122,1)', 'rgba(255,122,122,0.6)', p);
    drawCurve(lat_tv, 'rgba(122,249,255,1)', 'rgba(122,249,255,0.6)', p);
    if (revealed) drawMarker();
    drawLegend();
  }

  function drawLegend() {
    ctx.save();
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const items = [
      { c: '#ff7a7a', t: 'Vanilla ViT  O(N²)' },
      { c: '#7af9ff', t: 'TuringViT  O(N)' }
    ];
    let lx = W - PAD_R - 230;
    let ly = PAD_T + 8;
    items.forEach((it, i) => {
      const y = ly + i * 22;
      ctx.fillStyle = it.c;
      ctx.beginPath();
      ctx.arc(lx, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,236,255,0.85)';
      ctx.fillText(it.t, lx + 12, y);
    });
    ctx.restore();
  }

  function updateReadout() {
    const vit = lat_vit(curSeq);
    const tv = lat_tv(curSeq);
    vitMs.textContent = vit < 10 ? vit.toFixed(1) : Math.round(vit);
    tvMs.textContent = tv < 10 ? tv.toFixed(1) : Math.round(tv);
    speedup.textContent = (vit / tv).toFixed(1);
    const refMax = lat_vit(SEQ_MAX);
    vitBar.style.width = Math.min(100, (vit / refMax) * 100) + '%';
    tvBar.style.width = Math.min(100, (tv / refMax) * 100) + '%';
    seqValue.textContent = curSeq.toLocaleString();
  }

  function animateReveal() {
    const start = performance.now();
    const dur = 1200;
    function tick(now) {
      const e = Math.min(1, (now - start) / dur);
      animProgress = easeOutCubic(e);
      draw();
      if (e < 1) requestAnimationFrame(tick);
      else { revealed = true; draw(); }
    }
    requestAnimationFrame(tick);
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // events
  seqSlider.addEventListener('input', () => {
    curSeq = parseInt(seqSlider.value, 10);
    presets.forEach(b => b.classList.toggle(
      'active',
      Math.abs(parseInt(b.dataset.seq, 10) - curSeq) < 64
    ));
    updateReadout();
    draw();
  });
  presets.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = parseInt(btn.dataset.seq, 10);
      seqSlider.value = v;
      curSeq = v;
      presets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateReadout();
      draw();
    });
  });

  // initial state
  window.addEventListener('resize', resize, { passive: true });
  resize();
  updateReadout();

  // Reveal animation when chart enters viewport
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !revealed) {
        animateReveal();
        io.disconnect();
      }
    });
  }, { threshold: 0.3 });
  io.observe(canvas);
})();
