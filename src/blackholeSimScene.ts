// 블랙홀 시뮬레이션 3D 화면: 블랙홀(강착원반·중력렌즈) + 다가가는 실험체(우주인/별/국수)
// 실험체는 실제 조석력 공식(blackholePhysics.ts)에 따라 블랙홀 방향으로 늘어나고 옆으로 가늘어진다.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BH_PRESETS,
  CRITICAL_IMPACT,
  infallRate,
  tidalReport,
  traceLightRay,
  type SubjectKind,
  type TidalReport,
} from './blackholePhysics.ts';
import {
  createAccretionDisk,
  createBloomPipeline,
  createCoronaSprite,
  createLensingHalo,
  createSkyDome,
  createStarfield,
  getSoftDotTexture,
} from './fx.ts';
import { createPlanetTexture } from './planetTextures.ts';

export type BhCameraView = 'overview' | 'follow' | 'pov';
export type Observer = 'far' | 'self';

export interface BhSimState extends TidalReport {
  presetId: string;
  subject: SubjectKind;
  playing: boolean;
  observer: Observer;
  /** 지구(멀리 있는 관찰자) 시계 / 실험체 시계 (시뮬레이션 초) */
  farClock: number;
  subjectClock: number;
  /** 지평선 안에서 특이점에 닿아 사라졌는지 */
  reachedSingularity: boolean;
  /** 멀리서 볼 때 지평선 앞에서 얼어붙었는지 */
  frozenAtHorizon: boolean;
}

export interface BlackHoleSimScene {
  setPlaying(play: boolean): void;
  setDistance(x: number): void;
  setSpeed(speed: number): void;
  setPreset(id: string): void;
  setSubject(kind: SubjectKind): void;
  setObserver(o: Observer): void;
  setCameraView(view: BhCameraView): void;
  setShowLightRays(show: boolean): void;
  setShowMarkers(show: boolean): void;
  reset(x?: number): void;
  dispose(): void;
}

export const MIN_X = 1.0;
export const MAX_X = 300;
const R = 7.5; // 화면에서 사건의 지평선 반지름
const LINEAR_UNTIL = 14; // 14 rs 까지는 실제 비율, 그 바깥은 로그로 압축

/** 거리 x(rs 단위) → 화면 반지름 */
export function visualRadius(x: number): number {
  if (x <= LINEAR_UNTIL) return R * x;
  return R * (LINEAR_UNTIL + LINEAR_UNTIL * Math.log(x / LINEAR_UNTIL));
}

// ---------- 조석 변형 셰이더 주입 (모든 실험체 재질 공통) ----------
interface TidalUniforms {
  uCenter: { value: THREE.Vector3 };
  uAxis: { value: THREE.Vector3 };
  uStretch: { value: number };
  uSquash: { value: number };
  uBias: { value: number };
  uTint: { value: THREE.Color };
}

function makeTidalUniforms(): TidalUniforms {
  return {
    uCenter: { value: new THREE.Vector3() },
    uAxis: { value: new THREE.Vector3(1, 0, 0) },
    uStretch: { value: 1 },
    uSquash: { value: 1 },
    uBias: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
}

/**
 * 재질의 정점 셰이더를 고쳐서, 월드 좌표에서 블랙홀 방향(uAxis)으로는 늘리고 옆으로는 가늘게 만든다.
 * 블랙홀에 가까운 쪽(발끝)이 더 세게 당겨지도록 2차항(uBias)을 더한다.
 */
function applyTidal<T extends THREE.Material>(mat: T, u: TidalUniforms): T {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uCenter;
        uniform vec3 uAxis;
        uniform float uStretch;
        uniform float uSquash;
        uniform float uBias;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 tidalWorld = modelMatrix * vec4( transformed, 1.0 );
        vec3 tRel = tidalWorld.xyz - uCenter;
        float tAl = dot( tRel, uAxis );
        vec3 tPe = tRel - tAl * uAxis;
        float tAl2 = tAl * uStretch + uBias * tAl * abs( tAl );
        tidalWorld.xyz = uCenter + uAxis * tAl2 + tPe * uSquash;
        vec4 mvPosition = viewMatrix * tidalWorld;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= uTint;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uTint;');
  };
  mat.customProgramCacheKey = () => 'tidal';
  return mat;
}

