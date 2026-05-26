import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";

const sceneEl = document.querySelector("#scene");
const targetReadout = document.querySelector("#target-readout");
const equationEl = document.querySelector("#equation");
const answerEl = document.querySelector("#answer");
const statusPill = document.querySelector("#status-pill");
const presetGrid = document.querySelector("#preset-grid");
const scoreReadout = document.querySelector("#score-readout");
const solvedReadout = document.querySelector("#solved-readout");
const streakReadout = document.querySelector("#streak-readout");
const missionTitle = document.querySelector("#mission-title");
const missionBrief = document.querySelector("#mission-brief");
const allowNegativeEl = document.querySelector("#allow-negative");
const mSlider = document.querySelector("#m-slider");
const nSlider = document.querySelector("#n-slider");
const mReadout = document.querySelector("#m-readout");
const nReadout = document.querySelector("#n-readout");
const inputs = {
  ux: document.querySelector("#ux"),
  uy: document.querySelector("#uy"),
  uz: document.querySelector("#uz"),
  vx: document.querySelector("#vx"),
  vy: document.querySelector("#vy"),
  vz: document.querySelector("#vz")
};

const colors = {
  u: 0x7a5ad7,
  v: 0xe1a025,
  target: 0xf05050,
  route: 0x58d3a3,
  grid: 0x7c908d
};

const START_M = 0;
const START_N = 0;

const modes = {
  "3d": {
    target: [18, 16, 10],
    presets: [
      { name: "Mission A", u: [3, 1, 1], v: [1, 2, 1], brief: "Find a whole-number route to open the treasure." },
      { name: "Mission B", u: [5, 1, 1], v: [2, 3, 2], brief: "Decide whether this route can be solved with whole button presses." },
      { name: "Mission C", u: [2, 4, 1], v: [1, 2, 3], brief: "Investigate the movement sheet before you submit." },
      { name: "Mission D", u: [2, 1, 1], v: [-1, 3, 0], brief: "This one may need brave thinking about direction." },
      { name: "Mission E", u: [2, 4, 2], v: [1, 2, 1], brief: "Look carefully at whether the two buttons really give two directions." },
      { name: "Mission F", u: [4, 0, 2], v: [1, 4, 1], brief: "Hunt for a route, or prove the code cannot be whole." }
    ]
  },
  worksheet: {
    target: [18, 16, 0],
    presets: [
      { name: "Set 1", u: [3, 1, 0], v: [1, 2, 0], brief: "Match the original worksheet target with whole button presses." },
      { name: "Set 2", u: [4, 2, 0], v: [1, 1, 0], brief: "Use the grid to search for a whole-number code." },
      { name: "Set 3", u: [5, 1, 0], v: [2, 3, 0], brief: "A route may look possible before whole numbers are checked." },
      { name: "Set 4", u: [2, 4, 0], v: [1, 2, 0], brief: "Watch for parallel buttons." },
      { name: "Set 5", u: [4, 0, 0], v: [1, 4, 0], brief: "Check whether both coordinates can be matched exactly." },
      { name: "Set 6", u: [2, 1, 0], v: [-1, 3, 0], brief: "Negative x movement can still help." }
    ]
  }
};

let state = {
  mode: "worksheet",
  target: [...modes.worksheet.target],
  u: [3, 1, 0],
  v: [1, 2, 0],
  activeIndex: 0,
  m: START_M,
  n: START_N,
  clueLevel: 0,
  checked: false,
  score: 0,
  streak: 0,
  attempts: 0,
  message: "",
  solved: new Set(),
  animating: false,
  animationStart: 0
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sceneEl.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);
scene.fog = new THREE.Fog(0x101820, 720, 1600);

const perspectiveCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
perspectiveCamera.position.set(28, 22, 58);

const orthographicCamera = new THREE.OrthographicCamera(-24, 24, 24, -24, 0.1, 2000);
orthographicCamera.position.set(10, 10, 60);

let activeCamera = orthographicCamera;

