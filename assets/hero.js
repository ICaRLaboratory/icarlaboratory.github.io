/* ===============================================================
   Hero figure — the loop that ties the three research areas
   together, running live.

   One damped second-order system  x'' + 2ζω x' + ω² x = 0  drives
   all three blocks at once:

     left     the state descending its energy surface
              V(x,x') = ½x'² + ½ω²x², drawn as a wireframe bowl
              the trajectory spirals down into      → Control Algorithms
     middle   two-link arm posed from the state     → Robotics
     right    zero-order-hold of the sampled x      → Embedded Systems

   The bowl is exact, not decorative: V̇ = −2ζω x'² ≤ 0, so the
   trajectory can only slide downhill, and its ghost on the floor
   of the bowl is the classical phase portrait. A slow camera orbit
   keeps the surface readable.

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
  let cam = 0.6;                // the bowl's slow camera orbit

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
    cam += 0.0016;

    /* settled? start over */
    if (t > 5 && Math.hypot(state.x, state.v / OMEGA) < 0.045) reset();
  }

  /* ---------- drawing helpers ---------- */
  const INK = (a) => `rgba(255,255,255,${a})`;

  /* Labels inside the figure stay English in both languages -- they are
     block-diagram notation, and keeping one version keeps this file simple. */

  function label(text, x, y, align = "center", alpha = 0.62, size = 10) {
    ctx.save();
    ctx.font = `500 ${size}px "JetBrains Mono", ui-monospace, monospace`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.7px";
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function sym(text, x, y, size = 16, alpha = 0.9, italic = true) {
    ctx.save();
    ctx.font = `${italic ? "italic " : ""}${size}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = INK(alpha);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* a soft white glow with a bright core — the one look every live
     signal in the figure shares */
  function glow(x, y, r, core, coreAlpha = 0.95, haze = 0.5) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${haze})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = INK(coreAlpha);
    ctx.beginPath(); ctx.arc(x, y, core, 0, 7); ctx.fill();
  }

  function block(b, active = 0) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, "rgba(255,255,255,.05)");
    g.addColorStop(1, "rgba(255,255,255,.012)");
    ctx.fillStyle = g;
    ctx.fill();
    /* the border answers the pulse: it brightens as the signal
       arrives, holds while it is inside, and lets go as it leaves */
    ctx.strokeStyle = INK(0.32 + 0.3 * active);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    /* a quiet dot grid gives the panel a surface without competing
       with what is drawn on it */
    ctx.save();
    ctx.clip();
    ctx.fillStyle = INK(0.05);
    for (let x = b.x + 11; x < b.x + b.w - 5; x += 14)
      for (let y = b.y + 11; y < b.y + b.h - 5; y += 14)
        ctx.fillRect(x, y, 1, 1);
    ctx.restore();
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

  /* The energy bowl. Normalized coordinates X = x, Y = x'/ω make
     V ∝ X² + Y², a rotationally symmetric paraboloid; zs and dep
     turn (X, Y, z) into the panel's axonometric projection. */
  const BOWL = { rMax: 2.3, rings: [0.6, 1.17, 1.74, 2.3], ribs: 10 };

  function drawEnergy() {
    const cx = CTRL.x + CTRL.w / 2;
    const cy = CTRL.y + CTRL.h / 2 + 38;
    const s = 27;        // px per unit, horizontally
    const dep = 11;      // px per unit of scene depth
    const zs = 19;       // px per unit of energy height
    const K = 0.5;       // z = K r²

    const proj = (X, Y, z) => {
      const co = Math.cos(cam), si = Math.sin(cam);
      const u = X * co - Y * si;
      const w = X * si + Y * co;
      return [cx + u * s, cy + w * dep - z * zs, w];
    };

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(CTRL.x + 1, CTRL.y + 1, CTRL.w - 2, CTRL.h - 2, 8);
    ctx.clip();

    /* contour rings: level sets of V, brighter toward the viewer */
    const SEG = 48;
    for (const r of BOWL.rings) {
      const z = K * r * r;
      let prev = proj(r, 0, z);
      for (let i = 1; i <= SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const p = proj(Math.cos(a) * r, Math.sin(a) * r, z);
        const wn = ((prev[2] + p[2]) / 2) / r;   // −1 back … +1 front
        ctx.strokeStyle = INK(0.11 + 0.17 * (wn + 1) / 2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        prev = p;
      }
    }

    /* radial ribs down the surface */
    for (let k = 0; k < BOWL.ribs; k++) {
      const a = (k / BOWL.ribs) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const tip = proj(dx * BOWL.rMax, dy * BOWL.rMax, K * BOWL.rMax * BOWL.rMax);
      ctx.strokeStyle = INK(0.045 + 0.075 * (tip[2] / BOWL.rMax + 1) / 2);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      let started = false;
      for (let r = 0; r <= BOWL.rMax + 1e-6; r += BOWL.rMax / 10) {
        const p = proj(dx * r, dy * r, K * r * r);
        if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }

    /* the equilibrium the trajectory is headed for */
    const eq = proj(0, 0, 0);
    ctx.fillStyle = INK(0.4);
    ctx.beginPath(); ctx.arc(eq[0], eq[1], 1.6, 0, 7); ctx.fill();

    /* the floor ghost: the same trajectory at z = 0 is the classical
       phase portrait, projected under the bowl */
    for (let i = 1; i < phase.length; i++) {
      const a = (i / phase.length) * 0.34;
      if (a < 0.02) continue;
      const p0 = proj(phase[i - 1][0], phase[i - 1][1] / OMEGA, 0);
      const p1 = proj(phase[i][0], phase[i][1] / OMEGA, 0);
      ctx.strokeStyle = INK(a);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    }

    /* the trajectory itself, sliding down the surface, fading and
       thinning into the past */
    for (let i = 1; i < phase.length; i++) {
      const a = (i / phase.length) * 0.95;
      if (a < 0.03) continue;
      const [X0, Y0] = [phase[i - 1][0], phase[i - 1][1] / OMEGA];
      const [X1, Y1] = [phase[i][0], phase[i][1] / OMEGA];
      const p0 = proj(X0, Y0, K * (X0 * X0 + Y0 * Y0));
      const p1 = proj(X1, Y1, K * (X1 * X1 + Y1 * Y1));
      ctx.strokeStyle = INK(a);
      ctx.lineWidth = 0.7 + a * 1.3;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    }

    /* the state now: a plumb line ties the point on the surface to
       its shadow on the floor, then the point glows */
    const X = state.x, Y = state.v / OMEGA;
    const hp = proj(X, Y, K * (X * X + Y * Y));
    const hg = proj(X, Y, 0);
    ctx.strokeStyle = INK(0.16);
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hp[0], hp[1]); ctx.lineTo(hg[0], hg[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK(0.3);
    ctx.beginPath(); ctx.arc(hg[0], hg[1], 1.5, 0, 7); ctx.fill();
    glow(hp[0], hp[1], 9, 2.2);

    ctx.restore();

    sym("V", CTRL.x + 16, CTRL.y + 20, 14, 0.55);
  }

  /* a link of the arm as a tapered solid, not a stroked line */
  function limb(x0, y0, x1, y1, w0, w1) {
    const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
    const c = Math.cos(a), sn = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x0 + c * w0, y0 + sn * w0);
    ctx.lineTo(x1 + c * w1, y1 + sn * w1);
    ctx.lineTo(x1 - c * w1, y1 - sn * w1);
    ctx.lineTo(x0 - c * w0, y0 - sn * w0);
    ctx.closePath();
  }

  function drawArm() {
    const bx = PLANT.x + PLANT.w / 2 - 24;
    const by = PLANT.y + PLANT.h - 20;
    const L1 = 53, L2 = 39;

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

    /* what the tool tip has been doing: a tapered comet tail */
    for (let i = 1; i < ee.length; i++) {
      const k = i / ee.length;
      const a = k * 0.75;
      if (a < 0.03) continue;
      ctx.strokeStyle = INK(a);
      ctx.lineWidth = 0.6 + k * 1.4;
      ctx.lineCap = "round";
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

    /* links: tapered solids with a faint edge */
    ctx.fillStyle = INK(0.88);
    ctx.strokeStyle = INK(0.25);
    ctx.lineWidth = 1;
    limb(bx, by, j.x, j.y, 3.4, 2.4); ctx.fill(); ctx.stroke();
    limb(j.x, j.y, e.x, e.y, 2.4, 1.6); ctx.fill(); ctx.stroke();

    /* gripper */
    const g = a1 + a2;
    ctx.strokeStyle = INK(1);
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
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

    /* the tool tip is the live signal here */
    glow(e.x, e.y, 8, 1.8, 0.95, 0.4);
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
      const pts = samples.map((v, i) => [
        x0 + (off + i) * dx,
        mid - Math.max(-1.6, Math.min(1.6, v)) * amp,
      ]);

      /* the held signal encloses an area with the midline; filling it
         makes the staircase a shape instead of a wire */
      ctx.beginPath();
      ctx.moveTo(pts[0][0], mid);
      pts.forEach(([px, py], i) => {
        if (i === 0) ctx.lineTo(px, py);
        else { ctx.lineTo(px, pts[i - 1][1]); ctx.lineTo(px, py); }
      });
      ctx.lineTo(pts[pts.length - 1][0], mid);
      ctx.closePath();
      ctx.fillStyle = INK(0.07);
      ctx.fill();

      /* zero-order hold */
      ctx.strokeStyle = INK(1);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      pts.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px, py);
        else { ctx.lineTo(px, pts[i - 1][1]); ctx.lineTo(px, py); }
      });
      ctx.stroke();

      /* the sample instants */
      pts.forEach(([px, py], i) => {
        ctx.fillStyle = INK(0.25 + 0.6 * (i / pts.length));
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 7); ctx.fill();
      });

      /* the freshest sample is the live signal here */
      const [lx, ly] = pts[pts.length - 1];
      glow(lx, ly, 7, 1.8, 0.95, 0.4);
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
    const p = pulsePoint();
    if (!p) return;
    const [px, py] = p;

    /* inside a block the signal is being processed, not traveling;
       the glowing border and each block's own live signal stand in
       for it there */
    for (const b of [CTRL, PLANT, SENS]) {
      if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) return;
    }

    glow(px, py, 13, 2.6);
  }

  /* walk the polyline to find the point at `pulse` of its length */
  function pulsePoint() {
    let total = 0;
    const segs = [];
    for (let i = 1; i < WIRE.length; i++) {
      const d = Math.hypot(WIRE[i][0] - WIRE[i - 1][0], WIRE[i][1] - WIRE[i - 1][1]);
      segs.push(d); total += d;
    }
    let want = pulse * total, i = 0;
    while (i < segs.length && want > segs[i]) { want -= segs[i]; i++; }
    if (i >= segs.length) return null;
    const k = segs[i] ? want / segs[i] : 0;
    return [
      WIRE[i][0] + (WIRE[i + 1][0] - WIRE[i][0]) * k,
      WIRE[i][1] + (WIRE[i + 1][1] - WIRE[i][1]) * k,
    ];
  }

  /* 1 while the pulse sits inside the block, easing to 0 within
     `reach` px of its border */
  function nearBlock(p, b, reach = 42) {
    if (!p) return 0;
    const dx = Math.max(b.x - p[0], 0, p[0] - (b.x + b.w));
    const dy = Math.max(b.y - p[1], 0, p[1] - (b.y + b.h));
    const d = Math.hypot(dx, dy);
    return Math.max(0, 1 - d / reach);
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
    const p = pulsePoint();
    block(CTRL, nearBlock(p, CTRL));
    block(PLANT, nearBlock(p, PLANT));
    block(SENS, nearBlock(p, SENS));

    drawEnergy();
    drawArm();
    drawSensor();
    drawPulse();

    label("CONTROL ALGORITHMS", CTRL.x + CTRL.w / 2, CTRL.y + CTRL.h + 22);
    label("ROBOTICS", PLANT.x + PLANT.w / 2, PLANT.y + PLANT.h + 22);
    label("EMBEDDED SYSTEMS", SENS.x + SENS.w / 2, SENS.y + SENS.h + 22);
  }

  function loop() {
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* warm the figure up before the first paint, so the descent and the
     sensor strip are already populated instead of drawing themselves in */
  reset();
  for (let i = 0; i < 260; i++) step();

  /* ---------- running or held ----------
     Whether the figure starts moving is the visitor's motion preference,
     which is why the same page animates on one machine and sits still on
     another. The button under the caption overrides it either way, and
     once it has been pressed the preference stops speaking for the
     figure: a machine set to reduce motion can still be told to play,
     and one that is not can be told to stop. */
  let running = !reduced.matches;
  let chosen = false;

  const PLAY  = '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>';
  const PAUSE = '<path d="M9 5v14M15 5v14"/>';

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hero__toggle";

  function syncButton() {
    const label = running ? "Pause the figure" : "Play the figure";
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${running ? PAUSE : PLAY}</svg>`;
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function setRunning(next) {
    running = next;
    if (running && !raf && !document.hidden) raf = requestAnimationFrame(loop);
    else if (!running && raf) { cancelAnimationFrame(raf); raf = null; }
    syncButton();
  }

  button.addEventListener("click", () => { chosen = true; setRunning(!running); });
  /* The preference can be flipped while the page is open. */
  reduced.addEventListener("change", (e) => { if (!chosen) setRunning(!e.matches); });

  syncButton();
  const figure = canvas.parentElement;
  (figure.querySelector("figcaption") || figure).appendChild(button);

  if (running) raf = requestAnimationFrame(loop);
  else draw();

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (!raf && running) raf = requestAnimationFrame(loop);
  });
})();