// ---------- 우주인 모델 ----------
function buildAstronaut(u: TidalUniforms): { group: THREE.Group; limbs: Record<string, THREE.Object3D>; halfLength: number } {
  const g = new THREE.Group();
  const suit = applyTidal(new THREE.MeshStandardMaterial({ color: 0xf1f0ea, roughness: 0.72, metalness: 0.0 }), u);
  const joint = applyTidal(new THREE.MeshStandardMaterial({ color: 0x8b93a1, roughness: 0.45, metalness: 0.55 }), u);
  const dark = applyTidal(new THREE.MeshStandardMaterial({ color: 0x2b313b, roughness: 0.6, metalness: 0.2 }), u);
  const pack = applyTidal(new THREE.MeshStandardMaterial({ color: 0xd9d8d1, roughness: 0.65 }), u);
  const visor = applyTidal(
    new THREE.MeshPhysicalMaterial({ color: 0xd4a52a, metalness: 1, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }),
    u,
  );
  const helmetShell = applyTidal(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.8 }), u);
  const accent = applyTidal(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }), u);
  const stripe = applyTidal(new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 }), u);
  const lightRed = applyTidal(new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 3 }), u);
  const lightGreen = applyTidal(new THREE.MeshStandardMaterial({ color: 0x22ff88, emissive: 0x22ff88, emissiveIntensity: 2.5 }), u);
  const lightBlue = applyTidal(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.5 }), u);

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // 몸통 + 허리 링 + 가슴 제어판
  add(new THREE.CapsuleGeometry(0.5, 0.75, 8, 20), suit, 0, 0.35, 0);
  add(new THREE.TorusGeometry(0.47, 0.06, 10, 28), joint, 0, -0.12, 0).rotation.x = Math.PI / 2;
  const panel = add(new THREE.BoxGeometry(0.52, 0.34, 0.12), dark, 0, 0.45, 0.46);
  add(new THREE.SphereGeometry(0.035, 10, 8), lightRed, -0.14, 0.03, 0.065, panel);
  add(new THREE.SphereGeometry(0.035, 10, 8), lightGreen, 0, 0.03, 0.065, panel);
  add(new THREE.SphereGeometry(0.035, 10, 8), lightBlue, 0.14, 0.03, 0.065, panel);
  add(new THREE.BoxGeometry(0.36, 0.05, 0.02), stripe, 0, -0.09, 0.065, panel);

  // 생명유지 배낭 (PLSS) + 안테나
  add(new THREE.BoxGeometry(0.9, 1.05, 0.42), pack, 0, 0.4, -0.55);
  add(new THREE.BoxGeometry(0.7, 0.12, 0.44), joint, 0, 0.98, -0.55);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), joint, 0.3, 1.25, -0.6);
  const antennaLight = add(new THREE.SphereGeometry(0.04, 10, 8), lightRed, 0.3, 1.52, -0.6);

  // 헬멧: 흰 껍데기 + 금빛 반사 바이저 + 목 링
  add(new THREE.TorusGeometry(0.33, 0.07, 10, 28), joint, 0, 1.07, 0).rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.52, 32, 24), helmetShell, 0, 1.45, -0.02);
  // 바이저: 앞쪽(+Z, phi = π/2 중심) 띠 모양 반구 조각
  add(new THREE.SphereGeometry(0.47, 32, 20, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.42), visor, 0, 1.47, 0.03);

  // 어깨 패치 (파란 미션 패치)
  add(new THREE.CircleGeometry(0.11, 20), accent, 0.5, 0.62, 0.12).rotation.y = Math.PI / 2.4;

  const limbs: Record<string, THREE.Object3D> = {};
  // 팔 (어깨 피벗 → 위팔 → 팔꿈치 → 아래팔 → 장갑)
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.62, 0.72, 0);
    g.add(shoulder);
    add(new THREE.SphereGeometry(0.2, 16, 12), suit, 0, 0, 0, shoulder);
    add(new THREE.CapsuleGeometry(0.16, 0.42, 6, 14), suit, 0, -0.33, 0, shoulder);
    add(new THREE.TorusGeometry(0.16, 0.035, 8, 20), joint, 0, -0.62, 0, shoulder).rotation.x = Math.PI / 2;
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.62, 0);
    shoulder.add(elbow);
    add(new THREE.CapsuleGeometry(0.14, 0.38, 6, 14), suit, 0, -0.3, 0, elbow);
    add(new THREE.TorusGeometry(0.14, 0.035, 8, 20), stripe, 0, -0.5, 0, elbow).rotation.x = Math.PI / 2;
    add(new THREE.CapsuleGeometry(0.12, 0.12, 6, 12), joint, 0, -0.66, 0, elbow);
    shoulder.rotation.z = side * 0.75;
    elbow.rotation.z = side * 0.25;
    limbs[side < 0 ? 'shoulderL' : 'shoulderR'] = shoulder;
    limbs[side < 0 ? 'elbowL' : 'elbowR'] = elbow;
  }
  // 다리 (골반 피벗 → 허벅지 → 무릎 → 정강이 → 부츠)
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.24, -0.2, 0);
    g.add(hip);
    add(new THREE.CapsuleGeometry(0.2, 0.48, 6, 14), suit, 0, -0.38, 0, hip);
    add(new THREE.TorusGeometry(0.2, 0.04, 8, 20), joint, 0, -0.7, 0, hip).rotation.x = Math.PI / 2;
    const knee = new THREE.Group();
    knee.position.set(0, -0.7, 0);
    hip.add(knee);
    add(new THREE.CapsuleGeometry(0.18, 0.45, 6, 14), suit, 0, -0.34, 0, knee);
    const boot = add(new THREE.CapsuleGeometry(0.19, 0.2, 6, 12), dark, 0, -0.72, 0.06, knee);
    boot.scale.set(1, 1, 1.35);
    hip.rotation.z = side * 0.22;
    knee.rotation.x = 0.2;
    limbs[side < 0 ? 'hipL' : 'hipR'] = hip;
    limbs[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  limbs.antennaLight = antennaLight;
  return { group: g, limbs, halfLength: 1.6 };
}