const controls = new OrbitControls(activeCamera, renderer.domElement);
controls.target.set(8, 6, 3);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 10;
controls.maxDistance = 520;
controls.minZoom = 0.55;
controls.maxZoom = 3.2;

scene.add(new THREE.HemisphereLight(0xf4fff8, 0x22333a, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(18, 30, 14);
scene.add(sun);

const root = new THREE.Group();
scene.add(root);

const routeGroup = new THREE.Group();
const latticeGroup = new THREE.Group();
const planeGroup = new THREE.Group();
root.add(planeGroup, latticeGroup, routeGroup);

const robot = makeRobot();
root.add(robot);

const treasure = makeTreasure();
root.add(treasure);

const targetLine = makeLine([0, 0, 0], state.target, colors.target, 0.045);
targetLine.visible = false;
root.add(targetLine);

const targetMarker = new THREE.Group();
root.add(targetMarker);
const originMarker = new THREE.Group();
root.add(originMarker);

const axes = makeAxes();
root.add(axes);

function vec(arr) {
  return new THREE.Vector3(arr[0], arr[1], arr[2]);
}

function fromSceneVec(v) {
  return [v.x, v.y, v.z];
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function scale(a, s) {
  return a.map((value) => value * s);
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function sub(a, b) {
  return a.map((value, index) => value - b[index]);
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function makeCylinderBetween(start, end, color, radius = 0.035) {
  const a = vec(start);
  const b = vec(end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, Math.max(length, 0.001), 10);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).add(direction.multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function makeConeAt(start, end, color, size = 0.26) {
  const a = vec(start);
  const b = vec(end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(size, size * 2.2, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08 })
  );
  cone.position.copy(b);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return cone;
}

function makeArrow(start, end, color, radius = 0.045) {
  const group = new THREE.Group();
  if (norm(sub(end, start)) < 0.001) return group;
  group.add(makeCylinderBetween(start, end, color, radius));
  group.add(makeConeAt(start, end, color, radius * 5));
  return group;
}

function makeLine(start, end, color, radius) {
  return makeCylinderBetween(start, end, color, radius);
}

function makeTextSprite(text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 384;
  canvas.height = 128;
  context.font = "800 42px Inter, Arial, sans-serif";
  context.fillStyle = color;
  context.strokeStyle = "rgba(0,0,0,0.45)";
  context.lineWidth = 8;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.strokeText(text, 192, 64);
  context.fillText(text, 192, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.6, 1.85, 1);
  return sprite;
}

function makeTargetSprite() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 256;
  const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 112);
  gradient.addColorStop(0, "#fff6b8");
  gradient.addColorStop(0.36, "#f5b83f");
  gradient.addColorStop(0.38, "#e33f3f");
  gradient.addColorStop(0.7, "#e33f3f");
  gradient.addColorStop(0.72, "rgba(227,63,63,0.18)");
  gradient.addColorStop(1, "rgba(227,63,63,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(128, 128, 118, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#172126";
  context.font = "900 86px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("T", 128, 132);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.4, 4.4, 1);
  return sprite;
}

function makeOriginSprite() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 196;
  canvas.height = 196;
  const gradient = context.createRadialGradient(98, 98, 10, 98, 98, 80);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.5, "#c2e6ff");
  gradient.addColorStop(1, "rgba(194,230,255,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(98, 98, 86, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#0f1a20";
  context.font = "900 74px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("O", 98, 102);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.8, 2.8, 1);
  return sprite;
}

function makeGrid(size = 120, step = 2) {
  const group = new THREE.Group();
  const minor = new THREE.LineBasicMaterial({ color: 0x2f4f58, transparent: true, opacity: 0.76 });
  const major = new THREE.LineBasicMaterial({ color: 0x5b8990, transparent: true, opacity: 0.98 });
  for (let value = -size; value <= size; value += step) {
    const material = value % 10 === 0 ? major : minor;
    const xLine = new THREE.BufferGeometry().setFromPoints([
      vec([value, -size, -0.04]),
      vec([value, size, -0.04])
    ]);
    const yLine = new THREE.BufferGeometry().setFromPoints([
      vec([-size, value, -0.04]),
      vec([size, value, -0.04])
    ]);
    group.add(new THREE.Line(xLine, material));
    group.add(new THREE.Line(yLine, material));
  }
  return group;
}

function makeAxes() {
  const group = new THREE.Group();
  group.add(makeGrid());
  group.add(makeCylinderBetween([-24, 0, 0], [0, 0, 0], 0xc5ecff, 0.032));
  group.add(makeCylinderBetween([0, -24, 0], [0, 0, 0], 0xb9fac5, 0.032));
  group.add(makeArrow([0, 0, 0], [124, 0, 0], 0xc5ecff, 0.052));
  group.add(makeArrow([0, 0, 0], [0, 124, 0], 0xb9fac5, 0.052));

  const zAxis = new THREE.Group();
  zAxis.add(makeArrow([0, 0, 0], [0, 0, 44], 0xffd180, 0.048));
  const labels = [
    ["x", [126, 0, 0], "#bce7ff"],
    ["y", [0, 126, 0], "#c5f7cf"],
    ["O", [-1.4, -1.4, 0], "#ffffff"]
  ];
  labels.forEach(([text, position, color]) => {
    const sprite = makeTextSprite(text, color);
    sprite.position.copy(vec(position));
    group.add(sprite);
  });
  const zLabel = makeTextSprite("z", "#ffe0a8");
  zLabel.position.copy(vec([0, 0, 46]));
  zAxis.add(zLabel);
  group.add(zAxis);
  group.userData.zAxis = zAxis;
  return group;
}

function updateAxes() {
  clearGroup(axes);
  const freshAxes = makeAxes();
  axes.userData.zAxis = freshAxes.userData.zAxis;
  while (freshAxes.children.length) axes.add(freshAxes.children.shift());
  if (axes.userData.zAxis) axes.userData.zAxis.visible = state.mode === "3d";
}

function makeRobot() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x65d0ee, roughness: 0.35, metalness: 0.15 })
  );
  body.position.z = 0.62;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.5, 0.58),
    new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.38 })
  );
  head.position.y = 0.18;
  head.position.z = 1.35;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x13242a, emissive: 0x1bbde0, emissiveIntensity: 0.35 });
  [-0.17, 0.17].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), eyeMat);
    eye.position.set(x, 0.23, 1.68);
    group.add(eye);
  });
  group.add(body, head);
  return group;
}

