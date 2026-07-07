import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// 基本セットアップ
// ---------------------------------------------------------------------------
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
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

// 環境マップ(ツヤ・反射用)
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

// ライト
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

// ---------------------------------------------------------------------------
// 草原
// ---------------------------------------------------------------------------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(45, 48),
  new THREE.MeshStandardMaterial({ color: 0x7cc25e, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 草(インスタンス化した細いコーン)
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

// お花
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

// ちょうちょ
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

// ---------------------------------------------------------------------------
// ピラミッド犬(Blender製 GLB を読み込み、プロシージャルにアニメーション)
// ---------------------------------------------------------------------------
const _q = new THREE.Quaternion();
// ハイブリッドモデルの耳はベース回転付きノードなので、
// ローカルZまわりの回転で外側へぴょこんと開く(実機検証済み)
const _earAxis = new THREE.Vector3(0, 0, 1);

class PyramidDog {
  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group(); // アニメ用(スクワッシュ・傾き)
    this.group.add(this.body);
    this.loaded = false;

    // タップ判定用の透明な球
    this.hitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    this.hitSphere.position.y = 0.75;
    this.group.add(this.hitSphere);

    // ---- 状態 ----
    this.state = 'idle';
    this.stateTime = 2;
    this.heading = 0;
    this.target = new THREE.Vector2();
    this.hopPhase = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkT = -1;
    this.earLift = 0; // 0=たれ耳 1=ぴん
    this.reactT = 0;
    this.reactBase = 0;
    this.awakeTime = 0;
    this.zzzTimer = 0;
    this.petting = false;
    this.tongueOut = 1;
    this.tongueTimer = 4;
  }

  attachModel(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        // Meshyメッシュは片面パッチの寄せ集めなので、動いた時に裏面が見えても
        // 破綻しないよう両面描画にする
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

  // --- 状態遷移 ---
  setState(s, dur) {
    this.state = s;
    this.stateTime = dur;
  }

  chooseNext() {
    if (this.awakeTime > 22 && Math.random() < 0.3) {
      this.startSleep();
      return;
    }
    if (Math.random() < 0.6) {
      this.startWalk();
    } else {
      this.setState('idle', 1.5 + Math.random() * 3);
    }
  }

  startWalk() {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 5;
    this.target.set(Math.cos(a) * r, Math.sin(a) * r);
    this.setState('walk', 30);
  }

  startSleep() {
    this.setState('sleep', 10 + Math.random() * 14);
    this.zzzTimer = 1;
    showBubble('ふぁ〜… ちょっと おひるね…', 2.5);
  }

  wake() {
    this.awakeTime = 0;
    this.setState('idle', 1 + Math.random() * 2);
  }

  react() {
    if (this.state === 'sleep') {
      this.wake();
      showBubble('はっ! おきたよ!', 2);
      return;
    }
    this.state = 'react';
    this.reactT = 0;
    this.reactBase = this.heading;
    spawnFxAt(this.group.position, 'heart', '💛', 3);
    if (Math.random() < 0.35) {
      showBubble(randomOf(TAP_LINES), 2.5);
    }
  }

  // --- 毎フレーム更新 ---
  update(dt, t) {
    if (this.state !== 'sleep') this.awakeTime += dt;

    // まばたき
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.13) this.blinkT = -1;
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkT = 0;
        this.blinkTimer = 1.5 + Math.random() * 3.5;
      }
    }

    // 舌をたまに ひっこめたり出したり
    this.tongueTimer -= dt;
    if (this.tongueTimer <= 0) {
      this.tongueOut = this.tongueOut > 0.5 ? 0 : 1;
      this.tongueTimer = 2.5 + Math.random() * 5;
    }

    let hopY = 0;
    let squash = 1;
    let rock = 0;
    let earTarget = 0;
    let eyesClosed = false;

    switch (this.state) {
      case 'idle': {
        this.stateTime -= dt;
        squash = 1 + Math.sin(t * 2.2) * 0.015; // 呼吸
        if (this.stateTime <= 0) this.chooseNext();
        break;
      }

      case 'walk': {
        this.stateTime -= dt;
        const pos = this.group.position;
        const dx = this.target.x - pos.x;
        const dz = this.target.y - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25 || this.stateTime <= 0) {
          this.setState('idle', 1.5 + Math.random() * 3);
          break;
        }
        const want = Math.atan2(dx, dz);
        this.heading += shortestAngle(this.heading, want) * Math.min(1, dt * 4);
        const speed = 1.15;
        pos.x += Math.sin(this.heading) * speed * dt;
        pos.z += Math.cos(this.heading) * speed * dt;

        this.hopPhase += dt * 7.5;
        const s = Math.abs(Math.sin(this.hopPhase));
        hopY = s * 0.16;
        squash = 0.92 + s * 0.1;
        rock = Math.sin(this.hopPhase) * 0.06;
        earTarget = 0.25 + s * 0.2;
        break;
      }

      case 'sleep': {
        this.stateTime -= dt;
        eyesClosed = true;
        squash = 1 + Math.sin(t * 1.1) * 0.035;
        this.zzzTimer -= dt;
        if (this.zzzTimer <= 0) {
          spawnFxAt(this.group.position, 'zzz', 'Z', 1, { x: 40, y: -60 });
          this.zzzTimer = 1.6;
        }
        if (this.stateTime <= 0) this.wake();
        break;
      }

      case 'react': {
        this.reactT += dt / 0.85;
        const p = Math.min(this.reactT, 1);
        hopY = 4 * 0.55 * p * (1 - p); // ジャンプの放物線
        this.heading = this.reactBase + easeInOut(p) * Math.PI * 2;
        earTarget = 1;
        squash = p < 0.15 ? 0.85 : 1.03;
        eyesClosed = p > 0.2 && p < 0.85; // にっこり目
        if (this.reactT >= 1) {
          this.heading = this.reactBase;
          this.setState('idle', 1.5 + Math.random() * 2);
        }
        break;
      }
    }

    // なでなで中
    if (this.petting && this.state !== 'react') {
      eyesClosed = true;
      squash *= 1 + Math.sin(t * 9) * 0.025;
      earTarget = Math.max(earTarget, 0.35);
    }

    // 反映
    this.group.position.y = hopY;
    this.group.rotation.y = this.heading;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.body.rotation.z = rock;

    this.earLift += (earTarget - this.earLift) * Math.min(1, dt * 6);

    if (!this.loaded) return;

    // 耳(GLBのベース姿勢に、ローカル回転を重ねてぱたぱた)
    // 歩行・リアクション中だけ小さくぱたぱたさせる
    const flapping = this.state === 'walk' || this.state === 'react';
    const flap = flapping ? Math.sin(t * 6) * 0.03 : 0;
    const lift = this.earLift * 0.55 + flap;
    _q.setFromAxisAngle(_earAxis, -lift);
    this.earL.quaternion.copy(this.earBaseL).multiply(_q);
    _q.setFromAxisAngle(_earAxis, lift);
    this.earR.quaternion.copy(this.earBaseR).multiply(_q);

    // 目
    const blink = this.blinkT >= 0;
    const closed = eyesClosed || blink;
    this.eyeL.visible = !closed;
    this.eyeR.visible = !closed;
    this.eyeClosedL.visible = closed;
    this.eyeClosedR.visible = closed;

    // 舌(しまう/出す)— ローカルY=前後、Z=上下 をまとめて縮める
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

