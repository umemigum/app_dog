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
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0xf4f9ff,
    emissiveIntensity: 0.75,
  });
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

// ちょうちょ(追いかけっこ 2-7 で目標にもなる)
const butterflies = [];
{
  const wingGeo = new THREE.CircleGeometry(0.09, 8);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: [0xfff2a8, 0xffc4dd, 0xc8e8ff][i],
      side: THREE.DoubleSide,
    });
    const wl = new THREE.Mesh(wingGeo, mat);
    const wr = new THREE.Mesh(wingGeo, mat);
    wl.position.x = -0.07;
    wr.position.x = 0.07;
    g.add(wl, wr);
    g.userData = {
      wl, wr,
      phase: Math.random() * 10,
      cx: (Math.random() - 0.5) * 8,
      cz: (Math.random() - 0.5) * 8,
      rx: 2 + Math.random() * 3,
      rz: 2 + Math.random() * 3,
      speed: 0.25 + Math.random() * 0.2,
    };
    scene.add(g);
    butterflies.push(g);
  }
}

// 星(夜だけ表示 / 時間帯連動 3-3)
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

// ===========================================================================
// 時間帯連動(3-3)
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
let forcedHour = null; // デバッグ用の時刻上書き
let nightFactor = 0;

function applyDaylight(hour) {
  let a = DAY_STOPS[0];
  let b = DAY_STOPS[DAY_STOPS.length - 1];
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    if (hour >= DAY_STOPS[i].h && hour <= DAY_STOPS[i + 1].h) {
      a = DAY_STOPS[i];
      b = DAY_STOPS[i + 1];
      break;
    }
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
// なつき度(きずな 3-2)
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
// なまえ(3-5)
// ===========================================================================
let dogName = localStorage.getItem('pd_name') || '';
function setDogName(n) {
  dogName = (n || '').trim().slice(0, 8);
  localStorage.setItem('pd_name', dogName);
}
// セリフ内の ◯◯ を名前(なければ「きみ」)に置換
function withName(s) {
  if (dogName) return s.replace(/◯◯/g, dogName);
  return s.replace(/◯◯は/g, 'ぼくは').replace(/◯◯/g, 'きみ');
}

// ===========================================================================
// ピラミッド犬
// ===========================================================================
const _q = new THREE.Quaternion();
const _earAxis = new THREE.Vector3(0, 0, 1); // 耳は Blender流ローカルZまわりで開閉

class PyramidDog {
  constructor() {
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

    // 口もと(くわえ位置)— 食べ物・ボールをここに付ける
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, 0.55, 0.72);
    this.group.add(this.mouth);

    this.state = 'idle';
    this.stateTime = 2;
    this.heading = 0;
    this.target = new THREE.Vector2();
    this.hopPhase = 0;
    this.walkElapsed = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkT = -1;
    this.earLift = 0;
    this.reactT = 0;
    this.reactBase = 0;
    this.awakeTime = 0;
    this.zzzTimer = 0;
    this.petting = false;
    this.tongueOut = 1;
    this.tongueTimer = 4;
    this.onArrive = null;
    this.attendAngle = 0;
    this.tiltDir = 1;
    this.eatT = 0;
    this.nextBite = 0;
    this.eating = null;
    this.happyTimer = 0;   // うれしさ(おしり振り 2-3)
    this.zoomLeft = 0;     // ズーミー残り回数
    this.rollT = 0;
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
    // ときどきズーミー / ちょうちょ追い / ごろん を混ぜる
    const roll = Math.random();
    if (this.awakeTime > 22 && roll < 0.22) { this.startSleep(); return; }
    if (roll < 0.05) { this.startZoomies(); return; }
    if (roll < 0.13) { this.chaseButterfly(); return; }
    if (roll < 0.19) { this.startRoll(); return; }
    if (roll < 0.62) { this.startWalk(); return; }
    this.setState('idle', 1.5 + Math.random() * 3);
  }

  startWalk() {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 5;
    this.target.set(Math.cos(a) * r, Math.sin(a) * r);
    this.walkElapsed = 0;
    this.setState('walk', 30);
  }

  goTo(x, z, onArrive) {
    if (this.state === 'eat') return;
    if (this.state === 'sleep') this.wake();
    this.target.set(x, z);
    this.onArrive = onArrive || null;
    this.walkElapsed = 0;
    this.setState('walk', 30);
  }

  startZoomies() {
    this.zoomLeft = 3;
    this.pickZoomTarget();
    this.happyTimer = 4;
    speak('zoomies', 1.6);
  }
  pickZoomTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 5;
    this.target.set(Math.cos(a) * r, Math.sin(a) * r);
    this.walkElapsed = 0.5; // 助走なしで即トップスピード
    this.setState('zoomies', 8);
  }

  chaseButterfly() {
    const b = randomOf(butterflies);
    this.chaseTarget = b;
    this.goTo(b.position.x, b.position.z, () => {
      this.attend(Math.atan2(b.position.x - this.group.position.x, b.position.z - this.group.position.z));
      speak('chase', 2);
    });
    speak('chaseStart', 1.6);
  }

  startRoll() {
    this.rollT = 0;
    this.happyTimer = 2.5;
    this.setState('roll', 1.4);
    speak('roll', 1.6);
  }

  startSleep() {
    this.setState('sleep', 10 + Math.random() * 14);
    this.zzzTimer = 1;
    speak('sleep', 2.5);
  }

  wake() { this.awakeTime = 0; this.setState('idle', 1 + Math.random() * 2); }

  attend(angle) {
    if (this.state === 'eat') return;
    if (this.state === 'sleep') this.wake();
    this.attendAngle = angle;
    this.tiltDir = Math.random() < 0.5 ? 1 : -1;
    this.onArrive = null;
    this.setState('attend', 1.6);
  }

  react() {
    if (this.state === 'eat') return;
    if (this.state === 'sleep') { this.wake(); speak('wake', 2); return; }
    this.onArrive = null;
    this.state = 'react';
    this.reactT = 0;
    this.reactBase = this.heading;
    this.happyTimer = 2.5;
    spawnFxAt(this.group.position, 'heart', '💛', 3);
    bond.add(1);
    if (Math.random() < 0.4) speak('tap', 2.5);
  }

  update(dt, t) {
    if (this.state !== 'sleep') this.awakeTime += dt;
    if (this.happyTimer > 0) this.happyTimer -= dt;

    // まばたき
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.13) this.blinkT = -1;
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) { this.blinkT = 0; this.blinkTimer = 1.5 + Math.random() * 3.5; }
    }

    // 舌
    this.tongueTimer -= dt;
    if (this.tongueTimer <= 0) {
      this.tongueOut = this.tongueOut > 0.5 ? 0 : 1;
      this.tongueTimer = 2.5 + Math.random() * 5;
    }

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
          if (zoom && this.zoomLeft > 1 && this.stateTime > 0) {
            this.zoomLeft--;
            this.pickZoomTarget();
            break;
          }
          this.zoomLeft = 0;
          this.setState('idle', 1.2 + Math.random() * 2.5);
          if (this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(); }
          break;
        }
        const want = Math.atan2(dx, dz);
        this.heading += shortestAngle(this.heading, want) * Math.min(1, dt * (zoom ? 6 : 4));
        // 2-1 出発でじわっと加速、到着手前で減速。速度でホップも変わる
        const accel = Math.min(1, this.walkElapsed / 0.5);
        const decel = Math.min(1, dist / 0.9);
        const base = zoom ? 2.6 : 1.15;
        const sp = base * Math.min(accel, decel) + 0.12;
        pos.x += Math.sin(this.heading) * sp * dt;
        pos.z += Math.cos(this.heading) * sp * dt;
        this.hopPhase += dt * (4 + sp * 4);
        const s = Math.abs(Math.sin(this.hopPhase));
        const amp = zoom ? 0.24 : 0.16;
        hopY = s * amp * Math.min(1, sp / base + 0.2);
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
        if (this.zzzTimer <= 0) { spawnFxAt(this.group.position, 'zzz', 'Z', 1, { x: 40, y: -60 }); this.zzzTimer = 1.6; }
        if (this.stateTime <= 0) this.wake();
        break;
      }

      case 'attend': {
        // こっちむいて + 首かしげ(2-2)
        this.stateTime -= dt;
        this.heading += shortestAngle(this.heading, this.attendAngle) * Math.min(1, dt * 6);
        const p = 1 - this.stateTime / 1.6;
        rock = this.tiltDir * 0.22 * Math.sin(Math.min(1, p * 2.2) * Math.PI * 0.5);
        squash = 1 + Math.sin(t * 2.2) * 0.015;
        earTarget = 0.7;
        if (this.stateTime <= 0) this.setState('idle', 2 + Math.random() * 2);
        break;
      }

      case 'roll': {
        // ごろん(全身バレルロール 2-5 の簡易版)
        this.rollT += dt / 1.4;
        const p = Math.min(this.rollT, 1);
        rock = easeInOut(p) * Math.PI * 2;
        hopY = Math.sin(p * Math.PI) * 0.12;
        squash = 1 + Math.sin(p * Math.PI) * 0.05;
        eyesClosed = p > 0.15 && p < 0.9;
        earTarget = 0.5;
        if (this.rollT >= 1) this.setState('idle', 1 + Math.random() * 2);
        break;
      }

      case 'eat': {
        this.eatT += dt;
        pitch = Math.abs(Math.sin(this.eatT * 6)) * 0.15;
        squash = 1 + Math.sin(this.eatT * 12) * 0.02;
        earTarget = 0.3;
        if (this.eating && this.eatT >= this.nextBite) { this.nextBite += 0.55; biteTreat(); }
        if (this.eatT > this.eatDuration) finishEating();
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
    }

    // なでなで
    if (this.petting && this.state !== 'react') {
      eyesClosed = true;
      squash *= 1 + Math.sin(t * 9) * 0.025;
      earTarget = Math.max(earTarget, 0.35);
    }

    // 2-3 うれしいとき全身をぷりぷり
    if (this.happyTimer > 0 || this.petting) yaw = Math.sin(t * 17) * 0.05 * (this.petting ? 0.7 : 1);

    this.group.position.y = hopY;
    this.group.rotation.y = this.heading + yaw;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.body.rotation.z = rock;
    this.body.rotation.x = pitch;

    this.earLift += (earTarget - this.earLift) * Math.min(1, dt * 6);
    if (!this.loaded) return;

    const flapping = this.state === 'walk' || this.state === 'zoomies' || this.state === 'react';
    const flap = flapping ? Math.sin(t * 6) * 0.03 : 0;
    const lift = this.earLift * 0.7 + flap;
    _q.setFromAxisAngle(_earAxis, -lift);
    this.earL.quaternion.copy(this.earBaseL).multiply(_q);
    _q.setFromAxisAngle(_earAxis, lift);
    this.earR.quaternion.copy(this.earBaseR).multiply(_q);

    const blink = this.blinkT >= 0;
    const closed = eyesClosed || blink;
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
function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const dog = new PyramidDog();
scene.add(dog.group);
window.piramidog = dog;
window.__debugCam = { camera, controls: () => controls };