function makeTreasure() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.72, 1),
    new THREE.MeshStandardMaterial({ color: 0xd99a00, roughness: 0.32, metalness: 0.28 })
  );
  base.position.z = 0.5;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.24, 1.06),
    new THREE.MeshStandardMaterial({ color: 0xffc245, roughness: 0.24, metalness: 0.35 })
  );
  lid.position.z = 1.08;
  const glow = new THREE.PointLight(0xffc33a, 3.5, 10);
  glow.position.z = 1.5;
  group.add(base, lid, glow);
  return group;
}

function makeTargetBeacon() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.065, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0xff5252, emissive: 0x641515, emissiveIntensity: 0.28, roughness: 0.28 })
  );
  ring.position.z = 0.08;

  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xe9a922, emissiveIntensity: 0.32, roughness: 0.38 })
  );
  pin.position.z = 0.18;

  group.add(ring, pin);
  return group;
}

function updateTargetMarker() {
  clearGroup(targetMarker);
  const beacon = makeTargetBeacon();
  const badge = makeTargetSprite();
  badge.position.copy(vec([0, 0, state.mode === "worksheet" ? 0.65 : 1]));
  const labelText = state.mode === "worksheet"
    ? `T (${state.target[0]}, ${state.target[1]})`
    : `T (${state.target.join(", ")})`;
  const label = makeTextSprite(labelText, "#ffe8a3");
  label.position.copy(vec(state.mode === "worksheet" ? [-5.2, 2.6, 0.9] : [-5.6, 2.8, 2.2]));
  label.scale.set(state.mode === "worksheet" ? 8.4 : 9.2, 2.2, 1);
  targetMarker.position.copy(vec(state.target));
  targetMarker.add(beacon, badge, label);
  targetMarker.userData.beacon = beacon;
}

