import * as T from './vendor/three.js';
import { createView } from './three/view.js';
import { C, group, cylinder, rod, setRod, line, updateLine, floor, targetMarker } from './three/primitives.js';
import { finish, housing, turned, flange, fasteners, cable } from './three/engineering.js';
import { sculptedLink, resizeSculptedLink } from './three/robot-hardware.js';

// Presentation only: snapshots are copied by the existing controllers. No clock,
// integration or control law lives here, including when the camera is moved.
function pedestal(root, x = 0, z = 0) {
  const base = group('robot-base');
  base.position.set(x, 0, z);
  root.add(base);
  housing(base, 'base-plate', [0.46, 0.055, 0.44], [0, 0.0275, 0], 'dark-metal');
  turned(base, 'base-column', [[0, 0], [0.17, 0], [0.17, 0.04], [0.135, 0.055],
    [0.135, 0.32], [0.16, 0.34], [0.16, 0.38], [0, 0.38]], [0, 0.065, 0], 'paint');
  flange(base, 'base-collar', 0.17, 0.035, [0, 0.46, 0], 'aluminium', 0.095);
  fasteners(base, 'base-mount-bolts', 0.225, [0, 0.061, 0], 4, 0.019).rotation.y = Math.PI / 4;
  housing(base, 'base-electrical-box', [0.11, 0.20, 0.20], [-0.145, 0.23, 0], 'dark-metal');
  housing(base, 'base-rating-plate', [0.075, 0.07, 0.003], [-0.145, 0.25, 0.102], 'aluminium');
  cable(base, 'base-power-cable', [[-0.19, 0.15, 0], [-0.24, 0.10, 0.02], [-0.22, 0.02, 0.16], [-0.08, 0.018, 0.19]], 0.012);
  return base;
}

function horizontalLink(parent, name, length, rootRadius, tipRadius, depth) {
  const shell = sculptedLink(parent, `${name}-shell`, length,
    { rootRadius, tipRadius, depth, material: finish('paint', { color: 0xe5e3d9 }) });
  // The shared shell's local Z thickness becomes world Y. No extra joint.
  shell.rotation.x = Math.PI / 2;
  return shell;
}

