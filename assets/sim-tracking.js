/* ===============================================================
   One arm, one circle, one payload, four ways of chasing it.

   The plant, the task and the twenty kilogrammes that land on it in
   two steps are in assets/sim-arm-plant.js. What is here is the
   controllers the tab switches between, sharing that plant, so they
   can be read straight against each other. PD and sliding mode share
   the clock as well; the two laws that estimate the arm rather than
   model it bring their own, for the reason given where the constants
   they share are.

   PD is deliberately plain: proportional and derivative on each
   joint, tracking the reference with no attempt to cancel any of the
   dynamics.

       tau[k] = Kp (q_r - q[k-m]) + Kd (q_r' - q'[k-m])

   Computed torque would cancel the coupling and the payload with it,
   which is the point of that method and the death of this picture.
   What it reports is what it is worth: how far the end effector is
   from the point it is chasing.

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

   Sampling is what they have in common and what none of them escapes.
   A hold cannot act between samples, so PD drifts further off the
   reference as the period grows, and sliding mode does not reach its
   surface but straddles it, in a band of about (1 + m)h eta -- the switching
   term drives s at plus or minus eta and cannot be turned round until
   the next sample, nor until the m samples of delay have passed. That
   width is what the two panels shade, and a loop that is really
   sliding measures it to within about half again.
   =============================================================== */