const MODEL_VERSION = 'tripo-self-1';
new GLTFLoader().load(`assets/piramidog.glb?v=${MODEL_VERSION}`, (gltf) => {
  dog.attachModel(gltf.scene);
});

// 足もとの影
const blobShadow = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(40, 60, 20, 0.35)');
  grad.addColorStop(1, 'rgba(40, 60, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  scene.add(mesh);
  return mesh;
})();

// ===========================================================================
// カメラ方向ヘルパー
// ===========================================================================
function cameraGroundDir() {
  const v = new THREE.Vector3(camera.position.x, 0, camera.position.z);
  if (v.lengthSq() < 0.01) v.set(0, 0, 1);
  return v.normalize();
}
function angleToCamera() {
  return Math.atan2(camera.position.x - dog.group.position.x, camera.position.z - dog.group.position.z);
}

// ===========================================================================
// アクション: こっちむいて / おいで
// ===========================================================================
function lookAtMe() {
  if (dog.state === 'eat') return;
  dog.attend(angleToCamera());
  playBark();
  speak('lookAt', 2);
}
function comeHere() {
  if (dog.state === 'eat') return;
  const dir = cameraGroundDir();
  const dist = Math.min(4.2, Math.max(2.5, camera.position.length() * 0.4));
  speak('coming', 2);
  dog.goTo(dir.x * dist, dir.z * dist, () => {
    dog.attend(angleToCamera());
    playChirp();
    spawnFxAt(dog.group.position, 'heart', '💛', 2);
    bond.add(2);
    speak('arrived', 2.5);
  });
}