function trackingModel() {
  const root = group('research-tracking-robot');
  const stage = floor(root, 2.45, 1.85);
  stage.position.set(0.52, 0, -0.43);
  stage.userData.environment = true;
  pedestal(root);
  const shoulder = group('shoulder');
  // Two horizontal castings at constant heights, separated by a real shaft.
  // Presentation heights are not vertical plant coordinates or a third axis.
  shoulder.position.y = 0.65;
  root.add(shoulder);
  flange(shoulder, 'shoulder-bearing', 0.17, 0.055, [0, -0.145, 0], 'steel', 0.065);
  cylinder(shoulder, 'shoulder-shaft', 0.064, 0.16, [0, -0.11, 0], finish('steel'));
  const upper = horizontalLink(shoulder, 'upper-link', 1, 0.21, 0.15, 0.24);
  turned(shoulder, 'shoulder-servo', [[0, 0.06], [0.16, 0.06], [0.17, 0.09],
    [0.165, 0.11], [0.13, 0.13], [0, 0.13]], [0, 0, 0], 'dark-metal');
  cylinder(shoulder, 'shoulder-encoder', 0.10, 0.012, [0, 0.131, 0], finish('paint', { color: C.teal }));
  const elbow = group('elbow');
  shoulder.add(elbow);
  flange(elbow, 'elbow-bearing', 0.14, 0.13, [0, -0.155, 0], 'steel', 0.063);
  cylinder(elbow, 'elbow-shaft', 0.062, 0.38, [0, -0.14, 0], finish('dark-metal'));
  const lower = horizontalLink(elbow, 'forearm-link', 0.85, 0.18, 0.105, 0.20);
  turned(elbow, 'elbow-servo', [[0, 0.065], [0.135, 0.065], [0.14, 0.10],
    [0.13, 0.15], [0.095, 0.17], [0, 0.17]], [0, 0, 0], 'dark-metal');
  cylinder(elbow, 'elbow-encoder', 0.083, 0.012, [0, 0.171, 0], finish('paint', { color: C.amber }));
  const tool = group('tool-tip');
  elbow.add(tool);
  turned(tool, 'wrist', [[0, -0.09], [0.045, -0.09], [0.065, -0.06],
    [0.08, 0.06], [0.065, 0.12], [0, 0.12]], [0, 0, 0], 'dark-metal');
  flange(tool, 'tool-mass-fixture', 0.14, 0.028, [0, 0.135, 0], 'aluminium', 0.025);
  // The connected short tool clears the entire upstream casting/servo layer
  // at every joint angle. Constant heights are presentation, not a third axis.
  turned(tool, 'tool-stylus', [[0, -0.15], [0.012, -0.138], [0.012, -0.11],
    [0.024, -0.10], [0.024, -0.075], [0, -0.075]], [0, 0, 0], 'steel');
  cylinder(tool, 'tool-collet', 0.035, 0.05, [0, -0.105, 0], finish('aluminium'));
  // Lines only: the short tool's planar projection is not a physical shaft.
  // Inherit exact FK X/Z; Y=.06 is the unchanged measured-trajectory plane.
  const projection = group('tool-planar-projection');
  projection.position.y = 0.06 - 0.96;
  projection.userData.annotation = true;
  tool.add(projection);
  const guide = line(projection, 'tool-projection-guide', [[0, 0.75, 0], [0, 0, 0]], C.teal, true);
  guide.material.dashSize = 0.035; guide.material.gapSize = 0.025;
  // Chevron apex is the exact FK point; its wings stay inside the existing
  // swept workspace, unlike a ring that would expand the camera budget.
  line(projection, 'tool-planar-marker', [[-0.04, 0, -0.02], [0, 0, 0], [-0.04, 0, 0.02]], C.teal);
  cylinder(tool, 'tool-mass-spindle', 0.024, 0.19, [0, 0.225, 0], finish('steel'));
  const payload = group('payload');
  tool.add(payload);
  // Four mounted 5 kg elements attach discretely, with no falling animation.
  const massPlates = Array.from({ length: 4 }, (_, i) =>
    flange(payload, `payload-plate-${i + 1}`, 0.115, 0.028, [0, 0.164 + i * 0.032, 0],
      i % 2 ? 'steel' : 'dark-metal', 0.025));
  const massAnchor = group('inertial-payload-anchor');
  massAnchor.position.set(0, 0.27, 0); tool.add(massAnchor);
  const readouts = [
    { id: 'payload', anchor: massAnchor, label: { en: 'Horizontal plane · payload', ko: '수평면 · 말단 질량' }, retainLabel: true, value: '0 kg', side: 'right' },
    { id: 'shoulder', anchor: shoulder, label: { en: 'Joint 1', ko: '관절 1' }, value: '0.00 rad', side: 'left' },
  ];
  const reference = line(root, 'target-trajectory', [[0, 0, 0], [0, 0, 0]], C.ink, true);
  const unloaded = line(root, 'unloaded-trajectory', [[0, 0, 0], [0, 0, 0]], C.metal);
  const trail = line(root, 'measured-trajectory', [[0, 0, 0], [0, 0, 0]], C.teal);
  const target = targetMarker(root, 'target', [0, 0.055, 0], 0.065, C.amber);
  let circleKey = '';
  return {
    root,
    // Frame the full horizontal 2R workspace, not only the nominal circle.
    // A mild perspective keeps the default assembly readable in the same view.
    camera: { projection: 'perspective', fov: 30, position: [2.29, 2.35, -3.97], target: [0, 0.35, 0], span: 4.65 },
    readouts: () => readouts,
    legend: {
      en: 'Horizontal plane, two rotary joints; inertial payload. Gravity does not produce in-plane joint torque in this model. Mass plates attach at 5 s (15 kg) and 8 s (+5 kg), without impact. Teal vertical dashes and small planar chevron: nonphysical projection of the short tool onto the measured-path plane (Y=0.06), with no vertical degree of freedom. Mesh clearance is presentation only; the plant has no collision physics. Gray: unloaded measured path; teal: recent loaded path; dark dashed: reference; amber ring: target. Joint colors match the graphs.',
      ko: '수평면의 회전 2관절 모델에 관성 부하를 적용합니다. 중력은 이 모델에서 평면 내 관절 토크를 만들지 않습니다. 질량판은 5초에 15 kg, 8초에 5 kg이 충격 없이 추가됩니다. 청록 수직 점선과 작은 평면 표식은 짧은 공구를 실제 궤적 평면(Y=0.06)에 나타내는 비물리적 투영 표시입니다. 수직 자유도는 없으며 형상 간격은 표시용으로, 충돌 동역학은 모델에 포함되지 않습니다. 회색: 무부하 실제 궤적, 청록: 최근 부하 궤적, 검은 점선: 기준 궤적, 주황 고리: 목표점. 관절색은 그래프와 같습니다.',
    },
    update(state) {
      if (!state || !state.q.every(Number.isFinite)) return;
      const [l1, l2] = state.lengths;
      shoulder.rotation.y = -state.q[0];
      resizeSculptedLink(upper, l1);
      elbow.position.set(l1, 0.31, 0);
      elbow.rotation.y = -state.q[1];
      resizeSculptedLink(lower, l2);
      tool.position.set(l2, 0, 0);
      payload.visible = state.payload > 0;
      massPlates.forEach((plate, i) => { plate.visible = state.payload >= (i + 1) * 5; });
      readouts[0].value = `${state.payload.toFixed(0)} kg`;
      readouts[1].value = `${state.q[0].toFixed(2)} rad`;
      target.position.set(state.target.x, 0.055, state.target.y);
      const c = state.circle, key = `${c.x},${c.y},${c.r}`;
      if (key !== circleKey) {
        updateLine(reference, Array.from({ length: 129 }, (_, i) => {
          const angle = i * 2 * Math.PI / 128;
          return [c.x + c.r * Math.cos(angle), 0.05, c.y + c.r * Math.sin(angle)];
        }));
        circleKey = key;
      }
      unloaded.visible = state.unloadedTrail.length > 1;
      updateLine(unloaded, state.unloadedTrail.map(p => [p.x, 0.06, p.y]));
      trail.visible = state.trail.length > 1;
      updateLine(trail, state.trail.map(p => [p.x, 0.06, p.y]));
    },
  };
}

