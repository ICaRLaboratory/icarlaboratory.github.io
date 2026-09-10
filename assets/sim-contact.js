/* ===============================================================
   Pressing on something, from either side of the same relation.

   A tool on one axis is asked to hold a force against a wall. The
   behaviour being asked for is the same either way,

       M_d e'' + D_d e' + K_d e = f_d - f,

   and the two controllers differ only in which half of it they
   measure and which half they command.

   ADMITTANCE reads the force and commands a motion. The relation
   above is integrated in the controller, its solution x_r = x_c + e
   is handed to a stiff inner position loop, and that loop moves the
   machine. It needs a force sensor, and it works on a geared robot
   that cannot be back-driven.

   IMPEDANCE reads the motion and commands a force. There is no inner
   position loop and no force sensor in the loop at all:

       tau = f_d - K_d (x - x_c) - D_d x'

   The machine is a torque source, so the mass it presents is its own;
   there is no M_d to set, which is why that slider goes dead in this
   mode. It needs a back-driveable machine instead of a sensor.

   Both run on the same clock, because the interesting failures are
   sampled-data failures and the comparison is only fair if the clock
   is shared. The wall is a spring and a dashpot that can push and not
   pull, f = max(0, k_e (x - x_w) + b_e x'), and what is read off the
   run is the force the loop settles at and how much it is ringing.

   A run starts with the tool parked two centimetres off the surface
   and reaches for it: the contact point both laws hold to slides onto
   the wall over the first second, and no force is asked for until the
   tool is there. Neither law needs a mode of its own to do it -- with
   f_d = 0 the same relation is position control -- so what the picture
   shows is one controller reaching, touching and then pressing.

   Three things are worth finding on the sliders.

   The offset. Holding the virtual spring costs force, so the loop
   settles short of what was asked: at f_d / (1 + K_d (1/k_p + 1/k_e))
   under admittance, and f_d / (1 + K_d / k_e) under impedance, which
   is nearer, because impedance has no inner loop of its own to be
   compliant. Wind K_d to zero and both offsets go.

   Contact instability, which is admittance's. The force sensor closes
   a path whose gain rises with the stiffness of the wall, so a light
   virtual mass against a hard surface chatters. Impedance holds the
   same wall without complaint: against a passive environment it is
   passive.

   And the clock, which is impedance's. A torque source rendering a
   virtual spring and damper on a sampled clock is only passive up to
   a bound set by the period and by the machine's own damping; slow
   the clock down and impedance goes first, while admittance is still
   holding.
   =============================================================== */

