import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ===========================================================================
// 基本セットアップ
// ===========================================================================
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe9ff);
scene.fog = new THREE.Fog(0xbfe9ff, 28, 70);

{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
}

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4.2, 9.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minPolarAngle = Math.PI * 0.12;

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8fbb6e, 0.35);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.position.set(6, 10, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ===========================================================================
// 草原
// ===========================================================================
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(45, 48),
  new THREE.MeshStandardMaterial({ color: 0x7cc25e, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

{
  const grassGeo = new THREE.ConeGeometry(0.024, 0.2, 4);
  grassGeo.translate(0, 0.1, 0);
  const grassMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 600);
  const dummy = new THREE.Object3D();
  const colA = new THREE.Color(0x7bc35a);
  const colB = new THREE.Color(0x9cd977);
  const col = new THREE.Color();
  for (let i = 0; i < 600; i++) {
    const r = 2 + Math.pow(Math.random(), 0.7) * 16;
    const a = Math.random() * Math.PI * 2;
    dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
    dummy.scale.setScalar(0.7 + Math.random() * 0.9);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, col.lerpColors(colA, colB, Math.random()));
  }
  grass.instanceMatrix.needsUpdate = true;
  scene.add(grass);
}

{
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.22, 5);
  stemGeo.translate(0, 0.11, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f9b3e, roughness: 1 });
  const petalGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const centerGeo = new THREE.SphereGeometry(0.028, 8, 6);
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xffd75e, roughness: 0.8 });
  const petalColors = [0xffffff, 0xffd9e6, 0xfff3c4, 0xe6dbff];

  for (let i = 0; i < 34; i++) {
    const g = new THREE.Group();
    const r = 3 + Math.random() * 13;
    const a = Math.random() * Math.PI * 2;
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(new THREE.Mesh(stemGeo, stemMat));
    const petalMat = new THREE.MeshStandardMaterial({
      color: petalColors[i % petalColors.length],
      roughness: 0.85,
    });
    for (let p = 0; p < 5; p++) {
      const pm = new THREE.Mesh(petalGeo, petalMat);
      const pa = (p / 5) * Math.PI * 2;
      pm.position.set(Math.cos(pa) * 0.05, 0.22, Math.sin(pa) * 0.05);
      pm.scale.set(1, 0.55, 1);
      g.add(pm);
    }
    const c = new THREE.Mesh(centerGeo, centerMat);
    c.position.y = 0.235;
    g.add(c);
    g.rotation.y = Math.random() * Math.PI;
    scene.add(g);
  }
}

// 雲
const clouds = [];
{
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xf4f9ff, emissiveIntensity: 0.75 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const s = 0.9 + Math.random() * 1.3;
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), cloudMat);
      m.position.set(j * 1.2 - n * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.8);
      m.scale.y = 0.55;
      g.add(m);
    }
    const a = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 14;
    g.position.set(Math.cos(a) * r, 8 + Math.random() * 4, Math.sin(a) * r);
    g.userData.speed = 0.15 + Math.random() * 0.2;
    scene.add(g);
    clouds.push(g);
  }
}

// ちょうちょ
const butterflies = [];
{
  const wingGeo = new THREE.CircleGeometry(0.09, 8);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: [0xfff2a8, 0xffc4dd, 0xc8e8ff][i], side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, mat);
    const wr = new THREE.Mesh(wingGeo, mat);
    wl.position.x = -0.07; wr.position.x = 0.07;
    g.add(wl, wr);
    g.userData = {
      wl, wr, phase: Math.random() * 10,
      cx: (Math.random() - 0.5) * 8, cz: (Math.random() - 0.5) * 8,
      rx: 2 + Math.random() * 3, rz: 2 + Math.random() * 3, speed: 0.25 + Math.random() * 0.2,
    };
    scene.add(g);
    butterflies.push(g);
  }
}

// 星(夜だけ)
const stars = (() => {
  const n = 220;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const el = Math.random() * Math.PI * 0.42;
    const r = 40;
    pos[i * 3] = Math.cos(a) * Math.cos(el) * r;
    pos[i * 3 + 1] = Math.sin(el) * r + 4;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const p = new THREE.Points(geo, mat);
  scene.add(p);
  return p;
})();

// 足もとの影(犬ごとに使う共有アセット)
const shadowTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(40, 60, 20, 0.35)');
  grad.addColorStop(1, 'rgba(40, 60, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
})();
const shadowGeo = new THREE.PlaneGeometry(2.6, 2.6);
const shadowBaseMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

// ===========================================================================
// 時間帯連動
// ===========================================================================
const DAY_STOPS = [
  { h: 0,    sky: 0x0b1030, sun: 0x24427a, sunI: 0.25, hemiI: 0.16, star: 1.0 },
  { h: 5,    sky: 0x25314f, sun: 0x4a5a86, sunI: 0.45, hemiI: 0.22, star: 0.8 },
  { h: 7,    sky: 0xf3b98a, sun: 0xffd9a0, sunI: 1.10, hemiI: 0.30, star: 0.0 },
  { h: 11,   sky: 0xbfe9ff, sun: 0xfff1d6, sunI: 1.60, hemiI: 0.35, star: 0.0 },
  { h: 16,   sky: 0xbfe9ff, sun: 0xfff1d6, sunI: 1.55, hemiI: 0.35, star: 0.0 },
  { h: 18.5, sky: 0xf6a06b, sun: 0xffb877, sunI: 1.15, hemiI: 0.30, star: 0.05 },
  { h: 20.5, sky: 0x2a2f52, sun: 0x3a4a80, sunI: 0.45, hemiI: 0.22, star: 0.7 },
  { h: 24,   sky: 0x0b1030, sun: 0x24427a, sunI: 0.25, hemiI: 0.16, star: 1.0 },
];
const _cA = new THREE.Color();
const _cB = new THREE.Color();
let forcedHour = null;
let nightFactor = 0;