function contactModel() {
  const root = group('research-contact-robot');
  const stage = floor(root, 3.5, 1.45, -0.10);
  stage.userData.environment = true;
  housing(root, 'test-bed', [3.12, 0.065, 0.92], [0.05, -0.0325, 0], 'aluminium');
  for (const z of [-0.31, 0.31]) housing(root, 'bed-t-slot', [2.96, 0.007, 0.018], [0.05, 0.004, z], 'dark-metal');
  const base = group('robot-base'); root.add(base);
  housing(base, 'base-plate', [0.52, 0.055, 0.50], [-1.16, 0.0275, -0.12], 'dark-metal');
  turned(base, 'base-column', [[0, 0], [0.21, 0], [0.21, 0.035], [0.16, 0.075],
    [0.14, 0.26], [0.12, 0.32], [0, 0.32]], [-1.16, 0.055, -0.12],
    finish('paint', { color: 0xe5e3d9 }));
  // A locked casting carries the drive manifold itself. The two apparent
  // rotary joints are fixed setup clamps, never extra plant coordinates.
  const support = group('fixed-articulated-support'); root.add(support);
  const joints = [[-1.16, 0.33, -0.12], [-0.88, 0.91, -0.12], [-0.29, 0.50, -0.12]];
  for (let i = 0; i < joints.length; i++) {
    if (i) {
      const a = new T.Vector3().fromArray(joints[i - 1]), b = new T.Vector3().fromArray(joints[i]);
      const shell = sculptedLink(support, `support-link-shell-${i}`, a.distanceTo(b), {
        rootRadius: i === 1 ? 0.18 : 0.145, tipRadius: i === 1 ? 0.145 : 0.13,
        depth: 0.30, material: finish('paint', { color: 0xe5e3d9 }),
      });
      shell.position.copy(a); shell.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    }
    const joint = cylinder(support, `support-joint-${i}`, i ? 0.112 : 0.14, 0.055,
      [joints[i][0], joints[i][1], 0.045], finish('dark-metal'));
    joint.rotation.x = Math.PI / 2;
    const face = flange(support, `support-locking-plate-${i}`, i ? 0.082 : 0.103, 0.015,
      [joints[i][0], joints[i][1], 0.08], 'aluminium', 0.025);
    face.rotation.x = Math.PI / 2;
  }
  const carrier = horizontalLink(support, 'linear-carrier', 1.53, 0.15, 0.12, 0.18);
  carrier.position.set(-0.34, 0.28, 0);
  // A single rail bed seats on the cast carrier; guide blocks travel above it.
  housing(support, 'linear-rail-bed', [1.48, 0.035, 0.31], [0.46, 0.3775, 0], 'aluminium');
  const drive = sculptedLink(support, 'linear-drive-housing', 0.28, {
    rootRadius: 0.13, tipRadius: 0.13, depth: 0.25,
    material: finish('paint', { color: 0xe5e3d9 }),
  });
  drive.rotation.x = Math.PI / 2; drive.position.set(-0.61, 0.43, -0.02);
  const driveCap = cylinder(support, 'linear-drive-cap', 0.095, 0.025, [-0.72, 0.43, -0.02], finish('dark-metal'));
  driveCap.rotation.z = Math.PI / 2;
  for (const z of [-0.13, 0.13]) {
    rod(support, 'linear-guide', [-0.25, 0.47, z], [1.16, 0.47, z], 0.024, finish('steel'));
    for (const x of [-0.26, 1.17]) housing(support, 'rail-end-support', [0.08, 0.14, 0.10], [x, 0.44, z], 'dark-metal');
  }
  housing(support, 'carrier-end-foot', [0.21, 0.23, 0.32], [1.16, 0.115, 0],
    finish('paint', { color: 0xe5e3d9 }));
  const tool = group('tool-tip');
  root.add(tool);
  housing(tool, 'carriage', [0.27, 0.19, 0.36], [-0.32, -0.04, 0], 'aluminium');
  for (const z of [-0.13, 0.13]) {
    housing(tool, 'carriage-bearing-block', [0.22, 0.13, 0.11], [-0.32, -0.20, z], 'dark-metal');
    housing(tool, 'carriage-bearing-seal', [0.016, 0.12, 0.10], [-0.437, -0.20, z], 'rubber');
  }
  fasteners(tool, 'carriage-saddle-bolts', 0.10, [-0.32, 0.05, 0], 4, 0.013).rotation.y = Math.PI / 4;
  rod(tool, 'tool-shaft', [-0.20, 0, 0], [-0.12, 0, 0], 0.048, finish('steel'));
  const sensor = turned(tool, 'force-sensor', [[0, -0.055], [0.07, -0.055], [0.10, -0.035],
    [0.10, 0.035], [0.07, 0.055], [0, 0.055]], [-0.09, 0, 0], finish('aluminium'));
  sensor.rotation.z = Math.PI / 2;
  const connector = cylinder(tool, 'sensor-connector', 0.022, 0.052, [-0.09, -0.10, 0], finish('steel'));
  connector.rotation.z = 0.18;
  cable(tool, 'sensor-cable-loom', [[-0.09, -0.13, 0], [-0.17, -0.20, 0.03],
    [-0.39, -0.11, 0.12], [-0.48, 0.02, 0.13], [-0.41, 0.09, 0.13]], 0.009);
  housing(tool, 'contact-pad', [0.035, 0.16, 0.20], [-0.0175, 0, 0], 'rubber');
  const wall = group('contact-wall');
  root.add(wall);
  housing(wall, 'wall-face', [0.065, 0.65, 0.60], [0.0325, 0.67, 0], 'aluminium');
  // The contact face remains exactly at the model-mapped X coordinate.
  housing(wall, 'wall-contact-insert', [0.008, 0.26, 0.31], [0.004, 0.67, 0], 'ceramic');
  for (const z of [-0.20, 0.20]) {
    rod(root, 'wall-guide-rod', [0.71, 0.85, z], [1.43, 0.85, z], 0.018, finish('steel'));
    const bush = cylinder(wall, 'wall-guide-bushing', 0.035, 0.12, [0.12, 0.85, z], finish('dark-metal'));
    bush.rotation.z = Math.PI / 2;
  }
  housing(root, 'wall-backplate', [0.12, 1.05, 0.76], [1.48, 0.56, 0], 'paint');
  housing(root, 'wall-foot', [0.76, 0.06, 0.92], [1.16, 0.03, 0], 'dark-metal');
  for (const z of [-0.33, 0.33]) housing(root, 'wall-brace', [0.31, 0.30, 0.045], [1.37, 0.20, z], 'aluminium');
  const damper = turned(root, 'wall-damper-body', [[0, -0.15], [0.06, -0.15], [0.06, 0.15], [0, 0.15]], [1.26, 0.47, 0], 'dark-metal');
  damper.rotation.z = Math.PI / 2;
  const piston = rod(root, 'wall-damper-piston', [0.72, 0.47, 0], [1.405, 0.47, 0], 0.022, finish('steel'));
  const springs = [-0.20, 0.20].map(z => {
    const points = Array.from({ length: 97 }, (_, i) => {
      const u = i / 96, angle = u * Math.PI * 12;
      const r = i && i < 96 ? 0.055 : 0;
      return new T.Vector3(u, r * Math.sin(angle), r * Math.cos(angle));
    });
    const spring = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 120, 0.009, 8, false), finish('steel'));
    spring.name = 'wall-compliance'; spring.position.set(0, 0.67, z); spring.castShadow = true;
    root.add(spring); return spring;
  });
  const readouts = [
    { id: 'force', anchor: sensor, label: { en: 'Contact force', ko: '접촉력' }, value: '0.00 N', side: 'right' },
    { id: 'position', anchor: tool, label: { en: 'Actual travel', ko: '실제 변위' }, value: '0.00 mm', side: 'left' },
  ];
  const reference = targetMarker(root, 'command-position', [0, 0.67, 0], 0.15, C.amber);
  reference.rotation.z = Math.PI / 2;
  line(root, 'unloaded-surface', [[0.65, 0.08, -0.44], [0.65, 1.18, -0.44]], C.ink, true);
  const reaction = new T.ArrowHelper(new T.Vector3(-1, 0, 0), new T.Vector3(), 0.3, C.teal, 0.08, 0.06);
  reaction.name = 'contact-force'; root.add(reaction);
  const command = new T.ArrowHelper(new T.Vector3(1, 0, 0), new T.Vector3(), 0.3, C.amber, 0.08, 0.06);
  command.name = 'drive-force'; root.add(command);
  // Contact displacement is enlarged uniformly, including approach. The
  // caption states this; the untouched records retain physical metres/newtons.
  const displayX = x => 0.65 + 12 * Math.max(-0.03, Math.min(0.055, x));
  return {
    root,
    camera: { projection: 'orthographic', position: [-2.6, 2.2, 4.8], target: [0.04, 0.53, 0], span: 3.4 },
    readouts: () => readouts,
    legend: {
      en: 'Single-axis contact model; articulated support stays fixed. Tool travel is enlarged 12 times (clipped on divergence). Teal: contact force; amber: command.',
      ko: '접촉 1축 모델이며 관절 지지대는 고정됩니다. 공구 변위는 12배 확대하며 발산 시 표시 범위를 제한합니다. 청록: 접촉력, 주황: 명령.',
    },
    update(state) {
      if (!state || !Number.isFinite(state.position)) return;
      const tipX = displayX(state.position), faceX = displayX(Math.max(state.wall, state.position));
      tool.position.set(tipX, 0.67, 0);
      wall.position.x = faceX;
      sensor.material.color.setHex(state.mode === 'admittance' ? C.teal : C.light);
      reference.visible = state.mode === 'admittance';
      reference.position.x = displayX(state.reference);
      reaction.visible = state.force > 0.05;
      reaction.position.set(tipX - 0.02, 0.98, 0.22);
      reaction.setLength(Math.min(0.52, 0.12 + Math.abs(state.force) * 0.012), 0.08, 0.06);
      command.visible = state.mode === 'impedance' && Math.abs(state.command) > 0.05;
      command.position.set(tipX - 0.60, 0.43, 0.22);
      command.setDirection(new T.Vector3(state.command < 0 ? -1 : 1, 0, 0));
      command.setLength(Math.min(0.40, 0.10 + Math.abs(state.command) * 0.008), 0.07, 0.055);
      springs.forEach(spring => {
        spring.position.x = faceX + 0.07;
        spring.scale.x = 1.42 - faceX - 0.07;
      });
      setRod(piston, [faceX + 0.065, 0.47, 0], [1.405, 0.47, 0]);
      readouts[0].value = `${state.force.toFixed(2)} N`;
      readouts[1].value = `${(state.position * 1000).toFixed(2)} mm`;
    },
  };
}