function easeInOut(x) {
  return x * x * (3 - 2 * x);
}

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const dog = new PyramidDog();
scene.add(dog.group);
window.piramidog = dog;
window.__debugCam = { camera, controls: () => controls };

new GLTFLoader().load('assets/piramidog.glb', (gltf) => {
  dog.attachModel(gltf.scene);
});

// 足もとのやわらかい影
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

// ---------------------------------------------------------------------------
// おしゃべり(吹き出し)
// ---------------------------------------------------------------------------
const IDLE_LINES = [
  'きょうも いいてんき だね!',
  'おさんぽ たのしいなぁ',
  'くさの におい、だいすき',
  'ずっと いっしょに いようね',
  'ピラミッドは じょうぶで じまんなんだ',
  'ちょうちょ みつけたよ!',
  'きみが いると あんしんする〜',
  'ごろごろ するの きもちいい',
  'わん!',
];
const TAP_LINES = [
  'わーい! うれしい!',
  'えへへ、くすぐったい',
  'もっと あそぼ!',
  'なでてくれて ありがと!',
  'だいすき!',
];

const bubbleEl = document.getElementById('bubble');
let bubbleTimer = 0;
let speechTimer = 8 + Math.random() * 8;

function showBubble(text, dur = 3.5) {
  bubbleEl.textContent = text;
  bubbleEl.classList.add('show');
  bubbleTimer = dur;
}

// ---------------------------------------------------------------------------
// 画面エフェクト(ハート・Zzz)
// ---------------------------------------------------------------------------
const fxLayer = document.getElementById('fx-layer');
const _v = new THREE.Vector3();