function updateOriginMarker() {
  clearGroup(originMarker);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 12, 34),
    new THREE.MeshStandardMaterial({ color: 0xc5ecff, emissive: 0x1f2c3c, emissiveIntensity: 0.34, roughness: 0.4 })
  );
  ring.position.copy(vec([0, 0, 0.06]));
  const badge = makeOriginSprite();
  badge.position.copy(vec([0, 0, 0.5]));
  const label = makeTextSprite("O (0, 0, 0)", "#d3efff");
  label.position.copy(vec([-3.7, -1.7, 0.9]));
  label.scale.set(6.8, 1.9, 1);
  originMarker.add(ring, badge, label);
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) node.material.dispose();
    });
  }
}

function solveReal(u, v, t) {
  const uu = dot(u, u);
  const vv = dot(v, v);
  const uv = dot(u, v);
  const det = uu * vv - uv * uv;
  const parallel = norm(cross(u, v)) < 1e-8;
  if (det < 1e-8) {
    const base = uu > 1e-8 ? u : v;
    const baseDot = dot(base, base);
    if (baseDot < 1e-8) return { parallel: true, exists: norm(t) < 1e-8, m: 0, n: 0, residual: norm(t) };
    const k = dot(t, base) / baseDot;
    const projection = scale(base, k);
    return { parallel: true, exists: norm(sub(t, projection)) < 1e-6, m: uu > 1e-8 ? k : 0, n: uu > 1e-8 ? 0 : k, residual: norm(sub(t, projection)) };
  }
  const ut = dot(u, t);
  const vt = dot(v, t);
  const m = (ut * vv - vt * uv) / det;
  const n = (vt * uu - ut * uv) / det;
  const reached = add(scale(u, m), scale(v, n));
  const residual = norm(sub(t, reached));
  return { parallel, exists: residual < 1e-6, m, n, residual };
}

function findWholeSolution(u, v, t, allowNegative) {
  const min = allowNegative ? -20 : 0;
  let best = { m: 0, n: 0, distance: Infinity, point: [0, 0, 0] };
  for (let m = min; m <= 20; m += 1) {
    for (let n = min; n <= 20; n += 1) {
      const point = add(scale(u, m), scale(v, n));
      const distance = norm(sub(t, point));
      if (distance < best.distance) best = { m, n, distance, point };
      if (distance < 1e-8) return { exact: true, m, n, distance, point };
    }
  }
  return { exact: false, ...best };
}

function currentPoint() {
  return add(scale(state.u, state.m), scale(state.v, state.n));
}

function activeChallenge() {
  return modes[state.mode].presets[state.activeIndex];
}

function challengeKey(index = state.activeIndex) {
  return `${state.mode}:${modes[state.mode].presets[index].name}`;
}

function isSolved(index = state.activeIndex) {
  return state.solved.has(challengeKey(index));
}

function resetPuzzleProgress() {
  state.clueLevel = 0;
  state.checked = false;
  state.attempts = 0;
  state.message = "";
}

function getWorldPoints() {
  const point = currentPoint();
  const uEnd = scale(state.u, state.m);
  const points = [
    [0, 0, 0],
    state.target,
    point,
    state.u,
    state.v,
    uEnd,
    add(point, [2, 2, 0]),
    sub(point, [2, 2, 0])
  ];
  if (state.mode === "3d") {
    points.push([0, 0, 26]);
    points.push([state.target[0], state.target[1], 0]);
    points.push(add(point, [2, 2, 2]));
    points.push(sub(point, [2, 2, 2]));
  }
  return points;
}

function setActiveCameraForMode() {
  const nextCamera = state.mode === "worksheet" ? orthographicCamera : perspectiveCamera;
  if (activeCamera === nextCamera) return;
  activeCamera = nextCamera;
  controls.object = activeCamera;
}

