/* ===============================================================
   One arm, one circle, one payload, two ways of chasing it.

   The plant, the task and the six kilogrammes that land on it at
   five seconds are in assets/sim-arm-plant.js. What is here is the
   pair of controllers the tab switches between, sharing that plant
   and sharing the clock, so the two can be read straight against
   each other.

   PD is deliberately plain: proportional and derivative on each
   joint, tracking the reference with no attempt to cancel any of the
   dynamics.

       tau[k] = Kp (q_r - q[k-m]) + Kd (q_r' - q'[k-m])

   Computed torque would cancel the coupling and the payload with it,
   which is the point of that method and the death of this picture.
   Its readout is the loop linearised about the pose being tracked and
   discretised with the hold and the delay: at the tracking
   equilibrium the Coriolis terms drop out, what is left is
   M(q) dq'' = -Kp dq - Kd dq', and the spectral radius of the worst
   pose on the circle decides local stability.

   SLIDING MODE aims at a surface rather than a point. Each joint
   gets s = e' + lambda e, and the control drives s to zero the
   classical way, discontinuously:

       tau[k] = M_nominal(q) . eta sgn( s[k] )

   s = 0 is a first-order equation in the error whose decay does not
   care what the arm weighs, so the payload that costs the PD loop
   tens of millimetres costs this one a few. The switching gain is an
   acceleration turned into a torque through the arm as the controller
   believes it to be -- the unladen one. A single torque gain cannot
   serve both joints: the elbow carries about a tenth of the
   shoulder's inertia, so a torque that barely moves one throws the
   other clean off the surface every sample. Nothing about the payload
   is in that nominal inertia; it is the disturbance the surface is
   there to absorb.

   No boundary layer, deliberately. Smoothing the switch inside a
   layer is the standard practical fix for chattering, and a good one,
   but it is a modification of the method rather than the method --
   and the PD next door is the plain classical one too. Left
   discontinuous, the chattering is not a slider setting but a
   property, and what sets its size is the clock.

   Sampling is what the two have in common and what neither escapes. A
   hold cannot switch between samples, so PD's radius climbs past one
   as the period grows, and sliding mode does not reach its surface
   but straddles it, in a band of about (1 + m)h eta -- the switching
   term drives s at plus or minus eta and cannot be turned round until
   the next sample, nor until the m samples of delay have passed. That
   width is what the two panels shade, and a loop that is really
   sliding measures it to within about half again.
   =============================================================== */