function applyDaylight(hour) {
  let a = DAY_STOPS[0], b = DAY_STOPS[DAY_STOPS.length - 1];
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    if (hour >= DAY_STOPS[i].h && hour <= DAY_STOPS[i + 1].h) { a = DAY_STOPS[i]; b = DAY_STOPS[i + 1]; break; }
  }
  const k = a.h === b.h ? 0 : (hour - a.h) / (b.h - a.h);
  const sky = _cA.setHex(a.sky).lerp(_cB.setHex(b.sky), k).clone();
  scene.background = sky;
  scene.fog.color.copy(sky);
  sun.color.copy(_cA.setHex(a.sun).lerp(_cB.setHex(b.sun), k));
  sun.intensity = a.sunI + (b.sunI - a.sunI) * k;
  hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
  nightFactor = a.star + (b.star - a.star) * k;
  stars.material.opacity = nightFactor * 0.9;
}
function currentHour() {
  if (forcedHour != null) return forcedHour;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function timeBand() {
  const h = currentHour();
  if (h < 5 || h >= 20) return 'night';
  if (h < 9) return 'morning';
  if (h >= 17) return 'evening';
  return 'day';
}
applyDaylight(currentHour());

// ===========================================================================
// なつき度(群れ共通)
// ===========================================================================
const bond = {
  points: Number(localStorage.getItem('pd_bond') || 0),
  add(n) {
    this.points = Math.min(2000, this.points + n);
    localStorage.setItem('pd_bond', String(this.points));
    updateHearts();
  },
  get level() {
    const p = this.points;
    return p < 25 ? 1 : p < 80 ? 2 : p < 200 ? 3 : 4;
  },
};
function updateHearts() {
  const el = document.getElementById('hearts');
  if (!el) return;
  const lv = bond.level;
  el.textContent = '💛'.repeat(lv) + '🤍'.repeat(4 - lv);
}

// ===========================================================================
// ピラミッド犬
// ===========================================================================
const _q = new THREE.Quaternion();
const _earAxis = new THREE.Vector3(0, 0, 1);

class PyramidDog {
  constructor({ scale = 1 } = {}) {
    this.baseScale = scale;
    this.isChibi = scale < 1;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.loaded = false;

    this.hitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    this.hitSphere.position.y = 0.75;
    this.group.add(this.hitSphere);

    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, 0.55, 0.72);
    this.group.add(this.mouth);

    this.shadow = new THREE.Mesh(shadowGeo, shadowBaseMat.clone());
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;

    this.state = 'idle';
    this.stateTime = 2;
    this.heading = Math.random() * Math.PI * 2;
    this.target = new THREE.Vector2();
    this.hopPhase = 0;
    this.walkElapsed = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkT = -1;
    this.earLift = 0;
    this.reactT = 0;
    this.reactBase = 0;
    this.awakeTime = Math.random() * 8;
    this.zzzTimer = 0;
    this.petting = false;
    this.tongueOut = 1;
    this.tongueTimer = 4 + Math.random() * 3;
    this.onArrive = null;
    this.attendAngle = 0;
    this.tiltDir = 1;
    this.eatT = 0;
    this.nextBite = 0;
    this.eatDuration = 2.3;
    this.eating = null;
    this.happyTimer = 0;
    this.zoomLeft = 0;
    this.spawnT = 1; // 1=通常, <1=ポップイン中
    this.dropY = 0; // つかんで はなした後の落下高さ
    this.dropV = 0; // 落下速度
  }

  attachModel(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (o.material) o.material.side = THREE.DoubleSide;
      }
    });
    this.body.add(root);
    this.eyeL = root.getObjectByName('EyeL');
    this.eyeR = root.getObjectByName('EyeR');
    this.eyeClosedL = root.getObjectByName('EyeClosedL');
    this.eyeClosedR = root.getObjectByName('EyeClosedR');
    this.tongue = root.getObjectByName('Tongue');
    this.earL = root.getObjectByName('EarL');
    this.earR = root.getObjectByName('EarR');
    this.earBaseL = this.earL.quaternion.clone();
    this.earBaseR = this.earR.quaternion.clone();
    this.eyeClosedL.visible = false;
    this.eyeClosedR.visible = false;
    this.loaded = true;
  }

  setState(s, dur) { this.state = s; this.stateTime = dur; }

  chooseNext() {
    const roll = Math.random();
    if (this.awakeTime > 22 && roll < 0.22) { this.startSleep(); return; }
    if (roll < 0.06) { this.startZoomies(); return; }
    if (roll < 0.15) { this.chaseButterfly(); return; }
    if (roll < 0.62) { this.startWalk(); return; }
    this.setState('idle', 1.5 + Math.random() * 3);
  }

  startWalk() {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 5;
    this.target.set(this.group.position.x + Math.cos(a) * r, this.group.position.z + Math.sin(a) * r);
    this.clampTarget();
    this.walkElapsed = 0;
    this.setState('walk', 30);
  }

  clampTarget() {
    this.target.x = THREE.MathUtils.clamp(this.target.x, -14, 14);
    this.target.y = THREE.MathUtils.clamp(this.target.y, -14, 14);
  }

  goTo(x, z, onArrive) {
    if (this.state === 'eat' || this.state === 'held' || this.state === 'drop') return;
    if (this.state === 'sleep') this.wake();
    this.target.set(x, z);
    this.clampTarget();
    this.onArrive = onArrive || null;
    this.walkElapsed = 0;
    this.setState('walk', 30);
  }

  startZoomies() { this.zoomLeft = 3; this.happyTimer = 4; this.pickZoomTarget(); speak(this, 'zoomies', 1.6); }
  pickZoomTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 5;
    this.target.set(Math.cos(a) * r, Math.sin(a) * r);
    this.walkElapsed = 0.5;
    this.setState('zoomies', 8);
  }

  chaseButterfly() {
    const b = randomOf(butterflies);
    this.goTo(b.position.x, b.position.z, () => {
      this.attend(Math.atan2(b.position.x - this.group.position.x, b.position.z - this.group.position.z));
      speak(this, 'chase', 2);
    });
    speak(this, 'chaseStart', 1.6);
  }

  startSleep() { this.setState('sleep', 10 + Math.random() * 14); this.zzzTimer = 1; speak(this, 'sleep', 2.5); }
  wake() { this.awakeTime = 0; this.setState('idle', 1 + Math.random() * 2); }

  attend(angle) {
    if (this.state === 'eat' || this.state === 'held' || this.state === 'drop') return;
    if (this.state === 'sleep') this.wake();
    this.attendAngle = angle;
    this.tiltDir = Math.random() < 0.5 ? 1 : -1;
    this.onArrive = null;
    this.setState('attend', 1.6);
  }

  react() {
    if (this.state === 'eat' || this.state === 'held' || this.state === 'drop') return;
    if (this.state === 'sleep') { this.wake(); speak(this, 'wake', 2); return; }
    this.onArrive = null;
    this.state = 'react';
    this.reactT = 0;
    this.reactBase = this.heading;
    this.happyTimer = 2.5;
    spawnFxAt(this.group.position, 'heart', '💛', 3, { x: 0, y: 0 }, 1.6 * this.baseScale);
    bond.add(1);
    if (Math.random() < 0.4) speak(this, 'tap', 2.5);
  }

  update(dt, t) {
    // ポップイン(ふやした時)
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt / 0.45);
      this.group.scale.setScalar(Math.max(0.001, this.baseScale * easeOutBack(this.spawnT)));
    } else if (this.group.scale.x !== this.baseScale) {
      this.group.scale.setScalar(this.baseScale);
    }

    if (this.state !== 'sleep') this.awakeTime += dt;
    if (this.happyTimer > 0) this.happyTimer -= dt;

    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.13) this.blinkT = -1;
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) { this.blinkT = 0; this.blinkTimer = 1.5 + Math.random() * 3.5; }
    }

    this.tongueTimer -= dt;
    if (this.tongueTimer <= 0) { this.tongueOut = this.tongueOut > 0.5 ? 0 : 1; this.tongueTimer = 2.5 + Math.random() * 5; }

    let hopY = 0, squash = 1, rock = 0, pitch = 0, earTarget = 0, eyesClosed = false, yaw = 0;

    switch (this.state) {
      case 'idle': {
        this.stateTime -= dt;
        squash = 1 + Math.sin(t * 2.2) * 0.015;
        if (this.stateTime <= 0) this.chooseNext();
        break;
      }
      case 'walk':
      case 'zoomies': {
        const zoom = this.state === 'zoomies';
        this.stateTime -= dt;
        this.walkElapsed += dt;
        const pos = this.group.position;
        const dx = this.target.x - pos.x;
        const dz = this.target.y - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25 || this.stateTime <= 0) {
          if (zoom && this.zoomLeft > 1 && this.stateTime > 0) { this.zoomLeft--; this.pickZoomTarget(); break; }
          this.zoomLeft = 0;
          this.setState('idle', 1.2 + Math.random() * 2.5);
          if (this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(); }
          break;
        }
        const want = Math.atan2(dx, dz);
        this.heading += shortestAngle(this.heading, want) * Math.min(1, dt * (zoom ? 6 : 4));
        const accel = Math.min(1, this.walkElapsed / 0.5);
        const decel = Math.min(1, dist / 0.9);
        const base = (zoom ? 2.6 : 1.15) * (0.5 + 0.5 * this.baseScale);
        const sp = base * Math.min(accel, decel) + 0.12;
        pos.x += Math.sin(this.heading) * sp * dt;
        pos.z += Math.cos(this.heading) * sp * dt;
        this.hopPhase += dt * (4 + sp * 4);
        const s = Math.abs(Math.sin(this.hopPhase));
        hopY = s * (zoom ? 0.24 : 0.16) * Math.min(1, sp / base + 0.2);
        squash = 0.92 + s * 0.1;
        rock = Math.sin(this.hopPhase) * (zoom ? 0.1 : 0.06);
        earTarget = (zoom ? 0.6 : 0.25) + s * 0.2;
        break;
      }
      case 'sleep': {
        this.stateTime -= dt;
        eyesClosed = true;
        squash = 1 + Math.sin(t * 1.1) * 0.035;
        this.zzzTimer -= dt;
        if (this.zzzTimer <= 0) { spawnFxAt(this.group.position, 'zzz', 'Z', 1, { x: 40, y: -60 }, 1.6 * this.baseScale); this.zzzTimer = 1.6; }
        if (this.stateTime <= 0) this.wake();
        break;
      }
      case 'attend': {
        this.stateTime -= dt;
        this.heading += shortestAngle(this.heading, this.attendAngle) * Math.min(1, dt * 6);
        const p = 1 - this.stateTime / 1.6;
        rock = this.tiltDir * 0.22 * Math.sin(Math.min(1, p * 2.2) * Math.PI * 0.5);
        squash = 1 + Math.sin(t * 2.2) * 0.015;
        earTarget = 0.7;
        if (this.stateTime <= 0) this.setState('idle', 2 + Math.random() * 2);
        break;
      }
      case 'eat': {
        this.eatT += dt;
        pitch = Math.abs(Math.sin(this.eatT * 6)) * 0.15;
        squash = 1 + Math.sin(this.eatT * 12) * 0.02;
        earTarget = 0.3;
        if (this.eating && this.eatT >= this.nextBite) { this.nextBite += 0.55; biteTreat(); }
        if (this.eatT > this.eatDuration) finishEating(this);
        break;
      }
      case 'react': {
        this.reactT += dt / 0.85;
        const p = Math.min(this.reactT, 1);
        hopY = 4 * 0.55 * p * (1 - p);
        this.heading = this.reactBase + easeInOut(p) * Math.PI * 2;
        earTarget = 1;
        squash = p < 0.15 ? 0.85 : 1.03;
        eyesClosed = p > 0.2 && p < 0.85;
        if (this.reactT >= 1) { this.heading = this.reactBase; this.setState('idle', 1.5 + Math.random() * 2); }
        break;
      }
      case 'held': {
        // ぶらさがって ゆらゆら
        hopY = 1.1;
        rock = Math.sin(t * 3) * 0.12;
        earTarget = 0.9;
        squash = 1;
        break;
      }
      case 'drop': {
        this.dropV -= 20 * dt;
        this.dropY += this.dropV * dt;
        hopY = Math.max(0, this.dropY);
        earTarget = 0.6;
        if (this.dropY <= 0) {
          this.dropY = 0;
          playBounce();
          spawnFxAt(this.group.position, 'heart', '💛', 2, { x: 0, y: 0 }, 1.6 * this.baseScale);
          speak(this, 'dropped', 2.2);
          bond.add(1);
          this.setState('idle', 1.5 + Math.random() * 2);
        }
        break;
      }
    }

    if (this.petting && this.state !== 'react') {
      eyesClosed = true;
      squash *= 1 + Math.sin(t * 9) * 0.025;
      earTarget = Math.max(earTarget, 0.35);
    }
    if (this.happyTimer > 0 || this.petting) yaw = Math.sin(t * 17) * 0.05 * (this.petting ? 0.7 : 1);

    this.group.position.y = hopY * this.baseScale;
    this.group.rotation.y = this.heading + yaw;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.body.rotation.z = rock;
    this.body.rotation.x = pitch;

    this.earLift += (earTarget - this.earLift) * Math.min(1, dt * 6);

    // 影
    this.shadow.position.x = this.group.position.x;
    this.shadow.position.z = this.group.position.z;
    const airFade = Math.max(0.3, 1 - hopY * 0.8);
    const sc = airFade * (this.spawnT < 1 ? this.spawnT : 1);
    this.shadow.scale.setScalar(sc * this.baseScale);
    this.shadow.material.opacity = airFade;

    if (!this.loaded) return;

    const flapping = this.state === 'walk' || this.state === 'zoomies' || this.state === 'react';
    const flap = flapping ? Math.sin(t * 6) * 0.03 : 0;
    const lift = this.earLift * 0.7 + flap;
    _q.setFromAxisAngle(_earAxis, -lift);
    this.earL.quaternion.copy(this.earBaseL).multiply(_q);
    _q.setFromAxisAngle(_earAxis, lift);
    this.earR.quaternion.copy(this.earBaseR).multiply(_q);

    const closed = eyesClosed || this.blinkT >= 0;
    this.eyeL.visible = !closed;
    this.eyeR.visible = !closed;
    this.eyeClosedL.visible = closed;
    this.eyeClosedR.visible = closed;

    const tScale = this.state === 'sleep' ? 0.4 : this.tongueOut;
    const ts = this.tongue.scale.y + (Math.max(0.15, tScale) - this.tongue.scale.y) * Math.min(1, dt * 8);
    this.tongue.scale.set(1, ts, ts);
  }
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function easeInOut(x) { return x * x * (3 - 2 * x); }
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ===========================================================================
// 群れ(複数のピラミッド犬。通常サイズ+ちびサイズを同じ配列で管理)
// ===========================================================================
const MAX_NORMAL = 5;
const MAX_CHIBI = 5;
const dogs = [];
let modelProto = null;

