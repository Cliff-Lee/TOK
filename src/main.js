import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";

const sceneEl = document.querySelector("#scene");
const targetReadout = document.querySelector("#target-readout");
const equationEl = document.querySelector("#equation");
const answerEl = document.querySelector("#answer");
const statusPill = document.querySelector("#status-pill");
const presetGrid = document.querySelector("#preset-grid");
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
      { name: "Mission A", u: [3, 1, 1], v: [1, 2, 1] },
      { name: "Mission B", u: [5, 1, 1], v: [2, 3, 2] },
      { name: "Mission C", u: [2, 4, 1], v: [1, 2, 3] },
      { name: "Mission D", u: [2, 1, 1], v: [-1, 3, 0] },
      { name: "Mission E", u: [2, 4, 2], v: [1, 2, 1] },
      { name: "Mission F", u: [4, 0, 2], v: [1, 4, 1] }
    ]
  },
  worksheet: {
    target: [18, 16, 0],
    presets: [
      { name: "Set 1", u: [3, 1, 0], v: [1, 2, 0] },
      { name: "Set 2", u: [4, 2, 0], v: [1, 1, 0] },
      { name: "Set 3", u: [5, 1, 0], v: [2, 3, 0] },
      { name: "Set 4", u: [2, 4, 0], v: [1, 2, 0] },
      { name: "Set 5", u: [4, 0, 0], v: [1, 4, 0] },
      { name: "Set 6", u: [2, 1, 0], v: [-1, 3, 0] }
    ]
  }
};

let state = {
  mode: "3d",
  target: [...modes["3d"].target],
  u: [3, 1, 1],
  v: [1, 2, 1],
  m: START_M,
  n: START_N,
  clueLevel: 0,
  checked: false,
  animating: false,
  animationStart: 0
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sceneEl.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);
scene.fog = new THREE.Fog(0x101820, 40, 110);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
camera.position.set(36, 32, 42);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(8, 6, 3);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

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
root.add(targetLine);

const axes = makeAxes();
root.add(axes);

function vec(arr) {
  return new THREE.Vector3(arr[0], arr[2], arr[1]);
}

function fromSceneVec(v) {
  return [v.x, v.z, v.y];
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
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.6, 1.85, 1);
  return sprite;
}

function makeAxes() {
  const group = new THREE.Group();
  group.add(makeArrow([0, 0, 0], [26, 0, 0], 0x9fd6ff, 0.035));
  group.add(makeArrow([0, 0, 0], [0, 24, 0], 0xa7f0b9, 0.035));
  group.add(makeArrow([0, 0, 0], [0, 0, 18], 0xffd180, 0.035));
  const labels = [
    ["x", [27.2, 0, 0], "#bce7ff"],
    ["y", [0, 25.2, 0], "#c5f7cf"],
    ["z", [0, 0, 19.2], "#ffe0a8"],
    ["O", [-1.1, -1.1, 0], "#ffffff"]
  ];
  labels.forEach(([text, position, color]) => {
    const sprite = makeTextSprite(text, color);
    sprite.position.copy(vec(position));
    group.add(sprite);
  });

  const grid = new THREE.GridHelper(44, 44, 0x476166, 0x25363c);
  grid.position.set(9, -0.02, 8);
  group.add(grid);
  return group;
}

function makeRobot() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x65d0ee, roughness: 0.35, metalness: 0.15 })
  );
  body.position.y = 0.72;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.5, 0.58),
    new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: 0.38 })
  );
  head.position.y = 1.45;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x13242a, emissive: 0x1bbde0, emissiveIntensity: 0.35 });
  [-0.17, 0.17].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), eyeMat);
    eye.position.set(x, 1.5, 0.31);
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
  base.position.y = 0.4;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.24, 1.06),
    new THREE.MeshStandardMaterial({ color: 0xffc245, roughness: 0.24, metalness: 0.35 })
  );
  lid.position.y = 0.85;
  const glow = new THREE.PointLight(0xffc33a, 3.5, 10);
  glow.position.y = 1.4;
  group.add(base, lid, glow);
  return group;
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

function resetPuzzleProgress() {
  state.clueLevel = 0;
  state.checked = false;
}

function getWorldPoints() {
  const uEnd = scale(state.u, state.m);
  return [
    [0, 0, 0],
    state.target,
    add(state.target, [3, 3, 3]),
    sub(state.target, [3, 3, 3]),
    currentPoint(),
    add(currentPoint(), [2, 2, 2]),
    sub(currentPoint(), [2, 2, 2]),
    state.u,
    state.v,
    uEnd
  ];
}

function frameScene() {
  const box = new THREE.Box3();
  getWorldPoints().forEach((point) => box.expandByPoint(vec(point)));
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 8);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const fitFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.min(Math.max((radius / Math.sin(fitFov / 2)) * 0.95, 22), 90);
  const direction = new THREE.Vector3(1.05, 0.85, 1.25).normalize();

  controls.target.copy(center);
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = Math.max(0.1, distance / 180);
  camera.far = distance * 5;
  camera.updateProjectionMatrix();
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
      opacity: 0.16,
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
}