export function createResearchModel(id) {
  if (id === 'track') return trackingModel();
  if (id === 'contact') return contactModel();
  throw new Error(`Unknown research apparatus: ${id}`);
}

export function mountResearchView(host, id, options = {}) {
  const view = createView(host, createResearchModel(id), {
    ...options,
    compactControls: true,
    label: id === 'track'
      ? { en: '3D horizontal-plane tracking robot', ko: '3D 수평면 궤적 추종 로봇' }
      : { en: '3D single-axis contact apparatus', ko: '3D 단일축 접촉 장치' },
  });
  if (!view) return null;
  // The composite Research canvas has a smaller apparatus region than a
  // standalone page. Disclose the same shared help/legend without consuming
  // the scene or spilling into either graph. Camera controls remain shared.
  const info = document.createElement('details');
  info.className = 'research-three__info';
  const summary = document.createElement('summary');
  summary.textContent = 'i';
  const body = document.createElement('div');
  body.className = 'research-three__info-body';
  body.append(view.element.querySelector('.three-help'), view.element.querySelector('.three-legend'));
  info.append(summary, body);
  view.element.querySelector('.three-toolbar').prepend(info);
  const language = view.setLanguage;
  view.setLanguage = lang => {
    language(lang);
    summary.setAttribute('aria-label', lang === 'en' ? 'Scene information' : '장치 설명');
    summary.title = lang === 'en' ? 'Scene information' : '장치 설명';
  };
  view.setLanguage(options.lang || document.documentElement.lang);
  return view;
}
