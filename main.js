import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ========== 家具資料（名稱對應 Blender 物件名） ========== */
const FURNITURE = {
  Sofa:         { zh: '三人座沙發', mat: '亞麻混紡布料坐墊，橡木實木椅腳' },
  Armchair:     { zh: '單人休閒椅', mat: '芥末黃絨布，橡木實木椅腳' },
  CoffeeTable:  { zh: '茶几',       mat: '橡木實木桌面與桌腳，白色烤漆下層板' },
  Rug:          { zh: '地毯',       mat: '米色羊毛手織地毯' },
  TVCabinet:    { zh: '電視櫃',     mat: '白色烤漆櫃體，橡木檯面與櫃腳' },
  FloorLamp:    { zh: '立燈',       mat: '黑色金屬燈桿與底座，亞麻布燈罩' },
  Plant:        { zh: '盆栽',       mat: '陶土花盆，觀葉植物（琴葉榕）' },
  WallPainting: { zh: '掛畫',       mat: '橡木畫框，抽象藍色畫布' },
};

const SOFA_COLORS = [
  { name: '淺灰', hex: '#a9aaa6' },
  { name: '燕麥米', hex: '#d6c8b0' },
  { name: '鼠尾草綠', hex: '#8fa392' },
  { name: '霧藍', hex: '#7f95a8' },
  { name: '芥末黃', hex: '#c9a54a' },
];

const FLOORS = {
  oak:    { color: '#c9a77f', roughness: 0.5 },
  walnut: { color: '#5c4433', roughness: 0.45 },
  stone:  { color: '#9c9c97', roughness: 0.85 },
};

const VIEWS = {
  overview: { pos: [3, 4.5, 8],     target: [0, 0.9, 0] },
  top:      { pos: [0, 9.5, 0.01],  target: [0, 0, 0] },
  sofa:     { pos: [1.95, 1.15, 0], target: [-2.3, 0.7, 0] },
};

/* ========== 基本場景 ========== */
const DAY_BG = new THREE.Color(0xeef0ec);
const NIGHT_BG = new THREE.Color(0x1d222b);

const scene = new THREE.Scene();
scene.background = DAY_BG.clone();

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);

// 直式（手機）螢幕：加大視角並把鏡頭拉遠，讓整間客廳都能入鏡
const DESKTOP_HALF_H = Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * 16 / 9);
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1.5
    ? Math.min(60, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * 1.5 / aspect)))
    : 40;
  camera.updateProjectionMatrix();
}
function viewPos(key) {
  const v = VIEWS[key];
  const p = new THREE.Vector3(...v.pos);
  if (key === 'sofa') return p;
  const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const k = THREE.MathUtils.clamp(0.72 * Math.tan(DESKTOP_HALF_H) / Math.tan(halfH), 1, 2);
  const t = viewTarget(key);
  return p.sub(new THREE.Vector3(...v.target)).multiplyScalar(k).add(t);
}
function viewTarget(key) {
  const t = new THREE.Vector3(...VIEWS[key].target);
  // 直式螢幕：下方有控制面板，鏡頭看低一點讓客廳往上移
  if (camera.aspect < 1 && key === 'overview') t.y -= 0.9;
  if (camera.aspect < 1 && key === 'top') t.z += 1.2;
  return t;
}
fitCamera();
camera.position.copy(viewPos('overview'));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minDistance = 1;
controls.maxDistance = 25;
controls.target.copy(viewTarget('overview'));