function frameScene() {
  setActiveCameraForMode();
  const box = new THREE.Box3();
  getWorldPoints().forEach((point) => box.expandByPoint(vec(point)));
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  if (state.mode === "worksheet") {
    const rect = sceneEl.getBoundingClientRect();
    const aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
    const halfWidth = Math.max(size.x * 0.5 + 6, 18);
    const halfHeight = Math.max(size.y * 0.5 + 5, 16);
    const frustumHalfWidth = Math.max(halfWidth, halfHeight * aspect);
    const frustumHalfHeight = frustumHalfWidth / aspect;
    const distance = Math.max(size.z + 40, 60);

    orthographicCamera.left = -frustumHalfWidth;
    orthographicCamera.right = frustumHalfWidth;
    orthographicCamera.top = frustumHalfHeight;
    orthographicCamera.bottom = -frustumHalfHeight;
    orthographicCamera.up.set(0, 1, 0);
    orthographicCamera.position.set(center.x, center.y, distance);
    orthographicCamera.near = 0.1;
    orthographicCamera.far = 2000;
    orthographicCamera.zoom = 1;
    orthographicCamera.updateProjectionMatrix();

    controls.target.set(center.x, center.y, 0);
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minZoom = 0.55;
    controls.maxZoom = 3.2;
    controls.update();
    return;
  }

  const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * perspectiveCamera.aspect);
  perspectiveCamera.up.set(0, 1, 0);
  const fitFov = Math.min(verticalFov, horizontalFov);
  const radius = Math.max(size.length() * 0.45, 16);
  let distance = Math.min(Math.max((radius / Math.sin(fitFov / 2)) * 1.16, 42), 190);
  const direction = new THREE.Vector3(0.86, 0.8, 1.12).normalize();

  // Keep origin and treasure clearly inside frame in 3D at reset.
  const mustSee = [new THREE.Vector3(0, 0, 0), vec(state.target), vec(currentPoint())];
  for (let step = 0; step < 24; step += 1) {
    perspectiveCamera.position.copy(center).add(direction.clone().multiplyScalar(distance));
    perspectiveCamera.lookAt(center);
    perspectiveCamera.near = Math.max(0.1, distance / 180);
    perspectiveCamera.far = 2000;
    perspectiveCamera.updateProjectionMatrix();

    let maxEdge = 0;
    for (const point of mustSee) {
      const projected = point.clone().project(perspectiveCamera);
      maxEdge = Math.max(maxEdge, Math.abs(projected.x), Math.abs(projected.y));
    }
    if (maxEdge <= 0.84) break;
    distance *= 1.08;
  }

  controls.target.copy(center);
  perspectiveCamera.position.copy(center).add(direction.multiplyScalar(distance));
  perspectiveCamera.near = Math.max(0.1, distance / 180);
  perspectiveCamera.far = 2000;
  perspectiveCamera.updateProjectionMatrix();
  controls.enableRotate = true;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = Math.max(14, distance * 0.52);
  controls.maxDistance = Math.max(260, distance * 5.8);
  controls.update();
}

function drawReachableWorld() {
  clearGroup(latticeGroup);
  clearGroup(planeGroup);
  const min = allowNegativeEl.checked ? -6 : 0;
  const max = allowNegativeEl.checked ? 8 : 10;
  const pointGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const pointMat = new THREE.MeshStandardMaterial({ color: 0xdce8e1, roughness: 0.65 });
  for (let m = min; m <= max; m += 1) {
    for (let n = min; n <= max; n += 1) {
      const p = add(scale(state.u, m), scale(state.v, n));
      if (Math.abs(p[0]) <= 32 && Math.abs(p[1]) <= 32 && Math.abs(p[2]) <= 24) {
        const dotMesh = new THREE.Mesh(pointGeo, pointMat);
        dotMesh.position.copy(vec(p));
        latticeGroup.add(dotMesh);
      }
    }
  }

  const crossLen = norm(cross(state.u, state.v));
  if (crossLen > 1e-6) {
    const s = 7;
    const corners = [
      add(scale(state.u, -s), scale(state.v, -s)),
      add(scale(state.u, s), scale(state.v, -s)),
      add(scale(state.u, s), scale(state.v, s)),
      add(scale(state.u, -s), scale(state.v, s))
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(corners.map(vec));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2b6f75,
      transparent: true,
      opacity: state.mode === "worksheet" ? 0.08 : 0.16,
      side: THREE.DoubleSide,
      roughness: 0.7
    });
    planeGroup.add(new THREE.Mesh(geo, mat));
  }
}