function cloneModel() { return modelProto ? modelProto.clone(true) : null; }

function spawnDog(opts = {}) {
  const chibi = !!opts.chibi;
  const countOfKind = dogs.filter((d) => d.isChibi === chibi).length;
  if (countOfKind >= (chibi ? MAX_CHIBI : MAX_NORMAL)) return null;
  const d = new PyramidDog(chibi ? { scale: 0.5 } : {});
  if (modelProto) d.attachModel(cloneModel());
  // 位置: 最初の1匹は中央、以降は既存の犬の近くに
  if (dogs.length === 0) {
    d.group.position.set(0, 0, 0);
  } else {
    const near = randomOf(dogs);
    const a = Math.random() * Math.PI * 2;
    const r = 1.4 + Math.random() * 1.6;
    d.group.position.set(
      THREE.MathUtils.clamp(near.group.position.x + Math.cos(a) * r, -12, 12),
      0,
      THREE.MathUtils.clamp(near.group.position.z + Math.sin(a) * r, -12, 12)
    );
  }
  if (opts.pop) {
    d.spawnT = 0;
    d.group.scale.setScalar(0.001);
    spawnFxAt(d.group.position, 'heart', '✨', 4, { x: 0, y: 0 }, 1.6 * d.baseScale);
    speak(d, chibi ? 'helloChibi' : 'hello', 2.2);
    playChirp();
  }
  scene.add(d.group);
  scene.add(d.shadow);
  dogs.push(d);
  if (chibi) localStorage.setItem('pd_chibi_count', String(dogs.filter((x) => x.isChibi).length));
  else localStorage.setItem('pd_count', String(dogs.filter((x) => !x.isChibi).length));
  updateDogCountUI();
  return d;
}