/* 燈光 */
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2c0, 2.2);
sun.position.set(3, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

// 立燈燈光（夜晚才打開）
const lampLight = new THREE.PointLight(0xffc27a, 0, 0, 2);
lampLight.castShadow = true;
lampLight.shadow.mapSize.set(1024, 1024);
lampLight.shadow.bias = -0.002;
scene.add(lampLight);

/* ========== 載入模型 ========== */
const furnitureRoots = [];       // 可點選的家具物件
let sofaFabric = null;           // 沙發布料材質
let floorMat = null;             // 地板材質
let lampShadeMat = null;         // 燈罩材質

new GLTFLoader().load('models/living-room.glb', (gltf) => {
  const room = gltf.scene;
  room.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = obj.material.clone();          // 每件家具獨立材質，亮起時不互相影響
    const name = obj.material.name;
    obj.castShadow = name !== 'Glass_Clear';
    obj.receiveShadow = true;
    if (name === 'Fabric_LightGrey') sofaFabric = obj.material;
    if (name === 'Wood_Floor') { floorMat = obj.material; addPlanarUV(obj.geometry); }
    if (name === 'Linen_Lampshade') { lampShadeMat = obj.material; obj.castShadow = false; }
    if (name === 'Glass_Clear') {
      // 換成真正的半透明玻璃（glTF 的 transmission 在網頁上會變成不透明白色）
      obj.material = new THREE.MeshPhysicalMaterial({
        name, color: 0xdfeef0, metalness: 0, roughness: 0.05,
        transparent: true, opacity: 0.16, depthWrite: false,
        clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide,
      });
      obj.receiveShadow = false;
      obj.renderOrder = 2;
    }
  });
  scene.add(room);

  for (const key of Object.keys(FURNITURE)) {
    const obj = room.getObjectByName(key);
    if (!obj) { console.warn('找不到物件', key); continue; }
    FURNITURE[key].object = obj;
    FURNITURE[key].size = localSize(obj);
    obj.userData.furnitureKey = key;
    furnitureRoots.push(obj);
  }

  // 立燈光源放在燈罩內
  const lampBox = new THREE.Box3().setFromObject(FURNITURE.FloorLamp.object);
  lampLight.position.set(
    (lampBox.min.x + lampBox.max.x) / 2, lampBox.max.y - 0.15, (lampBox.min.z + lampBox.max.z) / 2);

  setFloor('oak');
  buildSwatches();
  document.getElementById('loading').remove();
}, undefined, (err) => {
  document.getElementById('loading').textContent = '模型載入失敗，請確認 models/living-room.glb 是否存在';
  console.error(err);
});

// 以物件自身方向計算尺寸（不受旋轉影響），回傳公分
function localSize(obj) {
  const q = obj.quaternion.clone();
  obj.quaternion.identity();
  obj.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.quaternion.copy(q);
  obj.updateMatrixWorld(true);
  // glTF：x = 寬、z = 深、y = 高
  return { w: Math.round(s.x * 100), d: Math.round(s.z * 100), h: Math.round(s.y * 100) };
}

/* ========== 滑鼠移入亮起、點選 ========== */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let selected = null;

function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(furnitureRoots, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !o.userData.furnitureKey) o = o.parent;
  return o;
}

function setGlow(obj, amount) {
  if (!obj) return;
  obj.traverse((m) => {
    if (m.isMesh) m.material.emissive.setRGB(amount * 0.9, amount * 0.85, amount * 0.6);
  });
}
function refreshGlow() {
  for (const o of furnitureRoots) setGlow(o, 0);
  setGlow(selected, 0.07);
  if (hovered) setGlow(hovered, 0.16);
  if (isNight && lampShadeMat) lampShadeMat.emissive.set(0xffc988); // 夜晚燈罩維持發光
}

renderer.domElement.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  const o = pick(ev);
  if (o !== hovered) {
    hovered = o;
    document.body.classList.toggle('hovering', !!o);
    refreshGlow();
  }
});

// 區分「點一下」與「拖曳旋轉」
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!downAt) return;
  const moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]);
  downAt = null;
  if (moved > 5) return;
  select(pick(ev));
});

/* ========== 資訊卡 ========== */
const card = document.getElementById('card');
function select(obj) {
  selected = obj;
  refreshGlow();
  document.body.classList.toggle('card-open', !!obj);
  if (!obj) { card.hidden = true; return; }
  const key = obj.userData.furnitureKey;
  const f = FURNITURE[key];
  document.getElementById('cardTitle').textContent = f.zh;
  document.getElementById('cardEn').textContent = key;
  document.getElementById('cardSize').textContent = `${f.size.w} × ${f.size.d} × ${f.size.h} 公分`;
  document.getElementById('cardMat').textContent = f.mat;
  document.getElementById('sofaColors').hidden = key !== 'Sofa';
  card.hidden = false;
}
document.getElementById('cardClose').addEventListener('click', () => select(null));

