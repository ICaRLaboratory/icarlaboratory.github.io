/* ===============================================================
   The loop, with the gains exposed.

   The plant is a two-link planar arm in the horizontal plane, with
   its real dynamics rather than a stand-in for them:

       M(q) q'' + c(q, q') = tau

   M is the inertia matrix, which changes with the elbow angle, and c
   collects the Coriolis and centripetal terms. The joints are
   therefore coupled: swinging the shoulder throws the elbow, and the
   inertia the controller is pushing against is different on one side
   of the circle than on the other.

   The task is a circle, traced by the tip once every five seconds,
   and the joint angles that draw it come from the inverse kinematics
   of the arm. The controller is plain sampled PD on each joint,
   tracking those angles with no attempt to cancel any of the
   dynamics:

       tau[k] = Kp (q_r - q[k-m]) + Kd (q_r' - q'[k-m]),  held until k+1

   Deliberately plain. Computed torque would cancel the coupling and
   the payload with it, which is the point of the method and the death
   of the picture.

   At five seconds -- one full lap in -- two kilogrammes arrive at the
   end effector. Nothing about the controller changes. The arm is
   simply heavier than the gains were chosen for, and the error it was
   holding to a few millimetres opens up: the laden laps are drawn
   wider than the first, because a plain PD loop lags a load it does
   not know about and the tip carries out past the circle it was
   given.

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
  /* point masses at the end of each link: the smallest model that still
     has a varying inertia and real Coriolis terms */
  const ARM = { m1: 1, m2: 0.7, l1: 1, l2: 0.85 };
  const PAYLOAD = 2;            /* kg, at the end effector */
  const T_LOAD = 5;             /* s, one lap in */
  const WINDOW = 20;            /* s, four laps */
  const CIRCLE = { x: 0.9, y: -0.4, r: 0.35, T: 5, phase: Math.PI };

  /* the joint angles the circle covers, so one scale serves the record */
  const A_TOP = 2.95, A_BOT = -2.35;
  /* the arm's reach over the whole task, padded for the pedestal and the
     payload marker, so the drawing never has to rescale mid-run */
  const REACH = { x0: -0.30, x1: 1.40, y0: -1.15, y1: 0.18 };

  const SUB = 1 / 600;          /* integration step, well under any h */
  const TRAIL = 620;            /* how much of the tip path is drawn */

  let q, v, held, queue, simT, nextT, hist, marks, diverged;
  let rhoFree = 0, rhoLoad = 0;

  const loaded = () => simT >= T_LOAD;
  const tipMass = () => (loaded() ? ARM.m2 + PAYLOAD : ARM.m2);

  /* ---------- the task ---------- */

  function ref(t) {
    const w = (2 * Math.PI) / CIRCLE.T, a = w * t + CIRCLE.phase;
    return { x: CIRCLE.x + CIRCLE.r * Math.cos(a),
             y: CIRCLE.y + CIRCLE.r * Math.sin(a) };
  }

  /* elbow up, the branch that keeps both links clear of the pedestal */
  function ik(p) {
    const { l1, l2 } = ARM;
    const c2 = Math.max(-1, Math.min(1,
      (p.x * p.x + p.y * p.y - l1 * l1 - l2 * l2) / (2 * l1 * l2)));
    const q2 = Math.acos(c2);
    return [Math.atan2(p.y, p.x) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2)), q2];
  }

  const fk = (a) => ({
    x: ARM.l1 * Math.cos(a[0]) + ARM.l2 * Math.cos(a[0] + a[1]),
    y: ARM.l1 * Math.sin(a[0]) + ARM.l2 * Math.sin(a[0] + a[1]),
  });

  /* the reference joint velocity, differenced rather than derived: the
     Jacobian inverse says the same thing and this cannot disagree with the
     angles the same call produced */
  function refJoints(t) {
    const e = 1e-4;
    const a = ik(ref(t - e)), b = ik(ref(t + e));
    return { q: ik(ref(t)), dq: [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)] };
  }

  /* ---------- the arm ---------- */

  function inertia(q2, m2) {
    const { m1, l1, l2 } = ARM;
    const off = m2 * l2 * l2 + m2 * l1 * l2 * Math.cos(q2);
    return [(m1 + m2) * l1 * l1 + m2 * l2 * l2 + 2 * m2 * l1 * l2 * Math.cos(q2),
            off, off, m2 * l2 * l2];                       /* [a, b, b, d] */
  }

  function coriolis(q2, d1, d2, m2) {
    const k = m2 * ARM.l1 * ARM.l2 * Math.sin(q2);
    return [-k * (2 * d1 * d2 + d2 * d2), k * d1 * d1];
  }

  function solve2(Mv, r0, r1) {
    const [a, b, , d] = Mv;
    const det = a * d - b * b;
    return [(d * r0 - b * r1) / det, (a * r1 - b * r0) / det];
  }

  function deriv(y) {
    const m2 = tipMass();
    const c = coriolis(y[1], y[2], y[3], m2);
    const a = solve2(inertia(y[1], m2), held[0] - c[0], held[1] - c[1]);
    return [y[2], y[3], a[0], a[1]];
  }

  function rk4(dt) {
    let y = [q[0], q[1], v[0], v[1]];
    const k1 = deriv(y);
    const k2 = deriv(y.map((c, i) => c + (dt / 2) * k1[i]));
    const k3 = deriv(y.map((c, i) => c + (dt / 2) * k2[i]));
    const k4 = deriv(y.map((c, i) => c + dt * k3[i]));
    y = y.map((c, i) => c + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    q = [y[0], y[1]];
    v = [y[2], y[3]];
    simT += dt;
  }

  function coast(dt) {
    let left = dt;
    while (left > 1e-12) {
      const step = Math.min(SUB, left);
      rk4(step);
      left -= step;
    }
  }

  function sample(P) {
    const r = refJoints(simT);
    for (let i = 0; i < 2; i++) {
      queue[i].push(P.kp * (r.q[i] - q[i]) + P.kd * (r.dq[i] - v[i]));
      const k = queue[i].length - 1 - P.m;
      held[i] = k >= 0 ? queue[i][k] : 0;
      if (queue[i].length > 64) queue[i].shift();
    }
    marks.push([simT, q[0], q[1]]);
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
    const [a, b, , d] = inertia(q2, m2);
    const det = a * d - b * b;
    const Mi = [d / det, -b / det, -b / det, a / det];

    const n = 4 + 2 * m;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    /* dq(k+1) = dq + h dq' + (h^2/2) M^-1 tau,  dq'(k+1) = dq' + h M^-1 tau */
    A[0][0] = 1; A[1][1] = 1;
    A[0][2] = h; A[1][3] = h;
    A[2][2] = 1; A[3][3] = 1;
    const applied = m === 0 ? null : n - 2;                /* the oldest torque */
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const g = Mi[i * 2 + j];
        if (applied === null) {
          /* tau(k) = -Kp dq - Kd dq', substituted straight in */
          A[i][j] += -0.5 * h * h * g * P.kp;
          A[i][2 + j] += -0.5 * h * h * g * P.kd;
          A[2 + i][j] += -h * g * P.kp;
          A[2 + i][2 + j] += -h * g * P.kd;
        } else {
          A[i][applied + j] += 0.5 * h * h * g;
          A[2 + i][applied + j] += h * g;
        }
      }
    }
    if (applied !== null) {
      for (let i = 0; i < 2; i++) {
        A[4 + i][i] = -P.kp;                               /* the new torque */
        A[4 + i][2 + i] = -P.kd;
      }
      for (let k = 1; k < m; k++) {                        /* and the queue shifts */
        A[4 + 2 * k][2 + 2 * k] = 1;
        A[5 + 2 * k][3 + 2 * k] = 1;
      }
    }
    return SIM.radiusByPowers(A, n);
  }

  /* the worst pose on the circle: the arm passes through all of them */
  function worstRadius(m2, P) {
    let worst = 0;
    for (let i = 0; i < 36; i++) {
      const r = radiusAt(ik(ref((i / 36) * CIRCLE.T))[1], m2, P);
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

  function boxes(D) {
    return D.w >= 700
      ? { loop: { x: 0, y: 18, w: 780, h: 282 },
          left: { x: 0, y: 330, w: 379, h: 290 },
          right: { x: 401, y: 330, w: 379, h: 290 } }
      : { loop: { x: 0, y: 18, w: 380, h: 412 },
          left: { x: 0, y: 460, w: 380, h: 265 },
          right: { x: 0, y: 745, w: 380, h: 265 } };
  }

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
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(colMid, cy, rad, 0, 7);
    ctx.stroke();
    const a = (2 * Math.PI * simT) / CIRCLE.T + CIRCLE.phase;
    ctx.fillStyle = "#0f766e";
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
    g.cap(loaded() ? "ARM  +2 KG" : "ARM", px0 + pw / 2, py0 - 9);
    drawArm(g, { x: px0, y: py0, w: pw, h: ph });
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

  /* ---------- the arm, drawn wherever it is asked to sit ---------- */

  function drawArm(g, box) {
    const { ctx } = g;
    const span = { w: REACH.x1 - REACH.x0, h: REACH.y1 - REACH.y0 };
    const s = Math.min((box.w * 0.92) / span.w, (box.h * 0.92) / span.h);
    /* the base sits where the origin falls once the reach is centred */
    const bx = box.x + (box.w - span.w * s) / 2 - REACH.x0 * s;
    const by = box.y + (box.h - span.h * s) / 2 - REACH.y0 * s;
    const at = (p) => ({ x: bx + p.x * s, y: by + p.y * s });

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x + 1.5, box.y + 1.5, box.w - 3, box.h - 3);
    ctx.clip();

    /* the circle it was asked for */
    ctx.strokeStyle = g.ink(0.22);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(bx + CIRCLE.x * s, by + CIRCLE.y * s, CIRCLE.r * s, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);

    /* where on it the tip is being asked to be, right now */
    const want = at(ref(simT));
    ctx.strokeStyle = g.ink(0.4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(want.x, want.y, 4.5, 0, 7);
    ctx.stroke();

    /* The path the tip has actually taken. The first lap is kept on the
       picture for the whole run rather than scrolling away, because the
       laden laps are only worth looking at beside it. */
    const cut = hist.length > TRAIL ? hist[hist.length - TRAIL][0] : 0;
    const path = (from, to, stroke) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const row of hist) {
        if (row[0] < from || row[0] > to) { started = false; continue; }
        const e = at(fk([row[1], row[2]]));
        started ? ctx.lineTo(e.x, e.y) : (ctx.moveTo(e.x, e.y), (started = true));
      }
      ctx.stroke();
    };
    path(0, T_LOAD, g.ink(0.26));
    path(Math.max(T_LOAD, cut), Infinity, "#0f766e");

    const j1 = at({ x: ARM.l1 * Math.cos(q[0]), y: ARM.l1 * Math.sin(q[0]) });
    const tip = at(fk(q));

    ctx.strokeStyle = g.ink(0.16);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx - s * 0.16, by); ctx.lineTo(bx + s * 0.16, by);
    ctx.stroke();

    ctx.strokeStyle = g.ink(1);
    ctx.lineWidth = Math.max(4, s * 0.055);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(j1.x, j1.y); ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.moveTo(bx - 9, by); ctx.lineTo(bx + 9, by);
    ctx.lineTo(bx + 6, by + 11); ctx.lineTo(bx - 6, by + 11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = g.ink(1);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j1.x, j1.y, 4, 0, 7); ctx.fill(); ctx.stroke();

    /* the load, when it is there: a mass at the tip, and said in words */
    if (loaded()) {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 9, 0, 7); ctx.fill();
      g.cap("+2 KG", tip.x + 13, tip.y + 4, 9, "left", 0.75);
    } else {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 4.6, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- the two records ---------- */

  /* how far the tip is from where it was asked to be, over the whole run */
  let errTop = 30;              /* mm; grows to fit, never shrinks mid-run */

  function drawError(g, p) {
    const { ctx } = g;
    const x0 = p.x + 34, x1 = p.x + p.w - 12;
    const yTop = p.y + 36, yBot = p.y + p.h - 26;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (e) => yBot - Math.min(e, errTop) / errTop * (yBot - yTop);

    g.seconds(p, px, yTop, yBot, WINDOW, 5);
    ctx.strokeStyle = g.ink(0.13);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yBot); ctx.lineTo(x1, yBot);
    ctx.stroke();
    for (const frac of [0.5, 1]) {
      const yy = yBot - frac * (yBot - yTop);
      ctx.strokeStyle = g.ink(0.07);
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      g.cap(Math.round(errTop * frac) + "", x0 - 6, yy + 3, 9, "right", 0.4);
    }

    if (simT >= T_LOAD) g.event(px(T_LOAD), yTop, yBot, "+2 KG");

    ctx.strokeStyle = g.ink(0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (const row of hist) {
      const X = px(row[0]), Y = py(row[3] * 1000);
      started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
    }
    ctx.stroke();
  }

  /* Both joints on one angle scale rather than each normalised to its own
     swing: normalised, the two would draw nearly the same curve twice. */
  function drawSampled(g, p) {
    const { ctx } = g;
    const x0 = p.x + 12, x1 = p.x + p.w - 12;
    const yTop = p.y + 34, yBot = p.y + p.h - 26;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (a) => yTop + ((A_TOP - a) / (A_TOP - A_BOT)) * (yBot - yTop);

    g.seconds(p, px, yTop, yBot, WINDOW, 5);

    /* the angles asked for, drawn once across the whole record */
    ctx.strokeStyle = g.ink(0.3);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const t = (i / 240) * WINDOW, a = ik(ref(t))[j];
        i ? ctx.lineTo(px(t), py(a)) : ctx.moveTo(px(t), py(a));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (simT >= T_LOAD) g.event(px(T_LOAD), yTop, yBot, "+2 KG");

    for (let j = 0; j < 2; j++) {
      /* the sampled measurement, held: what the controller was handed */
      ctx.strokeStyle = g.ink(j === 0 ? 0.95 : 0.55);
      ctx.lineWidth = j === 0 ? 1.6 : 1.3;
      ctx.beginPath();
      for (let i = 0; i < marks.length; i++) {
        const X = px(marks[i][0]), Y = py(marks[i][1 + j]);
        const Xn = i + 1 < marks.length ? px(marks[i + 1][0]) : px(Math.min(simT, WINDOW));
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        ctx.lineTo(Xn, Y);
      }
      ctx.stroke();
    }
    g.cap("SHOULDER", p.x + 12, p.y + p.h - 24, 9, "left", 0.55);
    g.cap("ELBOW", p.x + 12, p.y + p.h - 12, 9, "left", 0.32);
  }

  /* ---------- the module ---------- */

  return {
    id: "arm",
    canvasLabel: "Three live panels driven by one sampled-data control loop: " +
      "a two-link arm tracing a circle with a payload added partway, the tip " +
      "error over time, and the sampled joint angles against the angles asked for",

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

    reset(P) {
      q = ik(ref(0));
      v = refJoints(0).dq;       /* moving with the reference, not from rest */
      held = [0, 0];
      queue = [[], []];
      simT = 0;
      nextT = 0;
      hist = [];
      marks = [];
      diverged = false;
      errTop = 30;
    },

    done: () => diverged || simT >= WINDOW,

    advance(P, dt) {
      let left = dt;
      let guard = 0;
      while (left > 1e-9 && guard++ < 400) {
        if (simT >= nextT - 1e-12) {
          sample(P);
          nextT = simT + P.h;
        }
        const stepTo = Math.min(left, Math.max(nextT - simT, 1e-9));
        coast(stepTo);
        left -= stepTo;
      }

      const want = ref(simT), got = fk(q);
      const err = Math.hypot(got.x - want.x, got.y - want.y);
      hist.push([simT, q[0], q[1], err]);
      if (hist.length > 1600) hist.shift();
      /* the error scale grows to fit the run and never shrinks inside it, so
         the trace does not jump about while it is being drawn */
      const mm = err * 1000;
      if (mm > errTop) errTop = Math.ceil(mm / 30) * 30;

      const wild = !Number.isFinite(err) || err > 3
        || v.some((s) => Math.abs(s) > 120);
      if (wild) diverged = true;
    },

    tune(P) {
      rhoFree = worstRadius(ARM.m2, P);
      rhoLoad = worstRadius(ARM.m2 + PAYLOAD, P);
      return null;
    },

    live(P) {
      const rho = loaded() ? rhoLoad : rhoFree;
      const bad = !(rho < 1);
      /* the error the tip is holding, over the last second of the record */
      let sum = 0, n = 0;
      for (let i = hist.length - 1; i >= 0 && hist[i][0] > simT - 1; i--) {
        sum += hist[i][3] * hist[i][3];
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
      const b = boxes(D);
      drawLoop(g, P, b.loop);
      g.panel(b.left, "TIP ERROR (MM)", () => drawError(g, b.left));
      g.panel(b.right, "JOINT ANGLES OVER TIME (RAD)", () => drawSampled(g, b.right));
    },
  };
})());