function removeDog(chibi) {
  const kindDogs = dogs.filter((x) => x.isChibi === !!chibi);
  if (!chibi && kindDogs.length <= 1) return; // 通常は1匹未満にはできない
  if (chibi && kindDogs.length <= 0) return;
  // 配列の後ろから、その種類の最後の1匹を探して削除
  let idx = -1;
  for (let i = dogs.length - 1; i >= 0; i--) {
    if (dogs[i].isChibi === !!chibi) { idx = i; break; }
  }
  if (idx < 0) return;
  const d = dogs[idx];
  dogs.splice(idx, 1);
  scene.remove(d.group);
  scene.remove(d.shadow);
  if (d === fetcher) { if (ball) { scene.remove(ball); ball = null; } fetcher = null; ballState = 'none'; }
  if (d === treatEater) { if (treat) { scene.remove(treat); treat = null; } treatEater = null; }
  if (chibi) localStorage.setItem('pd_chibi_count', String(dogs.filter((x) => x.isChibi).length));
  else localStorage.setItem('pd_count', String(dogs.filter((x) => !x.isChibi).length));
  updateDogCountUI();
}

function nearestDogTo(x, z, filter) {
  let best = null, bd = 1e9;
  for (const d of dogs) {
    if (filter && !filter(d)) continue;
    const dd = (d.group.position.x - x) ** 2 + (d.group.position.z - z) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
function focusedDog() { return nearestDogTo(camera.position.x, camera.position.z) || dogs[0]; }
function angleTo(d) { return Math.atan2(camera.position.x - d.group.position.x, camera.position.z - d.group.position.z); }

function updateDogCountUI() {
  const normalCount = dogs.filter((d) => !d.isChibi).length;
  const chibiCount = dogs.filter((d) => d.isChibi).length;
  const elN = document.getElementById('dog-count');
  if (elN) elN.textContent = `${normalCount}/${MAX_NORMAL}`;
  const elC = document.getElementById('chibi-count');
  if (elC) elC.textContent = `${chibiCount}/${MAX_CHIBI}`;
}

// モデル読み込み → 保存された匹数ぶん配置(通常+ちび)
new GLTFLoader().load(`assets/piramidog.glb?v=tripo-self-1`, (gltf) => {
  modelProto = gltf.scene;
  const savedNormal = THREE.MathUtils.clamp(Number(localStorage.getItem('pd_count') || 1), 1, MAX_NORMAL);
  const savedChibi = THREE.MathUtils.clamp(Number(localStorage.getItem('pd_chibi_count') || 0), 0, MAX_CHIBI);
  for (let i = 0; i < savedNormal; i++) spawnDog();
  for (let i = 0; i < savedChibi; i++) spawnDog({ chibi: true });
  window.piramidog = dogs[0];
  window.__dogs = dogs;
  updateDogCountUI();
});

window.__debugCam = { camera, controls: () => controls };

// ===========================================================================
// カメラ方向ヘルパー
// ===========================================================================
function cameraGroundDir() {
  const v = new THREE.Vector3(camera.position.x, 0, camera.position.z);
  if (v.lengthSq() < 0.01) v.set(0, 0, 1);
  return v.normalize();
}

// ===========================================================================
// アクション: こっちむいて / おいで(群れ全員)
// ===========================================================================
function lookAtMe() {
  if (!dogs.length) return;
  for (const d of dogs) if (d.state !== 'eat') d.attend(angleTo(d));
  playBark();
  speak(focusedDog(), 'lookAt', 2);
}
function comeHere() {
  if (!dogs.length) return;
  const dir = cameraGroundDir();
  const px = -dir.z, pz = dir.x; // 直交方向(横に広がる)
  const base = Math.min(4.2, Math.max(2.5, camera.position.length() * 0.4));
  dogs.forEach((d, i) => {
    if (d.state === 'eat') return;
    const off = (i - (dogs.length - 1) / 2) * 1.15;
    d.goTo(dir.x * base + px * off, dir.z * base + pz * off, () => d.attend(angleTo(d)));
  });
  speak(focusedDog(), 'coming', 2);
  playChirp();
  bond.add(2);
}

// ===========================================================================
// おやつ(りんご / ほね / クッキー)
// ===========================================================================
const TREATS = {
  apple: {
    emoji: '🍎', bites: 3, lines: ['おいしい〜!', 'りんご だいすき!', 'あまずっぱい!'],
    linesDoku: ['すっぱ。…もう1こ よこせ', 'まあ たべられなくは ない'],
    make() {
      const g = new THREE.Group();
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), new THREE.MeshStandardMaterial({ color: 0xd93b36, roughness: 0.35 }));
      fruit.scale.y = 0.92; fruit.position.y = 0.15; fruit.castShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.09, 6), new THREE.MeshStandardMaterial({ color: 0x6d4a2a, roughness: 0.9 }));
      stem.position.y = 0.32; stem.rotation.z = 0.15;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x5fae4a, roughness: 0.7 }));
      leaf.scale.set(1, 0.35, 0.55); leaf.position.set(0.06, 0.34, 0);
      g.add(fruit, stem, leaf); return g;
    },
  },
  bone: {
    emoji: '🦴', bites: 4, lines: ['ほね さいこう!', 'かみごたえ ばつぐん!', 'ごきげん!'],
    linesDoku: ['ふん、まあまあだな', 'かみごたえだけは みとめる'],
    make() {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xf3ecd6, roughness: 0.5 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10), mat);
      shaft.rotation.z = Math.PI / 2; shaft.position.y = 0.13; shaft.castShadow = true; g.add(shaft);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), mat);
        k.position.set(sx * 0.17, 0.13, sz * 0.05); g.add(k);
      }
      return g;
    },
  },
  cookie: {
    emoji: '🍪', bites: 3, lines: ['あまくて しあわせ!', 'クッキー もっと!', 'さくさく!'],
    linesDoku: ['あまい。…きらいじゃない', 'こんなもので つられないぞ(もぐもぐ)'],
    make() {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xcaa15e, roughness: 0.7 }));
      c.position.y = 0.12; c.castShadow = true; g.add(c);
      const chip = new THREE.MeshStandardMaterial({ color: 0x4a2c19, roughness: 0.6 });
      for (let i = 0; i < 5; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), chip);
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.11;
        d.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r); g.add(d);
      }
      return g;
    },
  },
};
const TREAT_KINDS = Object.keys(TREATS);
let treatIndex = 0;
let treat = null;
let treatDef = null;
let treatEater = null;