// ===========================================================================
// おやつ(3-4 アイテム一般化: りんご / ほね / クッキー)
// ===========================================================================
const _tmpV = new THREE.Vector3();
const TREATS = {
  apple: {
    emoji: '🍎', bites: 3,
    lines: ['おいしい〜!', 'りんご だいすき!', 'あまずっぱい!'],
    make() {
      const g = new THREE.Group();
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0xd93b36, roughness: 0.35 }));
      fruit.scale.y = 0.92; fruit.position.y = 0.15; fruit.castShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.09, 6),
        new THREE.MeshStandardMaterial({ color: 0x6d4a2a, roughness: 0.9 }));
      stem.position.y = 0.32; stem.rotation.z = 0.15;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x5fae4a, roughness: 0.7 }));
      leaf.scale.set(1, 0.35, 0.55); leaf.position.set(0.06, 0.34, 0);
      g.add(fruit, stem, leaf); return g;
    },
  },
  bone: {
    emoji: '🦴', bites: 4,
    lines: ['ほね さいこう!', 'かみごたえ ばつぐん!', 'ごきげん!'],
    make() {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xf3ecd6, roughness: 0.5 });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10), mat);
      shaft.rotation.z = Math.PI / 2; shaft.position.y = 0.13; shaft.castShadow = true;
      g.add(shaft);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), mat);
        k.position.set(sx * 0.17, 0.13, sz * 0.05); g.add(k);
      }
      return g;
    },
  },
  cookie: {
    emoji: '🍪', bites: 3,
    lines: ['あまくて しあわせ!', 'クッキー もっと!', 'さくさく!'],
    make() {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20),
        new THREE.MeshStandardMaterial({ color: 0xcaa15e, roughness: 0.7 }));
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

