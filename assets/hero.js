/* ===============================================================
   Hero figure — the loop that ties the three research areas
   together, running live.

   One damped second-order system  x'' + 2ζω x' + ω² x = 0  drives
   all three blocks at once:

     C(z)     phase plane of (x, x')          → Control Algorithms
     plant    two-link arm posed from the state → Robotics
     sensor   zero-order-hold of the sampled x  → Embedded Systems

   When the state settles the loop restarts from a new initial
   condition, so the figure keeps converging.
   =============================================================== */

(function () {
  const canvas = document.getElementById("herofig");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- design space ---------- */
  const W = 640, H = 460;

  const SUM   = { x: 38,  y: 135, r: 16 };
  const CTRL  = { x: 74,  y: 54,  w: 182, h: 162 };
  const PLANT = { x: 336, y: 54,  w: 214, h: 162 };
  const SENS  = { x: 196, y: 296, w: 252, h: 118 };

  /* the wire the signal pulse runs along, as a polyline */
  const WIRE = [
    [SUM.x + SUM.r, SUM.y], [CTRL.x, SUM.y],
    [CTRL.x + CTRL.w, SUM.y], [PLANT.x, SUM.y],
    [PLANT.x + PLANT.w, SUM.y], [580, SUM.y],
    [580, SENS.y + SENS.h / 2], [SENS.x + SENS.w, SENS.y + SENS.h / 2],
    [SENS.x, SENS.y + SENS.h / 2], [SUM.x, SENS.y + SENS.h / 2],
    [SUM.x, SUM.y + SUM.r],
  ];

  /* ---------- plant ---------- */
  const OMEGA = 1.55;
  const ZETA  = 0.055;
  const DT    = 1 / 60;
  const SAMPLE_EVERY = 13;      // frames between sensor samples
  const TRAIL = 700, EE_TRAIL = 150, SAMPLES = 26;

  let state, t, frame, phase, ee, pulse, raf = null;
  let samples = null;

  function reset() {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 0.7;
    state = { x: Math.cos(a) * r, v: Math.sin(a) * r * OMEGA };
    t = 0; frame = 0;
    phase = []; ee = [];
    if (!samples) samples = [];   // the sensor keeps logging across restarts
    pulse = 0;
  }

  function step() {
    /* RK2 on x' = v, v' = -ω²x - 2ζωv */
    const f = (x, v) => [v, -OMEGA * OMEGA * x - 2 * ZETA * OMEGA * v];
    const [k1x, k1v] = f(state.x, state.v);
    const [k2x, k2v] = f(state.x + k1x * DT, state.v + k1v * DT);
    state.x += ((k1x + k2x) / 2) * DT;
    state.v += ((k1v + k2v) / 2) * DT;
    t += DT; frame++;

    phase.push([state.x, state.v]);
    if (phase.length > TRAIL) phase.shift();

    if (frame % SAMPLE_EVERY === 0) {
      samples.push(state.x);
      if (samples.length > SAMPLES) samples.shift();
    }

    pulse = (pulse + 0.0022) % 1;

    /* settled? start over */
    if (t > 5 && Math.hypot(state.x, state.v / OMEGA) < 0.045) reset();
  }

  /* ---------- drawing helpers ---------- */
  const INK = (a) => `rgba(255,255,255,${a})`;

  /* site.js owns the language; the figure just reads it each frame */
  const figLabel = (key) =>
    (typeof copy === "function" ? copy(key) : "") || key;

  const isKo = () => typeof LANG !== "undefined" && LANG === "ko";

  function label(text, x, y, align = "center", alpha = 0.62, size = 10) {
    ctx.save();
    ctx.font = isKo()
      ? `500 ${size + 1.5}px "Pretendard Variable", Pretendard, sans-serif`
      : `500 ${size}px "JetBrains Mono", ui-monospace, monospace`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = isKo() ? "0.6px" : "1.7px";
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function sym(text, x, y, size = 16, alpha = 0.9, italic = true) {
    ctx.save();
    ctx.font = `${italic ? "italic " : ""}${size}px "Newsreader", Georgia, serif`;
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function roundRect(b) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fillStyle = "rgba(255,255,255,.022)";
    ctx.fill();
    ctx.strokeStyle = INK(0.3);
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  function arrow(x, y, dir = 1) {
    ctx.beginPath();
    ctx.moveTo(x - 6 * dir, y - 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x - 6 * dir, y + 4);
    ctx.strokeStyle = INK(0.6);
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  /* ---------- the three live insets ---------- */

  function drawPhase() {
    const pad = 16;
    const cx = CTRL.x + CTRL.w / 2;
    const cy = CTRL.y + CTRL.h / 2 + 6;
    const s = Math.min(CTRL.w - pad * 2, CTRL.h - pad * 2 - 14) / 4.4;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(CTRL.x + 1, CTRL.y + 1, CTRL.w - 2, CTRL.h - 2, 8);
    ctx.clip();

    /* axes */
    ctx.strokeStyle = INK(0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CTRL.x + pad, cy); ctx.lineTo(CTRL.x + CTRL.w - pad, cy);
    ctx.moveTo(cx, CTRL.y + pad + 8); ctx.lineTo(cx, CTRL.y + CTRL.h - pad);
    ctx.stroke();

    /* the trajectory, fading into the past */
    for (let i = 1; i < phase.length; i++) {
      const a = (i / phase.length) * 0.95;
      if (a < 0.03) continue;
      ctx.strokeStyle = INK(a);
      ctx.lineWidth = 1 + a * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx + phase[i - 1][0] * s, cy - (phase[i - 1][1] / OMEGA) * s);
      ctx.lineTo(cx + phase[i][0] * s, cy - (phase[i][1] / OMEGA) * s);
      ctx.stroke();
    }

    /* the state itself */
    const hx = cx + state.x * s, hy = cy - (state.v / OMEGA) * s;
    ctx.fillStyle = INK(0.14);
    ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = INK(1);
    ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, 7); ctx.fill();
    ctx.restore();

    sym("C(z)", CTRL.x + 32, CTRL.y + 19, 15, 0.78);
  }

  function drawArm() {
    const bx = PLANT.x + PLANT.w / 2 - 22;
    const by = PLANT.y + PLANT.h - 22;
    const L1 = 46, L2 = 34;

    const a1 = -Math.PI / 2 + state.x * 0.52;
    const a2 = state.v * 0.26;

    const j = { x: bx + Math.cos(a1) * L1, y: by + Math.sin(a1) * L1 };
    const e = { x: j.x + Math.cos(a1 + a2) * L2, y: j.y + Math.sin(a1 + a2) * L2 };

    ee.push([e.x, e.y]);
    if (ee.length > EE_TRAIL) ee.shift();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PLANT.x + 1, PLANT.y + 1, PLANT.w - 2, PLANT.h - 2, 8);
    ctx.clip();

    /* what the tool tip has been doing */
    for (let i = 1; i < ee.length; i++) {
      const a = (i / ee.length) * 0.5;
      ctx.strokeStyle = INK(a);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(ee[i - 1][0], ee[i - 1][1]);
      ctx.lineTo(ee[i][0], ee[i][1]);
      ctx.stroke();
    }

    /* base */
    ctx.strokeStyle = INK(0.55);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(bx - 19, by + 9); ctx.lineTo(bx + 17, by + 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 9, by + 9); ctx.lineTo(bx - 5, by); ctx.lineTo(bx + 5, by);
    ctx.lineTo(bx + 9, by + 9);
    ctx.stroke();

    /* links */
    ctx.strokeStyle = INK(1);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(j.x, j.y); ctx.lineTo(e.x, e.y);
    ctx.stroke();

    /* gripper */
    const g = a1 + a2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(g - 0.8) * 9, e.y + Math.sin(g - 0.8) * 9);
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(g + 0.8) * 9, e.y + Math.sin(g + 0.8) * 9);
    ctx.stroke();

    /* joints */
    ctx.fillStyle = "#0a0a0a";
    ctx.strokeStyle = INK(0.92);
    ctx.lineWidth = 1.6;
    [[bx, by], [j.x, j.y]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }

  function drawSensor() {
    const pad = 18;
    const x0 = SENS.x + pad, x1 = SENS.x + SENS.w - pad;
    const mid = SENS.y + SENS.h / 2 + 4;
    const amp = 27;
    const n = SAMPLES;
    const dx = (x1 - x0) / (n - 1);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(SENS.x + 1, SENS.y + 1, SENS.w - 2, SENS.h - 2, 8);
    ctx.clip();

    ctx.strokeStyle = INK(0.2);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x1, mid); ctx.stroke();
    ctx.setLineDash([]);

    if (samples.length > 1) {
      const off = n - samples.length;
      /* zero-order hold */
      ctx.strokeStyle = INK(1);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      samples.forEach((v, i) => {
        const px = x0 + (off + i) * dx;
        const py = mid - Math.max(-1.6, Math.min(1.6, v)) * amp;
        if (i === 0) ctx.moveTo(px, py);
        else { ctx.lineTo(px, ctx.__last); ctx.lineTo(px, py); }
        ctx.__last = py;
      });
      ctx.stroke();

      /* the sample instants */
      samples.forEach((v, i) => {
        const px = x0 + (off + i) * dx;
        const py = mid - Math.max(-1.6, Math.min(1.6, v)) * amp;
        ctx.fillStyle = INK(0.25 + 0.6 * (i / samples.length));
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 7); ctx.fill();
      });
    }
    ctx.restore();

    label("T", SENS.x + SENS.w - 20, SENS.y + 20, "center", 0.35, 9);
  }

  /* ---------- wires, blocks, pulse ---------- */

  function drawWires() {
    ctx.strokeStyle = INK(0.45);
    ctx.lineWidth = 1.25;
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(4, SUM.y); ctx.lineTo(SUM.x - SUM.r, SUM.y);
    ctx.moveTo(SUM.x + SUM.r, SUM.y); ctx.lineTo(CTRL.x, SUM.y);
    ctx.moveTo(CTRL.x + CTRL.w, SUM.y); ctx.lineTo(PLANT.x, SUM.y);
    ctx.moveTo(PLANT.x + PLANT.w, SUM.y); ctx.lineTo(636, SUM.y);
    ctx.moveTo(580, SUM.y); ctx.lineTo(580, SENS.y + SENS.h / 2);
    ctx.lineTo(SENS.x + SENS.w, SENS.y + SENS.h / 2);
    ctx.moveTo(SENS.x, SENS.y + SENS.h / 2);
    ctx.lineTo(SUM.x, SENS.y + SENS.h / 2);
    ctx.lineTo(SUM.x, SUM.y + SUM.r);
    ctx.stroke();

    arrow(SUM.x - SUM.r, SUM.y);
    arrow(CTRL.x, SUM.y);
    arrow(PLANT.x, SUM.y);
    arrow(SENS.x + SENS.w, SENS.y + SENS.h / 2, -1);

    /* feedback tap */
    ctx.fillStyle = INK(0.45);
    ctx.beginPath(); ctx.arc(580, SUM.y, 2.4, 0, 7); ctx.fill();

    /* summing junction */
    ctx.strokeStyle = INK(0.6);
    ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(SUM.x, SUM.y, SUM.r, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(SUM.x - 12, SUM.y - 7); ctx.lineTo(SUM.x - 4, SUM.y - 7);
    ctx.moveTo(SUM.x - 8, SUM.y - 11); ctx.lineTo(SUM.x - 8, SUM.y - 3);
    ctx.moveTo(SUM.x - 5, SUM.y + 9); ctx.lineTo(SUM.x + 3, SUM.y + 9);
    ctx.stroke();

    sym("r", 12, SUM.y - 13, 15, 0.7);
    sym("e", CTRL.x - 16, SUM.y - 13, 15, 0.7);
    sym("u", PLANT.x - 16, SUM.y - 13, 15, 0.7);
    sym("y", 614, SUM.y - 13, 15, 0.7);
  }

  function drawPulse() {
    /* walk the polyline to find the point at `pulse` of its length */
    let total = 0;
    const segs = [];
    for (let i = 1; i < WIRE.length; i++) {
      const d = Math.hypot(WIRE[i][0] - WIRE[i - 1][0], WIRE[i][1] - WIRE[i - 1][1]);
      segs.push(d); total += d;
    }
    let want = pulse * total, i = 0;
    while (i < segs.length && want > segs[i]) { want -= segs[i]; i++; }
    if (i >= segs.length) return;
    const k = segs[i] ? want / segs[i] : 0;
    const px = WIRE[i][0] + (WIRE[i + 1][0] - WIRE[i][0]) * k;
    const py = WIRE[i][1] + (WIRE[i + 1][1] - WIRE[i][1]) * k;

    const g = ctx.createRadialGradient(px, py, 0, px, py, 13);
    g.addColorStop(0, "rgba(255,255,255,.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, 13, 0, 7); ctx.fill();
    ctx.fillStyle = INK(0.95);
    ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 7); ctx.fill();
  }

  /* ---------- frame ---------- */

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const scale = Math.min(rect.width / W, rect.height / H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.translate((rect.width - W * scale) / 2, (rect.height - H * scale) / 2);
    ctx.scale(scale, scale);

    drawWires();
    roundRect(CTRL);
    roundRect(PLANT);
    roundRect(SENS);

    drawPhase();
    drawArm();
    drawSensor();
    drawPulse();

    label(figLabel("fig.control"), CTRL.x + CTRL.w / 2, CTRL.y + CTRL.h + 22);
    label(figLabel("fig.robotics"), PLANT.x + PLANT.w / 2, PLANT.y + PLANT.h + 22);
    label(figLabel("fig.embedded"), SENS.x + SENS.w / 2, SENS.y + SENS.h + 22);
  }

  function loop() {
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* warm the figure up before the first paint, so the phase trail and the
     sensor strip are already populated instead of drawing themselves in */
  reset();
  for (let i = 0; i < 260; i++) step();

  if (reduced.matches) draw();
  else raf = requestAnimationFrame(loop);

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf && !reduced.matches) raf = requestAnimationFrame(loop);
  });
})();