function drawRoute(progress = 1) {
  clearGroup(routeGroup);
  const uEnd = scale(state.u, state.m);
  const final = currentPoint();
  const routeProgress = progress;
  const uProgress = Math.min(routeProgress * 2, 1);
  const vProgress = Math.max(routeProgress * 2 - 1, 0);
  routeGroup.add(makeArrow([0, 0, 0], scale(uEnd, uProgress), colors.u, 0.06));
  if (vProgress > 0) {
    routeGroup.add(makeArrow(uEnd, add(uEnd, scale(scale(state.v, state.n), vProgress)), colors.v, 0.06));
  }
  routeGroup.add(makeArrow([0, 0, 0], state.u, colors.u, 0.035));
  routeGroup.add(makeArrow([0, 0, 0], state.v, colors.v, 0.035));
  robot.position.copy(vec(routeProgress < 0.5 ? scale(uEnd, uProgress) : add(uEnd, scale(scale(state.v, state.n), vProgress))));
  treasure.position.copy(vec(state.target));
  targetLine.geometry?.dispose();
  const newLine = makeLine([0, 0, 0], state.target, colors.target, 0.032);
  targetLine.geometry = newLine.geometry;
  targetLine.material = newLine.material;
  targetLine.visible = false;
}

function updateUi() {
  inputs.ux.textContent = state.u[0];
  inputs.uy.textContent = state.u[1];
  inputs.uz.textContent = state.u[2];
  inputs.vx.textContent = state.v[0];
  inputs.vy.textContent = state.v[1];
  inputs.vz.textContent = state.v[2];
  mSlider.value = state.m;
  nSlider.value = state.n;
  mReadout.textContent = state.m;
  nReadout.textContent = state.n;
  targetReadout.textContent = state.mode === "worksheet" ? `(${state.target[0]}, ${state.target[1]})` : `(${state.target.join(", ")})`;
  missionTitle.textContent = activeChallenge().name;
  missionBrief.textContent = activeChallenge().brief;
  scoreReadout.textContent = state.score;
  streakReadout.textContent = state.streak;
  solvedReadout.textContent = `${modes[state.mode].presets.filter((_, index) => isSolved(index)).length} / ${modes[state.mode].presets.length}`;
  const p = currentPoint();
  const distance = norm(sub(p, state.target));
  const exactCurrent = distance < 1e-8;
  equationEl.textContent = state.mode === "worksheet"
    ? `${state.m}u + ${state.n}v = (${round(p[0])}, ${round(p[1])})`
    : `${state.m}u + ${state.n}v = (${p.map((x) => round(x)).join(", ")})`;
  document.body.classList.toggle("is-2d", state.mode === "worksheet");

  if (isSolved()) {
    statusPill.textContent = "Challenge solved";
  } else if (exactCurrent) {
    statusPill.textContent = "Treasure unlocked";
  } else if (state.checked) {
    statusPill.textContent = `${round(distance)} units away`;
  } else {
    statusPill.textContent = "Puzzle locked";
  }

  let message = "";
  if (state.message) {
    message = state.message;
  } else if (isSolved()) {
    message = `<strong class="ok">Solved.</strong> Choose another challenge from the board, or switch mode for a new set.`;
  } else if (exactCurrent) {
    message = `<strong class="ok">Unlocked.</strong> Submit this route to score the challenge.`;
  } else if (!state.checked && state.clueLevel === 0) {
    message = `Choose whole-number values for m and n. Submit a route if it reaches T, or claim impossible if you can justify that no whole-number code works.`;
  } else if (state.clueLevel === 0) {
    message = `<strong class="warn">Not yet.</strong> Your current landing point is ${round(distance)} units from the treasure. Use the landing point to decide which coordinate needs to change.`;
  } else if (state.clueLevel === 1) {
    message = state.mode === "worksheet"
      ? `<strong class="warn">Clue 1.</strong> Compare your landing point with T coordinate by coordinate. Is x or y too small or too large?`
      : `<strong class="warn">Clue 1.</strong> Compare your landing point with T coordinate by coordinate. Which of x, y, and z is too small or too large?`;
  } else if (state.clueLevel === 2) {
    message = `<strong class="warn">Clue 2.</strong> Try making a small table of attempts. If every whole-number route misses in a pattern, the best move may be to claim impossible.`;
  } else {
    message = state.mode === "worksheet"
      ? `<strong class="warn">Clue 3.</strong> Use the x and y equations. A legal code must make both coordinates match T at the same time, using whole numbers only.`
      : `<strong class="warn">Clue 3.</strong> Use the coordinate equations. A legal code must make x, y, and z match T at the same time, using whole numbers only.`;
  }
  answerEl.innerHTML = message;
}

