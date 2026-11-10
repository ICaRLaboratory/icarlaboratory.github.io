import * as T from './vendor/three.js';
import { createView } from './three/view.js';
import { C, group, box, cylinder, sphere, rod, line, updateLine, floor, targetMarker } from './three/primitives.js';

// Presentation only: snapshots are copied by the existing controllers. No clock,
// integration or control law lives here, including when the camera is moved.
function pedestal(root, x = 0, z = 0) {
  const base = group('robot-base');
  base.position.set(x, 0, z);
  root.add(base);
  box(base, 'base-plate', [0.44, 0.07, 0.44], [0, 0.035, 0], C.ink);
  cylinder(base, 'base-column', 0.13, 0.40, [0, 0.27, 0], C.light);
  cylinder(base, 'base-collar', 0.16, 0.07, [0, 0.49, 0], C.ink);
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cylinder(base, 'mount-bolt', 0.024, 0.015, [a * 0.15, 0.08, b * 0.15], C.metal);
  }
  return base;
}

function horizontalLink(parent, name, color) {
  const link = group(name);
  parent.add(link);
  box(link, 'link-shell', [0.92, 0.12, 0.19], [0.5, 0, 0], C.light);
  box(link, 'link-inset', [0.66, 0.014, 0.10], [0.5, 0.068, 0], C.ink);
  box(link, 'link-accent', [0.10, 0.018, 0.11], [0.20, 0.078, 0], color);
  for (const x of [0.27, 0.73]) {
    cylinder(link, 'cover-fastener', 0.012, 0.018, [x, 0.081, 0], C.metal);
  }
  return link;
}