function giveTreat(kind) {
  if (!dogs.length || treat) return;
  const def = TREATS[kind] || TREATS.apple;
  treatDef = def;
  const eater = focusedDog();
  if (!eater || eater.state === 'eat') return;
  if (eater.state === 'sleep') eater.wake();
  const dir = cameraGroundDir();
  const pos = eater.group.position;
  const ax = THREE.MathUtils.clamp(pos.x + dir.x * 1.7, -7, 7);
  const az = THREE.MathUtils.clamp(pos.z + dir.z * 1.7, -7, 7);
  treat = def.make();
  treat.position.set(ax, 2.6, az);
  treat.userData.vy = 0;
  scene.add(treat);
  playTone({ freq: 520, freqEnd: 780, dur: 0.15, type: 'sine', gain: 0.12 });
  speak(eater, 'treatDrop', 2);
  const dx = ax - pos.x, dz = az - pos.z, d = Math.hypot(dx, dz) || 1;
  eater.goTo(ax - (dx / d) * 0.85, az - (dz / d) * 0.85, () => {
    if (!treat) return;
    eater.heading = Math.atan2(treat.position.x - eater.group.position.x, treat.position.z - eater.group.position.z);
    eater.eating = treat;
    eater.eatT = 0;
    eater.nextBite = 0.5;
    eater.eatDuration = 0.5 + def.bites * 0.55 + 0.2;
    treatEater = eater;
    eater.setState('eat', 12);
  });
}

function biteTreat() {
  if (!treat) return;
  playCrunch();
  const s = treat.scale.x * 0.66;
  if (s < 0.22) { scene.remove(treat); treat = null; if (treatEater) treatEater.eating = null; }
  else treat.scale.setScalar(s);
}

function finishEating(d) {
  if (treat) { scene.remove(treat); treat = null; }
  d.eating = null;
  spawnFxAt(d.group.position, 'heart', '💛', 3, { x: 0, y: 0 }, 1.6 * d.baseScale);
  const def = treatDef || TREATS.apple;
  showBubble(d, randomOf(mode === 'doku' ? def.linesDoku : def.lines), 2.5);
  playChirp();
  bond.add(3);
  treatEater = null;
  d.setState('idle', 2 + Math.random() * 2);
}

// ===========================================================================
// ボール遊び・とってこい(一番近い犬が拾う)
// ===========================================================================
let ball = null;
let ballState = 'none'; // none / flying / fetch / carry
let fetcher = null;

function makeBall() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.4 }));
  m.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  stripe.rotation.x = Math.PI / 2;
  g.add(m, stripe);
  g.position.y = 0.17;
  return g;
}

function throwBall() {
  if (!dogs.length || ballState === 'carry' || ballState === 'flying') return;
  if (ball) { scene.remove(ball); ball = null; }
  const thrower = focusedDog();
  const dir = cameraGroundDir();
  const start = thrower.group.position.clone();
  ball = makeBall();
  ball.position.set(start.x, 1.0, start.z);
  const away = dir.clone().multiplyScalar(-1);
  const power = 5.5 + Math.random() * 2;
  ball.userData = { vx: away.x * power, vy: 4.2, vz: away.z * power };
  scene.add(ball);
  ballState = 'flying';
  playTone({ freq: 300, freqEnd: 200, dur: 0.12, type: 'sine', gain: 0.1 });
  speak(thrower, 'ballThrow', 1.8);
}

function pickUpBall() {
  if (!ball || !fetcher) { ballState = 'none'; return; }
  ballState = 'carry';
  scene.remove(ball);
  fetcher.mouth.add(ball);
  ball.position.set(0, 0, 0);
  ball.scale.setScalar(1 / fetcher.baseScale); // ちびは group が0.5倍なので逆補正しないとボールが縮む
  ball.userData = {};
  playChirp();
  const dir = cameraGroundDir();
  const dist = Math.min(4.2, Math.max(2.5, camera.position.length() * 0.4));
  fetcher.goTo(dir.x * dist, dir.z * dist, dropBall);
  speak(fetcher, 'ballGot', 1.8);
}