// ---------- 국수(스파게티) 모델 ----------
function buildNoodles(u: TidalUniforms): { group: THREE.Group; halfLength: number } {
  const g = new THREE.Group();
  const noodleMat = applyTidal(new THREE.MeshStandardMaterial({ color: 0xf2cf72, roughness: 0.42, metalness: 0.0, emissive: 0x3a2a00, emissiveIntensity: 0.25 }), u);
  const sauceMat = applyTidal(new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.35, emissive: 0x3d0705, emissiveIntensity: 0.4 }), u);
  const meatMat = applyTidal(new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.9 }), u);
  const basilMat = applyTidal(new THREE.MeshStandardMaterial({ color: 0x2f8a3a, roughness: 0.6, side: THREE.DoubleSide }), u);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) {
    const geo = new THREE.CylinderGeometry(0.055, 0.055, 3.4, 8, 90);
    const pos = geo.attributes.position;
    const ox = (rnd() - 0.5) * 0.7;
    const oz = (rnd() - 0.5) * 0.7;
    const ph = rnd() * Math.PI * 2;
    const k = 2.2 + rnd() * 2.5;
    for (let j = 0; j < pos.count; j++) {
      const y = pos.getY(j);
      pos.setX(j, pos.getX(j) + ox + Math.sin(y * k + ph) * 0.14);
      pos.setZ(j, pos.getZ(j) + oz + Math.cos(y * k * 0.8 + ph) * 0.14);
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, noodleMat));
  }
  // 미트볼 (울퉁불퉁)
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.IcosahedronGeometry(0.36, 3);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let j = 0; j < p.count; j++) {
      v.fromBufferAttribute(p, j);
      v.multiplyScalar(1 + 0.08 * Math.sin(v.x * 17 + i) * Math.cos(v.y * 13 - i));
      p.setXYZ(j, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, meatMat);
    m.position.set((rnd() - 0.5) * 0.5, (i - 1) * 0.9, (rnd() - 0.5) * 0.5);
    g.add(m);
    // 토마토 소스와 바질 잎
    const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), sauceMat);
    sauce.scale.set(1.3, 0.45, 1.3);
    sauce.position.copy(m.position).add(new THREE.Vector3(0, 0.28, 0));
    g.add(sauce);
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), basilMat);
    leaf.scale.set(1, 0.55, 1);
    leaf.position.copy(m.position).add(new THREE.Vector3(0.05, 0.42, 0.05));
    leaf.rotation.x = -1.2;
    g.add(leaf);
  }
  return { group: g, halfLength: 1.7 };
}

