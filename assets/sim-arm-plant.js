/* ===============================================================
   The arm, the task and the payload, shared by the loops that drive
   them.

   Two controllers on this page are handed the same machine and the
   same job: assets/sim-arm.js runs sampled PD on it and
   assets/sim-smc.js runs sampled sliding mode. The comparison is only
   worth anything if the plant underneath really is identical, so it
   lives here rather than in either of them.

   The plant is a two-link planar arm in the horizontal plane, with its
   real dynamics rather than a stand-in for them:

       M(q) q'' + c(q, q') = tau

   M is the inertia matrix, which changes with the elbow angle, and c
   collects the Coriolis and centripetal terms. The joints are
   therefore coupled: swinging the shoulder throws the elbow, and the
   inertia a controller is pushing against is different on one side of
   the circle than on the other.

   The task is a circle, traced by the tip once every five seconds,
   and the joint angles that draw it come from the inverse kinematics
   of the arm. At five seconds -- one full lap in -- ten kilogrammes
   arrive at the end effector, and nothing about any controller
   changes. Ten rather than six: the laws that estimate the arm rather
   than model it shrug six off without moving, so it separated nothing. What each one does about that is the point of having two
   of them.
   =============================================================== */

const ARMPLANT = (function () {
  /* point masses at the end of each link: the smallest model that still
     has a varying inertia and real Coriolis terms */
  const ARM = { m1: 1, m2: 0.7, l1: 1, l2: 0.85 };
  const PAYLOAD = 10;           /* kg, at the end effector */
  const T_LOAD = 5;             /* s, one lap in */
  const WINDOW = 20;            /* s, four laps */
  const CIRCLE = { x: 0.9, y: -0.4, r: 0.35, T: 5, phase: Math.PI };
  const KG = "+" + PAYLOAD + " KG";

  /* the arm's reach over the whole task, padded for the pedestal and the
     payload marker, so the drawing never has to rescale mid-run */
  const REACH = { x0: -0.30, x1: 1.40, y0: -1.15, y1: 0.18 };
  const TRAIL = 620;            /* how much of the tip path is drawn */
  const SUB = 1 / 600;          /* integration step, well under any h */

  const loaded = (t) => t >= T_LOAD;
  const tipMass = (t) => (loaded(t) ? ARM.m2 + PAYLOAD : ARM.m2);

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

  /* The reference joint velocity and acceleration, differenced rather than
     derived: the Jacobian says the same thing and this cannot disagree with
     the angles the same call produced. */
  function refJoints(t) {
    const e = 1e-4;
    const a = ik(ref(t - e)), b = ik(ref(t)), c = ik(ref(t + e));
    return {
      q: b,
      dq: [(c[0] - a[0]) / (2 * e), (c[1] - a[1]) / (2 * e)],
      ddq: [(c[0] - 2 * b[0] + a[0]) / (e * e), (c[1] - 2 * b[1] + a[1]) / (e * e)],
    };
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

  /* ---------- the integrator ----------
     S carries { q, v, simT }; the torque is held across the whole step, as a
     zero-order hold really does hold it. */

  function integrate(S, dt, held) {
    const deriv = (y) => {
      const m2 = tipMass(S.simT);
      const c = coriolis(y[1], y[2], y[3], m2);
      const a = solve2(inertia(y[1], m2), held[0] - c[0], held[1] - c[1]);
      return [y[2], y[3], a[0], a[1]];
    };
    let left = dt;
    while (left > 1e-12) {
      const step = Math.min(SUB, left);
      let y = [S.q[0], S.q[1], S.v[0], S.v[1]];
      const k1 = deriv(y);
      const k2 = deriv(y.map((c, i) => c + (step / 2) * k1[i]));
      const k3 = deriv(y.map((c, i) => c + (step / 2) * k2[i]));
      const k4 = deriv(y.map((c, i) => c + step * k3[i]));
      y = y.map((c, i) => c + (step / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      S.q = [y[0], y[1]];
      S.v = [y[2], y[3]];
      S.simT += step;
      left -= step;
    }
  }

  /* ---------- the arm, drawn wherever it is asked to sit ----------
     S carries { q, hist, simT }; hist rows begin [t, q1, q2, ...], which is
     all this needs from whatever else a controller is recording. */

  function drawArm(g, box, S) {
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
    const want = at(ref(S.simT));
    ctx.strokeStyle = g.ink(0.4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(want.x, want.y, 4.5, 0, 7);
    ctx.stroke();

    /* The path the tip has actually taken. The first lap is kept on the
       picture for the whole run rather than scrolling away, because the
       laden laps are only worth looking at beside it. */
    const hist = S.hist;
    const cut = hist.length > TRAIL ? hist[hist.length - TRAIL][0] : 0;
    const path = (from, to, stroke) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.8;
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
    path(Math.max(T_LOAD, cut), Infinity, SIM.hue.one);

    const j1 = at({ x: ARM.l1 * Math.cos(S.q[0]), y: ARM.l1 * Math.sin(S.q[0]) });
    const tip = at(fk(S.q));

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

    /* The two joints wear the colours their traces wear in the records
       below, so a curve in the panel and the pivot it belongs to can be
       matched without counting links. */
    const pin = Math.max(5, s * 0.036);
    ctx.strokeStyle = g.ink(1);
    ctx.lineWidth = 2;
    for (const [pt, fill] of [[{ x: bx, y: by }, SIM.hue.one], [j1, SIM.hue.two]]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pin, 0, 7);
      ctx.fill();
      ctx.stroke();
    }

    /* the load, when it is there: a mass at the tip, and said in words */
    if (loaded(S.simT)) {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 9, 0, 7); ctx.fill();
      g.cap(KG, tip.x + 13, tip.y + 4, 9, "left", 0.75);
    } else {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 4.6, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /* the three blocks every controller on this arm lays out the same way */
  function boxes(D) {
    return D.w >= 700
      ? { loop: { x: 0, y: 18, w: 780, h: 282 },
          left: { x: 0, y: 330, w: 379, h: 290 },
          right: { x: 401, y: 330, w: 379, h: 290 } }
      : { loop: { x: 0, y: 18, w: 380, h: 412 },
          left: { x: 0, y: 460, w: 380, h: 265 },
          right: { x: 0, y: 745, w: 380, h: 265 } };
  }

  return {
    ARM, PAYLOAD, T_LOAD, WINDOW, CIRCLE, REACH, TRAIL, KG,
    loaded, tipMass, ref, ik, fk, refJoints,
    inertia, coriolis, solve2, integrate, drawArm, boxes,
  };
})();