/* 沙發換色 */
function buildSwatches() {
  const box = document.getElementById('swatches');
  SOFA_COLORS.forEach((c, i) => {
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'center';
    const b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' on' : '');
    b.style.background = c.hex;
    b.title = c.name;
    b.setAttribute('aria-label', c.name);
    b.addEventListener('click', () => {
      sofaFabric?.color.set(c.hex);
      box.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === b));
    });
    const label = document.createElement('div');
    label.className = 'swatch-name';
    label.textContent = c.name;
    wrap.append(b, label);
    box.append(wrap);
  });
  sofaFabric?.color.set(SOFA_COLORS[0].hex);
}

/* ========== 按鈕群組（單選） ========== */
function segmented(id, attr, onPick) {
  const el = document.getElementById(id);
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    onPick(b.dataset[attr]);
  });
}

/* ========== 地板：程式產生貼圖（不需外部圖片） ========== */

// 地板模型沒有 UV：依世界座標（公尺）由上往下投影產生 UV
function addPlanarUV(geo) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// 固定種子的亂數，讓每次載入的紋理都一樣
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const hsl = (c, dl, a = 1) => {
  const o = {}; new THREE.Color(c).getHSL(o, THREE.SRGBColorSpace);
  return `hsl(${o.h * 360} ${o.s * 100}% ${Math.max(0, Math.min(100, (o.l + dl) * 100))}% / ${a})`;
};

const TEX_PX = 1024;
function canvasPair() {
  const make = () => { const c = document.createElement('canvas'); c.width = c.height = TEX_PX; return c; };
  const color = make(), bump = make();
  return { color, bump, cx: color.getContext('2d'), bx: bump.getContext('2d') };
}

// 木地板：寬 18 cm、長 108 cm 的錯縫拼板，含木紋
function woodCanvas(base, seed) {
  const SIZE_M = 2.16, PLANK_W = 0.18, PLANK_L = 1.08;
  const px = TEX_PX / SIZE_M;
  const { color, bump, cx, bx } = canvasPair();
  const rand = rng(seed);
  bx.fillStyle = '#fff'; bx.fillRect(0, 0, TEX_PX, TEX_PX);
  const rows = Math.round(SIZE_M / PLANK_W);
  for (let r = 0; r < rows; r++) {
    const y = r * PLANK_W * px, h = PLANK_W * px;
    const offset = (rand() * PLANK_L) * px;
    for (let x = -offset; x < TEX_PX; x += PLANK_L * px) {
      const w = PLANK_L * px;
      // 每片板子明暗略有不同
      cx.fillStyle = hsl(base, (rand() - 0.5) * 0.08);
      cx.fillRect(x, y, w, h);
      // 木紋：沿長向的細波浪線
      for (let g = 0; g < 14; g++) {
        const gy = y + rand() * h, amp = 1 + rand() * 3, freq = 0.004 + rand() * 0.01, ph = rand() * 6;
        cx.strokeStyle = hsl(base, -0.03 - rand() * 0.06);
        cx.globalAlpha = 0.25 + rand() * 0.3;
        cx.lineWidth = 0.6 + rand() * 1.4;
        cx.beginPath();
        for (let t = 0; t <= w; t += 8) {
          const yy = gy + Math.sin(t * freq + ph) * amp;
          t === 0 ? cx.moveTo(x + t, yy) : cx.lineTo(x + t, yy);
        }
        cx.stroke();
      }
      cx.globalAlpha = 1;
      // 拼縫（短邊）
      cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.fillRect(x, y, 2, h);
      bx.fillStyle = '#000'; bx.fillRect(x, y, 2, h);
    }
    // 拼縫（長邊）
    cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.fillRect(0, y, TEX_PX, 2);
    bx.fillStyle = '#000'; bx.fillRect(0, y, TEX_PX, 2);
  }
  return { color, bump, sizeM: SIZE_M };
}