SIM.register((function () {
  /* The inner position loop has to be a real one. At a few hundred newtons
     per metre it is softer than any wall, the two are in series, and the
     contact stiffness the outer loop feels saturates at the servo's own --
     which hides the very effect this tab is about. These are a thirty-hertz
     critically damped axis. */
  const ROBOT = { m: 1, kp: 35400, kv: 377, br: 5 };
  const WALL = { x: 0, be: 2 };                    /* surface, and its damping */
  const START = -0.02;                             /* the tool, 2 cm off the wall */
  const APPROACH = 0.8;                            /* s, reaching for the surface */
  const T_PRESS = 1;                               /* s, force asked for once there */
  const DEMAND = [10, 25];                         /* N, before and after the step */
  const T_STEP = 3;                                /* s */
  const WINDOW = 6;                                /* s */
  const SUB_MAX = 1 / 3000;                        /* the wall is stiff */

  let x, v, e, de, held, simT, nextT, hist, diverged;
  let virtual = null;                              /* the admittance, discretised */

  const adm = (P) => P.mode === "admittance";

  /* newtons per metre, over five decades, in units a reader can hold */
  function stiffness(k) {
    if (k >= 1e6) return (k / 1e6).toFixed(k >= 1e7 ? 0 : 1) + " MN/m";
    if (k >= 1e3) return (k / 1e3).toFixed(k >= 1e4 ? 0 : 1) + " kN/m";
    return Math.round(k) + " N/m";
  }
  /* The surface is reached, not started on. The contact point both laws
     hold to slides from where the tool is parked onto the wall over the
     first APPROACH seconds, eased at both ends so the command never steps,
     and nothing is asked of the force until the tool is there.

     Neither law changes shape to do it. With f_d = 0 and no contact the
     admittance relation leaves e at zero, so x_r is the contact point
     itself and the inner loop tracks it: position control. The impedance
     law becomes tau = -K_d (x - x_c) - D_d x', which is a PD to the same
     point. Asking for ten newtons during the reach would be the mistake --
     the admittance would integrate an error nothing balances, run e out to
     f_d / K_d, and aim the tool five centimetres past the wall. */
  const xc = (t) => {
    if (t >= APPROACH) return WALL.x;
    const u = t / APPROACH;
    return START + (WALL.x - START) * u * u * (3 - 2 * u);
  };
  const demand = (t) => (t < T_PRESS ? 0 : t >= T_STEP ? DEMAND[1] : DEMAND[0]);
  /* the force asked for, and when: the steps the records draw */
  const DEMANDS = [[0, T_PRESS, 0], [T_PRESS, T_STEP, DEMAND[0]],
                   [T_STEP, WINDOW, DEMAND[1]]];
  const force = (X, V, ke) => {
    if (X <= WALL.x) return 0;
    return Math.max(0, ke * (X - WALL.x) + WALL.be * V);
  };

  /* what the loop settles on, which is not what it was asked for */
  const settledForce = (fd, P) => adm(P)
    ? fd / (1 + P.kd * (1 / ROBOT.kp + 1 / P.ke))
    : fd / (1 + P.kd / P.ke);

  /* ---------- the machine, between samples ---------- */

  function deriv(y, P) {
    const f = force(y[0], y[1], P.ke);
    const drive = adm(P)
      ? ROBOT.kp * (held[0] - y[0]) + ROBOT.kv * (held[1] - y[1])
      : held[0];
    return [y[1], (drive - ROBOT.br * y[1] - f) / ROBOT.m];
  }

  function rk4(dt, P) {
    let y = [x, v];
    const k1 = deriv(y, P);
    const k2 = deriv(y.map((c, i) => c + (dt / 2) * k1[i]), P);
    const k3 = deriv(y.map((c, i) => c + (dt / 2) * k2[i]), P);
    const k4 = deriv(y.map((c, i) => c + dt * k3[i]), P);
    y = y.map((c, i) => c + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    [x, v] = y;
    simT += dt;
  }

  /* ---------- the controller, on the clock ---------- */

  function sample(P) {
    const f = force(x, v, P.ke);
    if (adm(P)) {
      /* the virtual system is stepped with the measured force held, by the
         same map the stability readout is built from */
      const u = demand(simT) - f;
      const { Ad, Bd } = virtual;
      const ne = Ad[0][0] * e + Ad[0][1] * de + Bd[0][0] * u;
      const nde = Ad[1][0] * e + Ad[1][1] * de + Bd[1][0] * u;
      e = ne; de = nde;
      held = [xc(simT) + e, de];
    } else {
      held = [demand(simT) - P.kd * (x - xc(simT)) - P.dd * v, 0];
    }
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

  /* the force it is asked for, and the step in it */
  function drawDemand(g, sx, sy, sw, sh, mid) {
    const { ctx } = g;
    g.words("Target force", mid, sy - sh * 0.45, 13);
    ctx.strokeStyle = g.ink(0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy + sh); ctx.lineTo(sx + sw, sy + sh);
    ctx.stroke();
    ctx.strokeStyle = SIM.hue.one;
    ctx.lineWidth = 3;
    /* three levels now: nothing is asked for while the tool is still on its
       way to the surface */
    const at = (t) => sx + sw * (t / WINDOW);
    const LEVEL = [sy + sh, sy + sh * 0.55, sy];
    ctx.beginPath();
    ctx.moveTo(sx + 2, LEVEL[0]);
    DEMANDS.forEach(([from], i) => {
      if (i) { ctx.lineTo(at(from), LEVEL[i - 1]); ctx.lineTo(at(from), LEVEL[i]); }
    });
    ctx.lineTo(sx + sw - 2, LEVEL[2]);
    ctx.stroke();
    g.maths("f", sx + sw + 6, sy + 5, 15, "left");
    g.maths("d", sx + sw + 12, sy + 9, 10, "left", 0.8);
  }

  function junction(g, cx, cy, r) {
    const { ctx } = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = g.ink(0.35); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy);
    ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5);
    ctx.stroke();
  }

  const plus = (g, cx, cy) => {
    const { ctx } = g;
    ctx.strokeStyle = g.ink(0.35); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
    ctx.stroke();
  };
  const minus = (g, cx, cy) => {
    const { ctx } = g;
    ctx.strokeStyle = g.ink(0.35); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
    ctx.stroke();
  };

  /* The loop, drawn the way the selected controller is actually wired. The
     two diagrams are the whole point of the tab: one closes through a force
     sensor into a position command, the other through an encoder into a
     torque, and everything else about them is the same. */
  function drawLoop(g, P, r) {
    const { ctx } = g;
    const { x: rx, y, w, h } = r;
    const colX = rx + w * 0.035, colW = w * 0.30;
    const colMid = colX + colW / 2;
    const feedX = rx + w * 0.008;
    const px0 = rx + w * 0.40, pw = w * 0.585;
    const py0 = y + h * 0.03, ph = h * 0.94;

    g.roundBox(px0, py0, pw, ph, 5);
    g.cap("TOOL AND WALL", px0 + pw / 2, py0 - 9);
    drawContact(g, P, { x: px0, y: py0, w: pw, h: ph });

    if (adm(P)) {
      /* force in at the top, position out at the middle, force back along
         the bottom through the sensor */
      drawDemand(g, colX, y + h * 0.10, colW, h * 0.11, colMid);
      const jy = y + h * 0.32, jr = Math.min(h * 0.055, 15);
      g.arrow(colMid, y + h * 0.10 + h * 0.11 + 6, colMid, jy - jr - 2);
      junction(g, colMid, jy, jr);
      plus(g, colMid + jr + 13, jy - jr + 2);
      minus(g, colMid - jr - 15, jy + jr + 4);

      const adY = y + h * 0.44, adH = Math.min(h * 0.24, 84);
      g.arrow(colMid, jy + jr + 2, colMid, adY - 2);
      g.signal("e", colMid + 9, jy + jr + 2, adY - 2);
      g.roundBox(colX, adY, colW, adH);
      g.cap("ADMITTANCE", colX, adY - 9, 10, "left");
      [["M", P.md.toFixed(1)], ["D", P.dd.toFixed(0)], ["K", P.kd.toFixed(0)]]
        .forEach(([sym, val], i) => {
          const yy = adY + adH * (0.32 + i * 0.26);
          g.maths(sym, colX + colW * 0.34, yy, 15, "right");
          g.maths("d", colX + colW * 0.34 + 2, yy + 4, 10, "left", 0.8);
          g.words(val, colX + colW * 0.78, yy, 12.5);
        });

      g.maths("x", (colX + colW + px0) / 2 - 4, adY + adH * 0.42 - 10, 15);
      g.maths("r", (colX + colW + px0) / 2 + 3, adY + adH * 0.42 - 6, 10, "left", 0.8);
      g.arrow(colX + colW + 2, adY + adH * 0.5, px0 - 2, adY + adH * 0.5);

      const rowY = y + h * 0.78, rowH = Math.min(h * 0.155, 54);
      g.maths("f", (colX + colW + px0) / 2, rowY + rowH * 0.42 - 10, 16);
      g.arrow(px0 - 2, rowY + rowH * 0.5, colX + colW + 2, rowY + rowH * 0.5);
      g.roundBox(colX, rowY, colW, rowH);
      g.words("Force sensor", colMid, rowY + rowH * 0.42, 13);
      g.labelled("h", "", " = " + Math.round(P.h * 1000) + " ms",
        colMid, rowY + rowH * 0.85);

      ctx.strokeStyle = g.ink(0.9); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(colX - 2, rowY + rowH * 0.5);
      ctx.lineTo(feedX, rowY + rowH * 0.5);
      ctx.lineTo(feedX, jy);
      ctx.stroke();
      g.arrow(feedX, jy, colMid - jr - 2, jy);
      return;
    }

    /* impedance: position in at the bottom through the encoder, torque out
       at the middle, and the target force added straight to it */
    drawDemand(g, colX, y + h * 0.08, colW, h * 0.10, colMid);
    const jy = y + h * 0.36, jr = Math.min(h * 0.055, 15);
    g.arrow(colMid, y + h * 0.08 + h * 0.10 + 6, colMid, jy - jr - 2);
    junction(g, colMid, jy, jr);
    plus(g, colMid + jr + 13, jy - jr + 2);
    plus(g, colMid - jr - 15, jy + jr + 6);

    g.maths("τ", (colMid + px0) / 2, jy - 10, 15);
    g.arrow(colMid + jr + 2, jy, px0 - 2, jy);

    const imY = y + h * 0.52, imH = Math.min(h * 0.20, 70);
    g.arrow(colMid, imY - 2, colMid, jy + jr + 2);
    g.roundBox(colX, imY, colW, imH);
    g.cap("IMPEDANCE", colX, imY - 9, 10, "left");
    [["K", P.kd.toFixed(0)], ["D", P.dd.toFixed(0)]].forEach(([sym, val], i) => {
      const yy = imY + imH * (0.40 + i * 0.36);
      g.maths(sym, colX + colW * 0.34, yy, 15, "right");
      g.maths("d", colX + colW * 0.34 + 2, yy + 4, 10, "left", 0.8);
      g.words(val, colX + colW * 0.78, yy, 12.5);
    });

    const rowY = y + h * 0.80, rowH = Math.min(h * 0.145, 50);
    g.arrow(colMid, rowY - 2, colMid, imY + imH + 2);
    minus(g, colMid - 15, imY + imH + 12);
    g.roundBox(colX, rowY, colW, rowH);
    g.words("Encoder", colMid, rowY + rowH * 0.42, 13);
    g.labelled("h", "", " = " + Math.round(P.h * 1000) + " ms",
      colMid, rowY + rowH * 0.85);

    g.maths("x", (colX + colW + px0) / 2, rowY + rowH * 0.42 - 10, 16);
    g.arrow(px0 - 2, rowY + rowH * 0.5, colX + colW + 2, rowY + rowH * 0.5);
  }

  /* ---------- the machine against the wall ----------

     One controlled axis, drawn as one: a fixed mount, a linear guide, the
     carriage the controller moves along it, a force sensor at the end of the
     rod and the tool face that meets the surface. A jointed arm would be the
     livelier picture and the wrong one -- the stroke here is a couple of
     centimetres against a millimetre of contact, and any elbow drawn to that
     scale would be flailing through ninety degrees while the tool creeps
     forward. The normal direction is what is modelled, so it is what is
     drawn. What the controller commands is drawn too, and differs: a
     position under admittance, a torque under impedance. */

  function drawContact(g, P, box) {
    const { ctx } = g;
    /* Millimetres of penetration beside centimetres of approach would be
       invisible, so the axis is drawn at a scale that makes the contact
       readable and the records below carry the honest numbers. */
    const LEFT = -0.030, RIGHT = 0.055;
    /* clamped: a run that has thrown the tool out of the frame should leave
       the machine parked at the end of its travel, not leave an empty box */
    const px = (X) => box.x + box.w * 0.34 +
      ((Math.max(LEFT, Math.min(RIGHT, X)) - LEFT) / (RIGHT - LEFT)) * (box.w * 0.58);
    const mid = box.y + box.h * 0.52;
    const f = force(x, v, P.ke);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x + 1.5, box.y + 1.5, box.w - 3, box.h - 3);
    ctx.clip();

    const face = px(WALL.x + Math.max(0, x - WALL.x));
    const wallEnd = box.x + box.w - 6;
    const tipX = px(x);
    const rail = box.h * 0.15;
    const mountX = box.x + box.w * 0.04;

    ctx.fillStyle = g.ink(0.05);
    ctx.fillRect(face, box.y + box.h * 0.12, wallEnd - face, box.h * 0.76);
    ctx.strokeStyle = g.ink(0.2);
    ctx.lineWidth = 1;
    for (let hx = face + 8; hx < wallEnd; hx += 10) {
      ctx.beginPath();
      ctx.moveTo(hx, box.y + box.h * 0.12);
      ctx.lineTo(hx - 10, box.y + box.h * 0.88);
      ctx.stroke();
    }
    ctx.strokeStyle = g.ink(f > 0 ? 0.9 : 0.45);
    ctx.lineWidth = f > 0 ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.moveTo(face, box.y + box.h * 0.12);
    ctx.lineTo(face, box.y + box.h * 0.88);
    ctx.stroke();
    ctx.strokeStyle = g.ink(0.22);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(WALL.x), box.y + box.h * 0.08);
    ctx.lineTo(px(WALL.x), box.y + box.h * 0.92);
    ctx.stroke();
    ctx.setLineDash([]);
    g.labelled("k", "e", " = " + stiffness(P.ke),
      (px(WALL.x) + wallEnd) / 2, box.y + box.h * 0.06, 11, 0.55);

    /* the mount the axis is bolted to */
    ctx.strokeStyle = g.ink(0.2);
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const yy = mid - rail * 1.5 + k * rail * 0.75;
      ctx.beginPath();
      ctx.moveTo(mountX - 12, yy + 8); ctx.lineTo(mountX, yy);
      ctx.stroke();
    }
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(mountX, mid - rail * 1.5, 7, rail * 3);

    ctx.strokeStyle = g.ink(0.3);
    ctx.lineWidth = 2.4;
    for (const dy of [-rail, rail]) {
      ctx.beginPath();
      ctx.moveTo(mountX + 7, mid + dy); ctx.lineTo(px(WALL.x) - 2, mid + dy);
      ctx.stroke();
    }

    const rod = box.w * 0.085, puck = box.w * 0.05;
    const carW = box.w * 0.115, carH = rail * 1.9;
    const carRight = tipX - rod - puck;

    /* what the controller is commanding, which is the difference itself */
    if (adm(P)) {
      const xr = px(xc(simT) + e);
      ctx.strokeStyle = g.ink(0.6);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xr, mid - rail * 2.1); ctx.lineTo(xr, mid + rail * 1.9);
      ctx.stroke();
      ctx.setLineDash([]);
      g.labelled("x", "r", "", xr, mid - rail * 2.4, 12, 0.55);
    } else {
      /* the torque the controller is commanding, on the carriage it acts on,
         mirroring the contact force arrow on the other side of the tool */
      const carLeft = carRight - carW;
      const len = Math.min(box.w * 0.16, 10 + (Math.abs(held[0]) / 30) * box.w * 0.13);
      const yy = mid + carH * 0.72;
      const push = held[0] >= 0;
      g.arrow(carLeft - 8 - (push ? len : 0), yy, carLeft - 8 - (push ? 0 : len), yy);
      g.words("τ " + held[0].toFixed(1) + " N", carLeft - len - 12, yy + 4, 12, "right");
    }

    g.roundBox(carRight - carW, mid - carH / 2, carW, carH, 3);
    ctx.fillStyle = g.ink(0.75);
    for (const dy of [-rail, rail]) ctx.fillRect(carRight - carW * 0.8, mid + dy - 2.5, carW * 0.6, 5);

    ctx.strokeStyle = g.ink(1);
    ctx.lineWidth = Math.max(4, box.h * 0.035);
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(carRight, mid); ctx.lineTo(carRight + rod, mid);
    ctx.stroke();

    /* the sensor is only in the loop under admittance; under impedance it is
       drawn hollow, because nothing is reading it */
    g.roundBox(carRight + rod, mid - carH * 0.28, puck, carH * 0.56, 2);
    g.maths("f", carRight + rod + puck / 2, mid + 5, 13, "center", adm(P) ? 0.9 : 0.3);

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(tipX - 6, mid - carH * 0.42, 6, carH * 0.84);

    if (f > 0.05) {
      const len = Math.min(box.w * 0.2, 10 + (f / 30) * box.w * 0.16);
      g.arrow(tipX - len - 10, mid - carH * 0.85, tipX - 8, mid - carH * 0.85);
      g.words(f.toFixed(1) + " N", tipX - len - 14, mid - carH * 0.85 + 4, 12, "right");
    } else {
      g.cap("NO CONTACT", tipX - 10, mid - carH * 0.85 + 4, 9, "right", 0.4);
    }
    ctx.restore();
  }

  /* ---------- the two records ---------- */

  let fTop = 40;                /* N; grows to fit the run */
  /* How far the tool gets into the surface is set by the stiffness, and that
     runs over decades: millimetres into rubber, a hundredth of one into
     metal. The axis is sized from the wall at the start of each run and then
     grown if the run overshoots it. */
  let pTop = 0.008;
  const penetrationScale = (P) => Math.max(6e-4, (DEMAND[1] / P.ke) * 1.6);
  const mm = (v) => {
    const x = v * 1000;
    return Math.abs(x) >= 10 ? String(Math.round(x))
      : Math.abs(x) >= 1 ? x.toFixed(1) : x.toFixed(2);
  };

  const H = SIM.hue;

  function drawForce(g, P, p) {
    const { ctx } = g;
    const x0 = p.x + 48, x1 = p.x + p.w - 14;
    const yTop = p.y + 52, yBot = p.y + p.h - 42;
    const px = (t) => x0 + (t / WINDOW) * (x1 - x0);
    const py = (f) => yBot - (Math.min(f, fTop) / fTop) * (yBot - yTop);

    g.keyRow([
      { label: "MEASURED", stroke: H.one, width: 2.1 },
      { label: "ASKED FOR", stroke: g.ink(0.4), width: 1.2, dash: [4, 4] },
      { label: "WILL BE HELD", stroke: H.two, width: 1.8, dash: [3, 3] },
    ], p.x + 12, p.y + 34);

    g.seconds(p, px, yTop, yBot, WINDOW, 1);
    ctx.strokeStyle = g.ink(0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yBot); ctx.lineTo(x1, yBot);
    ctx.moveTo(x0, yTop); ctx.lineTo(x0, yBot);
    ctx.stroke();
    for (const frac of [0.5, 1]) {
      const yy = yBot - frac * (yBot - yTop);
      ctx.strokeStyle = g.ink(0.07);
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      g.cap(Math.round(fTop * frac) + "", x0 - 6, yy + 3, 9, "right", 0.45);
    }
    g.cap("0", x0 - 6, yBot + 3, 9, "right", 0.45);
    g.vcap("FORCE  (N)", p.x + 15, (yTop + yBot) / 2, 9, 0.5);
    g.cap("TIME  (S)", (x0 + x1) / 2, p.y + p.h - 11, 9, "center", 0.5);

    ctx.strokeStyle = H.one;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    let started = false;
    for (const row of hist) {
      const X = px(row[0]), Y = py(row[3]);
      started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
    }
    ctx.stroke();

    /* What was asked for, and what the loop will actually hold. Drawn over
       the trace rather than under it: a settled run sits exactly on the
       second of them, and underneath it would simply be invisible. */
    for (const [stroke, dash, value] of [[g.ink(0.4), [4, 4], (fd) => fd],
                                         [H.two, [3, 3], (fd) => settledForce(fd, P)]]) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.8;
      ctx.setLineDash(dash);
      ctx.beginPath();
      DEMANDS.forEach(([from, to, fd], i) => {
        const Y = py(value(fd));
        i ? ctx.lineTo(px(from), Y) : ctx.moveTo(px(from), Y);
        ctx.lineTo(Math.min(px(to), x1), Y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* Force against how far the tool has pushed into the surface. Everything
     the sliders do is legible here: in free space the trace runs along the
     bottom at zero force; on contact it climbs the wall's own line, whose
     slope is the stiffness set on the slider; a settled loop is a point on
     that line, and a chattering one runs up and down it and off the end into
     free space. */
  function drawContactPlane(g, P, p) {
    const { ctx } = g;
    const x0 = p.x + 48, x1 = p.x + p.w - 16;
    const yTop = p.y + 52, yBot = p.y + p.h - 42;
    /* just enough free space to show the trace arriving at zero force; the
       twenty millimetres before that are a flat line and not worth the width */
    const LEFT = -0.35 * pTop;
    const px = (X) => x0 + ((Math.max(LEFT, X) - LEFT) / (pTop - LEFT)) * (x1 - x0);
    const py = (f) => yBot - (Math.min(f, fTop) / fTop) * (yBot - yTop);

    g.keyRow([
      { label: "MEASURED", stroke: H.one, width: 2.1 },
      { label: "WALL", stroke: g.ink(0.4), width: 1.4, dash: [5, 3] },
      { label: "ASKED FOR", stroke: H.two, width: 1.8, dash: [3, 3] },
    ], p.x + 12, p.y + 34);

    ctx.strokeStyle = g.ink(0.16);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, yBot); ctx.lineTo(x1, yBot);
    ctx.moveTo(x0, yTop); ctx.lineTo(x0, yBot);
    ctx.stroke();
    g.cap(Math.round(fTop) + "", x0 - 6, yTop + 4, 9, "right", 0.45);
    g.cap("0", x0 - 6, yBot + 3, 9, "right", 0.45);
    g.cap(mm(LEFT), x0, yBot + 15, 9, "center", 0.45);
    g.cap(mm(pTop), x1, yBot + 15, 9, "center", 0.45);
    g.vcap("FORCE  (N)", p.x + 15, (yTop + yBot) / 2, 9, 0.5);
    g.cap("PENETRATION  (MM)", (x0 + x1) / 2, p.y + p.h - 11, 9, "center", 0.5);

    ctx.strokeStyle = g.ink(0.28);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px(WALL.x), yTop); ctx.lineTo(px(WALL.x), yBot);
    ctx.stroke();
    ctx.setLineDash([]);
    g.cap("SURFACE", px(WALL.x) + 5, yTop + 11, 9, "left", 0.45);

    ctx.strokeStyle = H.one;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    let started = false;
    for (const row of hist) {
      const X = px(row[1]), Y = py(row[3]);
      started ? ctx.lineTo(X, Y) : (ctx.moveTo(X, Y), (started = true));
    }
    ctx.stroke();

    /* the wall itself: f = k_e x, the line the loop has to work along */
    const reach = Math.min(pTop, fTop / P.ke);
    ctx.strokeStyle = g.ink(0.4);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(px(WALL.x), py(0));
    ctx.lineTo(px(reach), py(P.ke * reach));
    ctx.stroke();
    ctx.setLineDash([]);
    g.labelled("k", "e", "", px(reach) - 12, py(P.ke * reach) + 16, 12, 0.55);

    /* what it was asked to hold, so the point it lands on can be read off */
    ctx.strokeStyle = H.two;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, py(demand(simT))); ctx.lineTo(x1, py(demand(simT)));
    ctx.stroke();
    ctx.setLineDash([]);

    if (hist.length) {
      const last = hist[hist.length - 1];
      ctx.fillStyle = H.one;
      ctx.beginPath();
      ctx.arc(px(last[1]), py(last[3]), 4, 0, 7);
      ctx.fill();
    }
  }

  /* ---------- the module ---------- */

  return {
    id: "contact",
    canvasLabel: "A single controlled axis pressed against a compliant wall, " +
      "under either admittance or impedance control, with the force it holds " +
      "over time and that force plotted against how far the tool has pushed " +
      "into the surface",

    controls: [
      { id: "mode", label: "Causality",
        value: "admittance",
        choices: [{ value: "admittance", label: "Admittance" },
                  { value: "impedance", label: "Impedance" }] },
      { id: "md", label: "Virtual mass <i>M</i><sub>d</sub>",
        min: 0.5, max: 10, step: 0.5, value: 1,
        show: (v) => v.toFixed(1) + " kg",
        /* a torque source presents its own mass; there is nothing to set */
        applies: (P) => P.mode === "admittance", off: "the machine's own" },
      { id: "dd", label: "Virtual damping <i>D</i><sub>d</sub>",
        min: 5, max: 120, step: 5, value: 20, show: (v) => v + " Ns/m" },
      /* Far enough to break it. A virtual spring stiffer than the machine
         can settle against inside one sampling period is where both of
         these laws let go, and the run shows that without a criterion to
         predict it -- but only if the slider reaches. */
      { id: "kd", label: "Virtual stiffness <i>K</i><sub>d</sub>",
        min: 0, max: 3000, step: 100, value: 200, show: (v) => v + " N/m" },
      /* Real contact stiffness spans decades -- soft rubber to metal through
         a stiff sensor -- so the slider is decades too, a tenth of one per
         notch, rather than a linear crawl across the interesting part. */
      { id: "ke", label: "Contact stiffness <i>k</i><sub>e</sub>",
        min: 30, max: 61, step: 1, value: 33,
        read: (v) => Math.pow(10, v / 10), show: (v) => stiffness(v) },
      { id: "h", label: "Sampling period <i>h</i>",
        min: 1, max: 40, step: 1, value: 4,
        read: (v) => v / 1000, show: (v) => Math.round(v * 1000) + " ms" },
    ],

    readouts: [
      { id: "held", label: "Force held" },
      { id: "ring", label: "Force ripple" },
    ],
    verdict: true,

    reset(P) {
      x = START;
      v = 0;
      e = START;
      de = 0;
      held = adm(P) ? [START, 0] : [0, 0];
      simT = 0;
      nextT = 0;
      hist = [];
      diverged = false;
      fTop = 40;
      pTop = penetrationScale(P);
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
        /* a meganewton-per-metre wall rings at a kilohertz, so the step has
           to follow the stiffness rather than being fixed to the slowest one */
        const w = Math.sqrt((P.ke + (adm(P) ? ROBOT.kp : 0)) / ROBOT.m);
        const sub = Math.min(SUB_MAX, 0.2 / w);
        let inner = stepTo;
        while (inner > 1e-12) {
          const step = Math.min(sub, inner);
          rk4(step, P);
          inner -= step;
        }
        left -= stepTo;
      }
      const f = force(x, v, P.ke);
      hist.push([simT, x, e, f]);
      if (hist.length > 900) hist.shift();
      if (f > fTop) fTop = Math.ceil(f / 40) * 40;
      if (x > pTop) pTop = x * 1.15;
      if (!Number.isFinite(x) || Math.abs(x) > 0.5 || Math.abs(v) > 40) diverged = true;
    },

    tune(P) {
      /* the virtual system, as the controller will actually step it */
      virtual = SIM.discretize([[0, 1], [-P.kd / P.md, -P.dd / P.md]],
        [[0], [1 / P.md]], P.h, 2, 1);
      return null;
    },

    live(P) {
      /* What the loop is doing rather than what a criterion says it may do:
         the mean force over the last second and the width it is swinging
         through. A loop that has lost the contact rings hard before any
         state runs away, and that ring is the whole of what goes wrong
         here, so it is what the verdict is read from: a fifth of the force
         being asked for is where the ringing stops being a settling
         transient and starts being the answer. */
      const fd = demand(simT);
      let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
      for (let i = hist.length - 1; i >= 0 && hist[i][0] > simT - 1; i--) {
        const f = hist[i][3];
        if (f < lo) lo = f;
        if (f > hi) hi = f;
        sum += f;
        n++;
      }
      const ring = n ? hi - lo : 0;
      const loud = fd > 0 && ring > 0.2 * fd;
      return {
        readouts: {
          held: diverged ? "lost" : fd === 0 || !n ? "—"
            : (sum / n).toFixed(1) + " N of " + fd.toFixed(0),
          ring: diverged ? "lost" : fd === 0 || !n ? "—"
            : ring.toFixed(1) + " N",
        },
        verdict: {
          text: diverged ? "Lost" : loud ? "Ringing" : "Held",
          bad: diverged || loud,
        },
      };
    },

    draw(g, P, D) {
      const b = boxes(D);
      drawLoop(g, P, b.loop);
      g.panel(b.left, "CONTACT FORCE", () => drawForce(g, P, b.left));
      g.panel(b.right, "FORCE AGAINST PENETRATION", () => drawContactPlane(g, P, b.right));
    },
  };
})());