function dropBall() {
  if (!ball || !fetcher) { ballState = 'none'; return; }
  scene.attach(ball);
  ball.position.y = 0.17;
  ball.scale.setScalar(1);
  ball.userData = {};
  ballState = 'none';
  fetcher.attend(angleTo(fetcher));
  spawnFxAt(fetcher.group.position, 'heart', '💛', 2, { x: 0, y: 0 }, 1.6 * fetcher.baseScale);
  bond.add(3);
  speak(fetcher, 'ballReturn', 2.2);
  fetcher = null;
}

// ===========================================================================
// モード(いやし ⇄ どくぜつ)
// ===========================================================================
let mode = localStorage.getItem('pd_mode') || 'iyashi'; // 'iyashi' | 'doku'

// ===========================================================================
// おしゃべり(文脈タグ付き)
// ===========================================================================
const LINES_IYASHI = {
  idle:   ['きょうも いいてんき だね!', 'おさんぽ たのしいなぁ', 'くさの におい、だいすき', 'ずっと いっしょに いようね', 'きみと いると あんしんする〜', 'わん!'],
  morning:['おはよう! きょうも あそぼ?', 'あさの くうき きもちいい〜', 'ん〜、よく ねむれた!'],
  day:    ['おひさま ぽかぽか!', 'ちょうちょ みつけた!', 'ピラミッドは じょうぶで じまんなんだ'],
  evening:['ゆうやけ きれいだね', 'そろそろ おなか すいたかも', 'きょうも たのしかったね'],
  night:  ['おほしさま きらきら…', 'よふかしは めっ、だよ?', 'しずかで きもちいいね…'],
  tap:    ['わーい! うれしい!', 'えへへ、くすぐったい', 'もっと あそぼ!', 'だいすき!'],
  petHead:['きもちいい〜…', 'うっとり…', 'なでなで だいすき'],
  petFace:['ふへへ、はなの あたま くすぐったい!', 'ぺろっ'],
  petBody:['あははっ、くすぐったいって〜!', 'そこは じゃれちゃう!'],
  lookAt: ['なあに?', 'よんだ?', 'わん!'],
  coming: ['いま いくー!', 'とことこ…', 'みんなで いくよ!'],
  sleep:  ['ふぁ〜… ちょっと おひるね…', ' zzz…'],
  wake:   ['はっ! おきたよ!', 'ん〜、おはよ…'],
  treatDrop:['わっ、たべもの だ!', 'いいにおい!'],
  ballThrow:['それっ、いってこーい!', 'まってて、とってくる!'],
  ballGot:  ['ゲット!', 'とれたよ!'],
  ballReturn:['もってきたよ!', 'もういっかい なげて!', 'えらい?'],
  chaseStart:['ちょうちょ まてまて〜!', 'つかまえるぞ〜'],
  chase:   ['あれ、いっちゃった…', 'にげ足 はやいなぁ'],
  zoomies: ['うおおお たのしー!', 'びゅーん!'],
  hello:   ['こんにちは!', 'はじめまして!', 'なかまに いれて!'],
  helloChibi: ['ちっちゃいけど よろしくね!', 'ちびだよ! よろしく!', 'ぼくも なかまに いれて!'],
  levelUp: ['きみと なかよしに なれた きがする!', 'えへへ、だいすきが ふえた!'],
  grabbed: ['わーい、たかいたかい!', 'ふわふわ する〜!'],
  dropped: ['とうちゃく!', 'もういっかい やって!'],
};

const LINES_DOKU = {
  idle:   ['ひまか? おれは いそがしい(ひなたぼっこで)', 'べつに きみを まってた わけじゃないし', 'ふーん、きょうも いるんだ', 'この くさ、あじは いまいちだな', 'わん(おざなり)'],
  morning:['あさから げんきだな…みならえない', 'ふぁ…もう おきる じかん?'],
  day:    ['ひるねの じゃまだけは するなよ', 'おひさま? まあ わるくない'],
  evening:['ゆうやけ? …まあ きれいだけど?', 'はらへった。はやく なんか くれ'],
  night:  ['よふかし するなよ、おれは ねる', 'ほし? かってに みろ。…きれいだな'],
  tap:    ['いてっ…べつに うれしくないし', 'なんだよ、かまって ほしいのか?', '…もういっかい やっても いいぞ'],
  petHead:['や、やめろって…(みみ ぴこぴこ)', 'そこは…わるくない'],
  petFace:['かおは やめろ! …つづけろ'],
  petBody:['くすぐったいって いってるだろ!'],
  lookAt: ['なんだよ', 'よぶな。…で、なに?'],
  coming: ['しかたないから いってやる', 'いそがしいんだけど…まあいい'],
  sleep:  ['おれの ひるねを じゃまするなよ', 'zzz…(いびき)'],
  wake:   ['…おこしたな?', 'いいところ だったのに'],
  treatDrop:['ふん、たべてやっても いい', 'わいろか? …うけとる'],
  ballThrow:['とってこい とか いうな…いくけど', 'なげたな? おぼえてろ(いってくる)'],
  ballGot:  ['とれた。とうぜんだろ'],
  ballReturn:['ほら。…もういっかい なげても いいぞ', 'かえしてやる。かんしゃしろよ'],
  chaseStart:['ちょうちょごときが おれから にげられると おもうなよ'],
  chase:   ['…みのがして やっただけだし'],
  zoomies: ['うおおお! …いまのは わざとだ'],
  hello:   ['ふん、よろしく', 'なかまが ひつようか?'],
  helloChibi: ['ちいさいけど なめるなよ', 'ちびって いうな!'],
  levelUp: ['べつに なついて ないからな! …ちょっとだけだぞ'],
  grabbed: ['おい! おろせ! …たかくて わるくないけど', 'あつかいが ざつなんだよ!'],
  dropped: ['らんぼうに おくな!', '…ふん、たのしかったけど'],
};

// 現在のモードに応じたセリフ集合を返す
function linePool(tag) {
  const L = mode === 'doku' ? LINES_DOKU : LINES_IYASHI;
  return L[tag] || L.idle;
}

const bubbleEl = document.getElementById('bubble');
let bubbleTimer = 0;
let bubbleDog = null;

function showBubble(d, text, dur = 3.5) {
  bubbleEl.textContent = text;
  bubbleEl.classList.add('show');
  bubbleTimer = dur;
  bubbleDog = d;
}
function speak(d, tag, dur = 3) {
  showBubble(d, randomOf(linePool(tag)), dur);
}
function packIdleChatter() {
  const talkers = dogs.filter((d) => d.state !== 'sleep' && d.state !== 'react' && d.state !== 'eat' && d.state !== 'held' && d.state !== 'drop');
  if (!talkers.length) return;
  const d = randomOf(talkers);
  const band = timeBand();
  const pool = linePool('idle').concat(linePool(band) || []);
  showBubble(d, randomOf(pool), 3.5);
}

