/* =========================================================
   SAVA RESIDENCE — 3D istraživač zgrade
   Three.js + vanilla JS. Demo by Salty.rs
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { PROJECT, TYPES, ROOMS, CORE, STATUS, buildApartments, floorY } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 4);
const fmt = (n, dec = 0) => {
  const [i, d] = Math.abs(n).toFixed(dec).split('.');
  return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
};
const eur = n => fmt(n) + ' €';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth < 900;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privatni režim */ } }
};

/* ---------- personalizacija: ?firma=…&projekat=… ---------- */
(() => {
  const q = new URLSearchParams(location.search);
  const firma = (q.get('firma') || '').trim().slice(0, 24);
  const proj = (q.get('projekat') || '').trim().slice(0, 28);
  if (firma) $$('[data-company]').forEach(el => { el.textContent = firma; });
  if (proj) {
    $$('[data-project]').forEach(el => { el.textContent = proj; });
    document.title = document.title.replace('Sava Residence', proj);
  }
})();

/* =========================================================
   STANJE
   ========================================================= */
const apts = buildApartments();
const byId = Object.fromEntries(apts.map(a => [a.id, a]));
const filter = { rooms: 'all', side: 'all', max: 600000, free: true };
const state = { mode: 'building', floor: 0, selected: null, night: false, nightT: 0 };
let favs = store.get('sava-favs', []).filter(id => byId[id]);

const matches = a =>
  (filter.rooms === 'all' || a.rooms === parseFloat(filter.rooms)) &&
  (filter.side === 'all' || a.side === filter.side) &&
  a.price <= filter.max &&
  (!filter.free || a.status === 'slobodan');

const monthly = (price, downPct = 20, years = 25, rate = 0.045) => {
  const L = price * (1 - downPct / 100), r = rate / 12, n = years * 12;
  return L * r / (1 - Math.pow(1 + r, -n));
};

/* =========================================================
   THREE — osnova
   ========================================================= */
