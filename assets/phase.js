/* ===============================================================
   Hero background: the phase portrait of a damped second-order
   system.  Particles are advected by  x' = y,  y' = -w^2 x - 2*z*w*y,
   so every trajectory spirals into the equilibrium at the origin --
   which is, more or less, what the lab does for a living.
   =============================================================== */

(function () {
  const canvas = document.getElementById("phase");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* system parameters */
  const W = 0.85;     // natural frequency
  const ZETA = 0.085; // damping ratio -- low, so spirals stay visible
  const DT = 0.016;

  const COUNT = 190;
  const SPAWN_MIN = 0.55;
  const SPAWN_MAX = 2.4;
  const DEATH_R = 0.055;

  let w = 0, h = 0, dpr = 1;
  let ox = 0, oy = 0, scale = 1;
  let particles = [];
  let theme = {};
  let raf = null;
  let animating = true;

  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const light = document.documentElement.getAttribute("data-theme") === "light";
    theme = {
      bg: cs.getPropertyValue("--bg").trim() || "#070b14",
      accent: cs.getPropertyValue("--accent").trim() || "#6ee7d0",
      accent2: cs.getPropertyValue("--accent-2").trim() || "#a78bfa",
      /* trails need to fade faster on paper than on ink */
      fade: light ? 0.055 : 0.045,
      alpha: light ? 0.62 : 0.72,
      grid: light ? 0.07 : 0.055,
      /* paper needs a fainter equilibrium, or the glow bands */
      glow: light ? 0.5 : 1,
    };
    theme.rgb = toRGB(theme.accent);
  }

  /* "#6ee7d0" or "rgb(...)" -> [r, g, b] */
  function toRGB(c) {
    if (c.startsWith("#")) {
      const hex = c.length === 4
        ? c.slice(1).split("").map((ch) => ch + ch).join("")
        : c.slice(1);
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/\d+/g);
    return m ? m.slice(0, 3).map(Number) : [110, 231, 208];
  }

  /* a point of light at the origin, not a ball */
  function drawEquilibrium() {
    const [r, g, b] = theme.rgb;
    const R = Math.max(70, Math.min(w, h) * 0.16);
    ctx.globalAlpha = 1;
    /* this is composited over a canvas that only fades by `k` each frame,
       so the on-screen result is roughly alpha/k -- pre-scale accordingly */
    const k = animating ? theme.fade : 1;
    const a = (t) => `rgba(${r},${g},${b},${(t * k * theme.glow).toFixed(4)})`;

    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
    glow.addColorStop(0, a(0.42));
    glow.addColorStop(0.08, a(0.16));
    glow.addColorStop(0.28, a(0.05));
    glow.addColorStop(0.6, a(0.012));
    glow.addColorStop(1, a(0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = a(0.85);
    ctx.beginPath();
    ctx.arc(ox, oy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ox = w * 0.66;
    oy = h * 0.44;
    scale = Math.max(w, h) * 0.30;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    drawGrid();
  }

  function spawn() {
    const r = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    const a = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      hue: Math.random(),
      age: 0,
      life: 400 + Math.random() * 900,
    };
  }

  function step(p) {
    /* RK2 on the linear field -- cheap and stable at this dt */
    const f = (x, y) => [y, -W * W * x - 2 * ZETA * W * y];
    const [k1x, k1y] = f(p.x, p.y);
    const [k2x, k2y] = f(p.x + k1x * DT, p.y + k1y * DT);
    p.x += ((k1x + k2x) / 2) * DT;
    p.y += ((k1y + k2y) / 2) * DT;
    p.age++;
  }

  function drawGrid() {
    const gap = 46;
    ctx.save();
    ctx.globalAlpha = theme.grid;
    ctx.fillStyle = theme.accent;
    for (let x = (ox % gap + gap) % gap; x < w; x += gap) {
      for (let y = (oy % gap + gap) % gap; y < h; y += gap) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }

  function frame() {
    /* fade the previous frame instead of clearing -- that is the trail */
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = theme.bg;
    ctx.globalAlpha = theme.fade;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    ctx.lineCap = "round";

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const sx = ox + p.x * scale;
      const sy = oy - p.y * scale;

      step(p);

      const nx = ox + p.x * scale;
      const ny = oy - p.y * scale;

      const r = Math.hypot(p.x, p.y);
      if (r < DEATH_R || p.age > p.life || r > 4.5) {
        particles[i] = spawn();
        continue;
      }

      /* fade in at birth, out at death, and thin out near the origin */
      const fadeIn = Math.min(1, p.age / 45);
      const fadeOut = Math.min(1, (p.life - p.age) / 90);
      const radial = Math.min(1, (r - DEATH_R) * 3.2);
      const a = theme.alpha * fadeIn * fadeOut * radial;
      if (a <= 0.01) continue;

      ctx.strokeStyle = p.hue > 0.62 ? theme.accent2 : theme.accent;
      ctx.globalAlpha = a;
      ctx.lineWidth = 0.55 + (1 - Math.min(1, r / 2.4)) * 1.15;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }

    drawEquilibrium();

    raf = requestAnimationFrame(frame);
  }

  function drawStatic() {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    drawGrid();
    /* one full pass, no animation: the portrait, drawn once */
    const shots = 90;
    for (let i = 0; i < shots; i++) {
      const p = spawn();
      ctx.beginPath();
      ctx.strokeStyle = p.hue > 0.62 ? theme.accent2 : theme.accent;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 0.8;
      ctx.moveTo(ox + p.x * scale, oy - p.y * scale);
      for (let k = 0; k < 900; k++) {
        step(p);
        if (Math.hypot(p.x, p.y) < DEATH_R) break;
        ctx.lineTo(ox + p.x * scale, oy - p.y * scale);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawEquilibrium();
  }

  function start() {
    readTheme();
    resize();
    particles = Array.from({ length: COUNT }, () => {
      const p = spawn();
      p.age = Math.floor(Math.random() * 300); // stagger, so no birth flash
      return p;
    });

    if (raf) cancelAnimationFrame(raf);
    animating = !reduced.matches;
    if (reduced.matches) drawStatic();
    else raf = requestAnimationFrame(frame);
  }

  /* keep up with layout, theme and visibility */
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 180);
  });

  new MutationObserver(start).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf && !reduced.matches) {
      raf = requestAnimationFrame(frame);
    }
  });

  start();
})();