// ===========================================================================
// エフェクト
// ===========================================================================
const fxLayer = document.getElementById('fx-layer');
const _v = new THREE.Vector3();
function worldToScreen(pos, yOffset = 0) {
  _v.set(pos.x, pos.y + yOffset, pos.z).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight };
}
function spawnFxAt(worldPos, cls, char, count = 1, offset = { x: 0, y: 0 }, yOff = 1.6) {
  const s = worldToScreen(worldPos, yOff);
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = `fx ${cls}`;
    el.textContent = char;
    el.style.left = `${s.x + offset.x + (Math.random() - 0.5) * 70}px`;
    el.style.top = `${s.y + offset.y + (Math.random() - 0.5) * 30}px`;
    fxLayer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ===========================================================================
// サウンド(Web Audio 合成)
// ===========================================================================
const audio = { ctx: null, master: null, enabled: true, started: false };
function initAudio() {
  if (audio.started) return;
  audio.started = true;
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.enabled ? 0.5 : 0;
  audio.master.connect(audio.ctx.destination);
  scheduleMelody();
  schedulePad();
}
function audioActive() { return audio.ctx && audio.enabled && !document.hidden; }
function playTone({ freq, freqEnd, dur = 0.5, type = 'sine', gain = 0.1, attack = 0.01 }) {
  if (!audio.ctx) return;
  const t0 = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur * 0.8);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.5];
function scheduleMelody() {
  if (!audio.ctx) return;
  if (audioActive() && Math.random() > nightFactor * 0.7) {
    playTone({ freq: randomOf(SCALE), dur: 1.6, type: 'sine', gain: 0.055, attack: 0.005 });
  }
  setTimeout(scheduleMelody, 700 + Math.random() * 1300 + nightFactor * 900);
}
const CHORDS = [[130.81, 164.81, 196.0], [110.0, 130.81, 164.81], [87.31, 110.0, 130.81], [98.0, 123.47, 146.83]];
let chordIndex = 0;
function schedulePad() {
  if (!audio.ctx) return;
  if (audioActive()) {
    for (const f of CHORDS[chordIndex % CHORDS.length]) playTone({ freq: f, dur: 7, type: 'triangle', gain: 0.022, attack: 2.5 });
    chordIndex++;
  }
  setTimeout(schedulePad, 8000);
}
function playBark() {
  playTone({ freq: 560, freqEnd: 290, dur: 0.12, type: 'triangle', gain: 0.22 });
  setTimeout(() => playTone({ freq: 620, freqEnd: 320, dur: 0.13, type: 'triangle', gain: 0.2 }), 150);
}
function playChirp() { playTone({ freq: 660, freqEnd: 1320, dur: 0.18, type: 'sine', gain: 0.15 }); }
function playPet() { playTone({ freq: 880, freqEnd: 700, dur: 0.25, type: 'sine', gain: 0.08 }); }
function playCrunch() {
  if (!audio.ctx) return;
  const dur = 0.09;
  const buf = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * dur), audio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  const f = audio.ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1400;
  const g = audio.ctx.createGain(); g.gain.value = 0.35;
  src.connect(f).connect(g).connect(audio.master);
  src.start(audio.ctx.currentTime);
}
function playBounce() { playTone({ freq: 240, freqEnd: 160, dur: 0.08, type: 'sine', gain: 0.09 }); }

const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.enabled = !audio.enabled;
  soundBtn.textContent = audio.enabled ? '🔊' : '🔇';
  if (audio.ctx) {
    if (audio.enabled && audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.master.gain.linearRampToValueAtTime(audio.enabled ? 0.5 : 0, audio.ctx.currentTime + 0.3);
  }
});

// タブが隠れたら音を止める(PC/スマホ共通・バックグラウンド対策)
document.addEventListener('visibilitychange', () => {
  if (!audio.ctx) return;
  if (document.hidden) audio.ctx.suspend().catch(() => {});
  else if (audio.enabled) audio.ctx.resume().catch(() => {});
});

// ===========================================================================
// 入力(タップ=よろこぶ / 長押し=なでなで、当たった犬に作用)
// ===========================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;
let pressedDog = null;
let lastHitPoint = null;
let petInterval = null;
let grabbedDog = null; // つかんで持ち上げ中の犬
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _groundHit = new THREE.Vector3();

function pickDog(clientX, clientY) {
  if (!dogs.length) return null;
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(dogs.map((d) => d.hitSphere));
  if (!hits.length) return null;
  lastHitPoint = hits[0].point;
  return dogs.find((d) => d.hitSphere === hits[0].object) || null;
}

function petRegion(d, point) {
  if (!point) return 'petHead';
  const local = d.group.worldToLocal(point.clone());
  if (local.y > 0.95) return 'petHead';
  if (local.z > 0.35 && local.y < 0.8) return 'petFace';
  return 'petBody';
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  initAudio();
  if (audio.ctx && audio.ctx.state === 'suspended' && audio.enabled) audio.ctx.resume();
  downPos = { x: e.clientX, y: e.clientY, time: performance.now() };
  pressedDog = pickDog(e.clientX, e.clientY);
  if (pressedDog) {
    const region = petRegion(pressedDog, lastHitPoint);
    let pets = 0;
    petInterval = setTimeout(function petLoop() {
      pressedDog.petting = true;
      playPet();
      spawnFxAt(pressedDog.group.position, 'note', randomOf(['♪', '💛', '♡']), 1, { x: 0, y: 0 }, 1.6 * pressedDog.baseScale);
      if (pets === 0 || Math.random() < 0.18) speak(pressedDog, region, 2);
      if (pets === 2) bond.add(2);
      pets++;
      petInterval = setTimeout(petLoop, 800);
    }, 550);
  }
});

window.addEventListener('pointerup', (e) => {
  if (grabbedDog) {
    controls.enabled = true;
    grabbedDog.dropY = 1.1;
    grabbedDog.dropV = 0;
    grabbedDog.setState('drop', 5);
    grabbedDog = null;
    renderer.domElement.style.cursor = 'grab';
    clearTimeout(petInterval);
    downPos = null; pressedDog = null;
    return; // タップ/なでなで判定はスキップ
  }
  clearTimeout(petInterval);
  const wasPetting = pressedDog && pressedDog.petting;
  if (pressedDog) pressedDog.petting = false;
  if (!downPos) { pressedDog = null; return; }
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  const held = performance.now() - downPos.time;
  downPos = null;
  if (pressedDog && !wasPetting && moved < 10 && held < 500) {
    pressedDog.react();
    playBark();
    setTimeout(playChirp, 350);
  }
  pressedDog = null;
});

renderer.domElement.addEventListener('pointermove', (e) => {
  renderer.domElement.style.cursor = pickDog(e.clientX, e.clientY) ? 'pointer' : 'grab';
});