function updateUi() {
  inputs.ux.value = state.u[0];
  inputs.uy.value = state.u[1];
  inputs.uz.value = state.u[2];
  inputs.vx.value = state.v[0];
  inputs.vy.value = state.v[1];
  inputs.vz.value = state.v[2];
  mSlider.value = state.m;
  nSlider.value = state.n;
  mReadout.textContent = state.m;
  nReadout.textContent = state.n;
  targetReadout.textContent = `(${state.target.join(", ")})`;
  const p = currentPoint();
  const real = solveReal(state.u, state.v, state.target);
  const whole = findWholeSolution(state.u, state.v, state.target, allowNegativeEl.checked);
  const distance = norm(sub(p, state.target));
  const exactCurrent = distance < 1e-8;
  equationEl.textContent = `${state.m}u + ${state.n}v = (${p.map((x) => round(x)).join(", ")})`;

  if (exactCurrent) {
    statusPill.textContent = "Treasure unlocked";
  } else if (state.checked) {
    statusPill.textContent = `${round(distance)} units away`;
  } else {
    statusPill.textContent = "Puzzle locked";
  }

  let message = "";
  if (exactCurrent) {
    message = `<strong class="ok">Unlocked.</strong> This button code lands exactly on T. Now explain why both coordinates and height match at the same time.`;
  } else if (!state.checked && state.clueLevel === 0) {
    message = `Choose values for m and n, launch the route, then check the distance. The treasure opens only when the robot lands exactly on T.`;
  } else if (state.clueLevel === 0) {
    message = `<strong class="warn">Not yet.</strong> Your current landing point is ${round(distance)} units from the treasure. Try changing one slider and watch whether the robot gets closer.`;
  } else if (state.clueLevel === 1) {
    message = whole.exact
      ? `<strong class="ok">Clue 1.</strong> There is a whole-number code somewhere on the lattice. Look for the bright route endpoint to sit exactly on the red target line.`
      : `<strong class="warn">Clue 1.</strong> No whole-number code appears in the current search range. The reason may be fractions, a missing plane, or parallel movement.`;
  } else if (state.clueLevel === 2) {
    if (real.exists && whole.exact) {
      const currentMGap = Math.abs(whole.m - state.m);
      const currentNGap = Math.abs(whole.n - state.n);
      message = currentMGap > currentNGap
        ? `<strong class="ok">Clue 2.</strong> Your m slider needs the bigger adjustment.`
        : `<strong class="ok">Clue 2.</strong> Your n slider needs the bigger adjustment.`;
    } else if (real.exists) {
      message = `<strong class="warn">Clue 2.</strong> Decimal button presses would hit the target, but the robot only accepts whole numbers.`;
    } else if (real.parallel) {
      message = `<strong class="bad">Clue 2.</strong> The two movement buttons are parallel, so the robot is trapped on one line.`;
    } else {
      message = `<strong class="bad">Clue 2.</strong> The two buttons make a flat sheet in 3D, and T is not on that sheet.`;
    }
  } else {
    if (whole.exact) {
      const mDirection = whole.m > state.m ? "increase m" : whole.m < state.m ? "decrease m" : "keep m";
      const nDirection = whole.n > state.n ? "increase n" : whole.n < state.n ? "decrease n" : "keep n";
      message = `<strong class="ok">Clue 3.</strong> To move closer, ${mDirection} and ${nDirection}.`;
    } else if (real.exists) {
      message = `<strong class="warn">Clue 3.</strong> The real-number route lands at m=${round(real.m)}, n=${round(real.n)}. Decide why that is not a legal whole-button code.`;
    } else if (real.parallel) {
      message = `<strong class="bad">Clue 3.</strong> Parallel vectors cannot sweep out an area or plane, so most targets are unreachable.`;
    } else {
      message = `<strong class="bad">Clue 3.</strong> Even decimal presses miss by ${round(real.residual)} units because T is outside the movement plane.`;
    }
  }
  answerEl.innerHTML = message;
}

function round(value) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function syncStateFromInputs() {
  state.u = [inputs.ux.valueAsNumber, inputs.uy.valueAsNumber, inputs.uz.valueAsNumber];
  state.v = [inputs.vx.valueAsNumber, inputs.vy.valueAsNumber, inputs.vz.valueAsNumber];
  state.m = Number(mSlider.value);
  state.n = Number(nSlider.value);
  state.checked = false;
  refresh();
}

function refresh() {
  updateUi();
  drawReachableWorld();
  drawRoute(1);
  frameScene();
}

function setPreset(preset) {
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
    button.className = "preset";
    button.type = "button";
    button.innerHTML = `<strong>${preset.name}</strong><span>Find the hidden m,n code</span>`;
    button.addEventListener("click", () => setPreset(preset));
    presetGrid.append(button);
  });
}

Object.values(inputs).forEach((input) => input.addEventListener("input", syncStateFromInputs));
mSlider.addEventListener("input", syncStateFromInputs);
nSlider.addEventListener("input", syncStateFromInputs);
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

document.querySelector("#animate-route").addEventListener("click", () => {
  state.checked = true;
  state.animating = true;
  state.animationStart = performance.now();
  updateUi();
});

document.querySelector("#clue-button").addEventListener("click", () => {
  state.checked = true;
  state.clueLevel = Math.min(state.clueLevel + 1, 3);
  refresh();
});

document.querySelector("#swap").addEventListener("click", () => {
  [state.u, state.v] = [state.v, state.u];
  [state.m, state.n] = [state.n, state.m];
  resetPuzzleProgress();
  refresh();
});

document.querySelector("#randomize").addEventListener("click", () => {
  const rand = () => Math.floor(Math.random() * 9) - 3;
  state.u = [rand() + 2, rand() + 2, state.mode === "worksheet" ? 0 : rand() + 1];
  state.v = [rand() + 1, rand() + 2, state.mode === "worksheet" ? 0 : rand() + 1];
  state.m = START_M;
  state.n = START_N;
  resetPuzzleProgress();
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
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
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
  if (state.animating) {
    const progress = Math.min((now - state.animationStart) / 2200, 1);
    drawRoute(ease(progress));
    if (progress >= 1) state.animating = false;
  }
  renderer.render(scene, camera);
}

function ease(t) {
  return 1 - Math.pow(1 - t, 3);
}

requestAnimationFrame(animate);
