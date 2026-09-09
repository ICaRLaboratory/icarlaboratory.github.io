/* ===============================================================
   The same arm, driven onto a surface instead of towards a point.

   The plant, the circle and the six kilogrammes are the ones in
   assets/sim-arm-plant.js -- the same ones the sampled PD tab is
   given -- so the two tabs can be read against each other directly.

   Each joint gets a sliding variable built from its own tracking
   error,

       s = e' + lambda e,     e = q_r - q

   and the control drives s to zero rather than driving e to zero.
   That is the whole idea: s = 0 is a first-order equation in e whose
   solution decays at lambda whatever the arm weighs, so if the
   controller can hold the state on that surface, the payload stops
   mattering. Holding it takes a term that fights back at full
   strength for any departure at all,

       tau[k] = eta sat( s[k] / Phi ),   held until k+1

   with no model of the arm in it anywhere. Phi is the boundary layer:
   inside it the law is continuous, with an effective gain of
   eta/Phi, and outside it the control is hard over one way or the
   other.

   What sampling does to that is the point of the tab. A hold cannot
   switch between samples, so once the state crosses the surface the
   control stays wrong for the rest of the period and s overshoots by
   something like h eta / M before it can be turned around. The
   surface is therefore not reached but straddled, in a band that
   grows with the period -- a quasi-sliding mode. Slow the clock and
   the band opens until the sign flips every sample and the torque is
   chattering between its limits; widen Phi and the chattering
   smooths out into plain PD with gains eta/Phi and lambda eta/Phi,
   and the robustness goes with it. The readout is that band, against
   the layer it is supposed to fit inside.
   =============================================================== */