let treat = null;       // 地面のおやつ(食べ中含む)
let treatDef = null;

function giveTreat(kind) {
  if (treat || dog.state === 'eat') return;
  if (dog.state === 'sleep') dog.wake();
  const def = TREATS[kind] || TREATS.apple;
  treatDef = def;
  const dir = cameraGroundDir();
  const pos = dog.group.position;
  const ax = THREE.MathUtils.clamp(pos.x + dir.x * 1.7, -7, 7);
  const az = THREE.MathUtils.clamp(pos.z + dir.z * 1.7, -7, 7);
  treat = def.make();
  treat.position.set(ax, 2.6, az);
  treat.userData.vy = 0;
  scene.add(treat);
  playTone({ freq: 520, freqEnd: 780, dur: 0.15, type: 'sine', gain: 0.12 });
  speak('treatDrop', 2);
  const dx = ax - pos.x, dz = az - pos.z, d = Math.hypot(dx, dz) || 1;
  dog.goTo(ax - (dx / d) * 0.85, az - (dz / d) * 0.85, () => {
    if (!treat) return;
    dog.heading = Math.atan2(treat.position.x - dog.group.position.x, treat.position.z - dog.group.position.z);
    dog.eating = treat;
    dog.eatT = 0;
    dog.nextBite = 0.5;
    dog.eatDuration = 0.5 + def.bites * 0.55 + 0.2;
    dog.setState('eat', 12);
  });
}

function biteTreat() {
  if (!treat) return;
  playCrunch();
  const s = treat.scale.x * 0.66;
  if (s < 0.22) { scene.remove(treat); treat = null; dog.eating = null; }
  else treat.scale.setScalar(s);
}

