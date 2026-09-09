/* ===============================================================
   Pressing on something, with the compliance exposed.

   A tool on one axis is asked to hold a force against a wall. It
   cannot do that by commanding a position -- a millimetre either way
   against a stiff surface is the difference between no contact and
   far too much -- so the force error drives a virtual second-order
   system, and the position it settles at is what the robot is told
   to go to:

       M_d e'' + D_d e' + K_d e = f_d - f,     x_r = x_c + e

   That is admittance control. M_d, D_d and K_d are not the tool's
   mass and stiffness; they are the mechanical behaviour it is being
   asked to imitate, and all three are on the sliders.

   Underneath sits a real position loop -- m x'' = k_p (x_r - x)
   + k_v (x_r' - x') - f, with fixed gains -- because the interesting
   failure needs it. The wall is a spring and a dashpot that can push
   and not pull:

       f = max(0, k_e (x - x_w) + b_e x')

   Two things are worth finding on the sliders.

   The first is the offset. At rest the virtual spring must be held
   somewhere, and holding it costs force: f settles at
   f_d / (1 + K_d (1/k_p + 1/k_e)), short of what was asked for.
   Wind K_d down to zero and the offset goes with it -- the virtual
   spring was the only thing keeping the loop from tracking the force
   exactly.

   The second is contact instability, which is the reason this is a
   research problem rather than a formula. Stiff wall, light virtual
   mass, little virtual damping, and the loop starts chattering
   against the surface: the readout is the rightmost pole of the
   loop in contact, and it crosses zero exactly where the picture
   starts to ring.
   =============================================================== */