// ---------- 별 모델 (조석 파괴 시나리오) ----------
function buildStar(u: TidalUniforms): { group: THREE.Group; halfLength: number; corona: THREE.Sprite } {
  const g = new THREE.Group();
  const tex = createPlanetTexture('sun', 512, 256);
  const mat = applyTidal(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.2 }), u);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), mat));
  const corona = createCoronaSprite(0xffc46b, 6.5);
  corona.material.opacity = 0.7;
  g.add(corona);
  return { group: g, halfLength: 1.5, corona };
}

export function createBlackHoleSimScene(container: HTMLDivElement, onUpdate: (s: BhSimState) => void): BlackHoleSimScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010208);
  // 우주복 금속·바이저가 반사할 은은한 환경광
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.05, 6000);
  camera.position.set(60, 70, 230);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 1500;

  scene.add(new THREE.AmbientLight(0x8890b0, 0.25));
  // 강착원반이 내뿜는 빛 (실험체를 주황빛으로 비춤)
  const diskLight = new THREE.PointLight(0xffa860, 900, 0, 1.4);
  scene.add(diskLight);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.9);
  fill.position.set(-80, 120, 160);
  scene.add(fill);

  const sky = new THREE.Group();
  sky.add(createSkyDome(3000, 1.1));
  const starfield = createStarfield({ count: 6000, radius: 2400, size: 2.3 });
  sky.add(starfield.points);
  scene.add(sky);

  // ---------- 블랙홀 ----------
  const horizon = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  scene.add(horizon);
  // 강착원반: 최내곽 안정 궤도(ISCO, 3rs)부터 바깥으로
  const DISK_TILT = Math.PI / 2 - 0.1;
  const disk = createAccretionDisk(visualRadius(3), visualRadius(11), { intensity: 0.9, speed: 0.6 });
  disk.rotation.x = DISK_TILT;
  scene.add(disk);
  const halo = createLensingHalo(R, { intensity: 0.8 });
  scene.add(halo);

  // ---------- 거리 표지 (광자구 1.5rs, ISCO 3rs, 지평선) ----------
  const markers = new THREE.Group();
  scene.add(markers);
  function makeLabel(text: string, color: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(6,10,28,0.82)';
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 84, 30);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // 화면 크기 고정 라벨 (가까이 가도 글씨가 화면을 덮지 않게)
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, sizeAttenuation: false }));
    s.scale.set(0.2, 0.0375, 1);
    return s;
  }
  for (const [x, text, color] of [
    [1.5, '광자구 1.5rₛ · 빛이 원을 그리며 도는 곳', '#facc15'],
    [3, '최내곽 안정궤도 3rₛ · 원반 안쪽 끝', '#38bdf8'],
  ] as const) {
    const pts: THREE.Vector3[] = [];
    const rv = visualRadius(x);
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * rv, 0, Math.sin(a) * rv));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color, dashSize: 1.4, gapSize: 1.0, transparent: true, opacity: 0.85 }),
    );
    line.computeLineDistances();
    line.rotation.x = DISK_TILT - Math.PI / 2;
    markers.add(line);
    const label = makeLabel(text, color);
    // 라벨끼리 겹치지 않게 서로 다른 방향에 둔다
    if (x === 1.5) label.position.set(-rv * 1.1, rv * 0.9, 0);
    else label.position.set(rv * 0.9, -rv * 0.35, rv * 0.5);
    markers.add(label);
  }
  const horizonLabel = makeLabel('사건의 지평선 · 빛도 못 나오는 경계', '#c084fc');
  horizonLabel.position.set(R * 0.6, R * 2.1, 0);
  markers.add(horizonLabel);

  // ---------- 빛의 휘어짐 (광선 추적, 화면을 향한 세로 평면) ----------
  const rays = new THREE.Group();
  rays.visible = false;
  scene.add(rays);
  const photonPulses: { line: THREE.Vector3[]; pos: number; speed: number; captured: boolean }[] = [];
  const pulseGeo = new THREE.BufferGeometry();
  const MAX_PULSES = 40;
  const pulsePos = new Float32Array(MAX_PULSES * 3);
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulses = new THREE.Points(
    pulseGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, map: getSoftDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  pulses.frustumCulled = false;
  rays.add(pulses);
  {
    const impacts = [-10, -7, -5, -3.8, -3.1, -2.75, -2.62, -2.55, -2.2, -1.2, 1.2, 2.2, 2.55, 2.62, 2.75, 3.1, 3.8, 5, 7, 10];
    for (const b of impacts) {
      const ray = traceLightRay(b, -16, 17);
      const pts = ray.points
        .filter(([x, y]) => Math.hypot(x, y) < 17)
        .map(([x, y]) => new THREE.Vector3(x * R, y * R, 0));
      if (pts.length < 2) continue;
      const near = Math.abs(Math.abs(b) - CRITICAL_IMPACT) < 0.2;
      const color = ray.captured ? 0xff6a3d : near ? 0xfde047 : 0x9fd8ff;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: ray.captured ? 0.75 : 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      rays.add(line);
      if (photonPulses.length < MAX_PULSES) photonPulses.push({ line: pts, pos: Math.random() * pts.length, speed: 40 + Math.random() * 10, captured: ray.captured });
    }
    const critLabel = makeLabel(`빛의 갈림길 b = ${CRITICAL_IMPACT.toFixed(2)}rₛ`, '#fde047');
    critLabel.position.set(-11 * R, CRITICAL_IMPACT * R + 5, 0);
    rays.add(critLabel);
  }

  // ---------- 실험체 ----------
  const tidal = makeTidalUniforms();
  const astronaut = buildAstronaut(tidal);
  const noodles = buildNoodles(tidal);
  const star = buildStar(tidal);
  const subjectRoot = new THREE.Group();
  scene.add(subjectRoot);
  subjectRoot.add(astronaut.group, noodles.group, star.group);

  // ---------- 찢겨 나간 물질의 흐름 (원자 흐름) ----------
  const STREAM_N = 2400;
  const sPos = new Float32Array(STREAM_N * 3);
  const sVel = new Float32Array(STREAM_N * 3);
  const sCol = new Float32Array(STREAM_N * 3);
  const sLife = new Float32Array(STREAM_N);
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  streamGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const stream = new THREE.Points(
    streamGeo,
    new THREE.PointsMaterial({ size: 0.55, vertexColors: true, map: getSoftDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  stream.frustumCulled = false;
  scene.add(stream);
  let streamCursor = 0;
  for (let i = 0; i < STREAM_N; i++) sPos[i * 3 + 1] = 1e5; // 화면 밖에 대기

  // ---------- 상태 ----------
  let presetId = 'stellar';
  let subject: SubjectKind = 'astronaut';
  let x = 300;
  let playing = false;
  let speed = 1;
  let observer: Observer = 'far';
  let view: BhCameraView = 'follow';
  let farClock = 0;
  let subjectClock = 0;
  let reachedSingularity = false;
  let frozenAtHorizon = false;
  let lastReport: TidalReport = tidalReport(BH_PRESETS[presetId].massSuns, x, subject);

  // 실험체가 떨어지는 방향 (원반보다 살짝 위에서 비스듬히 접근)
  const fallDir = new THREE.Vector3(Math.cos(-0.55), 0.16, Math.sin(-0.55)).normalize();
  const subjectPos = new THREE.Vector3();
  const towardBH = new THREE.Vector3();
  const upTmp = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const camGoal = new THREE.Vector3();
  const lookGoal = new THREE.Vector3();
  const lookCur = new THREE.Vector3();

  function applyPreset() {
    const p = BH_PRESETS[presetId];
    disk.material.uniforms.uIntensity.value = 0.9 * p.diskBrightness;
    halo.material.uniforms.uIntensity.value = 0.8 * (0.5 + 0.5 * p.diskBrightness);
    diskLight.intensity = 900 * p.diskBrightness;
  }

  function emitStream(count: number, tip: THREE.Vector3, hot: boolean) {
    for (let k = 0; k < count; k++) {
      const i = streamCursor;
      streamCursor = (streamCursor + 1) % STREAM_N;
      sPos[i * 3] = tip.x + (Math.random() - 0.5) * 0.4;
      sPos[i * 3 + 1] = tip.y + (Math.random() - 0.5) * 0.4;
      sPos[i * 3 + 2] = tip.z + (Math.random() - 0.5) * 0.4;
      // 블랙홀 쪽으로 떨어지면서 옆으로 휘감기는 속도
      tmp.copy(towardBH).multiplyScalar(6 + Math.random() * 6);
      tmp2.crossVectors(upTmp, towardBH).normalize().multiplyScalar(5 + Math.random() * 4);
      sVel[i * 3] = tmp.x + tmp2.x;
      sVel[i * 3 + 1] = tmp.y + tmp2.y;
      sVel[i * 3 + 2] = tmp.z + tmp2.z;
      const c = hot
        ? new THREE.Color().setHSL(0.1 + Math.random() * 0.05, 1, 0.65 + Math.random() * 0.25)
        : Math.random() < 0.7
          ? new THREE.Color(0.95, 0.95, 0.92)
          : Math.random() < 0.5
            ? new THREE.Color(1.0, 0.5, 0.15)
            : new THREE.Color(0.3, 0.6, 1.0);
      sCol[i * 3] = c.r;
      sCol[i * 3 + 1] = c.g;
      sCol[i * 3 + 2] = c.b;
      sLife[i] = 7;
    }
  }

  function updateStream(dt: number) {
    const K = 2200;
    for (let i = 0; i < STREAM_N; i++) {
      if (sLife[i] <= 0) continue;
      sLife[i] -= dt;
      const px = sPos[i * 3];
      const py = sPos[i * 3 + 1];
      const pz = sPos[i * 3 + 2];
      const r2 = px * px + py * py + pz * pz;
      const r = Math.sqrt(r2);
      if (r < R * 1.02 || sLife[i] <= 0) {
        sLife[i] = 0;
        sPos[i * 3 + 1] = 1e5;
        continue;
      }
      const a = K / Math.max(r2, R * R);
      sVel[i * 3] -= (px / r) * a * dt;
      sVel[i * 3 + 1] -= (py / r) * a * dt + py * 0.6 * dt; // 원반 평면으로 납작해짐
      sVel[i * 3 + 2] -= (pz / r) * a * dt;
      sPos[i * 3] += sVel[i * 3] * dt;
      sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt;
      sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
    }
    streamGeo.attributes.position.needsUpdate = true;
    streamGeo.attributes.color.needsUpdate = true;
  }

  function updateSubject(dt: number, time: number) {
    const rep = lastReport;
    const rv = visualRadius(Math.max(x, 0.02));
    subjectPos.copy(fallDir).multiplyScalar(rv);
    towardBH.copy(subjectPos).negate().normalize();
    subjectRoot.position.copy(subjectPos);
    // 머리(+Y)는 블랙홀 반대쪽, 발은 블랙홀 쪽
    subjectRoot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.copy(towardBH).negate());
    subjectRoot.rotateY(0.6);

    astronaut.group.visible = subject === 'astronaut';
    noodles.group.visible = subject === 'noodle';
    star.group.visible = subject === 'star';
    const half = subject === 'star' ? star.halfLength : subject === 'noodle' ? noodles.halfLength : astronaut.halfLength;

    // 조석 변형 유니폼
    const S = rep.stretch;
    tidal.uCenter.value.copy(subjectPos);
    tidal.uAxis.value.copy(towardBH);
    tidal.uStretch.value = S;
    tidal.uSquash.value = Math.max(0.14, 1 / Math.sqrt(S));
    // 블랙홀 쪽(발끝)이 더 길게: 늘어남이 클수록 비대칭 증가
    tidal.uBias.value = (S - 1) * 0.12;
    // 중력 적색편이: 지평선에 가까울수록 붉고 어둡게
    const tf = rep.timeFactor;
    const red = 1 - tf;
    tidal.uTint.value.setRGB(1, Math.max(0, 1 - red * 1.25), Math.max(0, 1 - red * 1.7)).multiplyScalar(Math.max(0.05, Math.pow(tf, 0.35)));
    star.corona.visible = subject === 'star' && S < 1.8;

    // 우주인 몸짓: 평소엔 둥둥, 당겨질수록 허우적
    const flail = Math.min(1, (rep.q ?? 0) * 2);
    const L = astronaut.limbs;
    const wob = Math.sin(time * (1.2 + flail * 6));
    L.shoulderL.rotation.z = -0.75 - 0.25 * wob * (0.3 + flail);
    L.shoulderR.rotation.z = 0.75 + 0.25 * wob * (0.3 + flail);
    L.shoulderL.rotation.x = 0.3 * Math.sin(time * 0.9) * (0.4 + flail);
    L.shoulderR.rotation.x = -0.3 * Math.sin(time * 0.9) * (0.4 + flail);
    L.hipL.rotation.x = 0.25 * Math.sin(time * 1.1 + 1) * (0.4 + flail);
    L.hipR.rotation.x = -0.25 * Math.sin(time * 1.1 + 1) * (0.4 + flail);
    (L.antennaLight as THREE.Mesh).visible = Math.sin(time * 6) > 0;

    // 찢겨 나가는 물질 (3단계부터, 찢길수록 많이)
    if (x > 1 && rep.q >= 1 && playing) {
      const tip = tmp2.copy(subjectPos).addScaledVector(towardBH, half * S * 0.95);
      const rate = Math.min(260, 25 * Math.log10(rep.q + 1) * (subject === 'star' ? 4 : 1));
      emitStream(Math.ceil(rate * dt * 2), tip, subject === 'star');
    }
    // 4단계: 몸 대부분이 원자 흐름으로 풀려 희미해짐
    const fade = rep.stage === 4 ? Math.max(0.25, 1 - Math.log10(rep.q / 60) * 0.25) : 1;
    subjectRoot.visible = x > 0.03 && !reachedSingularity && view !== 'pov';
    subjectRoot.scale.setScalar(fade < 1 ? 0.85 + 0.15 * fade : 1);
  }

  function updateCamera(dt: number) {
    const follow = 1 - Math.pow(0.04, dt);
    if (view === 'overview') {
      controls.enabled = true;
      return;
    }
    controls.enabled = false;
    const S = lastReport.stretch;
    if (view === 'follow') {
      // 실험체 뒤쪽 비스듬한 위치: 실험체가 화면 가운데, 그 너머로 블랙홀이 보이게
      const side = tmp.crossVectors(upTmp, towardBH).normalize();
      const dist = 11 + S * 1.3;
      camGoal.copy(subjectPos).addScaledVector(towardBH, -dist * 0.85).addScaledVector(side, dist * 0.6).add(tmp2.set(0, dist * 0.32, 0));
      lookGoal.copy(subjectPos).addScaledVector(towardBH, Math.min(visualRadius(x) * 0.25, 3 + S * 0.8));
    } else {
      // 우주인 눈으로: 머리 위치에서 블랙홀을 바라봄 → 중력렌즈 고리가 하늘을 가득 채움
      camGoal.copy(subjectPos).addScaledVector(towardBH, -astronaut.halfLength * S);
      lookGoal.set(0, 0, 0);
    }
    camera.position.lerp(camGoal, follow);
    lookCur.lerp(lookGoal, follow);
    camera.lookAt(lookCur);
    controls.target.copy(lookCur);
  }

  function frameOverview() {
    if (rays.visible) {
      // 빛의 길: 블랙홀 주변 ±17rs 를 정면에서 크게
      camera.position.set(0, 25, 235);
      controls.target.set(0, 0, 0);
    } else {
      const rv = visualRadius(x);
      const D = Math.max(150, rv * 1.7);
      camera.position.set(D * 0.25, D * 0.42, D);
      controls.target.copy(subjectPos).multiplyScalar(0.4);
    }
    lookCur.copy(controls.target);
  }

  // ---------- 루프 ----------
  let raf = 0;
  let last = performance.now();
  let lastEmit = 0;
  const bloom = createBloomPipeline(renderer, scene, camera, { strength: 0.75, radius: 0.45, threshold: 0.85 });
  applyPreset();

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = now * 0.001;

    if (playing && !reachedSingularity && !frozenAtHorizon) {
      const simDt = dt * speed;
      const rate = infallRate(Math.max(x, 0.02), observer);
      // 멀리서는 지평선에 영원히 닿지 않는다 (1 + ε 에서 멈춘 것처럼 보임)
      const floor = observer === 'far' ? 1.0004 : 0.02;
      // 먼 거리(6rs 바깥)는 너무 지루하지 않게 빨리 감기 (120rs → 6rs 약 9초, 1배속)
      const boost = x > 6 ? Math.pow(x / 6, 1.5) : 1;
      x = Math.max(floor, x - rate * boost * simDt);
      farClock += simDt;
      subjectClock += simDt * (observer === 'far' ? lastReport.timeFactor : 1);
      if (observer === 'far' && x <= 1.0005) frozenAtHorizon = true;
      if (observer === 'self' && x <= 0.03) {
        reachedSingularity = true;
        playing = false;
      }
    }
    lastReport = tidalReport(BH_PRESETS[presetId].massSuns, Math.max(x, 0.02), subject);

    updateSubject(dt, time);
    updateStream(dt);
    updateCamera(dt);
    controls.update();

    disk.material.uniforms.uTime.value = time;
    halo.material.uniforms.uTime.value = time;
    halo.quaternion.copy(camera.quaternion);
    starfield.update(time);
    sky.position.copy(camera.position);
    diskLight.position.set(0, 2, 0);

    // 광선 위의 빛 알갱이가 움직이는 모습
    if (rays.visible) {
      for (let i = 0; i < photonPulses.length; i++) {
        const p = photonPulses[i];
        p.pos += p.speed * dt * 0.25 * (p.captured ? 1 : 1);
        if (p.pos >= p.line.length - 1) p.pos = 0;
        const a = p.line[Math.floor(p.pos)];
        pulsePos[i * 3] = a.x;
        pulsePos[i * 3 + 1] = a.y;
        pulsePos[i * 3 + 2] = a.z;
      }
      pulseGeo.setDrawRange(0, photonPulses.length);
      pulseGeo.attributes.position.needsUpdate = true;
      rays.quaternion.copy(camera.quaternion);
    }

    bloom.render();

    if (now - lastEmit > 80) {
      lastEmit = now;
      onUpdate({
        ...lastReport,
        x,
        presetId,
        subject,
        playing,
        observer,
        farClock,
        subjectClock,
        reachedSingularity,
        frozenAtHorizon,
      });
    }
  }
  raf = requestAnimationFrame(frame);
  frameOverview();
  updateSubject(0, 0);

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    bloom.setSize(w, h);
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(container);
  onResize();

  function clearStream() {
    sLife.fill(0);
    for (let i = 0; i < STREAM_N; i++) sPos[i * 3 + 1] = 1e5;
    streamGeo.attributes.position.needsUpdate = true;
  }

  return {
    setPlaying(play) {
      if (play && (reachedSingularity || frozenAtHorizon)) {
        reachedSingularity = false;
        frozenAtHorizon = false;
        x = 300;
        farClock = subjectClock = 0;
        clearStream();
      }
      playing = play;
    },
    setDistance(nx) {
      x = Math.max(MIN_X, Math.min(MAX_X, nx));
      reachedSingularity = false;
      frozenAtHorizon = false;
    },
    setSpeed(s) {
      speed = s;
    },
    setPreset(id) {
      if (!BH_PRESETS[id]) return;
      presetId = id;
      applyPreset();
      clearStream();
    },
    setSubject(kind) {
      subject = kind;
      clearStream();
    },
    setObserver(o) {
      observer = o;
      if (o === 'self') frozenAtHorizon = false;
    },
    setCameraView(v) {
      view = v;
      if (v === 'overview') frameOverview();
    },
    setShowLightRays(show) {
      rays.visible = show;
      if (view === 'overview') frameOverview();
    },
    setShowMarkers(show) {
      markers.visible = show;
    },
    reset(nx = 300) {
      x = nx;
      playing = false;
      farClock = subjectClock = 0;
      reachedSingularity = false;
      frozenAtHorizon = false;
      clearStream();
      if (view === 'overview') frameOverview();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      bloom.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