function trackingModel() {
  const root = group('research-tracking-robot');
  const stage = floor(root, 3.5, 2.7);
  stage.position.set(0.5, 0, -0.4);
  pedestal(root);
  const shoulder = group('shoulder');
  shoulder.position.y = 0.57;
  root.add(shoulder);
  cylinder(shoulder, 'shoulder-drive', 0.15, 0.15, [0, 0, 0], C.ink);
  cylinder(shoulder, 'shoulder-cap', 0.12, 0.04, [0, 0.10, 0], C.teal);
  const upper = horizontalLink(shoulder, 'upper-link', C.teal);
  const elbow = group('elbow');
  shoulder.add(elbow);
  cylinder(elbow, 'elbow-drive', 0.125, 0.19, [0, 0, 0], C.ink);
  cylinder(elbow, 'elbow-cap', 0.105, 0.04, [0, 0.115, 0], C.amber);
  const lower = horizontalLink(elbow, 'forearm-link', C.amber);
  const tool = group('tool-tip');
  elbow.add(tool);
  cylinder(tool, 'wrist', 0.08, 0.14, [0, 0, 0], C.ink);
  cylinder(tool, 'tool-collar', 0.058, 0.09, [0, -0.12, 0], C.metal);
  cylinder(tool, 'tool-stylus', 0.023, 0.32, [0, -0.32, 0], C.ink);
  sphere(tool, 'tool-point', 0.035, [0, -0.49, 0], C.teal);
  const payload = group('payload');
  tool.add(payload);
  cylinder(payload, 'payload-disc', 0.13, 0.15, [0, 0.13, 0], C.ink);
  cylinder(payload, 'payload-rim', 0.135, 0.025, [0, 0.21, 0], C.metal);
  const reference = line(root, 'target-trajectory', [[0, 0, 0], [0, 0, 0]], C.ink, true);
  const unloaded = line(root, 'unloaded-trajectory', [[0, 0, 0], [0, 0, 0]], C.metal);
  const trail = line(root, 'measured-trajectory', [[0, 0, 0], [0, 0, 0]], C.teal);
  const target = targetMarker(root, 'target', [0, 0.055, 0], 0.065, C.amber);
  let circleKey = '';
  return {
    root,
    camera: { position: [2.8, 3.3, 3.8], target: [0.58, 0.25, -0.43], span: 3.7 },
    legend: {
      en: 'Two-link planar robot. Gray: unloaded measured path; teal: recent loaded path; dashed: reference; amber ring: target. Joint colors match the graphs.',
      ko: '평면 2관절 로봇. 회색: 무부하 실제 궤적, 청록: 최근 부하 궤적, 점선: 기준 궤적, 주황 고리: 목표점. 관절색은 그래프와 같습니다.',
    },
    update(state) {
      if (!state || !state.q.every(Number.isFinite)) return;
      const [l1, l2] = state.lengths;
      shoulder.rotation.y = -state.q[0];
      upper.scale.x = l1;
      elbow.position.set(l1, 0.06, 0);
      elbow.rotation.y = -state.q[1];
      lower.scale.x = l2;
      tool.position.set(l2, 0, 0);
      payload.visible = state.payload > 0;
      payload.scale.setScalar(state.payload > 0 ? Math.sqrt(state.payload / 20) : 1);
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
  floor(root, 3.6, 1.8);
  pedestal(root, -1.2);
  // The articulated support is FIXED. Only the existing plant's single
  // prismatic coordinate moves; there is no invented multi-joint dynamics.
  const support = group('fixed-articulated-support');
  root.add(support);
  const joints = [[-1.2, 0.57, 0], [-0.90, 1.12, 0], [-0.32, 0.67, 0]];
  for (let i = 0; i < joints.length; i++) {
    const joint = cylinder(support, `support-joint-${i}`, 0.115, 0.18, joints[i], C.ink);
    joint.rotation.x = Math.PI / 2;
    const cap = cylinder(support, `support-cap-${i}`, 0.082, 0.025,
      [joints[i][0], joints[i][1], 0.105], C.light);
    cap.rotation.x = Math.PI / 2;
    if (i) {
      rod(support, `support-link-${i}`, joints[i - 1], joints[i], 0.075, C.light);
      const start = joints[i - 1].map((v, j) => j === 2 ? v + 0.065 : v);
      const end = joints[i].map((v, j) => j === 2 ? v + 0.065 : v);
      rod(support, `support-rib-${i}`, start, end, 0.023, C.metal);
    }
  }
  box(root, 'linear-axis-mount', [0.22, 0.38, 0.38], [-0.34, 0.67, 0], C.ink);
  for (const z of [-0.115, 0.115]) {
    rod(root, 'linear-guide', [-0.25, 0.67, z], [0.64, 0.67, z], 0.023, C.metal);
  }
  const tool = group('tool-tip');
  root.add(tool);
  box(tool, 'carriage', [0.24, 0.24, 0.32], [-0.32, 0, 0], C.light);
  rod(tool, 'tool-shaft', [-0.20, 0, 0], [-0.07, 0, 0], 0.055, C.metal);
  const sensor = cylinder(tool, 'force-sensor', 0.10, 0.065, [-0.07, 0, 0], C.teal);
  sensor.rotation.z = Math.PI / 2;
  box(tool, 'contact-pad', [0.035, 0.22, 0.27], [-0.0175, 0, 0], C.ink);
  const wall = group('contact-wall');
  root.add(wall);
  box(wall, 'wall-face', [0.065, 0.94, 0.65], [0.0325, 0.58, 0], C.light);
  box(wall, 'wall-face-inset', [0.012, 0.60, 0.45], [-0.006, 0.65, 0], C.metal);
  box(root, 'wall-backplate', [0.12, 1.05, 0.76], [1.48, 0.56, 0], C.ink);
  box(root, 'wall-foot', [0.76, 0.06, 0.92], [1.16, 0.03, 0], C.ink);
  const springs = [-0.20, 0.20].map(z => line(root, 'wall-compliance', [[0, 0, z], [1, 0, z]], C.metal));
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
    camera: { position: [-2.6, 2.2, 4.8], target: [0.12, 0.53, 0], span: 3.2 },
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
      springs.forEach((spring, i) => updateLine(spring, Array.from({ length: 33 }, (_, j) => {
        const u = j / 32, z = i ? 0.20 : -0.20;
        return [faceX + 0.07 + (1.42 - faceX - 0.07) * u,
          0.58 + (j && j < 32 ? (j % 2 ? 0.06 : -0.06) : 0), z];
      })));
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
      ? { en: '3D planar tracking robot', ko: '3D 평면 궤적 추종 로봇' }
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