function worldToScreen(pos, yOffset = 0) {
  _v.set(pos.x, pos.y + yOffset, pos.z).project(camera);
  return {
    x: (_v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-_v.y * 0.5 + 0.5) * window.innerHeight,
  };
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

// ---------------------------------------------------------------------------
// サウンド(Web Audio で全部生成)
// ---------------------------------------------------------------------------
const audio = {
  ctx: null,
  master: null,
  enabled: true,
  started: false,
};

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

// オルゴール風メロディ(ペンタトニック)
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.5]; // C5 D5 E5 G5 A5 C6 E6
function scheduleMelody() {
  if (!audio.ctx) return;
  if (audio.enabled) {
    playTone({
      freq: randomOf(SCALE),
      dur: 1.6,
      type: 'sine',
      gain: 0.055,
      attack: 0.005,
    });
  }
  setTimeout(scheduleMelody, 700 + Math.random() * 1300);
}

// やわらかい低音のパッド
const CHORDS = [
  [130.81, 164.81, 196.0], // C
  [110.0, 130.81, 164.81], // Am
  [87.31, 110.0, 130.81],  // F
  [98.0, 123.47, 146.83],  // G
];
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
  setTimeout(() => {
    playTone({ freq: 620, freqEnd: 320, dur: 0.13, type: 'triangle', gain: 0.2 });
  }, 150);
}

function playChirp() {
  playTone({ freq: 660, freqEnd: 1320, dur: 0.18, type: 'sine', gain: 0.15 });
}

function playPet() {
  playTone({ freq: 880, freqEnd: 700, dur: 0.25, type: 'sine', gain: 0.08 });
}

const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  audio.enabled = !audio.enabled;
  soundBtn.textContent = audio.enabled ? '🔊' : '🔇';
  if (audio.master) {
    audio.master.gain.linearRampToValueAtTime(
      audio.enabled ? 0.5 : 0,
      audio.ctx.currentTime + 0.3
    );
  }
});

// ---------------------------------------------------------------------------
// 入力(タップでよろこぶ・ながおしで なでなで)
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;
let downOnDog = false;
let petInterval = null;

function hitDog(clientX, clientY) {
  pointer.set(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(dog.hitSphere, false).length > 0;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  initAudio();
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  downPos = { x: e.clientX, y: e.clientY, time: performance.now() };
  downOnDog = hitDog(e.clientX, e.clientY);

  if (downOnDog) {
    // ながおしで なでなで
    petInterval = setTimeout(function petLoop() {
      dog.petting = true;
      playPet();
      spawnFxAt(dog.group.position, 'note', randomOf(['♪', '💛', '♡']), 1);
      if (Math.random() < 0.15) showBubble(randomOf(TAP_LINES), 2);
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

  // 短いタップ & 犬に当たっていたら よろこぶ
  if (downOnDog && !wasPetting && moved < 10 && held < 500) {
    dog.react();
    playBark();
    setTimeout(playChirp, 350);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  renderer.domElement.style.cursor = hitDog(e.clientX, e.clientY) ? 'pointer' : 'grab';
});

// ---------------------------------------------------------------------------
// メインループ
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  dog.update(dt, t);

  // ブロブシャドウ追従(ジャンプ中は小さく・うすく)
  blobShadow.position.x = dog.group.position.x;
  blobShadow.position.z = dog.group.position.z;
  const airFade = Math.max(0.3, 1 - dog.group.position.y * 0.8);
  blobShadow.scale.setScalar(airFade);
  blobShadow.material.opacity = airFade;

  // 雲の流れ
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 36) c.position.x = -36;
  }

  // ちょうちょ
  for (const b of butterflies) {
    const u = b.userData;
    u.phase += dt * u.speed;
    b.position.set(
      u.cx + Math.cos(u.phase) * u.rx,
      0.9 + Math.sin(u.phase * 2.3) * 0.35,
      u.cz + Math.sin(u.phase * 1.3) * u.rz
    );
    const flap = Math.sin(t * 14 + u.phase * 20) * 0.9;
    u.wl.rotation.y = flap;
    u.wr.rotation.y = -flap;
    b.rotation.y = -u.phase;
  }

  // ひとりごと
  if (dog.state !== 'sleep' && dog.state !== 'react') {
    speechTimer -= dt;
    if (speechTimer <= 0) {
      showBubble(randomOf(IDLE_LINES), 3.5);
      speechTimer = 16 + Math.random() * 20;
    }
  }

  // 吹き出しの位置追従
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

// リサイズ
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ヒントは しばらくしたら うすくする
setTimeout(() => document.getElementById('hint').classList.add('faded'), 12000);