function round(value) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function awardChallenge(kind) {
  if (isSolved()) {
    state.message = `<strong class="ok">Already solved.</strong> Pick a new challenge to keep scoring.`;
    return 0;
  }

  const cluePenalty = state.clueLevel * 10;
  const attemptPenalty = Math.max(0, state.attempts - 1) * 5;
  const streakBonus = Math.min(state.streak * 5, 20);
  const base = kind === "route" ? 100 : 80;
  const points = Math.max(25, base - cluePenalty - attemptPenalty + streakBonus);
  state.score += points;
  state.streak += 1;
  state.solved.add(challengeKey());
  state.message = `<strong class="ok">+${points} points.</strong> Challenge solved. Streak bonus is now active for the next mission.`;
  renderPresets();
  return points;
}

function submitRoute() {
  state.checked = true;
  state.attempts += 1;
  state.animating = true;
  state.animationStart = performance.now();

  const distance = norm(sub(currentPoint(), state.target));
  if (distance < 1e-8) {
    awardChallenge("route");
  } else {
    state.streak = 0;
    state.message = `<strong class="warn">Route rejected.</strong> You landed ${round(distance)} units away from T. Adjust m and n, then submit again.`;
  }

  updateUi();
}

function claimImpossible() {
  state.checked = true;
  state.attempts += 1;
  const whole = findWholeSolution(state.u, state.v, state.target, allowNegativeEl.checked);

  if (!whole.exact) {
    const points = awardChallenge("impossible");
    const real = solveReal(state.u, state.v, state.target);
    const reason = real.exists
      ? "Decimal presses can reach T, but the button code is not made of whole numbers."
      : real.parallel
        ? "The two buttons are parallel, so the robot is trapped on one line."
        : "The target is outside the movement plane made by the two buttons.";
    state.message = `<strong class="ok">+${points} points.</strong> Correct impossible claim. ${reason}`;
  } else {
    state.streak = 0;
    state.message = `<strong class="bad">Claim rejected.</strong> A whole-number route exists in the game range. Keep searching before you spend another attempt.`;
  }

  refresh();
}

function syncStateFromInputs() {
  state.m = Number(mSlider.value);
  state.n = Number(nSlider.value);
  state.checked = false;
  state.message = "";
  refresh();
}

function refresh() {
  updateUi();
  updateAxes();
  updateTargetMarker();
  updateOriginMarker();
  drawReachableWorld();
  drawRoute(1);
  frameScene();
}

function setPreset(preset, index) {
  state.activeIndex = index;
  state.u = [...preset.u];
  state.v = [...preset.v];
  state.m = START_M;
  state.n = START_N;
  resetPuzzleProgress();
  refresh();
}