SIM.register((function () {
  const A = ARMPLANT;
  const { T_LOAD, WINDOW, KG } = A;
  const H = SIM.hue;
  const JOINT = [
    { name: "SHOULDER", on: H.one, off: H.onePale, w: 2.1 },
    { name: "ELBOW", on: H.two, off: H.twoPale, w: 1.8 },
  ];
  const pd = (P) => P.law === "pd";

  /* What a zero-order hold does to an ideal sliding mode. On the surface the
     switching term drives s at plus or minus eta, and the hold cannot turn it
     round until the next sample -- nor until m samples after that, if the
     measurement it switched on was that old. So s runs on for (1 + m)h at
     the full switching rate before the sign can change, and overshoots the
     surface by that much: it is not reached but straddled, in a band of
     about (1 + m)h eta. Measured over a run it comes out a little wider,
     since the switching term is not the only thing moving s -- the payload
     and the inertia the controller does not know about move it too -- so
     it is the width to expect rather than a ceiling. It is the sampled-data
     cost of the method: the panels shade it, the key names it, and the
     verdict is read against it. */
  const quasiBand = (P) => (P.m + 1) * P.h * P.eta;
  const bandName = (P) => (P.m ? "(1+m)hη" : "hη");

  const S = { q: [0, 0], v: [0, 0], simT: 0, hist: [] };
  let held, queue, nextT, marks, diverged;
  let rhoFree = 0, rhoLoad = 0;

  /* the planes are grown to fit the run; sliding mode holds an order of
     magnitude tighter than PD, so it starts an order of magnitude smaller */
  let eTop = 0.04, dTop = 0.4, sTop = 0.1;

  function sample(P) {
    const r = A.refJoints(S.simT);
    const tau = [0, 0];
    if (pd(P)) {
      for (let i = 0; i < 2; i++) {
        tau[i] = P.kp * (r.q[i] - S.q[i]) + P.kd * (r.dq[i] - S.v[i]);
      }
      /* the error as the controller saw it, which is the one it acted on */
      marks.push([S.simT, r.q[0] - S.q[0], r.q[1] - S.q[1]]);
      if (marks.length > 1600) marks.shift();
    } else {
      const want = [0, 0];
      for (let i = 0; i < 2; i++) {
        const s = (r.dq[i] - S.v[i]) + P.lam * (r.q[i] - S.q[i]);
        want[i] = P.eta * Math.sign(s);
      }
      const [a, b, , d] = A.inertia(S.q[1], A.ARM.m2);
      tau[0] = a * want[0] + b * want[1];
      tau[1] = b * want[0] + d * want[1];
    }
    for (let i = 0; i < 2; i++) {
      queue[i].push(tau[i]);
      const k = queue[i].length - 1 - P.m;
      held[i] = k >= 0 ? queue[i][k] : 0;
      if (queue[i].length > 64) queue[i].shift();
    }
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
  function drawLoopPD(g, P, r) {
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

  function drawLoopSMC(g, P, r) {
    const { ctx } = g;
    const { x, y, w, h } = r;
    const colX = x + w * 0.035, colW = w * 0.30;
    const colMid = colX + colW / 2;
    const feedX = x + w * 0.008;

    const cy = y + h * 0.15, rad = Math.min(h * 0.072, colW * 0.28);
    g.words("Target", colMid, y + h * 0.042, 13);
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

    const jy = y + h * 0.30, jr = Math.min(h * 0.052, 14);
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
    ctx.beginPath();
    ctx.moveTo(colMid + jr + 8, jy - jr + 2); ctx.lineTo(colMid + jr + 18, jy - jr + 2);
    ctx.moveTo(colMid + jr + 13, jy - jr - 3); ctx.lineTo(colMid + jr + 13, jy - jr + 7);
    ctx.moveTo(colMid - jr - 20, jy + jr + 4); ctx.lineTo(colMid - jr - 10, jy + jr + 4);
    ctx.stroke();

    /* the controller: the surface it is aiming at, and how hard it pushes */
    const smY = y + h * 0.42, smH = Math.min(h * 0.26, 92);
    g.arrow(colMid, jy + jr + 2, colMid, smY - 2);
    g.signal("e", colMid + 9, jy + jr + 2, smY - 2);
    g.roundBox(colX, smY, colW, smH);
    g.cap("SLIDING MODE", colX, smY - 9, 10, "left");
    /* the surface and the law, written out: they are the whole design */
    g.maths("s = e' + λe", colMid, smY + smH * 0.24, 13, "center", 0.85);
    g.maths("τ = M η sgn s", colMid, smY + smH * 0.47, 12.5, "center", 0.6);
    [["λ", P.lam.toFixed(0)], ["η", P.eta.toFixed(0)]].forEach(([sym, val], i) => {
      const yy = smY + smH * (0.70 + i * 0.22);
      g.maths(sym, colX + colW * 0.36, yy, 14, "right");
      g.words(val, colX + colW * 0.76, yy, 12);
    });

    const px0 = x + w * 0.40, pw = w * 0.585;
    const py0 = y + h * 0.03, ph = h * 0.94;
    g.roundBox(px0, py0, pw, ph, 5);
    g.cap(A.loaded(S.simT) ? "ARM  " + KG : "ARM", px0 + pw / 2, py0 - 9);
    A.drawArm(g, { x: px0, y: py0, w: pw, h: ph }, S);
    g.maths("τ", (colX + colW + px0) / 2, smY + smH * 0.45 - 10, 15);
    g.arrow(colX + colW + 2, smY + smH * 0.5, px0 - 2, smY + smH * 0.5);

    const rowY = y + h * 0.80, rowH = Math.min(h * 0.145, 50);
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

    ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(samX - 2, rowY + rowH * 0.5);
    ctx.lineTo(feedX, rowY + rowH * 0.5);
    ctx.lineTo(feedX, jy);
    ctx.stroke();
    g.arrow(feedX, jy, colMid - jr - 2, jy);
  }

  /* ---------- the four records, two to a law ---------- */

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

  /* The plane the design is drawn in: the surface is a line through the
     origin of slope -lambda, the band the hold implies is a strip of width
     h eta either side of it, and a loop that is sliding lives in that
     strip. */
  function drawSurface(g, P, p) {
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

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    /* the sampling band, then the surface down its middle */
    const X = (e) => cx + e * sx;
    const Y = (d) => cy - d * sy;
    const band = (off, style) => {
      ctx.beginPath();
      ctx.moveTo(X(-eTop), Y(P.lam * eTop + off));
      ctx.lineTo(X(eTop), Y(-P.lam * eTop + off));
      ctx.strokeStyle = style;
      ctx.stroke();
    };
    const reach = quasiBand(P);
    ctx.fillStyle = "rgba(234,88,12,0.09)";
    ctx.beginPath();
    ctx.moveTo(X(-eTop), Y(P.lam * eTop + reach));
    ctx.lineTo(X(eTop), Y(-P.lam * eTop + reach));
    ctx.lineTo(X(eTop), Y(-P.lam * eTop - reach));
    ctx.lineTo(X(-eTop), Y(P.lam * eTop - reach));
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    band(reach, "rgba(234,88,12,0.6)");
    band(-reach, "rgba(234,88,12,0.6)");
    ctx.setLineDash([]);
    ctx.lineWidth = 1.6;
    band(0, "rgba(234,88,12,0.9)");
    ctx.restore();

    ctx.strokeStyle = g.ink(0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, cy); ctx.lineTo(right, cy);
    ctx.moveTo(cx, top); ctx.lineTo(cx, bottom);
    ctx.stroke();
    g.cap("+" + eTop.toFixed(3), right, cy + 13, 9, "right", 0.45);
    g.cap("-" + eTop.toFixed(3), left, cy + 13, 9, "left", 0.45);
    g.cap("+" + dTop.toFixed(2), cx + 7, top + 8, 9, "left", 0.45);
    g.cap("-" + dTop.toFixed(2), cx + 7, bottom, 9, "left", 0.45);
    g.cap("ERROR  (RAD)", cx, p.y + p.h - 11, 9, "center", 0.5);
    g.vcap("ERROR RATE  (RAD/S)", p.x + 15, cy, 9, 0.5);
    g.cap("s = 0", right - 2, top + 12, 9, "right", 0.6);

    const hist = S.hist;
    const cut = hist.length > A.TRAIL ? hist[hist.length - A.TRAIL][0] : 0;
    JOINT.forEach((j, i) => {
      const path = (from, to, stroke) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = j.w;
        ctx.beginPath();
        let started = false;
        for (const row of hist) {
          if (row[0] < from || row[0] > to) { started = false; continue; }
          const a = X(row[4 + i]), b = Y(row[6 + i]);
          started ? ctx.lineTo(a, b) : (ctx.moveTo(a, b), (started = true));
        }
        ctx.stroke();
      };
      path(0, T_LOAD, j.off);
      path(Math.max(T_LOAD, cut), Infinity, j.on);
      if (hist.length) {
        const last = hist[hist.length - 1];
        ctx.fillStyle = j.on;
        ctx.beginPath();
        ctx.arc(X(last[4 + i]), Y(last[6 + i]), 3.2, 0, 7);
        ctx.fill();
      }
    });
  }

  /* The sliding variable itself, against the layer it should stay inside.
     A sampled loop cannot sit on the surface; it straddles it in a band, and
     that band against Phi is the whole reading. */
  function drawSliding(g, P, p) {
    const { ctx } = g;
    const x0 = p.x + 48, x1 = p.x + p.w - 14;
    const yTop = p.y + 52, yBot = p.y + p.h - 42;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const mid = (yTop + yBot) / 2;
    const py = (s) => mid - (s / sTop) * ((yBot - yTop) / 2);

    g.keyRow([
      { label: JOINT[0].name, stroke: JOINT[0].on, width: 2.1 },
      { label: JOINT[1].name, stroke: JOINT[1].on, width: 1.8 },
      { label: "BAND  ±" + bandName(P), stroke: "rgba(234,88,12,0.7)",
        width: 1.4, dash: [4, 3] },
    ], p.x + 12, p.y + 34);

    g.seconds(p, px, yTop, yBot, WINDOW, 5);

    /* the sampling band, the width the hold implies */
    const reach = quasiBand(P);
    const lo = Math.max(yTop, py(reach)), hi = Math.min(yBot, py(-reach));
    ctx.fillStyle = "rgba(234,88,12,0.09)";
    ctx.fillRect(x0, lo, x1 - x0, hi - lo);
    ctx.strokeStyle = "rgba(234,88,12,0.7)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    for (const yy of [lo, hi]) {
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = g.ink(0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, mid); ctx.lineTo(x1, mid);
    ctx.stroke();
    g.cap("+" + sTop.toFixed(2), x0 - 6, yTop + 3, 9, "right", 0.45);
    g.cap("0", x0 - 6, mid + 3, 9, "right", 0.45);
    g.cap("-" + sTop.toFixed(2), x0 - 6, yBot + 3, 9, "right", 0.45);
    g.vcap("SLIDING VARIABLE  s  (RAD/S)", p.x + 15, mid, 9, 0.5);
    g.cap("TIME  (S)", (x0 + x1) / 2, p.y + p.h - 11, 9, "center", 0.5);

    if (S.simT >= T_LOAD) g.event(px(T_LOAD), yTop, yBot, KG);

    JOINT.forEach((j, i) => {
      ctx.strokeStyle = j.on;
      ctx.lineWidth = j.w;
      ctx.beginPath();
      let started = false;
      for (const row of S.hist) {
        const a = px(row[0]), b = py(row[6 + i] + P.lam * row[4 + i]);
        started ? ctx.lineTo(a, b) : (ctx.moveTo(a, b), (started = true));
      }
      ctx.stroke();
    });
  }

  /* ---------- the module ---------- */

  return {
    id: "track",
    canvasLabel: "A two-link arm tracing a circle with a payload added " +
      "partway, under either sampled PD or sampled sliding mode control, " +
      "with the joint tracking errors and the record of them over time",

    /* each law has its own note and footnote in data/site.js */
    words: (P) => P.law,

    controls: [
      { id: "law", label: "Control law",
        value: "pd",
        choices: [{ value: "pd", label: "PD" },
                  { value: "smc", label: "Sliding mode" }] },
      { id: "kp", label: "Proportional gain <i>K</i><sub>p</sub>",
        min: 10, max: 200, step: 5, value: 70, show: (v) => v.toFixed(1),
        hide: (P) => !pd(P) },
      { id: "kd", label: "Derivative gain <i>K</i><sub>d</sub>",
        min: 2, max: 20, step: 0.5, value: 8, show: (v) => v.toFixed(1),
        hide: (P) => !pd(P) },
      { id: "lam", label: "Surface slope <i>λ</i>",
        min: 2, max: 40, step: 1, value: 10, show: (v) => v + " 1/s",
        hide: (P) => pd(P) },
      { id: "eta", label: "Switching gain <i>η</i>",
        min: 2, max: 60, step: 2, value: 20, show: (v) => v + " rad/s²",
        hide: (P) => pd(P) },
      /* shared, and the point of sharing them: the same clock and the same
         delay, so the two laws are answering the same question */
      { id: "h", label: "Sampling period <i>h</i>",
        min: 1, max: 100, step: 1, value: 10,
        read: (v) => v / 1000, show: (v) => Math.round(v * 1000) + " ms" },
      { id: "m", label: "Feedback delay <i>m</i>",
        min: 0, max: 3, step: 1, value: 0,
        show: (v, P) => (v === 0 ? "0"
          : v + (v > 1 ? " samples" : " sample") + "  ·  " +
            Math.round(v * P.h * 1000) + " ms") },
    ],

    readouts: [
      { id: "main", label: (P) => (pd(P) ? "Spectral radius" : "Sliding band") },
      { id: "err", label: "Tracking error" },
    ],
    verdict: true,

    reset(P) {
      S.q = A.ik(A.ref(0));
      S.v = A.refJoints(0).dq;   /* moving with the reference, not from rest */
      S.simT = 0;
      S.hist = [];
      held = [0, 0];
      queue = [[], []];
      nextT = 0;
      marks = [];
      diverged = false;
      eTop = pd(P) ? 0.04 : 0.01;
      dTop = pd(P) ? 0.4 : 0.1;
      sTop = 0.1;
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

      /* The scales grow to fit the run and never shrink inside it, so nothing
         jumps about while it is being drawn. Sliding mode skips the first
         half second: that is the reaching phase, and letting it set the axes
         would leave the sliding it reaches as a dot in the middle. */
      if (pd(P) || S.simT > 0.5) {
        const eStep = pd(P) ? 0.02 : 0.005, dStep = pd(P) ? 0.2 : 0.05;
        for (let i = 0; i < 2; i++) {
          if (Math.abs(e[i]) > eTop) eTop = Math.ceil(Math.abs(e[i]) / eStep) * eStep;
          if (Math.abs(de[i]) > dTop) dTop = Math.ceil(Math.abs(de[i]) / dStep) * dStep;
          const s = de[i] + P.lam * e[i];
          if (Math.abs(s) > sTop) sTop = Math.ceil(Math.abs(s) / 0.05) * 0.05;
        }
      }
      if (!pd(P)) {
        /* room for the band the hold implies, so it is on the picture even
           when the run is holding well inside it */
        const reach = quasiBand(P) * 1.8;
        if (reach > dTop) dTop = Math.ceil(reach / 0.05) * 0.05;
        if (reach > sTop) sTop = Math.ceil(reach / 0.05) * 0.05;
      }

      const wild = !Number.isFinite(err) || err > 3
        || S.v.some((s) => Math.abs(s) > 120);
      if (wild) diverged = true;
    },

    tune(P) {
      if (!pd(P)) return null;
      rhoFree = worstRadius(A.ARM.m2, P);
      rhoLoad = worstRadius(A.ARM.m2 + A.PAYLOAD, P);
      return null;
    },

    live(P) {
      /* the error the tip is holding, over the last second of the record */
      let sum = 0, n = 0;
      for (let i = S.hist.length - 1; i >= 0 && S.hist[i][0] > S.simT - 1; i--) {
        sum += S.hist[i][3] * S.hist[i][3];
        n++;
      }
      const err = diverged ? "lost"
        : n ? (Math.sqrt(sum / n) * 1000).toFixed(1) + " mm" : "—";

      if (pd(P)) {
        const rho = A.loaded(S.simT) ? rhoLoad : rhoFree;
        const bad = !(rho < 1);
        return {
          readouts: { main: fmtRadius(rho), err },
          verdict: { text: bad ? "Unstable" : "Stable", bad },
        };
      }

      /* The band is the worst of the whole run once the reaching phase is
         over, not the worst of the last second. The arm is at its lightest
         before the payload lands, and a light arm is the hard case for a
         gain written as an acceleration -- reading only the calm end would
         report sliding for a run that spent its first five seconds well off
         the surface. */
      let band = 0;
      for (const row of S.hist) {
        if (row[0] <= 0.5) continue;
        for (let j = 0; j < 2; j++) {
          const s = Math.abs(row[6 + j] + P.lam * row[4 + j]);
          if (s > band) band = s;
        }
      }
      const bound = quasiBand(P);
      /* A loop in quasi-sliding mode measures the width of its band, within
         about half again of it, across every period, gain and delay the
         sliders reach -- and a run that has left the surface measures
         several times it, often by orders of magnitude. Half again is where
         the two populations part: past it the switching is no longer
         dominating what it has to dominate. */
      const bad = diverged || band > 1.5 * bound;
      return {
        readouts: {
          main: diverged ? "lost" : band ? band.toFixed(3) + " rad/s" : "—",
          err,
        },
        verdict: {
          text: diverged ? "Lost" : bad ? "Not sliding" : "Sliding",
          bad,
        },
      };
    },

    draw(g, P, D) {
      const b = A.boxes(D);
      if (pd(P)) {
        drawLoopPD(g, P, b.loop);
        g.panel(b.left, "JOINT ERROR, PHASE PORTRAIT", () => drawPhase(g, b.left));
        g.panel(b.right, "JOINT ERROR OVER TIME", () => drawErrors(g, b.right));
      } else {
        drawLoopSMC(g, P, b.loop);
        g.panel(b.left, "ERROR PLANE AND SLIDING SURFACE", () => drawSurface(g, P, b.left));
        g.panel(b.right, "SLIDING VARIABLE OVER TIME", () => drawSliding(g, P, b.right));
      }
    },
  };
})());