function finishEating() {
  if (treat) { scene.remove(treat); treat = null; }
  dog.eating = null;
  spawnFxAt(dog.group.position, 'heart', '💛', 3);
  showBubble(withName(randomOf((treatDef || TREATS.apple).lines)), 2.5);
  playChirp();
  bond.add(3);
  dog.setState('idle', 2 + Math.random() * 2);
}

// ===========================================================================
// ボール遊び・とってこい(3-1)
// ===========================================================================
let ball = null;
let ballState = 'none'; // none / flying / fetch / carry

function makeBall() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.4 }));
  m.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  stripe.rotation.x = Math.PI / 2;
  g.add(m, stripe);
  g.position.y = 0.17;
  return g;
}

function throwBall() {
  if (ballState === 'carry' || ballState === 'flying') return;
  if (dog.state === 'eat') return;
  if (dog.state === 'sleep') dog.wake();
  if (ball) { scene.remove(ball); ball = null; }
  const dir = cameraGroundDir();
  const start = dog.group.position.clone();
  ball = makeBall();
  ball.position.set(start.x, 1.0, start.z);
  // カメラと反対方向(奥)へ放る
  const away = dir.clone().multiplyScalar(-1);
  const power = 5.5 + Math.random() * 2;
  ball.userData = { vx: away.x * power, vy: 4.2, vz: away.z * power, spin: 0 };
  scene.add(ball);
  ballState = 'flying';
  playTone({ freq: 300, freqEnd: 200, dur: 0.12, type: 'sine', gain: 0.1 });
  speak('ballThrow', 1.8);
}

function pickUpBall() {
  ballState = 'carry';
  scene.remove(ball);
  dog.mouth.add(ball);
  ball.position.set(0, 0, 0);
  ball.userData = {};
  playChirp();
  const dir = cameraGroundDir();
  const dist = Math.min(4.2, Math.max(2.5, camera.position.length() * 0.4));
  dog.goTo(dir.x * dist, dir.z * dist, dropBall);
  speak('ballGot', 1.8);
}

function dropBall() {
  if (!ball) return;
  scene.attach(ball); // ワールド変換を保ったまま親を外す
  ball.position.y = 0.17;
  ball.userData = {};
  ballState = 'none';
  dog.attend(angleToCamera());
  spawnFxAt(dog.group.position, 'heart', '💛', 2);
  bond.add(3);
  speak('ballReturn', 2.2);
}

// ===========================================================================
// おしゃべり(文脈タグ付き 3-9)
// ===========================================================================
const LINES = {
  idle:   ['きょうも いいてんき だね!', 'おさんぽ たのしいなぁ', 'くさの におい、だいすき',
           'ずっと いっしょに いようね', '◯◯と いると あんしんする〜', 'わん!'],
  morning:['おはよう! きょうも あそぼ?', 'あさの くうき きもちいい〜', 'ん〜、よく ねむれた!'],
  day:    ['おひさま ぽかぽか!', 'ちょうちょ みつけた!', 'ピラミッドは じょうぶで じまんなんだ'],
  evening:['ゆうやけ きれいだね', 'そろそろ おなか すいたかも', 'きょうも たのしかったね'],
  night:  ['おほしさま きらきら…', 'よふかしは めっ、だよ?', 'しずかで きもちいいね…'],
  tap:    ['わーい! うれしい!', 'えへへ、くすぐったい', 'もっと あそぼ!', 'だいすき!'],
  petHead:['きもちいい〜…', 'うっとり…', 'なでなで だいすき'],
  petFace:['ふへへ、はなの あたま くすぐったい!', 'ぺろっ'],
  petBody:['あははっ、くすぐったいって〜!', 'そこは じゃれちゃう!'],
  lookAt: ['なあに?', 'よんだ?', 'わん!'],
  coming: ['いま いくー!', 'とことこ…'],
  arrived:['きたよ!', 'なでてくれる?', '◯◯の となり すき'],
  sleep:  ['ふぁ〜… ちょっと おひるね…', ' zzz…'],
  wake:   ['はっ! おきたよ!', 'ん〜、おはよ…'],
  treatDrop:['わっ、たべもの だ!', 'いいにおい!'],
  ballThrow:['それっ、いってこーい!', 'まってて、とってくる!'],
  ballGot:  ['ゲット!', 'とれたよ!'],
  ballReturn:['もってきたよ!', 'もういっかい なげて!', 'えらい?'],
  chaseStart:['ちょうちょ まてまて〜!', 'つかまえるぞ〜'],
  chase:   ['あれ、いっちゃった…', 'にげ足 はやいなぁ'],
  zoomies: ['うおおお たのしー!', 'びゅーん!'],
  roll:    ['ごろーん', 'きもちいいっ'],
  levelUp: ['なんだか ◯◯と なかよしに なれた きがする!', 'えへへ、だいすきが ふえた!'],
};