function renderPresets() {
  presetGrid.innerHTML = "";
  modes[state.mode].presets.forEach((preset) => {
    const button = document.createElement("button");
    button.className = ["preset", preset === activeChallenge() ? "active" : "", isSolved(modes[state.mode].presets.indexOf(preset)) ? "solved" : ""].filter(Boolean).join(" ");
    button.type = "button";
    button.innerHTML = `<strong>${preset.name}</strong><span>${isSolved(modes[state.mode].presets.indexOf(preset)) ? "Solved" : "Unsolved challenge"}</span>`;
    button.addEventListener("click", () => setPreset(preset, modes[state.mode].presets.indexOf(preset)));
    presetGrid.append(button);
  });
}

mSlider.addEventListener("input", syncStateFromInputs);
nSlider.addEventListener("input", syncStateFromInputs);
document.querySelector("#m-minus").addEventListener("click", () => adjustPress("m", -1));
document.querySelector("#m-plus").addEventListener("click", () => adjustPress("m", 1));
document.querySelector("#n-minus").addEventListener("click", () => adjustPress("n", -1));
document.querySelector("#n-plus").addEventListener("click", () => adjustPress("n", 1));
allowNegativeEl.addEventListener("change", () => {
  mSlider.min = allowNegativeEl.checked ? -20 : 0;
  nSlider.min = allowNegativeEl.checked ? -20 : 0;
  if (!allowNegativeEl.checked) {
    state.m = Math.max(0, state.m);
    state.n = Math.max(0, state.n);
  }
  resetPuzzleProgress();
  refresh();
});

function adjustPress(which, change) {
  const slider = which === "m" ? mSlider : nSlider;
  const min = Number(slider.min);
  const max = Number(slider.max);
  state[which] = Math.max(min, Math.min(max, state[which] + change));
  state.checked = false;
  state.message = "";
  refresh();
}

document.querySelector("#animate-route").addEventListener("click", submitRoute);

document.querySelector("#impossible-button").addEventListener("click", claimImpossible);

document.querySelector("#clue-button").addEventListener("click", () => {
  state.checked = true;
  state.clueLevel = Math.min(state.clueLevel + 1, 3);
  state.message = "";
  refresh();
});

document.querySelector("#swap").addEventListener("click", () => {
  [state.u, state.v] = [state.v, state.u];
  [state.m, state.n] = [state.n, state.m];
  resetPuzzleProgress();
  refresh();
});

document.querySelector("#randomize").addEventListener("click", () => {
  state.activeIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.solved = new Set();
  const first = modes[state.mode].presets[0];
  state.u = [...first.u];
  state.v = [...first.v];
  state.m = START_M;
  state.n = START_N;
  resetPuzzleProgress();
  renderPresets();
  refresh();
});

document.querySelector("#reset-camera").addEventListener("click", () => {
  frameScene();
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.mode = button.dataset.mode;
    state.target = [...modes[state.mode].target];
    const first = modes[state.mode].presets[0];
    state.activeIndex = 0;
    state.u = [...first.u];
    state.v = [...first.v];
    state.m = START_M;
    state.n = START_N;
    resetPuzzleProgress();
    renderPresets();
    refresh();
  });
});

function resize() {
  const rect = sceneEl.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  perspectiveCamera.aspect = rect.width / Math.max(rect.height, 1);
  perspectiveCamera.updateProjectionMatrix();
  frameScene();
}

window.addEventListener("resize", resize);
renderPresets();
refresh();
resize();

function animate(now) {
  requestAnimationFrame(animate);
  controls.update();
  treasure.rotation.y += 0.012;
  robot.rotation.y = Math.sin(now * 0.002) * 0.2;
  if (targetMarker.userData.beacon) targetMarker.userData.beacon.lookAt(activeCamera.position);
  if (state.animating) {
    const progress = Math.min((now - state.animationStart) / 2200, 1);
    drawRoute(ease(progress));
    if (progress >= 1) state.animating = false;
  }
  renderer.render(scene, activeCamera);
}

function ease(t) {
  return 1 - Math.pow(1 - t, 3);
}

requestAnimationFrame(animate);