SIM.register((function () {
  const ROBOT = { m: 1, kp: 900, kv: 45 };   /* the inner position loop */
  const WALL = { x: 0, be: 2 };              /* surface, and its damping */
  const START = -0.02;                       /* the tool, 2 cm off the wall */
  const DEMAND = [10, 25];                   /* N, before and after the step */
  const T_STEP = 3;                          /* s */
  const WINDOW = 6;                          /* s */
  const SUB = 1 / 3000;                      /* the wall is stiff */

  let x, v, e, de, simT, hist, diverged;
  let pole = 0;

  const demand = (t) => (t >= T_STEP ? DEMAND[1] : DEMAND[0]);
  const force = (X, V, ke) => {
    if (X <= WALL.x) return 0;
    return Math.max(0, ke * (X - WALL.x) + WALL.be * V);
  };
  /* what the loop settles on, which is not what it was asked for */
  const settledForce = (fd, P) => fd / (1 + P.kd * (1 / ROBOT.kp + 1 / P.ke));

  /* ---------- the two loops, integrated together ---------- */

  function deriv(y, P) {
    const f = force(y[0], y[1], P.ke);
    const ax = (ROBOT.kp * (y[2] - y[0]) + ROBOT.kv * (y[3] - y[1]) - f) / ROBOT.m;
    const ae = (demand(simT) - f - P.dd * y[3] - P.kd * (y[2] - WALL.x)) / P.md;
    return [y[1], ax, y[3], ae];
  }

  function rk4(dt, P) {
    let y = [x, v, e, de];
    const k1 = deriv(y, P);
    const k2 = deriv(y.map((c, i) => c + (dt / 2) * k1[i]), P);
    const k3 = deriv(y.map((c, i) => c + (dt / 2) * k2[i]), P);
    const k4 = deriv(y.map((c, i) => c + dt * k3[i]), P);
    y = y.map((c, i) => c + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    [x, v, e, de] = y;
    simT += dt;
  }

  /* ---------- the loop in contact, linearised ----------
     States [x, x', e, e']. In contact the wall contributes k_e and b_e to the
     tool and, through the measured force, straight back into the admittance,
     which is where the instability comes from: the stiffer the wall, the
     harder that path pushes. Out of contact those terms are zero and the two
     halves decouple, so this is the case worth reporting. */

  function rightmost(P) {
    const { m, kp, kv } = ROBOT;
    const A = [
      [0, 1, 0, 0],
      [-(kp + P.ke) / m, -(kv + WALL.be) / m, kp / m, kv / m],
      [0, 0, 0, 1],
      [-P.ke / P.md, -WALL.be / P.md, -P.kd / P.md, -P.dd / P.md],
    ];
    return SIM.rightmostPole(A, 4);
  }

  /* ---------- drawing ---------- */

  function boxes(D) {
    return D.w >= 700
      ? { loop: { x: 0, y: 18, w: 780, h: 282 },
          left: { x: 0, y: 330, w: 379, h: 290 },
          right: { x: 401, y: 330, w: 379, h: 290 } }
      : { loop: { x: 0, y: 18, w: 380, h: 412 },
          left: { x: 0, y: 460, w: 380, h: 265 },
          right: { x: 0, y: 745, w: 380, h: 265 } };
  }

  function drawLoop(g, P, r) {
    const { ctx } = g;
    const { x: rx, y, w, h } = r;
    const colX = rx + w * 0.035, colW = w * 0.30;
    const colMid = colX + colW / 2;
    const feedX = rx + w * 0.008;

    /* the force it is asked for, and the step in it */
    const sx = colX, sw = colW, sy = y + h * 0.10, sh = h * 0.11;
    g.words("Target force", colMid, y + h * 0.045, 13);
    ctx.strokeStyle = g.ink(0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh);
    ctx.stroke();
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 3;
    const mid = sx + sw * (T_STEP / WINDOW);
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + sh * 0.55);
    ctx.lineTo(mid, sy + sh * 0.55);
    ctx.lineTo(mid, sy);
    ctx.lineTo(sx + sw - 2, sy);
    ctx.stroke();
    g.maths("f", sx + sw + 6, sy + 5, 15, "left");
    g.maths("d", sx + sw + 12, sy + 9, 10, "left", 0.8);

    /* summing junction */
    const jy = y + h * 0.32, jr = Math.min(h * 0.055, 15);
    g.arrow(colMid, sy + sh + 6, colMid, jy - jr - 2);
    ctx.beginPath();
    ctx.arc(colMid, jy, jr, 0, 7);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = g.ink(0.35); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(colMid - jr * 0.5, jy); ctx.lineTo(colMid + jr * 0.5, jy);
    ctx.moveTo(colMid, jy - jr * 0.5); ctx.lineTo(colMid, jy + jr * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(colMid + jr + 8, jy - jr + 2); ctx.lineTo(colMid + jr + 18, jy - jr + 2);
    ctx.moveTo(colMid + jr + 13, jy - jr - 3); ctx.lineTo(colMid + jr + 13, jy - jr + 7);
    ctx.moveTo(colMid - jr - 20, jy + jr + 4); ctx.lineTo(colMid - jr - 10, jy + jr + 4);
    ctx.stroke();

    /* the admittance: the mechanics the tool is being asked to imitate */
    const adY = y + h * 0.44, adH = Math.min(h * 0.24, 84);
    g.arrow(colMid, jy + jr + 2, colMid, adY - 2);
    g.signal("e", colMid + 9, jy + jr + 2, adY - 2);
    g.roundBox(colX, adY, colW, adH);
    g.cap("ADMITTANCE", colX, adY - 9, 10, "left");
    const rows = [["M", P.md.toFixed(1)], ["D", P.dd.toFixed(0)], ["K", P.kd.toFixed(0)]];
    rows.forEach(([sym, val], i) => {
      const yy = adY + adH * (0.32 + i * 0.26);
      g.maths(sym, colX + colW * 0.34, yy, 15, "right");
      g.maths("d", colX + colW * 0.34 + 2, yy + 4, 10, "left", 0.8);
      g.words(val, colX + colW * 0.78, yy, 12.5);
    });

    /* the plant: the tool, the wall, and what is happening between them */
    const px0 = rx + w * 0.40, pw = w * 0.585;
    const py0 = y + h * 0.03, ph = h * 0.94;
    g.roundBox(px0, py0, pw, ph, 5);
    g.cap("TOOL AND WALL", px0 + pw / 2, py0 - 9);
    drawContact(g, P, { x: px0, y: py0, w: pw, h: ph });
    g.maths("x", (colX + colW + px0) / 2 - 4, adY + adH * 0.42 - 10, 15);
    g.maths("r", (colX + colW + px0) / 2 + 3, adY + adH * 0.42 - 6, 10, "left", 0.8);
    g.arrow(colX + colW + 2, adY + adH * 0.5, px0 - 2, adY + adH * 0.5);

    /* the measured force, back along the bottom */
    const rowY = y + h * 0.78, rowH = Math.min(h * 0.155, 54);
    g.maths("f", (colX + colW + px0) / 2, rowY + rowH * 0.42 - 10, 16);
    g.arrow(px0 - 2, rowY + rowH * 0.5, colX + colW + 2, rowY + rowH * 0.5);
    g.roundBox(colX, rowY, colW, rowH);
    g.words("Force sensor", colMid, rowY + rowH * 0.42, 13);
    g.labelled("k", "e", " = " + P.ke.toFixed(0) + " N/m", colMid, rowY + rowH * 0.85);

    ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(colX - 2, rowY + rowH * 0.5);
    ctx.lineTo(feedX, rowY + rowH * 0.5);
    ctx.lineTo(feedX, jy);
    ctx.stroke();
    g.arrow(feedX, jy, colMid - jr - 2, jy);
  }

  /* ---------- the tool against the wall ---------- */

  function drawContact(g, P, box) {
    const { ctx } = g;
    /* Millimetres of penetration beside centimetres of approach would be
       invisible, so the axis is drawn at a scale that makes the contact
       readable and the record below carries the honest numbers. */
    const LEFT = -0.030, RIGHT = 0.055;
    const px = (X) => box.x + box.w * 0.12 +
      ((X - LEFT) / (RIGHT - LEFT)) * (box.w * 0.66);
    const mid = box.y + box.h * 0.52;

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x + 1.5, box.y + 1.5, box.w - 3, box.h - 3);
    ctx.clip();

    const f = force(x, v, P.ke);
    const face = px(WALL.x + Math.max(0, x - WALL.x));    /* the surface, pushed in */
    const wallEnd = box.x + box.w - 6;

    /* the wall: a face and hatching behind it */
    ctx.fillStyle = g.ink(0.06);
    ctx.fillRect(face, box.y + box.h * 0.16, wallEnd - face, box.h * 0.72);
    ctx.strokeStyle = g.ink(0.22);
    ctx.lineWidth = 1;
    for (let hx = face + 7; hx < wallEnd; hx += 9) {
      ctx.beginPath();
      ctx.moveTo(hx, box.y + box.h * 0.16);
      ctx.lineTo(hx - 9, box.y + box.h * 0.88);
      ctx.stroke();
    }
    ctx.strokeStyle = g.ink(f > 0 ? 0.9 : 0.45);
    ctx.lineWidth = f > 0 ? 2.4 : 1.6;
    ctx.beginPath();
    ctx.moveTo(face, box.y + box.h * 0.16);
    ctx.lineTo(face, box.y + box.h * 0.88);
    ctx.stroke();
    /* where the surface sits with nothing pressing on it */
    ctx.strokeStyle = g.ink(0.2);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(WALL.x), box.y + box.h * 0.12);
    ctx.lineTo(px(WALL.x), box.y + box.h * 0.92);
    ctx.stroke();
    ctx.setLineDash([]);

    /* the rail the tool runs on */
    ctx.strokeStyle = g.ink(0.14);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(box.x + 12, mid + 26); ctx.lineTo(face, mid + 26);
    ctx.stroke();

    /* where the admittance is telling it to be */
    const xr = px(WALL.x + e);
    ctx.strokeStyle = g.ink(0.35);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xr, mid - 30); ctx.lineTo(xr, mid + 26);
    ctx.stroke();
    ctx.setLineDash([]);
    g.labelled("x", "r", "", xr, mid - 34, 12, 0.5);

    /* the tool */
    const tw = box.w * 0.13, th = box.h * 0.26;
    const tx = px(x) - tw;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = g.ink(1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(tx, mid - th / 2, tw, th);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(px(x) - 5, mid - 5, 5, 10);

    /* what it is pressing with */
    if (f > 0.05) {
      const len = Math.min(box.w * 0.22, 8 + (f / 30) * box.w * 0.18);
      g.arrow(px(x) - len - 8, mid - th * 0.62, px(x) - 6, mid - th * 0.62);
      g.words(f.toFixed(1) + " N", px(x) - len - 12, mid - th * 0.62 + 4, 12, "right");
    } else {
      g.cap("NO CONTACT", box.x + box.w * 0.12, mid - th * 0.62 + 4, 9, "left", 0.4);
    }
    ctx.restore();
  }

  /* ---------- the two records ---------- */

  let fTop = 40;                /* N; grows to fit the run */
  /* The commanded position sits inside the surface -- that is what produces
     the force -- and how far inside depends on the wall, so the travel scale
     is grown to fit rather than fixed. */
  let xTop = 0.02;

  function drawForce(g, P, p) {
    const { ctx } = g;
    const x0 = p.x + 34, x1 = p.x + p.w - 12;
    const yTop = p.y + 36, yBot = p.y + p.h - 26;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (f) => yBot - (Math.min(f, fTop) / fTop) * (yBot - yTop);

    g.seconds(p, px, yTop, yBot, WINDOW, 1);
    ctx.strokeStyle = g.ink(0.13);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yBot); ctx.lineTo(x1, yBot);
    ctx.stroke();
    for (const frac of [0.5, 1]) {
      const yy = yBot - frac * (yBot - yTop);
      ctx.strokeStyle = g.ink(0.07);
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      g.cap(Math.round(fTop * frac) + "", x0 - 6, yy + 3, 9, "right", 0.4);
    }

    /* what was asked for, and what the loop will actually hold */
    for (const [alpha, dash, value] of [[0.34, [4, 4], (fd) => fd],
                                        [0.5, [1, 3], (fd) => settledForce(fd, P)]]) {
      ctx.strokeStyle = g.ink(alpha);
      ctx.lineWidth = 1.2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x0, py(value(DEMAND[0])));
      ctx.lineTo(px(T_STEP), py(value(DEMAND[0])));
      ctx.lineTo(px(T_STEP), py(value(DEMAND[1])));
      ctx.lineTo(x1, py(value(DEMAND[1])));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = g.ink(0.95);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (const row of hist) {
      const X = px(row[0]), Y = py(row[3]);
      started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
    }
    ctx.stroke();
    g.cap("ASKED FOR", x1 - 4, yTop + 11, 9, "right", 0.4);
    g.cap("HELD", x1 - 4, yTop + 23, 9, "right", 0.55);
  }

  function drawTravel(g, P, p) {
    const { ctx } = g;
    const x0 = p.x + 40, x1 = p.x + p.w - 12;
    const yTop = p.y + 36, yBot = p.y + p.h - 26;
    const TOP = xTop, BOT = -0.026;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (X) => yBot - ((Math.max(BOT, Math.min(TOP, X)) - BOT) / (TOP - BOT)) * (yBot - yTop);

    g.seconds(p, px, yTop, yBot, WINDOW, 1);

    /* everything past the surface is inside the wall */
    ctx.fillStyle = g.ink(0.07);
    ctx.fillRect(x0, yTop, x1 - x0, py(WALL.x) - yTop);
    ctx.strokeStyle = g.ink(0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, py(WALL.x)); ctx.lineTo(x1, py(WALL.x));
    ctx.stroke();
    g.cap("WALL", x1 - 4, py(WALL.x) - 6, 9, "right", 0.45);
    for (let mm = -20; mm <= TOP * 1000 + 0.5; mm += 10) {
      if (mm === 0) continue;                 /* the surface carries that one */
      g.cap(mm + "", x0 - 6, py(mm / 1000) + 3, 9, "right", 0.4);
    }

    /* where it was told to go, and where it went */
    ctx.strokeStyle = g.ink(0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let on = false;
    for (const row of hist) {
      const X = px(row[0]), Y = py(row[2]);
      on ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (on = true));
    }
    ctx.stroke();

    ctx.strokeStyle = g.ink(0.95);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    on = false;
    for (const row of hist) {
      const X = px(row[0]), Y = py(row[1]);
      on ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (on = true));
    }
    ctx.stroke();
    g.cap("COMMANDED", p.x + 44, p.y + p.h - 24, 9, "left", 0.35);
    g.cap("TOOL", p.x + 44, p.y + p.h - 12, 9, "left", 0.6);
  }

  /* ---------- the module ---------- */

  return {
    id: "contact",
    canvasLabel: "A tool pressed against a compliant wall under admittance " +
      "control, with the contact force it holds and the travel of the tool " +
      "against the surface plotted over time",

    controls: [
      { id: "md", label: "Virtual mass <i>M</i><sub>d</sub>",
        min: 0.5, max: 10, step: 0.5, value: 2, show: (v) => v.toFixed(1) + " kg" },
      { id: "dd", label: "Virtual damping <i>D</i><sub>d</sub>",
        min: 5, max: 120, step: 5, value: 30, show: (v) => v + " Ns/m" },
      { id: "kd", label: "Virtual stiffness <i>K</i><sub>d</sub>",
        min: 0, max: 400, step: 25, value: 200, show: (v) => v + " N/m" },
      { id: "ke", label: "Wall stiffness <i>k</i><sub>e</sub>",
        min: 500, max: 20000, step: 500, value: 4000, show: (v) => v + " N/m" },
    ],

    readouts: [
      { id: "pole", label: "Rightmost pole" },
      { id: "offset", label: "Force held" },
    ],
    verdict: true,

    reset() {
      x = START;
      v = 0;
      e = START;
      de = 0;
      simT = 0;
      hist = [];
      diverged = false;
      fTop = 40;
      xTop = 0.02;
    },

    done: () => diverged || simT >= WINDOW,

    advance(P, dt) {
      let left = dt;
      while (left > 1e-12) {
        const step = Math.min(SUB, left);
        rk4(step, P);
        left -= step;
      }
      const f = force(x, v, P.ke);
      hist.push([simT, x, e, f]);
      if (hist.length > 600) hist.shift();
      if (f > fTop) fTop = Math.ceil(f / 40) * 40;
      const far = Math.max(x, e);
      if (far > xTop) xTop = Math.ceil(far / 0.02) * 0.02;
      if (!Number.isFinite(x) || Math.abs(x) > 0.5 || Math.abs(v) > 40) diverged = true;
    },

    tune(P) {
      pole = rightmost(P);
      return null;
    },

    live(P) {
      const bad = !(pole < 0);
      const fd = demand(simT);
      const held = settledForce(fd, P);
      return {
        readouts: {
          pole: Number.isFinite(pole) ? pole.toFixed(1) + " /s" : "∞",
          /* an equilibrium the loop is running away from is not being held,
             so name it as that rather than printing a number for it */
          offset: diverged ? "lost" : bad ? "not held"
            : held.toFixed(1) + " N of " + fd.toFixed(0),
        },
        verdict: { text: bad ? "Unstable" : "Stable", bad },
      };
    },

    draw(g, P, D) {
      const b = boxes(D);
      drawLoop(g, P, b.loop);
      g.panel(b.left, "CONTACT FORCE (N)", () => drawForce(g, P, b.left));
      g.panel(b.right, "TRAVEL INTO THE SURFACE (MM)", () => drawTravel(g, P, b.right));
    },
  };
})());