const bubbleEl = document.getElementById('bubble');
let bubbleTimer = 0;
let speechTimer = 8 + Math.random() * 8;

function showBubble(text, dur = 3.5) {
  bubbleEl.textContent = text;
  bubbleEl.classList.add('show');
  bubbleTimer = dur;
}
function speak(tag, dur = 3) {
  const pool = LINES[tag] || LINES.idle;
  showBubble(withName(randomOf(pool)), dur);
}
function speakIdle() {
  // 時間帯の専用セリフを混ぜる
  const band = timeBand();
  const pool = LINES.idle.concat(LINES[band] || []);
  showBubble(withName(randomOf(pool)), 3.5);
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
function spawnFxAt(worldPos, cls, char, count = 1, offset = { x: 0, y: 0 }) {
  const s = worldToScreen(worldPos, 1.6);
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
  // 夜はメロディを控えめに(時間帯連動)
  if (audio.enabled && Math.random() > nightFactor * 0.7) {
    playTone({ freq: randomOf(SCALE), dur: 1.6, type: 'sine', gain: 0.055, attack: 0.005 });
  }
  setTimeout(scheduleMelody, 700 + Math.random() * 1300 + nightFactor * 900);
}
const CHORDS = [[130.81, 164.81, 196.0], [110.0, 130.81, 164.81], [87.31, 110.0, 130.81], [98.0, 123.47, 146.83]];
let chordIndex = 0;
function schedulePad() {
  if (!audio.ctx) return;
  if (audio.enabled) {
    for (const f of CHORDS[chordIndex % CHORDS.length]) {
      playTone({ freq: f, dur: 7, type: 'triangle', gain: 0.022, attack: 2.5 });
    }
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
  if (audio.master) audio.master.gain.linearRampToValueAtTime(audio.enabled ? 0.5 : 0, audio.ctx.currentTime + 0.3);
});

// ===========================================================================
// 入力(タップ=よろこぶ / 長押し=なでなで、なでる場所で反応 3-6)
// ===========================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;
let downOnDog = false;
let petInterval = null;

function raycastDog(clientX, clientY) {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(dog.hitSphere, false);
}
function hitDog(x, y) { return raycastDog(x, y).length > 0; }

// なでた場所を あたま / かお / からだ に分類
function petRegion(clientX, clientY) {
  const hits = raycastDog(clientX, clientY);
  if (!hits.length) return 'petHead';
  const local = dog.group.worldToLocal(hits[0].point.clone());
  if (local.y > 0.95) return 'petHead';
  if (local.z > 0.35 && local.y < 0.8) return 'petFace';
  return 'petBody';
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  initAudio();
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  downPos = { x: e.clientX, y: e.clientY, time: performance.now() };
  downOnDog = hitDog(e.clientX, e.clientY);
  if (downOnDog) {
    const region = petRegion(e.clientX, e.clientY);
    let pets = 0;
    petInterval = setTimeout(function petLoop() {
      dog.petting = true;
      playPet();
      spawnFxAt(dog.group.position, 'note', randomOf(['♪', '💛', '♡']), 1);
      if (pets === 0 || Math.random() < 0.18) speak(region, 2);
      if (pets === 2) bond.add(2);
      pets++;
      petInterval = setTimeout(petLoop, 800);
    }, 550);
  }
});