// つかむジェスチャの判定+グラブ中の位置追従(canvasのpointermoveとは別に window で監視)
window.addEventListener('pointermove', (e) => {
  if (grabbedDog) {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(groundPlane, _groundHit)) {
      grabbedDog.group.position.x = THREE.MathUtils.clamp(_groundHit.x, -14, 14);
      grabbedDog.group.position.z = THREE.MathUtils.clamp(_groundHit.z, -14, 14);
    }
    return;
  }
  if (pressedDog && downPos && !grabbedDog) {
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (moved > 14) {
      // なでなでタイマーを解除して グラブ に切り替える
      clearTimeout(petInterval);
      pressedDog.petting = false;
      if (pressedDog.state !== 'eat') {
        grabbedDog = pressedDog;
        controls.enabled = false; // カメラ回転と衝突させない
        if (grabbedDog.state === 'sleep') grabbedDog.wake();
        grabbedDog.onArrive = null;
        // ボール運搬・追跡中の犬を掴んだ時の後始末
        if (fetcher === grabbedDog) {
          if (ballState === 'carry' && ball) { scene.attach(ball); ball.scale.setScalar(1); ball.position.y = 0.17; ball.userData = {}; }
          ballState = 'none'; fetcher = null;
        }
        grabbedDog.setState('held', 9999);
        speak(grabbedDog, 'grabbed', 2);
        playTone({ freq: 400, freqEnd: 900, dur: 0.25, type: 'sine', gain: 0.12 }); // ひょい
        renderer.domElement.style.cursor = 'grabbing';
      }
    }
  }
});

// ===========================================================================
// UI ボタン
// ===========================================================================
function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
}
bindClick('btn-look', lookAtMe);
bindClick('btn-come', comeHere);
bindClick('btn-ball', throwBall);
bindClick('btn-treat', () => { giveTreat(TREAT_KINDS[treatIndex % TREAT_KINDS.length]); treatIndex++; });
bindClick('btn-add', () => spawnDog({ pop: true }));
bindClick('btn-remove', () => removeDog(false));
bindClick('btn-add-chibi', () => spawnDog({ pop: true, chibi: true }));
bindClick('btn-remove-chibi', () => removeDog(true));
bindClick('btn-shot', () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `piramidog_${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

// モード切替(いやし ⇄ どくぜつ)
const modeBtn = document.getElementById('mode-toggle');
function applyModeUI() {
  if (modeBtn) modeBtn.textContent = mode === 'doku' ? '😈' : '😇';
}
function toggleMode() {
  mode = mode === 'doku' ? 'iyashi' : 'doku';
  localStorage.setItem('pd_mode', mode);
  applyModeUI();
  const d = focusedDog();
  if (d) {
    showBubble(d, mode === 'doku' ? 'ふん、ここからは しんらつに いくからな' : '…なんてね。ほんとは だいすきだよ', 3);
  }
}
bindClick('mode-toggle', toggleMode);
applyModeUI();

updateHearts();

window.__actions = {
  lookAtMe, comeHere, giveTreat, throwBall, spawnDog, removeDog,
  spawnChibi: () => spawnDog({ pop: true, chibi: true }),
  removeChibi: () => removeDog(true),
  toggleMode,
};
window.__setHour = (h) => { forcedHour = h; applyDaylight(currentHour()); };
window.__bond = bond;

// ===========================================================================
// メインループ
// ===========================================================================
const clock = new THREE.Clock();
let lastBondLevel = bond.level;
let daylightTick = 0;
let speechTimer = 8 + Math.random() * 8;

function stepProjectile(obj, dt, onBounce) {
  const u = obj.userData;
  if (u.vy === undefined) return false;
  u.vy -= 14 * dt;
  obj.position.y += u.vy * dt;
  if (u.vx !== undefined) { obj.position.x += u.vx * dt; obj.position.z += u.vz * dt; }
  if (obj.position.y <= 0.17) {
    obj.position.y = 0.17;
    if (Math.abs(u.vy) > 1.0) { u.vy = -u.vy * 0.4; if (u.vx !== undefined) { u.vx *= 0.6; u.vz *= 0.6; } if (onBounce) onBounce(); }
    else { u.vy = 0; if (u.vx !== undefined) { u.vx *= 0.8; u.vz *= 0.8; if (Math.hypot(u.vx, u.vz) < 0.15) return true; } else { delete u.vy; } }
  }
  return false;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  for (const d of dogs) d.update(dt, t);

  daylightTick += dt;
  if (daylightTick > 2) { daylightTick = 0; applyDaylight(currentHour()); }

  if (bond.level !== lastBondLevel) {
    lastBondLevel = bond.level;
    const d = focusedDog();
    if (d) { spawnFxAt(d.group.position, 'heart', '💛', 5, { x: 0, y: 0 }, 1.6 * d.baseScale); speak(d, 'levelUp', 3); }
  }

  if (treat) stepProjectile(treat, dt, playBounce);

  if (ball && ballState === 'flying') {
    const settled = stepProjectile(ball, dt, playBounce);
    ball.rotation.x += dt * 4;
    if (settled) {
      fetcher = nearestDogTo(ball.position.x, ball.position.z, (d) => d.state !== 'eat') || dogs[0];
      if (fetcher) { ballState = 'fetch'; fetcher.goTo(ball.position.x, ball.position.z, pickUpBall); }
      else ballState = 'none';
    }
  }

  for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 36) c.position.x = -36; }

  for (const b of butterflies) {
    const u = b.userData;
    u.phase += dt * u.speed;
    b.position.set(u.cx + Math.cos(u.phase) * u.rx, 0.9 + Math.sin(u.phase * 2.3) * 0.35, u.cz + Math.sin(u.phase * 1.3) * u.rz);
    const flap = Math.sin(t * 14 + u.phase * 20) * 0.9;
    u.wl.rotation.y = flap; u.wr.rotation.y = -flap; b.rotation.y = -u.phase;
  }

  if (dogs.length) {
    speechTimer -= dt;
    if (speechTimer <= 0) { packIdleChatter(); speechTimer = 12 + Math.random() * 16; }
  }

  if (bubbleTimer > 0) {
    bubbleTimer -= dt;
    if (bubbleDog) {
      const s = worldToScreen(bubbleDog.group.position, 1.75 * bubbleDog.baseScale);
      bubbleEl.style.left = `${s.x}px`;
      bubbleEl.style.top = `${s.y}px`;
    }
    if (bubbleTimer <= 0) bubbleEl.classList.remove('show');
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setTimeout(() => document.getElementById('hint').classList.add('faded'), 12000);

// ===========================================================================
// PWA
// ===========================================================================
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
