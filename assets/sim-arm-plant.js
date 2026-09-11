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
   of the arm. The load arrives in two steps -- fifteen kilogrammes at
   five seconds, one full lap in, and five more at eight -- and nothing
   about any controller changes at either. Twenty rather than six or
   ten: six the laws that estimate the arm rather than model it shrug
   off without moving, so it separated nothing; ten they still carry at
   the gain they were written with; twenty the classical estimate holds
   only once its gain matrix is raised and its slow error pole is
   slowed further -- which is where those two sliders now start -- and
   the proposed law holds without being told anything. Two steps rather
   than one because the second lands on a loop that has already settled
   around the first, which is the question a single step never asks.

   Twenty is also the ceiling. At twenty-five plain PD is outside the
   mark at every gain it has, and sampled sliding mode leaves its
   surface at the switching gain it starts on; past thirty-five the
   smooth-gain law itself comes apart. A load that breaks three of the
   four laws compares nothing, so this is as heavy as the figure goes.
   =============================================================== */

const ARMPLANT = (function () {
  /* point masses at the end of each link: the smallest model that still
     has a varying inertia and real Coriolis terms */
  const ARM = { m1: 1, m2: 0.7, l1: 1, l2: 0.85 };
  /* The load arrives in two steps: fifteen kilogrammes one lap in and
     five more three seconds later. One step asks a law what it does about
     a load; the second asks it of a loop that has already settled around
     the first, and that is the harder question. */
  const LOAD = [{ t: 5, kg: 15 }, { t: 8, kg: 5 }];
  const PAYLOAD = LOAD.reduce((kg, l) => kg + l.kg, 0);   /* kg, both steps */
  /* where the trail changes colour: the first step, or never if the list is
     emptied to run the arm unloaded */
  const T_LOAD = LOAD.length ? LOAD[0].t : Infinity;
  const WINDOW = 20;            /* s, four laps */
  const CIRCLE = { x: 0.9, y: -0.4, r: 0.35, T: 5, phase: Math.PI };
  const KG = "+" + PAYLOAD + " KG";          /* the whole of it, for a legend */

  /* the arm's reach over the whole task, padded for the pedestal and the
     payload marker, so the drawing never has to rescale mid-run */
  const REACH = { x0: -0.30, x1: 1.40, y0: -1.15, y1: 0.18 };
  const TRAIL = 620;            /* how much of the tip path is drawn */
  const SUB = 1 / 600;          /* integration step, well under any h */

  const carried = (t) => LOAD.reduce((kg, l) => kg + (t >= l.t ? l.kg : 0), 0);
  const loaded = (t) => carried(t) > 0;
  const tipMass = (t) => ARM.m2 + carried(t);
  /* what is on the arm at this instant, not what will be */
  const kgLabel = (t) => "+" + carried(t) + " KG";

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

    /* the load, when it is there: a mass at the tip, and said in words.
       The dot carries the second step as area, so the figure shows it
       arriving and not only the caption. */
    if (loaded(S.simT)) {
      ctx.fillStyle = "#0a0a0a";
      const r = 9 * Math.sqrt(carried(S.simT) / PAYLOAD);
      ctx.beginPath(); ctx.arc(tip.x, tip.y, r, 0, 7); ctx.fill();
      g.cap(kgLabel(S.simT), tip.x + r + 4, tip.y + 4, 9, "left", 0.75);
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
    ARM, PAYLOAD, LOAD, T_LOAD, WINDOW, CIRCLE, REACH, TRAIL, KG,
    loaded, carried, kgLabel, tipMass, ref, ik, fk, refJoints,
    inertia, coriolis, solve2, integrate, drawArm, boxes,
  };
})();
