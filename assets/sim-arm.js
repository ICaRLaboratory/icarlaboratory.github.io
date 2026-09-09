/* ===============================================================
   The loop, with the gains exposed.

   The plant, the circle it is tracing and the six kilogrammes that
   land on it at five seconds all live in assets/sim-arm-plant.js,
   because assets/sim-smc.js is handed exactly the same ones. What is
   here is the controller: plain sampled PD on each joint, tracking
   the reference with no attempt to cancel any of the dynamics.

       tau[k] = Kp (q_r - q[k-m]) + Kd (q_r' - q'[k-m]),  held until k+1

   Deliberately plain. Computed torque would cancel the coupling and
   the payload with it, which is the point of the method and the death
   of the picture -- and the sliding mode tab next door is the honest
   way to show a controller that shrugs the load off.

   The stability readout is the loop linearised about the pose it is
   passing through, discretised with the hold and the delay: at the
   tracking equilibrium the Coriolis terms drop out, so what is left
   is M(q) dq'' = -Kp dq - Kd dq', and its spectral radius decides
   local stability. The pose changes around the circle, so the number
   reported is the worst of thirty-six points on it, at whatever the
   arm is carrying at that moment -- which is why it moves when the
   payload lands. More inertia makes a sampled loop slower and, for
   the same gains, better damped, so the load can carry the radius
   down even as it makes the tracking worse. Both readings are true,
   and they are measuring different things.
   =============================================================== */