SIM.register((function () {
  const A = ARMPLANT;
  const { T_LOAD, WINDOW } = A;
  const H = SIM.hue;
  const JOINT = [
    { name: "SHOULDER", on: H.one, off: H.onePale, w: 2.1 },
    { name: "ELBOW", on: H.two, off: H.twoPale, w: 1.8 },
  ];
  const pd = (P) => P.law === "pd";
  const smc = (P) => P.law === "smc";
  const tdc = (P) => P.law === "tdc";
  const asmc = (P) => P.law === "asmc";
  /* which of the lab's laws the switch has selected */
  const sigvar = (P) => asmc(P) && P.algo === "sigvar";
  /* The two that estimate the arm instead of modelling it. Both hold an
     order of magnitude tighter than the laws that model it, which is what
     they share here: the planes they are drawn on. They do not share a
     clock's readings. All four run on the same ten milliseconds: the
     sampling period and the delay are the machine, not the design, and a
     comparison that lets one law pick a finer machine is not a comparison.
     What each law is free to choose is its own constants, and the lab's two
     were tuned again for this clock -- see the blocks below. */
  const tde = (P) => tdc(P) || asmc(P);
  /* only a switch implies a band for the hold to open */
  const hasBand = (P) => smc(P) || asmc(P);

  /* PROPOSED is the lab's own adaptive sliding mode, as published. The
     switching gain is replaced by a continuous function of the sliding
     variable, and everything the arm is doing is estimated from the last
     sample instead of from a model of it:

         sigma    = e' + l1 e
         k(sigma) = rho ln^2(1 + |sigma| / lambda)        the quasi-convex gain
         N^(t)    = q''(t-h) - Hbar^-1 tau(t-h)           the delay estimate
         tau      = Hbar ( q_r'' + l1 e' + l2 sigma
                           - N^ - alpha phi + k(sigma) sgn sigma )

     Electronics 13(19) 3940 introduced the gain; Sensors 25(14) 4252 carries
     the same law with the estimate, equations (5), (11), (12) and (18), and
     its Theorem 1 bounds the band the surface settles into at

         delta = lambda ( exp( sqrt(phibar / rho) ) - 1 ),

     phibar being the estimate's own error. Two things are left out. The
     RBFNN that paper puts in place of the fixed alpha needs trained weights,
     and a file of them has no place on a site with no build step.

     And the constants are not the paper's. The estimate is only as good as
     h is small -- N(t) is taken for N(t-h) -- and the paper's numbers are
     written for a millisecond clock, where they diverge outright on ten.
     The law is the paper's; these five are this arm's, searched on the
     figure's own run and then checked: the surface is gentler, the gain
     flatter, and less of the last estimate error is undone, which is what a
     ten-millisecond hold asks for. Within a fifth of each of them the loop
     still slides, and it holds the same half-millimetre whether the run is
     twenty seconds or a hundred. */
  const ASMC = {
    h: 0.010,                  /* s, the clock the whole tab runs on */
    l1: 3, l2: 20,             /* the surface, and the linear term on it */
    rho: 35, lam: 0.04,        /* the gain */
    alpha: 0.03,               /* how much of the last estimate error is undone */
    hbar: [1.4, 0.56],         /* kg m^2, the diagonal standing in for M(q) */
  };

  /* The diagonal TDC stands M(q) up with, before its H slider. It is the
     plain nominal rather than either published law's tuned Hbar: the slider
     is the reader's design variable and has to start from something that is
     not a consequence of tuning someone else's law. */
  const TDC_HBAR = [1.0, 0.4];

  /* The other law the switch offers, from the lab's other 2024 paper. Its
     sliding variable is scaled up rather than shaped:

         s     = Lam (e' + Ke e),  Lam > I                        eq (7)
         tau   = -Hb Phi^ + Hb(q_r'' + (Lam - I)e'' + Lam Ke e'
                 + Ks s) + Hb k(s) sgn(s)                    eq (8), (9)
         k_i   = h_i                       if ||s||_inf >= eps
               = alpha (|s_i|/eps)^8       otherwise               eq (12)
         h_i'  = gam |s_i|                 if ||s||_inf >= eps
               = -del k_i |s_i| / (eps h)  otherwise               eq (13)

     Scaling the variable by Lam is the point: the error dynamics come out
     with Lam^-1 on the estimate error instead of the error itself, so the
     same estimate buys a tighter loop. The gain is a rate while the loop is
     outside eps and a steep function of |s| inside it, which is where the
     chattering would otherwise be.

     These numbers are this arm's rather than the paper's, for the same
     reason as the block above: the paper's are written for a millisecond
     clock and diverge on ten. What they were searched against is worth
     stating, because it is easy to search against the wrong thing.

     Theorem 1 holds once the loop is inside eps, and eps bounds the law's
     own s, the one that carries the Lam -- so the band is read at that
     scale, see sVar. A candidate had to keep every second of the run inside
     eps except the ones it is entitled to: the reaching phase, and the
     second a step of the load lands in. Coming back inside is the claim;
     never leaving is not. And it had to leave the adaptive gain flat rather
     than climbing over a run five times the figure's, which is what
     separates a loop that slides from one that has not diverged yet.

     These hold from an unloaded arm to twenty-five kilogrammes, in one step
     or in four, returning inside eps after the reaching phase and the
     load-step transients described above. About a third of them will not
     take a fifth either way, though, where the smooth-gain law next door
     shrugs at that: on a coarse hold this law wants its constants found
     rather than chosen. */
  const SIGVAR = {
    ke: 2.8, ks: 34.3,         /* the surface, and the linear term on it */
    lam: 5.1,                  /* Lam > 1, the scaling that buys Lam^-1 */
    alpha: 5, gam: 6,          /* the cap inside eps, and the rate outside */
    del: 0.3, eps: 0.08,       /* the decay inside eps, and the band itself */
    pow: 8,                    /* the paper's exponent */
    hbar: [0.27, 0.11],
  };

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
  /* Theorem 1's bound, evaluated at the estimate error the run has actually
     shown. Nothing has been measured for the first half second, so it opens
     at a floor rather than at zero and tightens onto the real number. */
  const theoremBand = () =>
    ASMC.lam * (Math.exp(Math.sqrt(Math.max(phiMax, 0.05) / ASMC.rho)) - 1);

  const quasiBand = (P) =>
    (sigvar(P) ? SIGVAR.eps : asmc(P) ? theoremBand()
      : (lag(P) + 1) * clock(P) * P.eta);
  const bandName = (P) =>
    (sigvar(P) ? "ε" : asmc(P) ? "δ" : P.m ? "(1+m)hη" : "hη");

  /* The surface slope, the clock and the delay each law actually runs on:
     PROPOSED carries its own, the other two read the sliders. */
  const slope = (P) => (tdc(P) ? P.l1 : sigvar(P) ? SIGVAR.ke
    : asmc(P) ? ASMC.l1 : P.lam);
  /* The variable the law actually drives. The sliding-variable law scales its
     own by Lam -- s = Lam(e' + Ke e) -- and eps bounds that scaled one, so
     the strip, the readout and the verdict have to be scaled the same way or
     they are reading eps against a tenth of what it bounds. The phase plane
     is drawn in e' rather than in s, so there the band goes the other way. */
  const sScale = (P) => (sigvar(P) ? SIGVAR.lam : 1);
  const sVar = (P, e, de) => sScale(P) * (de + slope(P) * e);
  const clock = (P) => (asmc(P) ? ASMC.h : P.h);
  const lag = (P) => (asmc(P) ? 0 : P.m);

  const S = { q: [0, 0], v: [0, 0], simT: 0, hist: [] };
  let held, queue, nextT, marks, diverged;
  /* what the delay estimate needs carried across a sample, and what the
     adaptive gain came out at, for the panel to print */
  let vPrev = [0, 0], nhatPrev = [0, 0], phiMax = 0, gainNow = [0, 0];
  let hRate = [0, 0];          /* h_{i,t}, which only the sliding-variable law keeps */

  /* the planes are grown to fit the run; sliding mode holds an order of
     magnitude tighter than PD, so it starts an order of magnitude smaller.
     Torque runs the other way round: switching asks for the inertia times
     the switching gain, which is tens of newton metres, where PD asks for
     its gain times an error of a hundredth of a radian. */
  let eTop = 0.04, dTop = 0.4, sTop = 0.1, tauTop = 2;
  const tauStep = (P) => (pd(P) ? 1 : 10);

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
    } else if (smc(P)) {
      const want = [0, 0];
      for (let i = 0; i < 2; i++) {
        const s = (r.dq[i] - S.v[i]) + P.lam * (r.q[i] - S.q[i]);
        want[i] = P.eta * Math.sign(s);
      }
      const [a, b, , d] = A.inertia(S.q[1], A.ARM.m2);
      tau[0] = a * want[0] + b * want[1];
      tau[1] = b * want[0] + d * want[1];
    } else {
      /* The two laws that estimate rather than model. `held` is still the
         torque the arm was given over the interval that just ended, and S.v
         has moved across it, so the acceleration and the estimate are both
         read off the arm -- neither of these is told the payload landed. */
      const h = clock(P);
      /* TDC's gain matrix is a slider over its own nominal; each published
         law keeps its own, tuned with the rest of its constants. */
      const hb = tdc(P) ? TDC_HBAR.map((v) => v * P.hs)
        : sigvar(P) ? SIGVAR.hbar : ASMC.hbar;
      /* the sliding-variable law switches on the whole vector, not per joint */
      const sAll = sigvar(P) ? [0, 1].map((i) => SIGVAR.lam *
        ((r.dq[i] - S.v[i]) + SIGVAR.ke * (r.q[i] - S.q[i]))) : null;
      const outside = sAll
        ? Math.max(Math.abs(sAll[0]), Math.abs(sAll[1])) >= SIGVAR.eps : false;
      for (let i = 0; i < 2; i++) {
        const ddq = (S.v[i] - vPrev[i]) / h;
        const nhat = ddq - held[i] / hb[i];              /* eq (5) */
        const phi = nhat - nhatPrev[i];                  /* eq (11), one back */
        const e = r.q[i] - S.q[i], de = r.dq[i] - S.v[i];
        if (tdc(P)) {
          /* eq (6): the estimate carries the whole of the arm, and what is
             left is a second-order error with poles at -l1 and -l2. There is
             no switch, so nothing absorbs what the estimate gets wrong. */
          tau[i] = hb[i] * (r.ddq[i] + (P.l1 + P.l2) * de
                            + P.l1 * P.l2 * e - nhat);
          gainNow[i] = 0;
        } else if (sigvar(P)) {
          const s = sAll[i];
          const dde = r.ddq[i] - ddq;             /* the same measurement again */
          /* eq (12) and (13): a rate outside the band, a steep function of
             |s| inside it, and the cap alpha at its edge */
          const k = outside ? hRate[i]
            : SIGVAR.alpha * Math.pow(Math.abs(s) / SIGVAR.eps, SIGVAR.pow);
          hRate[i] = Math.max(0, hRate[i] + h * (outside
            ? SIGVAR.gam * Math.abs(s)
            : -SIGVAR.del * k * Math.abs(s) / (SIGVAR.eps * h)));
          tau[i] = hb[i] * (r.ddq[i] + (SIGVAR.lam - 1) * dde
                            + SIGVAR.lam * SIGVAR.ke * de + SIGVAR.ks * s
                            - nhat + k * Math.sign(s));   /* eq (8), (9) */
          gainNow[i] = k;
        } else {
          const s = de + ASMC.l1 * e;
          /* eq (18): continuous, class K-infinity, and quadratic in |s| near
             the surface -- which is what leaves the torque smooth where a
             switch would be chattering */
          const k = ASMC.rho * Math.pow(Math.log1p(Math.abs(s) / ASMC.lam), 2);
          tau[i] = ASMC.hbar[i] * (r.ddq[i] + ASMC.l1 * de + ASMC.l2 * s
                                   - nhat - ASMC.alpha * phi
                                   + k * Math.sign(s));  /* eq (12) */
          gainNow[i] = k;
        }
        nhatPrev[i] = nhat;
        /* what the estimate is getting wrong: TDC's own limit, and what the
           bound beside the proposed law is read at */
        if (S.simT > 0.5 && Math.abs(phi) > phiMax) phiMax = Math.abs(phi);
      }
      vPrev = [S.v[0], S.v[1]];
    }
    for (let i = 0; i < 2; i++) {
      queue[i].push(tau[i]);
      const k = queue[i].length - 1 - lag(P);
      held[i] = k >= 0 ? queue[i][k] : 0;
      if (queue[i].length > 64) queue[i].shift();
    }
  }

  /* A loop holding ten microns reads as 0.0 mm at one place, which looks
     like nothing rather than like an answer, so the places follow the size. */
  const fmtMm = (mm) => mm.toFixed(mm < 0.02 ? 3 : mm < 0.2 ? 2 : 1) + " mm";

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
    g.cap(A.loaded(S.simT) ? "ARM  " + A.kgLabel(S.simT) : "ARM", px0 + pw / 2, py0 - 9);
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

    /* The controller, as the PD block next door does it: the gains as they
       stand and nothing else. The law is named on the tab and on the cap;
       what belongs in the box is the numbers the reader can move. */
    /* A constant is printed to three figures rather than to a fixed number
       of places. The published laws' constants are measured numbers now --
       Lam is 9.78, not 10 -- and a box that rounds them to the value the
       loop does not run at is telling the reader something untrue. */
    const cst = (v) => String(Number(v.toPrecision(3)));
    const rows = tdc(P)
      ? [["ℓ₁", P.l1.toFixed(0)], ["ℓ₂", P.l2.toFixed(0)],
         ["H", "×" + P.hs.toFixed(2)]]
      : sigvar(P)
        ? [["Λ", cst(SIGVAR.lam)], ["ε", cst(SIGVAR.eps)],
           ["Ke", cst(SIGVAR.ke)], ["Ks", cst(SIGVAR.ks)],
           ["k", Math.max(gainNow[0], gainNow[1]).toFixed(3)]]
      : asmc(P)
        ? [["ρ", cst(ASMC.rho)], ["λ", cst(ASMC.lam)],
           ["ℓ₁", cst(ASMC.l1)], ["ℓ₂", cst(ASMC.l2)],
           ["k", Math.max(gainNow[0], gainNow[1]).toFixed(3)]]
        : [["λ", P.lam.toFixed(0)], ["η", P.eta.toFixed(0)]];
    const smY = y + h * 0.42;
    const smH = Math.min(h * (0.17 + 0.045 * rows.length), h * 0.36, 116);
    g.arrow(colMid, jy + jr + 2, colMid, smY - 2);
    g.signal("e", colMid + 9, jy + jr + 2, smY - 2);
    g.roundBox(colX, smY, colW, smH);
    g.cap(asmc(P) ? "ASMC" : tdc(P) ? "TDC" : "SMC", colX, smY - 9, 10, "left");
    rows.forEach(([sym, val], i) => {
      const yy = smY + (smH * (i + 1)) / (rows.length + 1) + 4;
      g.maths(sym, colX + colW * 0.42, yy, 14, "right");
      g.words(val, colX + colW * 0.80, yy, 12, "right");
    });

    const px0 = x + w * 0.40, pw = w * 0.585;
    const py0 = y + h * 0.03, ph = h * 0.94;
    g.roundBox(px0, py0, pw, ph, 5);
    g.cap(A.loaded(S.simT) ? "ARM  " + A.kgLabel(S.simT) : "ARM", px0 + pw / 2, py0 - 9);
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
    g.labelled("m", "", lag(P) === 0 ? " = 0"
      : " = " + lag(P) + " · " + Math.round(lag(P) * clock(P) * 1000) + " ms",
      delX + halfW / 2, rowY + rowH * 0.85);

    g.arrow(delX - 2, rowY + rowH * 0.5, samX + halfW + 2, rowY + rowH * 0.5);
    g.roundBox(samX, rowY, halfW, rowH);
    g.words("Sample", samX + halfW / 2, rowY + rowH * 0.42, 13);
    g.labelled("h", "", " = " + Math.round(clock(P) * 1000) + " ms",
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
      { label: "BEFORE THE LOAD", stroke: JOINT[0].off, width: 2.1 },
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
      /* The two halves meet at the payload and neither is trimmed. A trail
         window belongs to the tip path on the arm, where the pen keeps
         moving off down the page; here the curve retraces nearly the same
         small loop every lap, so dropping its oldest samples only punched a
         hole between the pale half and the recent end of the solid one. */
      path(0, T_LOAD, j.off);
      path(T_LOAD, Infinity, j.on);
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
  /* ---------- the record: two strips over one clock ----------
     The variable the law is written in goes above and the torque it asked
     for goes below, sharing the seconds axis. Reading down a column is the
     point: the input that was held and what the arm did about it are the
     same instant, and under sliding mode the second strip is what the
     first one costs. */
  function strips(p) {
    const x0 = p.x + 48, x1 = p.x + p.w - 14;
    const top = p.y + 52, bot = p.y + p.h - 42;
    const GAP = 18, h = (bot - top - GAP) / 2;
    const band = (a, b) => {
      const mid = (a + b) / 2, half = (b - a) / 2;
      return { top: a, bot: b, mid, at: (v, span) => mid - (v / span) * half };
    };
    return {
      x0, x1, top, bot,
      px: (t) => x0 + (t / WINDOW) * (x1 - x0),
      upper: band(top, top + h),
      lower: band(bot - h, bot),
    };
  }

  /* one strip's furniture: the zero it swings about, the extremes of its
     scale, and the name of what is plotted, short enough to stand on its
     side in half a panel */
  function stripFrame(g, p, s, band, span, name) {
    const { ctx } = g;
    ctx.strokeStyle = g.ink(0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x0, band.mid); ctx.lineTo(s.x1, band.mid);
    ctx.stroke();
    const fmt = span >= 10 ? span.toFixed(0) : span >= 1 ? span.toFixed(1)
      : span.toFixed(2);
    g.cap("+" + fmt, s.x0 - 6, band.top + 3, 9, "right", 0.45);
    g.cap("0", s.x0 - 6, band.mid + 3, 9, "right", 0.45);
    g.cap("-" + fmt, s.x0 - 6, band.bot + 3, 9, "right", 0.45);
    g.vcap(name, p.x + 15, band.mid, 9, 0.5);
  }

  /* the torque the hold is presenting to the arm, drawn as it was held:
     the record is taken every frame, so wherever a step is wide enough to
     see, the trace is the staircase */
  function drawTorque(g, p, s, band) {
    const { ctx } = g;
    stripFrame(g, p, s, band, tauTop, "τ  (N·M)");
    JOINT.forEach((j, i) => {
      ctx.strokeStyle = j.on;
      ctx.lineWidth = j.w;
      ctx.beginPath();
      let started = false;
      for (const row of S.hist) {
        const X = s.px(row[0]), Y = band.at(row[8 + i], tauTop);
        started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
      }
      ctx.stroke();
    });
  }

  function drawErrors(g, p, s, band) {
    const { ctx } = g;
    stripFrame(g, p, s, band, eTop, "e  (RAD)");

    JOINT.forEach((j, i) => {
      /* what happened between the samples, which the loop never saw */
      ctx.strokeStyle = g.ink(0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const row of S.hist) {
        const X = s.px(row[0]), Y = band.at(row[4 + i], eTop);
        started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
      }
      ctx.stroke();

      /* and the held staircase it acted on */
      ctx.strokeStyle = j.on;
      ctx.lineWidth = j.w;
      ctx.beginPath();
      for (let k = 0; k < marks.length; k++) {
        const X = s.px(marks[k][0]), Y = band.at(marks[k][1 + i], eTop);
        const Xn = k + 1 < marks.length ? s.px(marks[k + 1][0])
          : s.px(Math.min(S.simT, WINDOW));
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
      { label: "BEFORE THE LOAD", stroke: JOINT[0].off, width: 2.1 },
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
      ctx.moveTo(X(-eTop), Y(slope(P) * eTop + off));
      ctx.lineTo(X(eTop), Y(-slope(P) * eTop + off));
      ctx.strokeStyle = style;
      ctx.stroke();
    };
    const reach = hasBand(P) ? quasiBand(P) / sScale(P) : 0;
    if (reach) {
    ctx.fillStyle = "rgba(234,88,12,0.09)";
    ctx.beginPath();
    ctx.moveTo(X(-eTop), Y(slope(P) * eTop + reach));
    ctx.lineTo(X(eTop), Y(-slope(P) * eTop + reach));
    ctx.lineTo(X(eTop), Y(-slope(P) * eTop - reach));
    ctx.lineTo(X(-eTop), Y(slope(P) * eTop - reach));
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    band(reach, "rgba(234,88,12,0.6)");
    band(-reach, "rgba(234,88,12,0.6)");
    }
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
      /* The two halves meet at the payload and neither is trimmed. A trail
         window belongs to the tip path on the arm, where the pen keeps
         moving off down the page; here the curve retraces nearly the same
         small loop every lap, so dropping its oldest samples only punched a
         hole between the pale half and the recent end of the solid one. */
      path(0, T_LOAD, j.off);
      path(T_LOAD, Infinity, j.on);
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
  function drawSliding(g, P, p, s, band) {
    const { ctx } = g;

    /* the sampling band, the width the hold implies. A law with no switch
       has no such width, and draws no band. */
    if (hasBand(P)) {
      const reach = quasiBand(P);
      const lo = Math.max(band.top, band.at(reach, sTop));
      const hi = Math.min(band.bot, band.at(-reach, sTop));
      ctx.fillStyle = "rgba(234,88,12,0.09)";
      ctx.fillRect(s.x0, lo, s.x1 - s.x0, hi - lo);
      ctx.strokeStyle = "rgba(234,88,12,0.7)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      for (const yy of [lo, hi]) {
        ctx.beginPath(); ctx.moveTo(s.x0, yy); ctx.lineTo(s.x1, yy); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    stripFrame(g, p, s, band, sTop, "s  (RAD/S)");

    JOINT.forEach((j, i) => {
      ctx.strokeStyle = j.on;
      ctx.lineWidth = j.w;
      ctx.beginPath();
      let started = false;
      for (const row of S.hist) {
        const a = s.px(row[0]), b = band.at(sVar(P, row[4 + i], row[6 + i]), sTop);
        started ? ctx.lineTo(a, b) : (ctx.moveTo(a, b), (started = true));
      }
      ctx.stroke();
    });
  }

  /* both strips, their shared clock, and the key that serves the pair */
  function drawRecord(g, P, p) {
    const s = strips(p);
    g.keyRow([
      { label: JOINT[0].name, stroke: JOINT[0].on, width: 2.1 },
      { label: JOINT[1].name, stroke: JOINT[1].on, width: 1.8 },
      pd(P)
        ? { label: "BETWEEN SAMPLES", stroke: g.ink(0.3), width: 1 }
        : hasBand(P)
          ? { label: "BAND  ±" + bandName(P), stroke: "rgba(234,88,12,0.7)",
              width: 1.4, dash: [4, 3] }
          : null,
    ].filter(Boolean), p.x + 12, p.y + 34);

    /* one axis and one marker down both strips, so a column is one instant */
    g.seconds(p, s.px, s.top, s.bot, WINDOW, 5);
    g.cap("TIME  (S)", (s.x0 + s.x1) / 2, p.y + p.h - 11, 9, "center", 0.5);
    /* one marker per step of the load, each named for what it added */
    for (const l of A.LOAD) {
      if (S.simT >= l.t) g.event(s.px(l.t), s.top, s.bot, "+" + l.kg + " KG");
    }

    if (pd(P)) drawErrors(g, p, s, s.upper);
    else drawSliding(g, P, p, s, s.upper);
    drawTorque(g, p, s, s.lower);
  }

  /* ---------- the module ---------- */

  return {
    id: "track",
    canvasLabel: "A two-link arm tracing a circle with a payload added " +
      "partway, under sampled PD, sampled sliding mode or the lab's " +
      "proposed adaptive sliding mode control, " +
      "with the joint errors, the record of them and of the torque over " +
      "time, and the distance from the end effector to the point it is " +
      "tracking",

    /* each law has its own note and footnote in data/site.js, and the two
       published ones are keyed by which paper is on the figure */
    words: (P) => (asmc(P) ? "asmc-" + P.algo : P.law),

    controls: [
      { id: "law", label: "Control law",
        value: "pd", cols: 4,
        choices: [{ value: "pd", label: "PD" },
                  { value: "smc", label: "SMC" },
                  { value: "tdc", label: "TDC" },
                  { value: "asmc", label: "Ours" }] },
      /* Which of the lab's own laws is on the figure. One of them is
         implemented here; the others are named and switched off, so the
         switch shows the set rather than a single button. */
      { id: "algo", label: "Algorithm",
        value: "quasi", cols: 2,
        hide: (P) => !asmc(P),
        /* Each named for the part of the loop its paper replaced, so the
           switch reads without the papers beside it. */
        choices: [{ value: "quasi", label: "Smooth gain" },
                  { value: "sigvar", label: "Novel SV" },
                  { value: "tde", label: "Neural estimate", off: true },
                  { value: "force", label: "Force tracking", off: true }] },
      { id: "kp", label: "Proportional gain <i>K</i><sub>p</sub>",
        min: 10, max: 200, step: 5, value: 70, show: (v) => v.toFixed(1),
        hide: (P) => !pd(P) },
      { id: "kd", label: "Derivative gain <i>K</i><sub>d</sub>",
        min: 2, max: 20, step: 0.5, value: 8, show: (v) => v.toFixed(1),
        hide: (P) => !pd(P) },
      { id: "lam", label: "Surface slope <i>λ</i>",
        min: 2, max: 40, step: 1, value: 10, show: (v) => v + " 1/s",
        hide: (P) => !smc(P) },
      { id: "eta", label: "Switching gain <i>η</i>",
        min: 2, max: 60, step: 2, value: 20, show: (v) => v + " rad/s²",
        hide: (P) => !smc(P) },
      /* TDC is the classical law, so its design is the reader's to move. */
      /* (its nominal gain matrix is TDC_HBAR, up by the H slider) */
      { id: "l1", label: "Error pole <i>ℓ</i><sub>1</sub>",
        min: 5, max: 60, step: 1, value: 30, show: (v) => v + " 1/s",
        hide: (P) => !tdc(P) },
      /* The slow pole starts slow. Twenty kilogrammes of unmodelled mass
         goes into the estimate, and the harder this pole is asked to pull
         the residual in, the more of that estimate error it amplifies: at
         the 5 1/s it used to start on, no setting of H tracks this load. */
      { id: "l2", label: "Error pole <i>ℓ</i><sub>2</sub>",
        min: 1, max: 20, step: 1, value: 2, show: (v) => v + " 1/s",
        hide: (P) => !tdc(P) },
      /* A quarter again on the nominal H-bar, because the estimate does
         not hold twenty kilogrammes at x1.00: wind it back down and the
         loop drifts off the circle, which is the reader's to find. With
         the slow pole where it now starts this tracks from about x0.90 to
         x1.55 and diverges above that, so the start sits inside the window
         rather than on its edge. A change of payload wants the window
         measured again, not this number nudged. */
      { id: "hs", label: "Gain matrix <i>H</i>",
        min: 0.1, max: 2, step: 0.05, value: 1.25,
        show: (v) => "×" + v.toFixed(2),
        hide: (P) => !tdc(P) },
      /* The clock and the delay are not a design: they are the machine the
         design has to live on, and all four laws live on the same one. The
         three classical laws read these two sliders. The lab's own laws are
         tuned for the clock they were given rather than tracking it, so on
         those tabs the sliders stay on screen, parked at that clock and
         locked -- the reader can see what every law is answering for
         instead of having to take it on trust. */
      { id: "h", label: "Sampling period <i>h</i>",
        min: 1, max: 100, step: 1, value: 10,
        read: (v) => v / 1000, show: (v) => Math.round(v * 1000) + " ms",
        applies: (P) => !asmc(P), lock: () => Math.round(ASMC.h * 1000) },
      { id: "m", label: "Feedback delay <i>m</i>",
        min: 0, max: 3, step: 1, value: 0,
        show: (v, P) => (v === 0 ? "0"
          : v + (v > 1 ? " samples" : " sample") + "  ·  " +
            Math.round(v * P.h * 1000) + " ms"),
        applies: (P) => !asmc(P), lock: () => 0 },
    ],

    readouts: [
      { id: "main", label: (P) => (hasBand(P) ? "Sliding band"
        : "End-effector error") },
      /* named for the thing it measures: the tip, not the joints. TDC has
         no second number to report -- the tracking error is the whole of
         it -- so the row goes rather than printing it twice. */
      { id: "err", label: "End-effector error", hide: (P) => !hasBand(P) },
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
      vPrev = [S.v[0], S.v[1]];
      nhatPrev = [0, 0];
      phiMax = 0;
      gainNow = [0, 0];
      hRate = [0, 0];
      /* the proposed law holds an order of magnitude tighter again than
         sliding mode, so its planes start an order of magnitude smaller */
      eTop = pd(P) ? 0.04 : tde(P) ? 0.002 : 0.01;
      dTop = pd(P) ? 0.4 : tde(P) ? 0.02 : 0.1;
      sTop = tde(P) ? 0.01 : 0.1;
      tauTop = pd(P) ? 2 : 20;
    },

    done: () => diverged || S.simT >= WINDOW,

    advance(P, dt) {
      let left = dt;
      let guard = 0;
      while (left > 1e-9 && guard++ < 400) {
        if (S.simT >= nextT - 1e-12) {
          sample(P);
          nextT = S.simT + clock(P);
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
      /* the torque as held, not as computed: it is what the arm was given */
      S.hist.push([S.simT, S.q[0], S.q[1], err, e[0], e[1], de[0], de[1],
                   held[0], held[1]]);
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
          const s = sVar(P, e[i], de[i]);
          if (Math.abs(s) > sTop) sTop = Math.ceil(Math.abs(s) / 0.05) * 0.05;
        }
      }
      if (hasBand(P)) {
        /* room for the band the hold implies, so it is on the picture even
           when the run is holding well inside it -- in s for the strip, and
           in e' for the plane, which are a factor of Lam apart */
        const inS = quasiBand(P) * 1.8, inD = inS / sScale(P);
        if (inD > dTop) dTop = Math.ceil(inD / 0.05) * 0.05;
        if (inS > sTop) sTop = Math.ceil(inS / 0.05) * 0.05;
      }
      const step = tauStep(P);
      for (let i = 0; i < 2; i++) {
        const tq = Math.abs(held[i]);
        if (tq > tauTop) tauTop = Math.ceil(tq / step) * step;
      }

      const wild = !Number.isFinite(err) || err > 3
        || S.v.some((s) => Math.abs(s) > 120);
      if (wild) diverged = true;
    },

    live(P) {
      /* The error the tip is holding, over the last second of the record:
         the distance from the end effector to the point the reference is
         asking for, root-mean-squared. The joints have their own errors and
         their own two panels; this is the one the task is judged on. */
      let sum = 0, n = 0;
      for (let i = S.hist.length - 1; i >= 0 && S.hist[i][0] > S.simT - 1; i--) {
        sum += S.hist[i][3] * S.hist[i][3];
        n++;
      }
      const err = diverged ? "lost"
        : n ? fmtMm(Math.sqrt(sum / n) * 1000) : "—";

      if (!hasBand(P)) {
        /* Neither PD nor TDC drives a surface, so neither has a band and
           neither has a second number: what they are worth is how far the
           tip is from the point it is chasing, measured the same way for
           every law on this tab.

           And it is what the verdict is read from. A detuned loop does not
           always blow up -- a coarse clock, a sample of delay, a gain too
           low for the payload -- and can circle hundreds of millimetres off
           the reference with every state finite. So "stable" is not the
           question, and a criterion that answers it reads 0.998 either way.
           Tracking is the question. The mark is a tenth of the circle being
           traced, about thirty-five millimetres: plain PD carrying twenty
           kilogrammes gets inside that with its gains wound right up and
           not before, and a TDC is inside it or a hundred millimetres
           outside depending on whether its poles and its gain matrix suit
           the load it is holding. */
        const off = n ? Math.sqrt(sum / n) > 0.1 * A.CIRCLE.r : false;
        return {
          readouts: { main: err, err: "" },
          verdict: {
            text: diverged ? "Lost" : off ? "Off track" : "Tracking",
            bad: diverged || off,
          },
        };
      }

      /* Sliding mode's band is the worst of the whole run once the reaching
         phase is over, not the worst of the last second: (1+m)h eta is what
         a hold does at every sample, so it has to hold at every sample, and
         the arm is at its lightest before the payload lands -- a light arm
         is the hard case for a gain written as an acceleration, and reading
         only the calm end would report sliding for a run that spent its
         first five seconds well off the surface.

         The lab's two are read over the last second instead, because what
         their bounds claim is where the loop settles. A step of the load
         puts the loop outside the band by design -- that is what the
         adaptation is for -- and it is coming back inside that the theorem
         is about, not never having left. */
      const from = asmc(P) ? S.simT - 1 : 0.5;
      let band = 0;
      for (const row of S.hist) {
        if (row[0] <= from) continue;
        for (let j = 0; j < 2; j++) {
          const s = Math.abs(sVar(P, row[4 + j], row[6 + j]));
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
      /* Sliding mode is judged against a width to expect, so it is allowed
         half again of it. The proposed law is judged against Theorem 1's
         bound, which is a bound: past it the claim has failed. */
      const bad = diverged || band > (asmc(P) ? 1 : 1.5) * bound;
      return {
        readouts: {
          main: diverged ? "lost"
            : band ? band.toFixed(asmc(P) ? 4 : 3) + " rad/s" : "—",
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
        g.panel(b.right, "JOINT ERROR AND TORQUE", () => drawRecord(g, P, b.right));
      } else {
        /* TDC drives the error to zero rather than onto a surface, so the
           same two panels carry it under their own names. */
        drawLoopSMC(g, P, b.loop);
        g.panel(b.left, tdc(P) ? "ERROR PLANE" : "ERROR PLANE AND SLIDING SURFACE",
                () => drawSurface(g, P, b.left));
        g.panel(b.right, tdc(P) ? "ERROR VARIABLE AND TORQUE"
                : "SLIDING VARIABLE AND TORQUE",
                () => drawRecord(g, P, b.right));
      }
    },
  };
})());