window.addEventListener('pointerup', (e) => {
  clearTimeout(petInterval);
  const wasPetting = dog.petting;
  dog.petting = false;
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  const held = performance.now() - downPos.time;
  downPos = null;
  if (downOnDog && !wasPetting && moved < 10 && held < 500) {
    dog.react();
    playBark();
    setTimeout(playChirp, 350);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  renderer.domElement.style.cursor = hitDog(e.clientX, e.clientY) ? 'pointer' : 'grab';
});

// ===========================================================================
// UI: ボタン / なまえ / スクショ / きずな
// ===========================================================================
function bindClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
}
bindClick('btn-look', lookAtMe);
bindClick('btn-come', comeHere);
bindClick('btn-ball', throwBall);
bindClick('btn-treat', () => { giveTreat(TREAT_KINDS[treatIndex % TREAT_KINDS.length]); treatIndex++; });

// スクショ(3-7)
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

// なまえ(3-5)
const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('name-input');
bindClick('btn-name', () => {
  nameInput.value = dogName;
  nameModal.classList.add('show');
  setTimeout(() => nameInput.focus(), 50);
});
bindClick('name-ok', () => {
  setDogName(nameInput.value);
  nameModal.classList.remove('show');
  speak('arrived', 2.5);
});
bindClick('name-cancel', () => nameModal.classList.remove('show'));

updateHearts();
if (!dogName && !localStorage.getItem('pd_seen')) {
  localStorage.setItem('pd_seen', '1');
  setTimeout(() => { if (!dogName) { nameModal.classList.add('show'); } }, 2500);
}

window.__actions = { lookAtMe, comeHere, giveTreat, throwBall };
window.__setHour = (h) => { forcedHour = h; applyDaylight(currentHour()); };
window.__bond = bond;

// ===========================================================================
// メインループ
// ===========================================================================
const clock = new THREE.Clock();
let lastBondLevel = bond.level;
let daylightTick = 0;

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

  dog.update(dt, t);

  // 時間帯をゆっくり更新(2秒ごと)
  daylightTick += dt;
  if (daylightTick > 2) { daylightTick = 0; applyDaylight(currentHour()); }

  // きずな レベルアップ演出
  if (bond.level !== lastBondLevel) {
    lastBondLevel = bond.level;
    spawnFxAt(dog.group.position, 'heart', '💛', 5);
    speak('levelUp', 3);
  }

  // 影
  blobShadow.position.x = dog.group.position.x;
  blobShadow.position.z = dog.group.position.z;
  const airFade = Math.max(0.3, 1 - dog.group.position.y * 0.8);
  blobShadow.scale.setScalar(airFade);
  blobShadow.material.opacity = airFade;

  // おやつの落下
  if (treat) stepProjectile(treat, dt, playBounce);

  // ボールの物理・とってこい制御
  if (ball && ballState === 'flying') {
    const settled = stepProjectile(ball, dt, playBounce);
    ball.rotation.x += dt * 4;
    if (settled) {
      ballState = 'fetch';
      dog.goTo(ball.position.x, ball.position.z, pickUpBall);
    }
  }

  // 雲
  for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 36) c.position.x = -36; }

  // ちょうちょ
  for (const b of butterflies) {
    const u = b.userData;
    u.phase += dt * u.speed;
    b.position.set(u.cx + Math.cos(u.phase) * u.rx, 0.9 + Math.sin(u.phase * 2.3) * 0.35, u.cz + Math.sin(u.phase * 1.3) * u.rz);
    const flap = Math.sin(t * 14 + u.phase * 20) * 0.9;
    u.wl.rotation.y = flap; u.wr.rotation.y = -flap; b.rotation.y = -u.phase;
  }

  // ひとりごと
  if (dog.state !== 'sleep' && dog.state !== 'react' && dog.state !== 'eat') {
    speechTimer -= dt;
    if (speechTimer <= 0) { speakIdle(); speechTimer = 16 + Math.random() * 20; }
  }

  // 吹き出し追従
  if (bubbleTimer > 0) {
    bubbleTimer -= dt;
    const s = worldToScreen(dog.group.position, 1.75);
    bubbleEl.style.left = `${s.x}px`;
    bubbleEl.style.top = `${s.y}px`;
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
// PWA(3-8)
// ===========================================================================
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