SIM.register((function () {
  const A = ARMPLANT;
  const { T_LOAD, WINDOW, KG } = A;

  const S = { q: [0, 0], v: [0, 0], simT: 0, hist: [] };
  let held, queue, nextT, diverged;

  const sat = (u) => (u > 1 ? 1 : u < -1 ? -1 : u);

  /* The switching gain is an acceleration, not a torque, and it is turned
     into one through the arm's nominal inertia -- the arm as the controller
     believes it to be, which is the unladen one:

         tau = M_nominal(q) . eta sat(s / Phi)

     A single torque gain cannot serve both joints here: the elbow carries
     about a tenth of the shoulder's inertia, so a torque that barely moves
     one throws the other clean off the surface every sample. Written as an
     acceleration the same number means the same thing at both, and the
     quasi-sliding band is h eta whatever the arm is holding. Nothing about
     the payload is in M_nominal; that is the disturbance the surface is
     supposed to absorb, and it is not told about it. */
  function sample(P) {
    const r = A.refJoints(S.simT);
    const now = [0, 0], want = [0, 0];
    for (let i = 0; i < 2; i++) {
      const e = r.q[i] - S.q[i];
      const de = r.dq[i] - S.v[i];
      now[i] = de + P.lam * e;
      want[i] = P.eta * sat(now[i] / P.phi);
    }
    const [a, b, , d] = A.inertia(S.q[1], A.ARM.m2);
    const tau = [a * want[0] + b * want[1], b * want[0] + d * want[1]];
    for (let i = 0; i < 2; i++) {
      queue[i].push(tau[i]);
      const k = queue[i].length - 1 - P.m;
      held[i] = k >= 0 ? queue[i][k] : 0;
      if (queue[i].length > 64) queue[i].shift();
    }
  }

  /* ---------- drawing ---------- */

  function drawLoop(g, P, r) {
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
    /* the surface itself, written out: it is the whole design */
    g.maths("s = e' + λe", colMid, smY + smH * 0.26, 13, "center", 0.85);
    [["λ", P.lam.toFixed(0)], ["η", P.eta.toFixed(0)], ["Φ", P.phi.toFixed(2)]]
      .forEach(([sym, val], i) => {
        const yy = smY + smH * (0.52 + i * 0.22);
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

  /* ---------- the two records ---------- */

  /* A sliding loop holds an order of magnitude tighter than the PD one next
     door, so the planes start an order of magnitude smaller. The rate axis
     keeps a floor tied to the boundary layer, because a layer drawn entirely
     off the panel would leave the design parameter invisible. */
  let eTop = 0.01, dTop = 0.1, sTop = 0.1;

  const H = SIM.hue;
  const JOINT = [
    { name: "SHOULDER", on: H.one, off: H.onePale, w: 2.1 },
    { name: "ELBOW", on: H.two, off: H.twoPale, w: 1.8 },
  ];

  /* The plane the design is drawn in: the surface is a line through the
     origin of slope -lambda, the boundary layer is a strip either side of
     it, and a loop that is sliding lives inside that strip. */
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

    /* the boundary layer, then the surface down its middle */
    const X = (e) => cx + e * sx;
    const Y = (d) => cy - d * sy;
    const band = (off, style) => {
      ctx.beginPath();
      ctx.moveTo(X(-eTop), Y(P.lam * eTop + off));
      ctx.lineTo(X(eTop), Y(-P.lam * eTop + off));
      ctx.strokeStyle = style;
      ctx.stroke();
    };
    ctx.fillStyle = "rgba(234,88,12,0.09)";
    ctx.beginPath();
    ctx.moveTo(X(-eTop), Y(P.lam * eTop + P.phi));
    ctx.lineTo(X(eTop), Y(-P.lam * eTop + P.phi));
    ctx.lineTo(X(eTop), Y(-P.lam * eTop - P.phi));
    ctx.lineTo(X(-eTop), Y(P.lam * eTop - P.phi));
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    band(P.phi, "rgba(234,88,12,0.6)");
    band(-P.phi, "rgba(234,88,12,0.6)");
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
      { label: "LAYER  ±Φ", stroke: "rgba(234,88,12,0.7)", width: 1.4, dash: [4, 3] },
    ], p.x + 12, p.y + 34);

    g.seconds(p, px, yTop, yBot, WINDOW, 5);

    /* the boundary layer */
    const lo = Math.max(yTop, py(P.phi)), hi = Math.min(yBot, py(-P.phi));
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
    g.vcap("SLIDING VARIABLE  s  (1/S)", p.x + 15, mid, 9, 0.5);
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
    id: "smc",
    canvasLabel: "The same two-link arm and payload under sampled sliding " +
      "mode control, with the error plane and its sliding surface, and the " +
      "sliding variable against its boundary layer over time",

    controls: [
      { id: "lam", label: "Surface slope <i>λ</i>",
        min: 2, max: 40, step: 1, value: 10, show: (v) => v + " 1/s" },
      { id: "eta", label: "Switching gain <i>η</i>",
        min: 2, max: 60, step: 2, value: 20, show: (v) => v + " rad/s²" },
      { id: "phi", label: "Boundary layer <i>Φ</i>",
        min: 2, max: 100, step: 2, value: 20,
        read: (v) => v / 100, show: (v) => v.toFixed(2) + " 1/s" },
      { id: "h", label: "Sampling period <i>h</i>",
        min: 1, max: 40, step: 1, value: 5,
        read: (v) => v / 1000, show: (v) => Math.round(v * 1000) + " ms" },
      { id: "m", label: "Feedback delay <i>m</i>",
        min: 0, max: 3, step: 1, value: 0,
        show: (v, P) => (v === 0 ? "0"
          : v + (v > 1 ? " samples" : " sample") + "  ·  " +
            Math.round(v * P.h * 1000) + " ms") },
    ],

    readouts: [
      { id: "band", label: "Sliding band" },
      { id: "err", label: "Tracking error" },
    ],
    verdict: true,

    reset() {
      S.q = A.ik(A.ref(0));
      S.v = A.refJoints(0).dq;
      S.simT = 0;
      S.hist = [];
      held = [0, 0];
      queue = [[], []];
      nextT = 0;
      diverged = false;
      eTop = 0.01;
      dTop = 0.1;
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
      /* the first half second is the reaching phase, and letting it set the
         axes would leave the sliding it reaches as a dot in the middle */
      if (S.simT > 0.5) {
        for (let i = 0; i < 2; i++) {
          if (Math.abs(e[i]) > eTop) eTop = Math.ceil(Math.abs(e[i]) / 0.005) * 0.005;
          if (Math.abs(de[i]) > dTop) dTop = Math.ceil(Math.abs(de[i]) / 0.05) * 0.05;
          const s = de[i] + P.lam * e[i];
          if (Math.abs(s) > sTop) sTop = Math.ceil(Math.abs(s) / 0.05) * 0.05;
        }
      }
      if (P.phi * 1.5 > dTop) dTop = Math.ceil(P.phi * 1.5 / 0.05) * 0.05;
      if (P.phi * 1.6 > sTop) sTop = Math.ceil(P.phi * 1.6 / 0.05) * 0.05;

      const wild = !Number.isFinite(err) || err > 3
        || S.v.some((s) => Math.abs(s) > 120);
      if (wild) diverged = true;
    },

    live(P) {
      /* The band is the worst of the whole run once the reaching phase is
         over, not the worst of the last second. The arm is at its lightest
         before the payload lands, and a light arm is the hard case for a
         gain written as an acceleration -- reading only the calm end would
         report sliding for a run that spent its first five seconds
         hammering. The tracking error stays a reading of the moment, so it
         can be held against the PD tab's. */
      let band = 0, sum = 0, n = 0;
      for (const row of S.hist) {
        if (row[0] <= 0.5) continue;
        for (let j = 0; j < 2; j++) {
          const s = Math.abs(row[6 + j] + P.lam * row[4 + j]);
          if (s > band) band = s;
        }
      }
      for (let i = S.hist.length - 1; i >= 0 && S.hist[i][0] > S.simT - 1; i--) {
        sum += S.hist[i][3] * S.hist[i][3];
        n++;
      }
      const bad = diverged || band > P.phi;
      return {
        readouts: {
          band: diverged ? "lost" : band ? band.toFixed(3) + " of " + P.phi.toFixed(2) : "—",
          err: diverged ? "lost" : n ? (Math.sqrt(sum / n) * 1000).toFixed(1) + " mm" : "—",
        },
        verdict: {
          text: diverged ? "Lost" : band > P.phi ? "Chattering" : "Sliding",
          bad,
        },
      };
    },

    draw(g, P, D) {
      const b = A.boxes(D);
      drawLoop(g, P, b.loop);
      g.panel(b.left, "ERROR PLANE AND SLIDING SURFACE", () => drawSurface(g, P, b.left));
      g.panel(b.right, "SLIDING VARIABLE OVER TIME", () => drawSliding(g, P, b.right));
    },
  };
})());