// 灰色石材：60 × 60 cm 磚，含磚縫與細微斑紋
function stoneCanvas(base, seed) {
  const SIZE_M = 1.8, TILE = 0.6, GROUT = 4;
  const px = TEX_PX / SIZE_M;
  const { color, bump, cx, bx } = canvasPair();
  const rand = rng(seed);
  cx.fillStyle = '#d4d3cf'; cx.fillRect(0, 0, TEX_PX, TEX_PX);   // 磚縫顏色
  bx.fillStyle = '#000'; bx.fillRect(0, 0, TEX_PX, TEX_PX);
  const n = Math.round(SIZE_M / TILE), t = TILE * px;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * t + GROUT / 2, y = j * t + GROUT / 2, s = t - GROUT;
    cx.fillStyle = hsl(base, (rand() - 0.5) * 0.05);
    cx.fillRect(x, y, s, s);
    // 細微斑點
    for (let k = 0; k < 2200; k++) {
      cx.fillStyle = hsl(base, (rand() - 0.5) * 0.22);
      cx.globalAlpha = 0.15 + rand() * 0.25;
      const r = 0.5 + rand() * 1.8;
      cx.fillRect(x + rand() * s, y + rand() * s, r, r);
    }
    // 淡淡的雲紋
    for (let k = 0; k < 4; k++) {
      const gx = x + rand() * s, gy = y + rand() * s, gr = 80 + rand() * 120;
      const grad = cx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      const dl = rand() > 0.5 ? 0.04 : -0.04;
      grad.addColorStop(0, hsl(base, dl, 0.5));
      grad.addColorStop(1, hsl(base, dl, 0));
      cx.globalAlpha = 0.3; cx.fillStyle = grad;
      cx.fillRect(x, y, s, s);
    }
    cx.globalAlpha = 1;
    bx.fillStyle = '#fff'; bx.fillRect(x, y, s, s);
  }
  return { color, bump, sizeM: SIZE_M };
}

const FLOOR_TEX = {};
function floorTextures(key) {
  if (FLOOR_TEX[key]) return FLOOR_TEX[key];
  const f = FLOORS[key];
  const c = key === 'stone' ? stoneCanvas(f.color, 7) : woodCanvas(f.color, key === 'oak' ? 11 : 23);
  const toTex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / c.sizeM, 1 / c.sizeM);   // UV 是公尺 → 貼圖依實際尺寸重複
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return (FLOOR_TEX[key] = { map: toTex(c.color, true), bump: toTex(c.bump, false) });
}

function setFloor(key) {
  if (!floorMat) return;
  const tex = floorTextures(key);
  floorMat.map = tex.map;
  floorMat.bumpMap = tex.bump;
  floorMat.bumpScale = key === 'stone' ? 1.5 : 1;
  floorMat.color.set(0xffffff);              // 顏色交給貼圖
  floorMat.roughness = FLOORS[key].roughness;
  floorMat.needsUpdate = true;
}
segmented('floors', 'floor', setFloor);

/* 日／夜 */
let isNight = false;
segmented('daynight', 'mode', (mode) => {
  isNight = mode === 'night';
  document.body.classList.toggle('night', isNight);
  scene.background.copy(isNight ? NIGHT_BG : DAY_BG);
  hemi.intensity = isNight ? 0.12 : 1.2;
  hemi.color.set(isNight ? 0x8090b0 : 0xffffff);
  sun.intensity = isNight ? 0 : 2.2;
  lampLight.intensity = isNight ? 6 : 0;
  if (lampShadeMat) {
    lampShadeMat.emissive.set(isNight ? 0xffc988 : 0x000000);
    lampShadeMat.emissiveIntensity = isNight ? 1.2 : 1;
  }
  refreshGlow();
});

/* 視角：鏡頭平滑移動 */
let tween = null;
segmented('views', 'view', (key) => {
  const v = VIEWS[key];
  tween = {
    fromPos: camera.position.clone(), toPos: viewPos(key),
    fromTgt: controls.target.clone(), toTgt: viewTarget(key),
    start: performance.now(), dur: 1200,
  };
});
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ========== 畫面更新 ========== */
addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop((now) => {
  if (tween) {
    const t = Math.min((now - tween.start) / tween.dur, 1);
    const k = ease(t);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
    if (t === 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
});

// 方便測試用
window.__app = { FURNITURE, camera, controls, select, get sofaFabric() { return sofaFabric; }, get floorMat() { return floorMat; }, lampLight, hemi, sun };