SIM.register((function () {
  const A = ARMPLANT;
  const { T_LOAD, WINDOW, KG } = A;

  const S = { q: [0, 0], v: [0, 0], simT: 0, hist: [] };
  let held, queue, nextT, marks, diverged;
  let rhoFree = 0, rhoLoad = 0;

  function sample(P) {
    const r = A.refJoints(S.simT);
    for (let i = 0; i < 2; i++) {
      queue[i].push(P.kp * (r.q[i] - S.q[i]) + P.kd * (r.dq[i] - S.v[i]));
      const k = queue[i].length - 1 - P.m;
      held[i] = k >= 0 ? queue[i][k] : 0;
      if (queue[i].length > 64) queue[i].shift();
    }
    /* the error as the controller saw it, which is the one it acted on */
    marks.push([S.simT, r.q[0] - S.q[0], r.q[1] - S.q[1]]);
    if (marks.length > 1600) marks.shift();
  }

  /* ---------- stability of the loop, not of the picture ----------
     Linearise about the pose being tracked. At the tracking equilibrium the
     Coriolis terms and their derivatives drop out, so what is left is
     M(q) dq'' = -Kp dq - Kd dq' -- a four-state plant whose channels are
     coupled only through M(q)^-1. The hold makes that exact rather than
     approximate: with A nilpotent, exp(Ah) and its integral are polynomials
     in h, so no matrix exponential is needed. Written on
     z = [dq, dq', tau(k-1), ..., tau(k-m)] the loop is one matrix, and it is
     locally stable exactly when the radius is under 1. */

  function radiusAt(q2, m2, P) {
    const h = P.h, m = P.m;
    const [a, b, , d] = A.inertia(q2, m2);
    const det = a * d - b * b;
    const Mi = [d / det, -b / det, -b / det, a / det];

    const n = 4 + 2 * m;
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    /* dq(k+1) = dq + h dq' + (h^2/2) M^-1 tau,  dq'(k+1) = dq' + h M^-1 tau */
    M[0][0] = 1; M[1][1] = 1;
    M[0][2] = h; M[1][3] = h;
    M[2][2] = 1; M[3][3] = 1;
    const applied = m === 0 ? null : n - 2;                /* the oldest torque */
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const g = Mi[i * 2 + j];
        if (applied === null) {
          /* tau(k) = -Kp dq - Kd dq', substituted straight in */
          M[i][j] += -0.5 * h * h * g * P.kp;
          M[i][2 + j] += -0.5 * h * h * g * P.kd;
          M[2 + i][j] += -h * g * P.kp;
          M[2 + i][2 + j] += -h * g * P.kd;
        } else {
          M[i][applied + j] += 0.5 * h * h * g;
          M[2 + i][applied + j] += h * g;
        }
      }
    }
    if (applied !== null) {
      for (let i = 0; i < 2; i++) {
        M[4 + i][i] = -P.kp;                               /* the new torque */
        M[4 + i][2 + i] = -P.kd;
      }
      for (let k = 1; k < m; k++) {                        /* and the queue shifts */
        M[4 + 2 * k][2 + 2 * k] = 1;
        M[5 + 2 * k][3 + 2 * k] = 1;
      }
    }
    return SIM.radiusByPowers(M, n);
  }

  /* the worst pose on the circle: the arm passes through all of them */
  function worstRadius(m2, P) {
    let worst = 0;
    for (let i = 0; i < 36; i++) {
      const r = radiusAt(A.ik(A.ref((i / 36) * A.CIRCLE.T))[1], m2, P);
      if (r > worst) worst = r;
      if (!Number.isFinite(worst)) return Infinity;
    }
    return worst;
  }

  /* Three places is enough to read, but near the boundary show as many as it
     takes to separate the number from 1, so a loop that really is unstable
     never sits beside a flat 1.000 and looks like a mistake. */
  function fmtRadius(rho) {
    if (!Number.isFinite(rho)) return "∞";
    let places = 3;
    const gap = Math.abs(rho - 1);
    if (gap > 0 && gap < 0.0015) places = Math.min(7, Math.ceil(-Math.log10(gap)) + 1);
    return rho.toFixed(places);
  }

  /* ---------- drawing ---------- */

  /* The arm keeps the whole right side, because it is the only block with
     something moving in it. Down the left: the circle it is asked to trace,
     the junction, the controller, and then the sampler and the delay side by
     side in one row -- they carry a word and a number each. */
  function drawLoop(g, P, r) {
    const { ctx } = g;
    const { x, y, w, h } = r;
    const colX = x + w * 0.035, colW = w * 0.30;
    const colMid = colX + colW / 2;
    const feedX = x + w * 0.008;

    /* the path it is asked to follow, drawn as the path it is */
    const cy = y + h * 0.155, rad = Math.min(h * 0.078, colW * 0.30);
    g.words("Target", colMid, y + h * 0.045, 13);
    ctx.strokeStyle = SIM.hue.one;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(colMid, cy, rad, 0, 7);
    ctx.stroke();
    const a = (2 * Math.PI * S.simT) / A.CIRCLE.T + A.CIRCLE.phase;
    ctx.fillStyle = SIM.hue.one;
    ctx.beginPath();
    ctx.arc(colMid + Math.cos(a) * rad, cy + Math.sin(a) * rad, 3.6, 0, 7);
    ctx.fill();
    g.maths("r", colMid + rad + 8, cy + 5, 15, "left");

    /* summing junction */
    const jy = y + h * 0.32, jr = Math.min(h * 0.055, 15);
    g.arrow(colMid, cy + rad + 6, colMid, jy - jr - 2);
    ctx.beginPath();
    ctx.arc(colMid, jy, jr, 0, 7);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = g.ink(0.35); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(colMid - jr * 0.5, jy); ctx.lineTo(colMid + jr * 0.5, jy);
    ctx.moveTo(colMid, jy - jr * 0.5); ctx.lineTo(colMid, jy + jr * 0.5);
    ctx.stroke();
    /* the signs, drawn rather than set, clear of both wires */
    ctx.beginPath();
    ctx.moveTo(colMid + jr + 8, jy - jr + 2); ctx.lineTo(colMid + jr + 18, jy - jr + 2);
    ctx.moveTo(colMid + jr + 13, jy - jr - 3); ctx.lineTo(colMid + jr + 13, jy - jr + 7);
    ctx.moveTo(colMid - jr - 20, jy + jr + 4); ctx.lineTo(colMid - jr - 10, jy + jr + 4);
    ctx.stroke();

    /* the controller, with the gains as they stand */
    const pdY = y + h * 0.46, pdH = Math.min(h * 0.19, 66);
    g.arrow(colMid, jy + jr + 2, colMid, pdY - 2);
    g.signal("e", colMid + 9, jy + jr + 2, pdY - 2);
    g.roundBox(colX, pdY, colW, pdH);
    g.cap("PD", colX, pdY - 9, 10, "left");
    g.maths("K", colX + colW * 0.30, pdY + pdH * 0.42, 15, "right");
    g.maths("p", colX + colW * 0.30 + 2, pdY + pdH * 0.42 + 4, 10, "left", 0.8);
    g.words(P.kp.toFixed(0), colX + colW * 0.74, pdY + pdH * 0.42, 13);
    g.maths("K", colX + colW * 0.30, pdY + pdH * 0.84, 15, "right");
    g.maths("d", colX + colW * 0.30 + 2, pdY + pdH * 0.84 + 4, 10, "left", 0.8);
    g.words(P.kd.toFixed(1), colX + colW * 0.74, pdY + pdH * 0.84, 13);

    /* the plant: the whole right side, with the arm in it */
    const px0 = x + w * 0.40, pw = w * 0.585;
    const py0 = y + h * 0.03, ph = h * 0.94;
    g.roundBox(px0, py0, pw, ph, 5);
    g.cap(A.loaded(S.simT) ? "ARM  " + KG : "ARM", px0 + pw / 2, py0 - 9);
    A.drawArm(g, { x: px0, y: py0, w: pw, h: ph }, S);
    g.maths("τ", (colX + colW + px0) / 2, pdY + pdH * 0.45 - 10, 15);
    g.arrow(colX + colW + 2, pdY + pdH * 0.5, px0 - 2, pdY + pdH * 0.5);

    /* the measurement, back along one row: the delay, then the sampler */
    const rowY = y + h * 0.78, rowH = Math.min(h * 0.155, 54);
    const halfW = (colW - w * 0.02) / 2;
    const samX = colX, delX = colX + halfW + w * 0.02;
    g.maths("q", (colX + colW + px0) / 2, rowY + rowH * 0.42 - 10, 16);
    g.arrow(px0 - 2, rowY + rowH * 0.5, delX + halfW + 2, rowY + rowH * 0.5);

    g.roundBox(delX, rowY, halfW, rowH);
    g.words("Delay", delX + halfW / 2, rowY + rowH * 0.42, 13);
    g.labelled("m", "", P.m === 0 ? " = 0"
      : " = " + P.m + " · " + Math.round(P.m * P.h * 1000) + " ms",
      delX + halfW / 2, rowY + rowH * 0.85);

    g.arrow(delX - 2, rowY + rowH * 0.5, samX + halfW + 2, rowY + rowH * 0.5);
    g.roundBox(samX, rowY, halfW, rowH);
    g.words("Sample", samX + halfW / 2, rowY + rowH * 0.42, 13);
    g.labelled("h", "", " = " + Math.round(P.h * 1000) + " ms",
      samX + halfW / 2, rowY + rowH * 0.85);

    /* and up the outside, back to the junction */
    ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(samX - 2, rowY + rowH * 0.5);
    ctx.lineTo(feedX, rowY + rowH * 0.5);
    ctx.lineTo(feedX, jy);
    ctx.stroke();
    g.arrow(feedX, jy, colMid - jr - 2, jy);
  }

  /* ---------- the two records ---------- */

  /* radians and radians a second, grown to fit the run */
  let eTop = 0.04, dTop = 0.4;

  const H = SIM.hue;
  const JOINT = [
    { name: "SHOULDER", on: H.one, off: H.onePale, w: 2.1 },
    { name: "ELBOW", on: H.two, off: H.twoPale, w: 1.8 },
  ];

  /* Each joint's tracking error against how fast that error is changing. A
     loop that is following draws a small orbit near the origin; the payload
     opens it out, and an unstable one spirals away from it. */
  function drawPhase(g, p) {
    const { ctx } = g;
    const left = p.x + 48, right = p.x + p.w - 16;
    const top = p.y + 52, bottom = p.y + p.h - 42;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const sx = (right - left) / 2 / eTop;
    const sy = (bottom - top) / 2 / dTop;

    g.keyRow([
      { label: JOINT[0].name, stroke: JOINT[0].on, width: 2.1 },
      { label: JOINT[1].name, stroke: JOINT[1].on, width: 1.8 },
      { label: "BEFORE " + KG, stroke: JOINT[0].off, width: 2.1 },
    ], p.x + 12, p.y + 34);

    ctx.strokeStyle = g.ink(0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, cy); ctx.lineTo(right, cy);
    ctx.moveTo(cx, top); ctx.lineTo(cx, bottom);
    ctx.stroke();
    g.cap("+" + eTop.toFixed(2), right, cy + 13, 9, "right", 0.45);
    g.cap("-" + eTop.toFixed(2), left, cy + 13, 9, "left", 0.45);
    g.cap("+" + dTop.toFixed(1), cx + 7, top + 8, 9, "left", 0.45);
    g.cap("-" + dTop.toFixed(1), cx + 7, bottom, 9, "left", 0.45);
    g.cap("ERROR  (RAD)", cx, p.y + p.h - 11, 9, "center", 0.5);
    g.vcap("ERROR RATE  (RAD/S)", p.x + 15, cy, 9, 0.5);

    const hist = S.hist;
    const cut = hist.length > A.TRAIL ? hist[hist.length - A.TRAIL][0] : 0;
    JOINT.forEach((j, i) => {
      const X = (row) => cx + row[4 + i] * sx;
      const Y = (row) => cy - row[6 + i] * sy;
      const path = (from, to, stroke) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = j.w;
        ctx.beginPath();
        let started = false;
        for (const row of hist) {
          if (row[0] < from || row[0] > to) { started = false; continue; }
          started ? ctx.lineTo(X(row), Y(row)) : (ctx.moveTo(X(row), Y(row)), (started = true));
        }
        ctx.stroke();
      };
      path(0, T_LOAD, j.off);
      path(Math.max(T_LOAD, cut), Infinity, j.on);
      if (hist.length) {
        const last = hist[hist.length - 1];
        ctx.fillStyle = j.on;
        ctx.beginPath();
        ctx.arc(X(last), Y(last), 3.2, 0, 7);
        ctx.fill();
      }
    });
  }

  /* The same error against time, with the staircase the controller actually
     saw laid over the continuous one it did not. */
  function drawErrors(g, p) {
    const { ctx } = g;
    const x0 = p.x + 48, x1 = p.x + p.w - 14;
    const yTop = p.y + 52, yBot = p.y + p.h - 42;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const mid = (yTop + yBot) / 2;
    const py = (e) => mid - (e / eTop) * ((yBot - yTop) / 2);

    g.keyRow([
      { label: JOINT[0].name, stroke: JOINT[0].on, width: 2.1 },
      { label: JOINT[1].name, stroke: JOINT[1].on, width: 1.8 },
      { label: "BETWEEN SAMPLES", stroke: g.ink(0.3), width: 1 },
    ], p.x + 12, p.y + 34);

    g.seconds(p, px, yTop, yBot, WINDOW, 5);
    ctx.strokeStyle = g.ink(0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, mid); ctx.lineTo(x1, mid);
    ctx.stroke();
    g.cap("+" + eTop.toFixed(2), x0 - 6, yTop + 3, 9, "right", 0.45);
    g.cap("0", x0 - 6, mid + 3, 9, "right", 0.45);
    g.cap("-" + eTop.toFixed(2), x0 - 6, yBot + 3, 9, "right", 0.45);
    g.vcap("ERROR  (RAD)", p.x + 15, mid, 9, 0.5);
    g.cap("TIME  (S)", (x0 + x1) / 2, p.y + p.h - 11, 9, "center", 0.5);

    if (S.simT >= T_LOAD) g.event(px(T_LOAD), yTop, yBot, KG);

    JOINT.forEach((j, i) => {
      /* what happened between the samples, which the loop never saw */
      ctx.strokeStyle = g.ink(0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const row of S.hist) {
        const X = px(row[0]), Y = py(row[4 + i]);
        started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
      }
      ctx.stroke();

      /* and the held staircase it acted on */
      ctx.strokeStyle = j.on;
      ctx.lineWidth = j.w;
      ctx.beginPath();
      for (let k = 0; k < marks.length; k++) {
        const X = px(marks[k][0]), Y = py(marks[k][1 + i]);
        const Xn = k + 1 < marks.length ? px(marks[k + 1][0]) : px(Math.min(S.simT, WINDOW));
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        ctx.lineTo(Xn, Y);
      }
      ctx.stroke();
    });
  }

  /* ---------- the module ---------- */

  return {
    id: "arm",
    canvasLabel: "Three live panels driven by one sampled-data control loop: " +
      "a two-link arm tracing a circle with a payload added partway, the joint " +
      "tracking errors against their rates, and those errors over time",

    controls: [
      { id: "kp", label: "Proportional gain <i>K</i><sub>p</sub>",
        min: 10, max: 200, step: 5, value: 70, show: (v) => v.toFixed(1) },
      { id: "kd", label: "Derivative gain <i>K</i><sub>d</sub>",
        min: 2, max: 20, step: 0.5, value: 8, show: (v) => v.toFixed(1) },
      { id: "h", label: "Sampling period <i>h</i>",
        min: 5, max: 100, step: 5, value: 25,
        read: (v) => v / 1000, show: (v) => Math.round(v * 1000) + " ms" },
      /* the delay is a whole number of samples, so name it and say what that
         is in milliseconds -- the sampling period carries its own symbol */
      { id: "m", label: "Feedback delay <i>m</i>",
        min: 0, max: 3, step: 1, value: 0,
        show: (v, P) => (v === 0 ? "0"
          : v + (v > 1 ? " samples" : " sample") + "  ·  " +
            Math.round(v * P.h * 1000) + " ms") },
    ],

    readouts: [
      { id: "rho", label: "Spectral radius" },
      { id: "err", label: "Tracking error" },
    ],
    verdict: true,

    reset() {
      S.q = A.ik(A.ref(0));
      S.v = A.refJoints(0).dq;   /* moving with the reference, not from rest */
      S.simT = 0;
      S.hist = [];
      held = [0, 0];
      queue = [[], []];
      nextT = 0;
      marks = [];
      diverged = false;
      eTop = 0.04;
      dTop = 0.4;
    },

    done: () => diverged || S.simT >= WINDOW,

    advance(P, dt) {
      let left = dt;
      let guard = 0;
      while (left > 1e-9 && guard++ < 400) {
        if (S.simT >= nextT - 1e-12) {
          sample(P);
          nextT = S.simT + P.h;
        }
        const stepTo = Math.min(left, Math.max(nextT - S.simT, 1e-9));
        A.integrate(S, stepTo, held);
        left -= stepTo;
      }

      const want = A.ref(S.simT), got = A.fk(S.q);
      const err = Math.hypot(got.x - want.x, got.y - want.y);
      const r = A.refJoints(S.simT);
      const e = [r.q[0] - S.q[0], r.q[1] - S.q[1]];
      const de = [r.dq[0] - S.v[0], r.dq[1] - S.v[1]];
      S.hist.push([S.simT, S.q[0], S.q[1], err, e[0], e[1], de[0], de[1]]);
      if (S.hist.length > 1600) S.hist.shift();
      /* the scales grow to fit the run and never shrink inside it, so nothing
         jumps about while it is being drawn */
      for (let i = 0; i < 2; i++) {
        if (Math.abs(e[i]) > eTop) eTop = Math.ceil(Math.abs(e[i]) / 0.02) * 0.02;
        if (Math.abs(de[i]) > dTop) dTop = Math.ceil(Math.abs(de[i]) / 0.2) * 0.2;
      }

      const wild = !Number.isFinite(err) || err > 3
        || S.v.some((s) => Math.abs(s) > 120);
      if (wild) diverged = true;
    },

    tune(P) {
      rhoFree = worstRadius(A.ARM.m2, P);
      rhoLoad = worstRadius(A.ARM.m2 + A.PAYLOAD, P);
      return null;
    },

    live() {
      const rho = A.loaded(S.simT) ? rhoLoad : rhoFree;
      const bad = !(rho < 1);
      /* the error the tip is holding, over the last second of the record */
      let sum = 0, n = 0;
      for (let i = S.hist.length - 1; i >= 0 && S.hist[i][0] > S.simT - 1; i--) {
        sum += S.hist[i][3] * S.hist[i][3];
        n++;
      }
      return {
        readouts: {
          rho: fmtRadius(rho),
          err: diverged ? "lost" : n ? (Math.sqrt(sum / n) * 1000).toFixed(1) + " mm" : "—",
        },
        verdict: { text: bad ? "Unstable" : "Stable", bad },
      };
    },

    draw(g, P, D) {
      const b = A.boxes(D);
      drawLoop(g, P, b.loop);
      g.panel(b.left, "JOINT ERROR, PHASE PORTRAIT", () => drawPhase(g, b.left));
      g.panel(b.right, "JOINT ERROR OVER TIME", () => drawErrors(g, b.right));
    },
  };
})());