const explorer = $('.explorer');
const canvas = $('.scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile() ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const DAY_FOG = new THREE.Color('#e3ddd1'), NIGHT_FOG = new THREE.Color('#121210');
scene.fog = new THREE.Fog(DAY_FOG.clone(), 140, 380);

const camera = new THREE.PerspectiveCamera(32, 1, 1, 1200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 40;
controls.maxDistance = 170;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.42;
controls.autoRotateSpeed = 0.55;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;

// svetla
const hemi = new THREE.HemisphereLight('#e6eef5', '#b5a58c', 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
sun.position.set(70, 95, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile() ? 1024 : 2048, isMobile() ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);

/* ---------- teksture fasade (crtane na canvasu) ---------- */
function facadeTex(bays, w, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = 128;
  const g = c.getContext('2d');
  const e = document.createElement('canvas');
  e.width = w; e.height = 128;
  const ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, 128);
  g.fillStyle = opts.store ? '#d9d3c8' : '#efebe4';
  g.fillRect(0, 0, w, 128);
  // fini šum betona
  for (let i = 0; i < w * 6; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * .035})`;
    g.fillRect(Math.random() * w, Math.random() * 128, 2, 2);
  }
  const bw = w / bays;
  for (let b = 0; b < bays; b++) {
    const x = b * bw + (opts.store ? 4 : bw * 0.14);
    const ww = opts.store ? bw - 8 : bw * 0.72;
    const y = opts.store ? 10 : 16, h = opts.store ? 108 : 96;
    const grd = g.createLinearGradient(x, y, x + ww, y + h);
    grd.addColorStop(0, '#4a5a66'); grd.addColorStop(.5, '#26323b'); grd.addColorStop(1, '#3a4853');
    g.fillStyle = grd; g.fillRect(x, y, ww, h);
    g.strokeStyle = '#1c2328'; g.lineWidth = 3; g.strokeRect(x, y, ww, h);
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.beginPath(); g.moveTo(x + ww * .15, y); g.lineTo(x + ww * .45, y); g.lineTo(x + ww * .1, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
    g.fillStyle = '#1c2328'; g.fillRect(x + ww / 2 - 1.5, y, 3, h);
    const lit = opts.store || Math.random() < (opts.lit ?? .45);
    if (lit) {
      const eg = ge.createLinearGradient(x, y, x, y + h);
      const warm = Math.random() < .8 ? '255,196,120' : '200,220,255';
      eg.addColorStop(0, `rgba(${warm},${.55 + Math.random() * .4})`); eg.addColorStop(1, `rgba(${warm},${.9})`);
      ge.fillStyle = eg; ge.fillRect(x + 2, y + 2, ww - 4, h - 4);
    }
  }
  // razdelna linija ploče
  g.fillStyle = '#d6d0c5'; g.fillRect(0, 0, w, 6);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const emap = new THREE.CanvasTexture(e);
  emap.colorSpace = THREE.SRGBColorSpace;
  return { map, emap };
}
const TEX = {
  long: [0, 1, 2].map(() => facadeTex(10, 1024)),
  short: [0, 1, 2].map(() => facadeTex(5, 512)),
  storeLong: facadeTex(10, 1024, { store: true }),
  storeShort: facadeTex(5, 512, { store: true })
};

const M = {
  concrete: new THREE.MeshStandardMaterial({ color: '#ece7de', roughness: .85 }),
  slab: new THREE.MeshStandardMaterial({ color: '#d9d3c8', roughness: .8 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2a2a27', roughness: .6 }),
  glass: new THREE.MeshStandardMaterial({ color: '#9fb6c2', roughness: .1, metalness: .1, transparent: true, opacity: .35, depthWrite: false }),
  accent: new THREE.MeshStandardMaterial({ color: '#ff5a1f', roughness: .55, emissive: '#ff5a1f', emissiveIntensity: 0 }),
  wall: new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: .9 }),
  ground: new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 1 }),
  plot: new THREE.MeshStandardMaterial({ color: '#cbc2b0', roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: '#a9b48f', roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: '#7f9aa8', roughness: .15, metalness: .3 }),
  path: new THREE.MeshStandardMaterial({ color: '#e6dfd2', roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#7f9a6c', roughness: .9, flatShading: true }),
  neighbor: new THREE.MeshStandardMaterial({ color: '#dcd6cc', roughness: .9 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff2d6', emissive: '#ffcf8a', emissiveIntensity: 0 })
};

function box(w, h, d, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

/* ---------- okolina ---------- */
const world = new THREE.Group();
scene.add(world);
{
  const ground = new THREE.Mesh(new THREE.CircleGeometry(420, 64), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const plot = box(66, .2, 48, M.plot, 0, .1, 2, false); world.add(plot);
  const lawnN = box(60, .25, 14, M.grass, 0, .12, -19, false); world.add(lawnN);
  const prom = box(420, .22, 8, M.path, 0, .11, 34, false); world.add(prom);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 120), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set(0, .05, 98); water.receiveShadow = true; world.add(water);
  // susedne zgrade
  const rn = (a, b) => a + Math.random() * (b - a);
  [[-62, -10, 18, 14, 22], [-60, -42, 22, 16, 14], [62, -14, 16, 18, 28], [64, -46, 22, 14, 18], [-26, -66, 30, 16, 16], [24, -70, 26, 18, 24], [-96, -20, 18, 22, 12], [96, -30, 20, 20, 16]]
    .forEach(([x, z, w, d, h]) => world.add(box(w, h, d, M.neighbor, x, h / 2, z)));
  // drveće (instanced)
  const spots = [];
  for (let x = -200; x <= 200; x += 9) spots.push([x + rn(-2, 2), 31 + rn(-1, 1)]);
  for (let i = 0; i < 26; i++) spots.push([rn(-28, 28), rn(-25, -14)]);
  for (let i = 0; i < 40; i++) { const a = rn(0, Math.PI * 2), r = rn(48, 120); const p = [Math.cos(a) * r, Math.sin(a) * r * .7 - 20]; if (p[1] < 26) spots.push(p); }
  const trunkG = new THREE.CylinderGeometry(.18, .25, 2.2, 6);
  const leafG = new THREE.IcosahedronGeometry(1.7, 0);
  const trunks = new THREE.InstancedMesh(trunkG, M.trunk, spots.length);
  const leaves = new THREE.InstancedMesh(leafG, M.leaf, spots.length);
  const o = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    const s = rn(.8, 1.35);
    o.position.set(x, 1.1 * s, z); o.scale.setScalar(s); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
    o.position.set(x, 3 * s, z); o.rotation.set(rn(0, 3), rn(0, 3), 0); o.updateMatrix(); leaves.setMatrixAt(i, o.matrix);
  });
  trunks.castShadow = leaves.castShadow = true;
  world.add(trunks, leaves);
  // lampe na šetalištu
  const lampG = new THREE.SphereGeometry(.35, 10, 8);
  const lamps = new THREE.InstancedMesh(lampG, M.lamp, 40);
  for (let i = 0; i < 40; i++) { o.position.set(-195 + i * 10, 3.6, 37.6); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); lamps.setMatrixAt(i, o.matrix); }
  world.add(lamps);
}

/* =========================================================
   ZGRADA
   ========================================================= */
const building = new THREE.Group();
scene.add(building);
const W = PROJECT.width, D = PROJECT.depth;
const levels = [];          // 0 = prizemlje, 1…11 spratovi, 12 = krov
const shellHit = [];        // meshevi za raycast u režimu zgrade
const plateHit = [];        // meshevi stanova za raycast u režimu sprata
const plates = {};          // id → mesh

function makeShellMats(store, v) {
  const L = store ? TEX.storeLong : TEX.long[v % 3];
  const S = store ? TEX.storeShort : TEX.short[v % 3];
  const mk = t => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emap, emissive: '#ffffff', emissiveIntensity: 0, roughness: .7 });
  const side = mk(S), front = mk(L), top = M.concrete.clone();
  return [side, side, top, top, front, front.clone()];
}

for (let f = 0; f <= PROJECT.floors + 1; f++) {
  const isRoof = f === PROJECT.floors + 1;
  const g = new THREE.Group();
  const baseY = isRoof ? floorY(PROJECT.floors) + PROJECT.floorH : floorY(f);
  const h = f === 0 ? PROJECT.groundH : PROJECT.floorH;
  g.position.y = baseY;
  const shell = new THREE.Group();
  const mats = [];
  g.add(shell);

  if (!isRoof) {
    const slab = box(W + .6, .32, D + .6, M.slab.clone(), 0, .16, 0);
    shell.add(slab); mats.push(slab.material);
    const fm = makeShellMats(f === 0, f);
    const facade = box(W, h - .32, D, fm, 0, .32 + (h - .32) / 2, 0);
    facade.userData.floor = f;
    shell.add(facade); shellHit.push(facade);
    fm.forEach(m => mats.includes(m) || mats.push(m));
    if (f === 0) {
      // nadstrešnica ulaza
      const can = box(10, .3, 3.4, M.accent.clone(), -5, 3.6, 9.4); shell.add(can); mats.push(can.material);
    } else {
      // balkoni na jugu
      apts.filter(a => a.floor === f && a.side === 'S').forEach(a => {
        const w = a.x[1] - a.x[0] - .5, cx = (a.x[0] + a.x[1]) / 2;
        const bs = box(w, .2, 1.8, M.slab.clone(), cx, .1, D / 2 + .9);
        const rail = box(w, 1, .05, M.glass.clone(), cx, .7, D / 2 + 1.78, false);
        const top = box(w, .06, .1, M.dark.clone(), cx, 1.22, D / 2 + 1.78);
        shell.add(bs, rail, top); mats.push(bs.material, rail.material, top.material);
      });
      // vertikalni akcenat na zapadnom uglu
      const fin = box(.5, h, .5, M.accent.clone(), -W / 2 - .25, h / 2, D / 2 + .25);
      shell.add(fin); mats.push(fin.material);
    }
  } else {
    const roof = box(W + .8, .5, D + .8, M.slab.clone(), 0, .25, 0);
    const parapet = box(W + .8, 1.1, .3, M.concrete.clone(), 0, 1, D / 2 + .25);
    const parapet2 = box(W + .8, 1.1, .3, M.concrete.clone(), 0, 1, -D / 2 - .25);
    const core = box(5, 3.4, 5, M.accent.clone(), (CORE.x[0] + CORE.x[1]) / 2, 2.2, -4.5);
    const pergola = new THREE.Group();
    for (let i = 0; i < 9; i++) pergola.add(box(.18, .18, 9, M.dark.clone(), 2 + i * 1.4, 3.2, 2));
    pergola.add(box(.25, 3, .25, M.dark.clone(), 2, 1.6, -2.4), box(.25, 3, .25, M.dark.clone(), 13.2, 1.6, -2.4), box(.25, 3, .25, M.dark.clone(), 2, 1.6, 6.4), box(.25, 3, .25, M.dark.clone(), 13.2, 1.6, 6.4));
    shell.add(roof, parapet, parapet2, core, pergola);
    shell.traverse(o => o.material && mats.push(o.material));
  }

  // enterijer sprata
  let interior = null;
  if (f >= 1 && !isRoof) {
    interior = new THREE.Group();
    interior.visible = false;
    interior.add(box(W, .3, D, M.wall, 0, .15, 0));
    const wallH = 1.25, extH = .9, t = .14;
    const walls = new THREE.Group();
    const addWall = (x0, z0, x1, z1, hh = wallH, th = t) => {
      const w = Math.abs(x1 - x0) || th, d = Math.abs(z1 - z0) || th;
      walls.add(box(w, hh, d, M.wall, (x0 + x1) / 2, .3 + hh / 2, (z0 + z1) / 2));
    };
    // spoljni zidovi (presek)
    addWall(-W / 2, -D / 2, W / 2, -D / 2, extH, .3); addWall(-W / 2, D / 2, W / 2, D / 2, extH, .3);
    addWall(-W / 2, -D / 2, -W / 2, D / 2, extH, .3); addWall(W / 2, -D / 2, W / 2, D / 2, extH, .3);
    // hodnik
    addWall(-W / 2, -1, W / 2, -1); addWall(-W / 2, 1, W / 2, 1);
    const seen = new Set();
    const floorApts = apts.filter(a => a.floor === f);
    floorApts.forEach(a => {
      const [x0, x1] = a.x, w = x1 - x0, S = a.side === 'S';
      const zf = S ? D / 2 : -D / 2, zc = S ? 1 : -1;
      const toZ = v => lerp(zf, zc, v);
      [x0, x1].forEach(x => {
        const k = x + a.side;
        if (Math.abs(x) < W / 2 && !seen.has(k)) { seen.add(k); addWall(x, zf, x, zc, wallH, .22); }
      });
      // pregrade soba
      ROOMS[a.type].forEach(r => {
        if (r.u[1] < 1) addWall(x0 + r.u[1] * w, toZ(r.v[0]), x0 + r.u[1] * w, toZ(r.v[1]));
        if (r.v[1] < 1) addWall(x0 + r.u[0] * w, toZ(r.v[1]), x0 + r.u[1] * w, toZ(r.v[1]));
      });
      // ploča stana (obojena po statusu)
      const mat = new THREE.MeshStandardMaterial({ color: STATUS[a.status].color, roughness: .6, transparent: true, opacity: .92, emissive: STATUS[a.status].color, emissiveIntensity: 0 });
      const p = box(w - .3, .12, 7 - .3, mat, (x0 + x1) / 2, .36, (zf + zc) / 2, false);
      p.userData.apt = a.id;
      p.userData.baseY = .36;
      interior.add(p); plateHit.push(p); plates[a.id] = p;
    });
    // jezgro
    walls.add(box(CORE.x[1] - CORE.x[0], 1.6, 7, M.dark.clone(), (CORE.x[0] + CORE.x[1]) / 2, .3 + .8, -4.5));
    interior.add(walls);
    g.add(interior);
  }

  building.add(g);
  levels.push({
    f, g, shell, interior, mats, baseY, h, isRoof,
    lift: 0, liftT: 0, shellO: 1, shellT: 1, drop: reduced ? 0 : 1, dropDelay: f * 70, inT: 0
  });
}
levels.forEach(L => L.mats.forEach(m => { m.userData.baseOpacity = m.opacity; }));

// highlight sprata
const hl = new THREE.Group();
{
  const geo = new THREE.BoxGeometry(W + 1, 1, D + 1);
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff5a1f', transparent: true, opacity: .32, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#ff5a1f' }));
  hl.add(fill, edges);
  hl.visible = false;
  hl.userData.o = 0;
  scene.add(hl);
}

/* =========================================================
   KAMERA I TRANZICIJE
   ========================================================= */
const HOME = { dist: 122, polar: 1.12, targetY: 17 };
let camTween = null;
function sphericalPos(target, dist, polar, az) {
  return new THREE.Vector3(
    target.x + dist * Math.sin(polar) * Math.sin(az),
    target.y + dist * Math.cos(polar),
    target.z + dist * Math.sin(polar) * Math.cos(az)
  );
}
function flyTo(target, pos, dur = 1300) {
  camTween = { t0: performance.now(), dur: reduced ? 1 : dur, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: pos, toT: target };
  controls.enabled = false;
}
function homeView(dur) {
  const t = new THREE.Vector3(0, HOME.targetY, 0);
  const d = isMobile() ? HOME.dist * 1.35 : HOME.dist;
  flyTo(t, sphericalPos(t, d, HOME.polar, controls.getAzimuthalAngle()), dur);
}

let idleTimer = 0;
function bumpIdle() { idleTimer = performance.now(); }

/* =========================================================
   REŽIMI: ZGRADA ↔ SPRAT
   ========================================================= */
function enterFloor(f, opts = {}) {
  f = clamp(f, 1, PROJECT.floors);
  const first = state.mode !== 'floor';
  state.mode = 'floor'; state.floor = f;
  explorer.dataset.mode = 'floor';
  levels.forEach(L => {
    L.liftT = L.f > f ? 1 : 0;
    L.shellT = L.f === f ? 0 : 1;
    if (L.interior) L.interior.visible = L.f === f;
    if (L.f === f && L.interior) L.inT = 0;
  });
  controls.autoRotate = false;
  controls.minDistance = 22; controls.maxDistance = 90;
  const y = floorY(f);
  const target = new THREE.Vector3(0, y, isMobile() ? 3 : 0);
  const az = controls.getAzimuthalAngle();
  const dist = isMobile() ? 96 : 74;
  if (first || opts.recenter) flyTo(target, sphericalPos(target, dist, .56, az), 1400);
  else flyTo(target, camera.position.clone().add(new THREE.Vector3(0, y - controls.target.y, 0)), 700);
  renderFloorPanel();
  updatePlates();
  setTip(null);
  hoverFloor = -1;
}
function exitFloor() {
  state.mode = 'building';
  explorer.dataset.mode = 'building';
  closeDrawer();
  levels.forEach(L => { L.liftT = 0; L.shellT = 1; });
  controls.minDistance = 40; controls.maxDistance = 170;
  homeView(1300);
  bumpIdle();
}

/* =========================================================
   RAYCAST / INTERAKCIJA
   ========================================================= */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(-9, -9);
let pointerIn = false, hoverFloor = -1, hoverApt = null, needsPick = false;
const pointer = { x: 0, y: 0, downX: 0, downY: 0, down: false };

canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
  ndc.set(pointer.x / r.width * 2 - 1, -(pointer.y / r.height) * 2 + 1);
  pointerIn = true; needsPick = true;
  if (pointer.down) bumpIdle();
});
canvas.addEventListener('pointerleave', () => { pointerIn = false; ndc.set(-9, -9); needsPick = true; });
canvas.addEventListener('pointerdown', e => { pointer.down = true; pointer.downX = e.clientX; pointer.downY = e.clientY; bumpIdle(); });
canvas.addEventListener('pointerup', e => {
  pointer.down = false;
  if (Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 6) return;
  // na dodir: prvo izaberi pa klikni
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pick();
  if (state.mode === 'building' && hoverFloor >= 1) enterFloor(hoverFloor);
  else if (state.mode === 'floor' && hoverApt) openApt(byId[hoverApt]);
});
canvas.addEventListener('wheel', bumpIdle, { passive: true });

function pick() {
  needsPick = false;
  if (camTween) return;
  ray.setFromCamera(ndc, camera);
  if (state.mode === 'building') {
    let f = -1;
    const hit = ray.intersectObjects(shellHit.filter(m => m.parent.visible), false)[0];
    if (hit) f = hit.object.userData.floor;
    if (f !== hoverFloor) {
      hoverFloor = f;
      $$('.ftag').forEach(t => t.classList.toggle('is-hover', +t.dataset.f === f));
    }
    if (f >= 1) {
      const list = apts.filter(a => a.floor === f);
      const free = list.filter(a => a.status === 'slobodan').length;
      const m = list.filter(matches).length;
      setTip(`<b>Sprat ${f}</b> · ${free} slobodnih od ${list.length}<span class="mono">${m} odgovara filteru · klikni za osnovu</span>`);
    } else if (f === 0) setTip('<b>Prizemlje</b> · poslovni prostori<span class="mono">Ulaz, lobi i 3 lokala</span>');
    else setTip(null);
    canvas.classList.toggle('is-pointer', f >= 1);
  } else {
    const hit = ray.intersectObjects(plateHit.filter(p => p.parent.visible), false)[0];
    const id = hit ? hit.object.userData.apt : null;
    if (id !== hoverApt) {
      hoverApt = id;
      $$('.js-floor-list li').forEach(li => li.classList.toggle('is-hover', li.dataset.id === id));
    }
    if (id) {
      const a = byId[id];
      setTip(`<i style="--c:${STATUS[a.status].color}"></i><b>Stan ${a.id}</b> · ${TYPES[a.type].label}<span class="mono">${fmt(a.area, 1)} m² · ${eur(a.price)} · ${STATUS[a.status].label}</span>`);
    } else setTip(null);
    canvas.classList.toggle('is-pointer', !!id);
  }
}

const tip = $('.tip');
let tipOn = false;
function setTip(html) {
  if (!html || !pointerIn) { if (tipOn) { tip.classList.remove('is-on'); tipOn = false; } return; }
  tip.innerHTML = html; tip.classList.add('is-on'); tipOn = true;
}

/* ---------- oznake spratova i stanova (HTML u 3D) ---------- */
const tagWrap = $('.floor-tags');
const ftags = [];
for (let f = PROJECT.floors; f >= 1; f--) {
  const el = document.createElement('button');
  el.className = 'ftag'; el.dataset.f = f;
  el.innerHTML = `<b>0</b><span>Sprat ${f}</span>`;
  el.addEventListener('click', () => enterFloor(f));
  el.addEventListener('mouseenter', () => { hoverFloor = f; });
  tagWrap.appendChild(el);
  ftags.push({ el, f });
}
const v3 = new THREE.Vector3();
function project(x, y, z) {
  v3.set(x, y, z).project(camera);
  return [(v3.x + 1) / 2 * canvas.clientWidth, (1 - v3.y) / 2 * canvas.clientHeight, v3.z];
}
function updateTags() {
  if (state.mode !== 'building') return;
  ftags.forEach(({ el, f }) => {
    const L = levels[f];
    const y = L.g.position.y + L.h / 2;
    let best = [-1e9, 0];
    for (const [x, z] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) {
      const p = project(x, y, z);
      if (p[0] > best[0]) best = p;
    }
    el.style.transform = `translate3d(${best[0] + 14}px, ${best[1] - 11}px, 0)`;
  });
}

/* =========================================================
   FILTERI
   ========================================================= */
function chipGroup(sel, key) {
  $$(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
    $$(sel + ' .chip').forEach(x => x.classList.toggle('is-on', x === c));
    filter[key] = c.dataset.v;
    applyFilter();
  }));
}
chipGroup('.js-f-rooms', 'rooms');
chipGroup('.js-f-side', 'side');
const fPrice = $('.js-f-price');
fPrice.addEventListener('input', () => { filter.max = +fPrice.value; applyFilter(); });
$('.js-f-free').addEventListener('change', e => { filter.free = e.target.checked; applyFilter(); });

function setRangeFill(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }

function applyFilter() {
  setRangeFill(fPrice);
  $('.js-f-price-out').textContent = filter.max >= 600000 ? 'bez limita' : eur(filter.max);
  const m = apts.filter(matches);
  $('.js-match').textContent = m.length;
  ftags.forEach(({ el, f }) => {
    const n = m.filter(a => a.floor === f).length;
    el.firstChild.textContent = n;
    el.classList.toggle('is-zero', n === 0);
  });
  updatePlates();
  if (state.mode === 'floor') renderFloorPanel();
  renderList(true);
}

function updatePlates() {
  apts.forEach(a => {
    const p = plates[a.id];
    p.userData.dim = !matches(a);
    p.material.opacity = p.userData.dim ? .25 : .95;
  });
}

/* =========================================================
   PANEL SPRATA
   ========================================================= */
function renderFloorPanel() {
  const f = state.floor;
  $('.js-floor-num').textContent = f;
  $('.js-floor-up').disabled = f >= PROJECT.floors;
  $('.js-floor-down').disabled = f <= 1;
  const ul = $('.js-floor-list');
  ul.innerHTML = apts.filter(a => a.floor === f).map(a => `
    <li data-id="${a.id}" class="${matches(a) ? '' : 'is-dim'}">
      <i style="--c:${STATUS[a.status].color}"></i><b>${a.id}</b>
      <span>${TYPES[a.type].short} · ${fmt(a.area, 0)} m²</span>
      <em>${a.status === 'prodat' ? 'prodat' : fmt(Math.round(a.price / 1000)) + 'k €'}</em>
    </li>`).join('');
  $$('li', ul).forEach(li => {
    li.addEventListener('click', () => openApt(byId[li.dataset.id]));
    li.addEventListener('mouseenter', () => { hoverApt = li.dataset.id; });
    li.addEventListener('mouseleave', () => { hoverApt = null; });
  });
}
$('.js-back').addEventListener('click', exitFloor);
$('.js-floor-up').addEventListener('click', () => { closeDrawer(); enterFloor(state.floor + 1); });
$('.js-floor-down').addEventListener('click', () => { closeDrawer(); enterFloor(state.floor - 1); });
$('.js-reset').addEventListener('click', () => (state.mode === 'floor' ? exitFloor() : homeView(1000)));
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (explorer.classList.contains('has-drawer')) closeDrawer(); else if (state.mode === 'floor') exitFloor(); }
  if (state.mode === 'floor' && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && document.activeElement === canvas) {
    e.preventDefault(); enterFloor(state.floor + (e.key === 'ArrowUp' ? 1 : -1));
  }
});

/* =========================================================
   DRAWER: DETALJI STANA
   ========================================================= */
const drawer = $('.drawer');
function planSVG(a) {
  const w = a.x[1] - a.x[0], d = 7, terr = a.side === 'S' ? 1.7 : 0;
  const pad = .6;
  const rooms = ROOMS[a.type].map(r => {
    const x = r.u[0] * w, y = (1 - r.v[1]) * d, rw = (r.u[1] - r.u[0]) * w, rh = (r.v[1] - r.v[0]) * d;
    const area = rw * rh * .94;
    const small = rw < 2.2 || rh < 1.8;
    return `<g><rect class="room" x="${x}" y="${y}" width="${rw}" height="${rh}"/>
      <text class="room-t" x="${x + rw / 2}" y="${y + rh / 2 - (small ? 0 : .1)}" ${small ? 'font-size=".36"' : ''}>${small ? r.n.split(' ')[0] : r.n}</text>
      <text class="room-a" x="${x + rw / 2}" y="${y + rh / 2 + .5}">${fmt(area, 1)} m²</text></g>`;
  }).join('');
  const entry = ROOMS[a.type].find(r => /Hodnik|Predsoblje/.test(r.n));
  const ex = entry ? (entry.u[0] + entry.u[1]) / 2 * w : w / 2;
  const door = `<path class="door" d="M${ex - .45} 0 v.9 a.9 .9 0 0 0 .9 -.9"/><text class="room-a" x="${ex}" y="-.25">ULAZ</text>`;
  const terrace = terr ? `<rect class="terr" x=".3" y="${d + .15}" width="${w - .6}" height="${terr - .2}"/><text class="terr-t" x="${w / 2}" y="${d + terr / 2 + .25}">TERASA ${fmt(a.terrace, 1)} m²</text>` : '';
  const north = a.side === 'S' ? 'up' : 'down';
  const compass = `<g transform="translate(${w + .1} ${-.1})"><path d="M0 ${north === 'up' ? '.9 L.25 0 L.5 .9' : '0 L.25 .9 L.5 0'}" fill="none" stroke="#ff5a1f" stroke-width=".06"/><text class="compass" x=".12" y="${north === 'up' ? 1.4 : 1.4}">S</text></g>`;
  return `<svg viewBox="${-pad} ${-pad - .3} ${w + pad * 2 + .5} ${d + terr + pad * 2 + .3}">
    ${rooms}${terrace}
    <rect class="wall draw" x="0" y="0" width="${w}" height="${d}"/>
    ${door}${compass}
  </svg>`;
}

function openApt(a) {
  if (!a) return;
  state.selected = a.id;
  const st = STATUS[a.status];
  drawer.classList.toggle('is-sold', a.status === 'prodat');
  const sEl = $('.js-d-status');
  sEl.textContent = st.label; sEl.style.setProperty('--c', st.color);
  $('.js-d-id').textContent = a.id;
  $('.js-d-floor').textContent = `Sprat ${a.floor} · ${a.side === 'S' ? 'Jug' : 'Sever'}`;
  $('.js-d-type').textContent = `${TYPES[a.type].label} · ${fmt(a.area, 1)} m²`;
  $('.js-d-plan').innerHTML = planSVG(a);
  $('.js-d-area').textContent = fmt(a.area, 1) + ' m²';
  $('.js-d-terrace').textContent = a.terrace ? fmt(a.terrace, 1) + ' m²' : '—';
  $('.js-d-ppm').textContent = eur(a.ppm);
  $('.js-d-orient').textContent = a.orient;
  $('.js-d-price').textContent = a.status === 'prodat' ? 'Prodat' : eur(a.price);
  $('.js-d-rate').textContent = a.status === 'prodat' ? '—' : eur(Math.round(monthly(a.price))) + '/mes';
  $('.js-d-book').textContent = a.status === 'prodat' ? 'Stan je prodat' : 'Zakaži razgledanje';
  $('.js-d-fav').classList.toggle('is-on', favs.includes(a.id));
  explorer.classList.add('has-drawer');
  document.body.classList.add('drawer-open');
  drawer.setAttribute('aria-hidden', 'false');
  explorer.classList.remove('show-filters');
  // kalkulator prati izabrani stan
  if (a.status !== 'prodat') { cPrice.value = a.price; calc(); }
}
function closeDrawer() {
  state.selected = null;
  explorer.classList.remove('has-drawer');
  document.body.classList.remove('drawer-open');
  drawer.setAttribute('aria-hidden', 'true');
}
$('.js-close').addEventListener('click', closeDrawer);
$('.js-d-fav').addEventListener('click', () => { if (state.selected) toggleFav(state.selected); });
$('.js-d-book').addEventListener('click', () => { if (state.selected && !favs.includes(state.selected)) toggleFav(state.selected); });

function openFromList(id) {
  const a = byId[id];
  scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  setTimeout(() => {
    enterFloor(a.floor, { recenter: true });
    setTimeout(() => openApt(a), reduced ? 0 : 900);
  }, reduced ? 0 : 500);
}

/* ---------- favoriti = stanovi u kontakt formi ---------- */
function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  store.set('sava-favs', favs);
  renderFavs();
  const b = $('.js-fav-open');
  b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
}
function renderFavs() {
  const b = $('.js-fav-open');
  $('.js-fav-count').textContent = favs.length;
  b.classList.toggle('has', favs.length > 0);
  if (state.selected) $('.js-d-fav').classList.toggle('is-on', favs.includes(state.selected));
  const wrap = $('.js-picked-chips');
  wrap.innerHTML = favs.length
    ? favs.map(id => `<span class="pchip">Stan ${id} · ${TYPES[byId[id].type].short}<button type="button" data-id="${id}" aria-label="Ukloni">×</button></span>`).join('')
    : '<em>Izaberite stan u 3D prikazu ili listi</em>';
  $$('button', wrap).forEach(x => x.addEventListener('click', () => toggleFav(x.dataset.id)));
}
$('.js-fav-open').addEventListener('click', () => $('#kontakt').scrollIntoView({ behavior: 'smooth' }));

/* =========================================================
   LISTA STANOVA
   ========================================================= */
let sortKey = 'id', shown = 12;
$$('.sort button').forEach(b => b.addEventListener('click', () => {
  $$('.sort button').forEach(x => x.classList.toggle('is-on', x === b));
  sortKey = b.dataset.sort; renderList(true);
}));
$('.js-more').addEventListener('click', () => { shown += 12; renderList(false); });
function renderList(reset) {
  if (reset) shown = 12;
  const list = apts.filter(matches).sort((a, b) => sortKey === 'id' ? (a.floor - b.floor || a.id.localeCompare(b.id)) : a[sortKey] - b[sortKey]);
  const free = apts.filter(a => a.status === 'slobodan').length;
  $('.js-list-sum').textContent = `${list.length} odgovara filteru · ${free} slobodnih od ${apts.length} ukupno`;
  const rows = $('.js-rows');
  const prev = reset ? 0 : rows.children.length;
  rows.innerHTML = list.length ? list.slice(0, shown).map((a, i) => `
    <div class="tr ${i >= prev ? 'is-new' : ''}" role="row" style="animation-delay:${(i - prev) * 30}ms">
      <span class="t-id">${a.id}</span>
      <span class="t-type">${TYPES[a.type].label}<span class="t-m"> · ${fmt(a.area, 0)} m²</span></span>
      <span class="t-area">${fmt(a.area, 1)} m²</span>
      <span class="t-orient">${a.orient}</span>
      <span class="t-price">${a.status === 'prodat' ? '—' : eur(a.price)}</span>
      <span class="t-st" style="--c:${STATUS[a.status].color}"><i></i>${STATUS[a.status].label}</span>
      <button class="t-go" data-id="${a.id}">Vidi u 3D</button>
    </div>`).join('') : '<p class="empty">Nema stanova za izabrane filtere. Probajte veći budžet ili drugu strukturu.</p>';
  $$('.t-go', rows).forEach(b => b.addEventListener('click', () => openFromList(b.dataset.id)));
  $('.js-more').style.display = list.length > shown ? '' : 'none';
}

/* =========================================================
   KALKULATOR KREDITA
   ========================================================= */
const cPrice = $('.js-c-price'), cDown = $('.js-c-down'), cYears = $('.js-c-years');
let rateShown = 0, rateAnim;
function calc() {
  [cPrice, cDown, cYears].forEach(setRangeFill);
  const price = +cPrice.value, down = +cDown.value, years = +cYears.value;
  $('.js-c-price-out').textContent = eur(price);
  $('.js-c-down-out').textContent = `${down}% · ${eur(Math.round(price * down / 100))}`;
  $('.js-c-years-out').textContent = years + ' godina';
  const loan = price * (1 - down / 100);
  $('.js-c-loan').textContent = eur(Math.round(loan));
  $('.js-c-donut').style.strokeDashoffset = 314 * (down / 100);
  const target = Math.round(monthly(price, down, years));
  cancelAnimationFrame(rateAnim);
  const from = rateShown, t0 = performance.now();
  (function tick(now) {
    const t = clamp((now - t0) / 600);
    rateShown = Math.round(lerp(from, target, easeOut(t)));
    $('.js-c-rate').textContent = fmt(rateShown);
    if (t < 1) rateAnim = requestAnimationFrame(tick);
  })(t0);
}
[cPrice, cDown, cYears].forEach(r => r.addEventListener('input', calc));

/* =========================================================
   KONTAKT
   ========================================================= */
(() => {
  const days = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
  const slots = [];
  const d = new Date();
  while (slots.length < 6) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue;
    slots.push(`${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. · ${slots.length % 2 ? '17h' : '11h'}`);
  }
  const wrap = $('.js-slots');
  wrap.innerHTML = slots.map((s, i) => `<button type="button" class="chip ${i === 0 ? 'is-on' : ''}">${s}</button>`).join('');
  $$('.chip', wrap).forEach(c => c.addEventListener('click', () => $$('.chip', wrap).forEach(x => x.classList.toggle('is-on', x === c))));
  const f = $('.js-form');
  f.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('[required]', f).forEach(i => { const bad = !i.value.trim(); i.parentElement.classList.toggle('is-error', bad); if (bad) ok = false; });
    if (!ok) return;
    const slot = $('.chip.is-on', wrap)?.textContent || '';
    $('.js-done-txt').textContent = `Termin: ${slot}${favs.length ? ' · Stanovi: ' + favs.join(', ') : ''}. Potvrdu šaljemo SMS-om.`;
    f.classList.add('is-sent');
  });
  $$('input', f).forEach(i => i.addEventListener('input', () => i.parentElement.classList.remove('is-error')));
})();

/* =========================================================
   DAN / NOĆ, FILTERI NA MOBILNOM
   ========================================================= */
$('.js-daynight').addEventListener('click', () => {
  state.night = !state.night;
  explorer.classList.toggle('is-night', state.night);
  $('.js-dn-label').textContent = state.night ? 'Dan' : 'Noć';
});
$('.js-filters-toggle').addEventListener('click', () => explorer.classList.toggle('show-filters'));

const C_SUN_DAY = new THREE.Color('#fff1dc'), C_SUN_NIGHT = new THREE.Color('#8fa6ff');
const C_HEMI_DAY = new THREE.Color('#e6eef5'), C_HEMI_NIGHT = new THREE.Color('#2b3142');
const C_WATER_DAY = new THREE.Color('#7f9aa8'), C_WATER_NIGHT = new THREE.Color('#141c26');
const C_GROUND_DAY = new THREE.Color('#d8d0c0'), C_GROUND_NIGHT = new THREE.Color('#2a2925');
function applyNight(t) {
  hemi.intensity = lerp(1.25, .4, t);
  hemi.color.copy(C_HEMI_DAY).lerp(C_HEMI_NIGHT, t);
  sun.intensity = lerp(2.6, .3, t);
  sun.color.copy(C_SUN_DAY).lerp(C_SUN_NIGHT, t);
  scene.fog.color.copy(DAY_FOG).lerp(NIGHT_FOG, t);
  M.water.color.copy(C_WATER_DAY).lerp(C_WATER_NIGHT, t);
  M.ground.color.copy(C_GROUND_DAY).lerp(C_GROUND_NIGHT, t);
  M.lamp.emissiveIntensity = t * 3;
  levels.forEach(L => L.mats.forEach(m => {
    if (m.emissiveMap) m.emissiveIntensity = t * 1.15;
    else if (m.color && m.emissive && m.color.getHexString() === 'ff5a1f') m.emissiveIntensity = t * .6;
  }));
}

/* =========================================================
   PETLJA
   ========================================================= */
let visible = true, last = performance.now(), introStart = 0;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(explorer);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 42 : 32;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (!visible) return;

  // tranzicija kamere
  if (camTween) {
    const t = clamp((now - camTween.t0) / camTween.dur), e = easeInOut(t);
    camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
    controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
    if (t >= 1) { camTween = null; controls.enabled = true; }
  }
  // automatska rotacija kad nema interakcije
  controls.autoRotate = state.mode === 'building' && !camTween && now - idleTimer > 5000 && !reduced;
  controls.update();

  // noć
  const nt = state.night ? 1 : 0;
  if (Math.abs(state.nightT - nt) > .001) { state.nightT = lerp(state.nightT, nt, 1 - Math.pow(.02, dt)); applyNight(state.nightT); }

  // spratovi
  const k = 1 - Math.pow(.004, dt);
  levels.forEach(L => {
    if (introStart && L.drop > 0 && now - introStart > L.dropDelay) L.drop = Math.max(0, L.drop - dt * 1.6);
    L.lift = lerp(L.lift, L.liftT, k);
    L.shellO = lerp(L.shellO, L.shellT, k * 1.2);
    const dropE = easeOut(1 - L.drop);
    L.g.position.y = L.baseY + easeInOut(clamp(L.lift)) * 34 + (1 - dropE) * 40;
    const op = clamp(L.shellO * (1 - L.lift) * dropE);
    L.shell.visible = op > .01;
    L.mats.forEach(m => {
      const o = op * (m.userData.baseOpacity ?? 1);
      m.opacity = o;
      const tr = o < .999 || m.userData.baseOpacity < 1;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.depthWrite = o > .6 && m.userData.baseOpacity === 1;
    });
    L.shell.traverse(o => { if (o.isMesh) o.castShadow = op > .5; });
    if (L.interior && L.interior.visible) {
      L.inT = Math.min(1, L.inT + dt * 1.4);
      const s = easeOut(L.inT);
      L.interior.scale.set(1, s, 1);
    }
  });

  // ploče stanova: hover/selektovan
  if (state.mode === 'floor') {
    plateHit.forEach(p => {
      const on = p.userData.apt === hoverApt || p.userData.apt === state.selected;
      const ty = p.userData.baseY + (on ? .6 : 0);
      p.position.y = lerp(p.position.y, ty, k);
      p.material.emissiveIntensity = lerp(p.material.emissiveIntensity, on ? .45 : 0, k);
    });
  }

  // highlight sprata
  const showHl = state.mode === 'building' && hoverFloor >= 1 && !camTween;
  hl.userData.o = lerp(hl.userData.o, showHl ? 1 : 0, k);
  hl.visible = hl.userData.o > .02;
  if (hoverFloor >= 1) {
    const L = levels[hoverFloor];
    hl.position.y = L.g.position.y + L.h / 2 + .1;
    hl.scale.y = L.h + .1;
  }
  hl.children[0].material.opacity = .3 * hl.userData.o;
  hl.children[1].material.opacity = hl.userData.o;
  hl.children[1].material.transparent = true;

  if (needsPick || controls.autoRotate) pick();
  updateTags();
  if (tipOn) tip.style.transform = '';
  tip.style.left = pointer.x + 'px'; tip.style.top = pointer.y + 'px';

  renderer.render(scene, camera);
}

/* =========================================================
   START
   ========================================================= */
function boot() {
  resize();
  const t = new THREE.Vector3(0, HOME.targetY, 0);
  camera.position.copy(sphericalPos(t, (isMobile() ? HOME.dist * 1.35 : HOME.dist) * 1.6, .7, .9));
  controls.target.copy(t);
  controls.update();
  applyNight(0);
  applyFilter();
  renderFavs();
  calc();
  const free = apts.filter(a => a.status === 'slobodan');
  $('.js-kpi-free').textContent = free.length;
  $('.js-kpi-from').textContent = fmt(Math.min(...apts.map(a => a.ppm)));
  requestAnimationFrame(frame);

  // loader
  const bars = $$('.loader__floors i');
  const dur = reduced ? 200 : 1300, t0 = performance.now();
  (function tick(now) {
    const p = clamp((now - t0) / dur);
    bars.forEach((b, i) => b.classList.toggle('on', i < Math.round(p * bars.length)));
    $('.js-load').textContent = Math.round(p * 100) + '%';
    if (p < 1) return requestAnimationFrame(tick);
    $('.loader').classList.add('is-out');
    document.body.classList.remove('is-loading');
    introStart = performance.now();
    flyTo(t, sphericalPos(t, isMobile() ? HOME.dist * 1.35 : HOME.dist, HOME.polar, .62), reduced ? 1 : 2600);
    idleTimer = performance.now() - 2000;
    setTimeout(() => $('.salty').classList.add('is-in'), 2500);
  })(t0);

  // lokacija: animacija traka
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { $('.dist').classList.add('is-in'); o.disconnect(); } }, { threshold: .4 }).observe($('.dist'));
}

// Sačekaj fontove (nekoliko stotina ms max) pa kreni
Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1200))]).then(boot);

// Za testove i debug
window.__sava = { enterFloor, exitFloor, openApt: id => openApt(byId[id]), state, apts };
