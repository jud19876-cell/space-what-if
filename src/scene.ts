// Three.js 화면. 물리 상태(AU 단위)를 "보기 좋은" 화면 좌표로 바꿔서 그린다.
// 여기서는 물리 상태를 읽기만 하고 바꾸지 않는다. (시간 진행 advance() 만 호출)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AU_PER_DAY_TO_KM_S, G, length, SUN_MASS, calculateCircularSpeed, isBlackHoleBody, type Body, type Vec3, type AbsorptionEvent, type CollisionEvent } from './physics.ts';
import { advance, findHost, type SimState } from './simulation.ts';
import { BODY_INFO, ORBIT_RADII, type BodyId } from './solarSystem.ts';
import { createPlanetTexture, createNormalMap, createRingTexture, createRoughnessMap, createCloudTexture } from './planetTextures.ts';
import {
  createAccretionDisk,
  createAtmosphereMaterial,
  createBloomPipeline,
  createCoronaSprite,
  createLensingHalo,
  createSkyDome,
  createStarfield,
  createSunMaterial,
  setRadialRingUVs,
  softenPoints,
} from './fx.ts';

// ---------- 화면 거리 스케일 ----------
// 실제 거리(0.39 ~ 30 AU)를 그대로 쓰면 안쪽 행성이 안 보이므로 제곱근으로 압축한다.
const DIST_K = 11;
const DIST_R0 = 0.05;
const SQRT_R0 = Math.sqrt(DIST_R0);

export function mapRadius(rAU: number): number {
  return DIST_K * (Math.sqrt(rAU + DIST_R0) - SQRT_R0);
}

export function mapPoint(p: Vec3, out: THREE.Vector3): THREE.Vector3 {
  const r = length(p);
  if (r < 1e-12) return out.set(0, 0, 0);
  const s = mapRadius(r) / r;
  return out.set(p[0] * s, p[2] * s, -p[1] * s); // 물리 z-up → three.js y-up
}

/** 3D 화면의 y=0 궤도 평면 좌표를 물리 AU 좌표계로 역변환 */
export function unmapPoint(worldVec: THREE.Vector3): Vec3 {
  const R = Math.hypot(worldVec.x, worldVec.z);
  if (R < 1e-6) return [0, 0, 0];
  const rSqrt = R / DIST_K + SQRT_R0;
  const rAU = Math.max(0.01, rSqrt * rSqrt - DIST_R0);
  const px = (worldVec.x / R) * rAU;
  const py = (-worldVec.z / R) * rAU;
  return [px, py, 0];
}

// 위성(달)은 실제 거리로는 행성 안에 묻혀 버리므로, 행성 기준 오프셋을 크게 늘려서 그린다.
function satelliteOffset(dAU: number): number {
  return (5 * dAU) / (dAU + 0.0081); // 0.00257 AU(달) → 약 1.2, 최대 5
}

const TRAIL_N = 500;

interface Visual {
  group: THREE.Group;
  /** visualRadius 로 크기가 정해지는 천체 본체 (고리·대기·원반이 함께 커지고 작아짐) */
  body: THREE.Group;
  /** 자전하는 부분 (자전축 기울기 그룹 안쪽) */
  spin: THREE.Object3D;
  spinSpeed: number;
  sphere: THREE.Mesh;
  clouds?: THREE.Mesh;
  atmosphere?: THREE.ShaderMaterial;
  hit: THREE.Mesh;
  trail: THREE.Line;
  trailPos: Float32Array;
  trailCount: number;
  vis: THREE.Vector3;
  accretionDisk?: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
  lensingRing?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  sunMaterial?: THREE.ShaderMaterial;
  orbitLine?: THREE.LineLoop;
}

// 실제 자전축 기울기 (라디안)
const AXIAL_TILT: Record<string, number> = {
  mercury: 0.0006,
  venus: 3.096,
  earth: 0.4091,
  moon: 0.117,
  mars: 0.4396,
  jupiter: 0.0546,
  saturn: 0.4665,
  uranus: 1.7064,
  neptune: 0.4943,
  pluto: 2.138,
};

// 대기 산란광 색 / 두께 / 세기
const ATMOSPHERES: Record<string, { color: number; scale: number; power: number; intensity: number }> = {
  earth: { color: 0x4d9dff, scale: 1.07, power: 2.4, intensity: 1.6 },
  venus: { color: 0xffcf86, scale: 1.06, power: 2.2, intensity: 1.3 },
  mars: { color: 0xff9466, scale: 1.025, power: 4.0, intensity: 0.55 },
  jupiter: { color: 0xffe2b8, scale: 1.02, power: 5.0, intensity: 0.4 },
  saturn: { color: 0xffe8b6, scale: 1.02, power: 5.0, intensity: 0.4 },
  uranus: { color: 0x9cf6ff, scale: 1.045, power: 3.0, intensity: 1.0 },
  neptune: { color: 0x5a8cff, scale: 1.045, power: 3.0, intensity: 1.1 },
};

export interface AimInfo {
  active: boolean;
  speedKmS: number;
  massType: 'normal' | 'giant';
}

export interface PlacementConfig {
  typeId: string;
  name: string;
  visualRadius: number;
  massMultiplier: number;
  hasRings: boolean;
}

export interface PlacementInfo {
  distanceAU: number;
  millionKm: number;
  circularSpeedKmS: number;
  position: Vec3;
}

export interface SpaceScene {
  clearTrails(): void;
  setSelected(id: string | null): void;
  setCannonMode(active: boolean, massType?: 'normal' | 'giant'): void;
  setAimingAsteroid(id: string | null): void;
  setPlacementMode(
    config: PlacementConfig | null,
    onHover?: (info: PlacementInfo | null) => void,
    onConfirm?: (pos: Vec3) => void,
  ): void;
  focusBody(id: string | null): void;
  resetCamera(): void;
  /** 다른 시뮬레이션 화면이 위에 떠 있는 동안 계산·렌더링을 멈춘다 */
  setActive(active: boolean): void;
  dispose(): void;
}

// ---------- Web Audio API 효과음 합성기 (외부 파일 불필요, 100% 즉시 재생) ----------
let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playLaunchSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

export function playImpactSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

export function playExplosionSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.65);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.18));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(70, now + 0.6);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.65, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

export function createSpaceScene(
  container: HTMLElement,
  getState: () => SimState,
  onPick: (id: string | null) => void,
  onAbsorb?: (ev: AbsorptionEvent) => void,
  onCollision?: (ev: CollisionEvent) => void,
  onLaunchAsteroid?: (pos: Vec3, vel: Vec3, massType: 'normal' | 'giant') => void,
  onAimInfo?: (info: AimInfo | null) => void,
  onFireAsteroid?: (asteroidId: string, targetPos: Vec3) => void,
): SpaceScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030b');

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  camera.position.set(0, 48, 62);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 1400;

  scene.add(new THREE.AmbientLight(0xb8c4ff, 0.22));
  const sunLight = new THREE.PointLight(0xfff2d8, 3.6, 0, 0);
  scene.add(sunLight);

  // 하늘 (은하수 돔 + 반짝이는 별) — 카메라를 따라다녀서 아무리 멀리 가도 배경으로 남는다
  const sky = new THREE.Group();
  sky.add(createSkyDome(2600, 1.0));
  const starfield = createStarfield({ count: 7000, radius: 1900, size: 2.3 });
  sky.add(starfield.points);
  scene.add(sky);

  const bloom = createBloomPipeline(renderer, scene, camera, { strength: 0.7, radius: 0.42, threshold: 0.88 });

  // 원래 궤도 (흐린 기준선) — 궤도에서 벗어나는 게 잘 보이도록
  for (const o of ORBIT_RADII) {
    const r = mapRadius(o.a);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * r, 0, -Math.sin(t) * r));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.18 }),
    );
    scene.add(ring);
  }

  // 천체 메시 관리
  const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
  const visuals = new Map<string, Visual>();
  const hitMeshes: THREE.Mesh[] = [];

  function createVisualForBody(b: Body): Visual {
    const id = b.id as BodyId;
    const isBlackHole = isBlackHoleBody(b);
    const isAsteroid = b.id.includes('asteroid') || b.id.includes('fragment');
    const isGiant = b.id.includes('giant');
    const isCustom = b.id.startsWith('custom_');
    const customType = b.typeId || (isCustom ? b.id.split('_')[1] : null);
    const effectiveType = customType || id;
    const baseInfo = customType ? BODY_INFO[customType as BodyId] : undefined;
    const info = BODY_INFO[id] ?? baseInfo ?? (isBlackHole ? BODY_INFO['black_hole'] : isAsteroid ? (isGiant ? BODY_INFO['giant_asteroid'] : BODY_INFO['asteroid']) : { emoji: '🪐', color: '#38bdf8', lines: [] });
    const group = new THREE.Group();
    // body: 단위 크기(반지름 1)로 만들고 매 프레임 visualRadius 로 확대
    const body = new THREE.Group();
    group.add(body);
    const tilt = new THREE.Group();
    tilt.rotation.z = AXIAL_TILT[effectiveType] ?? 0;
    body.add(tilt);
    const spin = new THREE.Group();
    tilt.add(spin);
    let spinSpeed = 0.6;

    let sphere: THREE.Mesh;
    let clouds: THREE.Mesh | undefined;
    let atmosphere: THREE.ShaderMaterial | undefined;
    let accretionDisk: Visual['accretionDisk'];
    let lensingRing: Visual['lensingRing'];
    let sunMaterial: THREE.ShaderMaterial | undefined;

    if (isBlackHole) {
      // 사건의 지평선 (빛 한 줄기 없는 칠흑의 구체)
      sphere = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
      body.add(sphere);

      const isSupermassive = id === 'supermassive_black_hole';
      // 난류 플라스마 강착원반 (가까이 다가오는 쪽이 더 밝은 도플러 효과)
      accretionDisk = createAccretionDisk(1.5, isSupermassive ? 5.6 : 4.2, { intensity: 0.75 });
      accretionDisk.rotation.x = -Math.PI / 2 + 0.32;
      accretionDisk.rotation.y = 0.12;
      body.add(accretionDisk);

      // 중력렌즈로 지평선 위·아래를 감싸는 뒤편 원반 + 광자 고리 (카메라를 향함)
      lensingRing = createLensingHalo(1.0, { intensity: 0.7 });
      body.add(lensingRing);
    } else if (isAsteroid) {
      // 소행성 및 파편: 울퉁불퉁한 암석 + 대기 마찰 불꽃 오라
      const rockGeo = new THREE.IcosahedronGeometry(1, 3);
      const p = rockGeo.attributes.position;
      const v3 = new THREE.Vector3();
      const seed = b.id.length * 13.7;
      for (let i = 0; i < p.count; i++) {
        v3.fromBufferAttribute(p, i);
        const k = 1 + 0.22 * Math.sin(v3.x * 3.1 + seed) * Math.cos(v3.y * 2.7 - seed) + 0.1 * Math.sin(v3.z * 6.3 + seed * 2);
        v3.multiplyScalar(k);
        p.setXYZ(i, v3.x, v3.y, v3.z);
      }
      rockGeo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: isGiant ? '#ff8a7a' : '#d9b48a',
        roughness: 0.95,
        metalness: 0.05,
        map: makeAsteroidTexture(isGiant),
        emissive: isGiant ? new THREE.Color('#ff3300') : new THREE.Color('#ff7a00'),
        emissiveIntensity: isGiant ? 0.35 : 0.15,
      });
      sphere = new THREE.Mesh(rockGeo, mat);
      spin.add(sphere);
      spinSpeed = 2.2;
      body.add(makeAsteroidFlameGlow(isGiant));
    } else {
      const isSun = effectiveType === 'sun';

      if (isSun) {
        sunMaterial = createSunMaterial(1.45);
        sphere = new THREE.Mesh(sphereGeo, sunMaterial);
        spin.add(sphere);
        spinSpeed = 0.08;
        // 코로나 (안쪽 밝은 빛무리 + 넓게 퍼지는 은은한 빛)
        const innerCorona = createCoronaSprite(0xffc46b, 3.4);
        innerCorona.material.opacity = 0.75;
        body.add(innerCorona);
        const outerCorona = createCoronaSprite(0xff7a2e, 7.0);
        outerCorona.material.opacity = 0.35;
        body.add(outerCorona);
      } else {
        const textureKey = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(effectiveType) ? effectiveType : id;
        const isGas = ['jupiter', 'saturn', 'uranus', 'neptune'].includes(effectiveType);
        const diffTex = createPlanetTexture(textureKey);
        const roughTex = createRoughnessMap(textureKey);
        const mat = new THREE.MeshStandardMaterial({
          map: diffTex,
          normalMap: isGas ? null : createNormalMap(diffTex, 2.4),
          normalScale: new THREE.Vector2(0.9, 0.9),
          roughness: roughTex ? 1.0 : isGas ? 0.85 : 0.9,
          roughnessMap: roughTex ?? null,
          metalness: 0.0,
          emissive: new THREE.Color(info.color),
          emissiveIntensity: isCustom ? 0.08 : 0.0,
        });
        sphere = new THREE.Mesh(sphereGeo, mat);
        spin.add(sphere);
        spinSpeed = isGas ? 1.1 : effectiveType === 'venus' ? -0.1 : 0.6;

        // 지구 구름층 (지표보다 조금 빠르게 흐름)
        if (effectiveType === 'earth') {
          clouds = new THREE.Mesh(
            sphereGeo,
            new THREE.MeshStandardMaterial({ map: createCloudTexture(), transparent: true, depthWrite: false, roughness: 1 }),
          );
          clouds.scale.setScalar(1.015);
          spin.add(clouds);
        }

        // 대기 산란광 (태양 쪽 가장자리가 빛남)
        const atm = ATMOSPHERES[effectiveType] ?? (isCustom ? { color: new THREE.Color(info.color).getHex(), scale: 1.05, power: 2.8, intensity: 0.9 } : undefined);
        if (atm) {
          atmosphere = createAtmosphereMaterial(atm.color, { power: atm.power, intensity: atm.intensity });
          const shell = new THREE.Mesh(sphereGeo, atmosphere);
          shell.scale.setScalar(atm.scale);
          body.add(shell);
        }
      }

      // 고리 (적도면에 놓이도록 자전축 기울기 그룹 안에 둔다. 실제 비율: 토성 1.24~2.33R, 천왕성 1.6~2.0R)
      if (b.hasRings || effectiveType === 'saturn' || id === 'saturn' || id === 'andros_titan') {
        tilt.add(makeProceduralRing('saturn', 1.24, 2.33));
      } else if (effectiveType === 'uranus' || id === 'uranus') {
        tilt.add(makeProceduralRing('uranus', 1.6, 2.05));
      }

      // 인접 나선은하 안드로스 중심핵 및 외계 거성 효과 (원래 크기 유지 위해 group 에 직접)
      if (id === 'andros_core') group.add(makeSpiralGalaxyDisc());
      const glow = id === 'andros_core' ? 0xc084fc : id === 'andros_sirius' ? 0x60a5fa : id === 'andros_betelgeuse' ? 0xf87171 : null;
      if (glow !== null) {
        atmosphere = createAtmosphereMaterial(glow, { power: 2.0, intensity: 1.8 });
        const shell = new THREE.Mesh(sphereGeo, atmosphere);
        shell.scale.setScalar(1.15);
        body.add(shell);
      }
    }

    // 클릭하기 쉽게 보이지 않는 큰 구를 덧붙인다
    const hit = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    hit.userData.id = b.id;
    group.add(hit);
    hitMeshes.push(hit);

    const trailPos = new Float32Array(TRAIL_N * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setDrawRange(0, 0);
    const trailColor = isBlackHole ? 0xcc44ff : isGiant ? 0xff2244 : isAsteroid ? 0xff8811 : new THREE.Color(info.color).getHex();
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({
        color: trailColor,
        transparent: true,
        opacity: id === 'moon' ? 0.35 : 0.85,
      }),
    );
    trail.frustumCulled = false;

    // 네온 궤도선 (Neon Orbit Path Line)
    let orbitLine: THREE.LineLoop | undefined;
    if (id !== 'sun' && effectiveType !== 'sun' && !isBlackHole && !isAsteroid) {
      const orbitPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        orbitPts.push(new THREE.Vector3());
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(info.color).getHex(),
        transparent: true,
        opacity: id === 'moon' ? 0.25 : (isCustom ? 0.65 : 0.42),
      });
      orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
      scene.add(orbitLine);
    }

    scene.add(group, trail);
    const vis: Visual = {
      group,
      body,
      spin,
      spinSpeed,
      sphere,
      clouds,
      atmosphere,
      hit,
      trail,
      trailPos,
      trailCount: 0,
      vis: new THREE.Vector3(),
      accretionDisk,
      lensingRing,
      sunMaterial,
      orbitLine,
    };
    visuals.set(b.id, vis);
    return vis;
  }

  // 초기 천체 메시 생성
  for (const b of getState().bodies) {
    createVisualForBody(b);
  }

  // 선택 표시 네온 링 (Selected Body Neon Indicator Ring)
  const selRing = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.45, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);
  let selectedId: string | null = null;
  let focusedBodyId: string | null = null;

  // ---------- 충격파 & 폭발 파편 & 카메라 진동 시스템 ----------
  const shockwaves: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; time: number; maxTime: number; scaleMult: number }[] = [];

  function triggerShockwave(pos: THREE.Vector3, color = 0xff33cc, scaleMult = 1.0) {
    const geo = new THREE.RingGeometry(0.5, 1.8, 64);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    shockwaves.push({ mesh, mat, time: 0, maxTime: 0.85, scaleMult });
  }

  function updateShockwaves(dt: number) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.time += dt;
      const progress = sw.time / sw.maxTime;
      if (progress >= 1) {
        scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mat.dispose();
        shockwaves.splice(i, 1);
      } else {
        const s = (1 + progress * 6.5) * sw.scaleMult;
        sw.mesh.scale.set(s, s, s);
        sw.mat.opacity = 0.95 * (1 - progress);
      }
    }
  }

  interface SparkSystem {
    mesh: THREE.Points;
    geo: THREE.BufferGeometry;
    mat: THREE.PointsMaterial;
    pos: Float32Array;
    vel: Float32Array;
    count: number;
    time: number;
    maxTime: number;
  }
  const sparkSystems: SparkSystem[] = [];

  function triggerExplosionSparks(pos: THREE.Vector3, isGiant: boolean) {
    const count = isGiant ? 60 : 32;
    const posArr = new Float32Array(count * 3);
    const velArr = new Float32Array(count * 3);
    const colArr = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      posArr[i * 3] = pos.x;
      posArr[i * 3 + 1] = pos.y;
      posArr[i * 3 + 2] = pos.z;

      const th = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = (isGiant ? 5.5 : 3.2) * (0.4 + Math.random() * 0.9);
      velArr[i * 3] = Math.cos(phi) * Math.cos(th) * speed;
      velArr[i * 3 + 1] = Math.sin(phi) * speed * 0.6;
      velArr[i * 3 + 2] = Math.cos(phi) * Math.sin(th) * speed;

      const c = new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 1.0, 0.55 + Math.random() * 0.35);
      colArr[i * 3] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

    const mat = softenPoints(
      new THREE.PointsMaterial({
        size: isGiant ? 4.0 : 2.5,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      2.4,
    );

    const mesh = new THREE.Points(geo, mat);
    scene.add(mesh);
    sparkSystems.push({
      mesh,
      geo,
      mat,
      pos: posArr,
      vel: velArr,
      count,
      time: 0,
      maxTime: isGiant ? 1.3 : 0.85,
    });
  }

  function updateSparks(dt: number) {
    for (let i = sparkSystems.length - 1; i >= 0; i--) {
      const sp = sparkSystems[i];
      sp.time += dt;
      const prog = sp.time / sp.maxTime;
      if (prog >= 1) {
        scene.remove(sp.mesh);
        sp.geo.dispose();
        sp.mat.dispose();
        sparkSystems.splice(i, 1);
      } else {
        const p = sp.pos;
        const v = sp.vel;
        for (let k = 0; k < sp.count; k++) {
          p[k * 3] += v[k * 3] * dt;
          p[k * 3 + 1] += v[k * 3 + 1] * dt;
          p[k * 3 + 2] += v[k * 3 + 2] * dt;
        }
        sp.geo.attributes.position.needsUpdate = true;
        sp.mat.opacity = 1 - prog;
      }
    }
  }

  let shakeIntensity = 0;
  let shakeTime = 0;
  function startCameraShake(intensity: number) {
    shakeIntensity = intensity;
    shakeTime = 0.45;
  }

  // ---------- 대포 모드 & 궤적 조준 (Cannon Mode & Trajectory Prediction) ----------
  let cannonActive = false;
  let cannonMassType: 'normal' | 'giant' = 'normal';
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // 조준 발사대 링
  const muzzleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.15, 32),
    new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  muzzleRing.rotation.x = -Math.PI / 2;
  muzzleRing.visible = false;
  scene.add(muzzleRing);

  // 실시간 예측 궤적선 (Trajectory Line)
  const MAX_TRAJ_PTS = 32;
  const trajPos = new Float32Array(MAX_TRAJ_PTS * 3);
  const trajGeo = new THREE.BufferGeometry();
  trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPos, 3));
  trajGeo.setDrawRange(0, 0);
  const trajLine = new THREE.Line(
    trajGeo,
    new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    }),
  );
  trajLine.frustumCulled = false;
  trajLine.visible = false;
  scene.add(trajLine);

  // 소행성 2단계 클릭 조준 레이저선 (Asteroid Laser Aiming Line)
  let aimingAsteroidId: string | null = null;
  const laserPos = new Float32Array(2 * 3);
  const laserGeo = new THREE.BufferGeometry();
  laserGeo.setAttribute('position', new THREE.BufferAttribute(laserPos, 3));
  laserGeo.setDrawRange(0, 0);
  const laserLine = new THREE.Line(
    laserGeo,
    new THREE.LineBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    }),
  );
  laserLine.frustumCulled = false;
  laserLine.visible = false;
  scene.add(laserLine);

  // 타겟 위치 마커 링
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.visible = false;
  scene.add(targetRing);

  let isDraggingCannon = false;
  const cannonStart = new THREE.Vector3();
  const cannonCurrent = new THREE.Vector3();

  // ---------- 매 프레임 루프 ----------
  const tmp = new THREE.Vector3();
  const prevTarget = new THREE.Vector3();
  const clock = new THREE.Clock();
  let raf = 0;

  function updateVisuals(bodies: Body[], dt: number, elapsed: number) {
    // 새로운 천체가 생겼거나 블랙홀 변신 상태가 전환된 경우 비주얼 동기화
    for (const b of bodies) {
      let v = visuals.get(b.id);
      const isBh = isBlackHoleBody(b);
      if (v) {
        const hasDisk = !!v.accretionDisk;
        if (isBh !== hasDisk) {
          scene.remove(v.group);
          scene.remove(v.trail);
          if (v.orbitLine) scene.remove(v.orbitLine);
          visuals.delete(b.id);
          const hitIdx = hitMeshes.indexOf(v.hit);
          if (hitIdx >= 0) hitMeshes.splice(hitIdx, 1);
          v = createVisualForBody(b);
          if (isBh) {
            triggerShockwave(v.vis, 0xcc33ff, 2.6);
            triggerExplosionSparks(v.vis, true);
            startCameraShake(1.2);
            playExplosionSound();
          }
        }
      } else {
        createVisualForBody(b);
      }
    }

    const alive = new Set(bodies.map((b) => b.id));
    for (const [id, v] of visuals) {
      const isAlive = alive.has(id);
      v.group.visible = isAlive;
      v.trail.visible = isAlive;
      if (!isAlive && v.trailCount > 0) {
        v.trailCount = 0;
        v.trail.geometry.setDrawRange(0, 0);
      }
    }
    // 1차: 기본 위치
    for (const b of bodies) mapPoint(b.position, visuals.get(b.id)!.vis);
    // 2차: 위성은 행성 옆에 보이도록 (블랙홀은 위성 호스트 제외)
    for (const b of bodies) {
      const host = findHost(bodies, b);
      if (!host || isBlackHoleBody(host)) continue;
      const v = visuals.get(b.id)!;
      const hv = visuals.get(host.id)!;
      const d: Vec3 = [b.position[0] - host.position[0], b.position[1] - host.position[1], b.position[2] - host.position[2]];
      const dl = length(d);
      const s = satelliteOffset(dl) / dl;
      tmp.set(hv.vis.x + d[0] * s, hv.vis.y + d[2] * s, hv.vis.z - d[1] * s);
      const w = Math.min(1, Math.max(0, (0.05 - dl) / 0.03));
      v.vis.lerp(tmp, w);
    }
    const sunBody = bodies.find((b) => b.id === 'sun');
    const sunWorld = sunBody ? visuals.get('sun')!.vis : tmp.set(0, 0, 0);
    for (const b of bodies) {
      const v = visuals.get(b.id)!;
      v.group.position.copy(v.vis);
      v.body.scale.setScalar(b.visualRadius);
      v.hit.scale.setScalar(Math.max(b.visualRadius * 1.6, 1.1));
      v.spin.rotation.y += v.spinSpeed * dt;
      if (v.clouds) v.clouds.rotation.y += 0.05 * dt;
      if (b.id === 'andros_core') {
        v.group.rotation.y += 0.18 * dt;
      }
      if (v.atmosphere) v.atmosphere.uniforms.uSunPos.value.copy(sunWorld);
      if (v.sunMaterial) v.sunMaterial.uniforms.uTime.value = elapsed;

      // 블랙홀 강착원반 소용돌이 & 렌즈 광륜은 항상 카메라를 향함
      if (v.accretionDisk) v.accretionDisk.material.uniforms.uTime.value = elapsed;
      if (v.lensingRing) {
        v.lensingRing.material.uniforms.uTime.value = elapsed;
        v.lensingRing.quaternion.copy(camera.quaternion);
      }

      // 동적 네온 궤도선 갱신 (Dynamic Neon Orbit Path Loop)
      if (v.orbitLine) {
        const isMoon = b.id === 'moon';
        const center = isMoon ? (visuals.get('earth')?.vis ?? new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
        const r = isMoon ? 1.8 : Math.hypot(v.vis.x - center.x, v.vis.z - center.z);
        const posArr = v.orbitLine.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i <= 64; i++) {
          const th = (i / 64) * Math.PI * 2;
          posArr[i * 3] = center.x + Math.cos(th) * r;
          posArr[i * 3 + 1] = center.y;
          posArr[i * 3 + 2] = center.z + Math.sin(th) * r;
        }
        v.orbitLine.geometry.attributes.position.needsUpdate = true;
        v.orbitLine.visible = v.group.visible;
      }

      pushTrail(v, b.id === 'moon' ? 0.04 : 0.12);
    }
    const sun = bodies.find((b) => b.id === 'sun');
    sunLight.visible = !!sun;
    if (sun) sunLight.position.copy(visuals.get('sun')!.vis);
  }

  function pushTrail(v: Visual, minStep: number) {
    const p = v.trailPos;
    if (v.trailCount > 0) {
      const i = (v.trailCount - 1) * 3;
      const dx = p[i] - v.vis.x, dy = p[i + 1] - v.vis.y, dz = p[i + 2] - v.vis.z;
      if (dx * dx + dy * dy + dz * dz < minStep * minStep) return;
    }
    if (v.trailCount === TRAIL_N) {
      p.copyWithin(0, 3);
      v.trailCount--;
    }
    p.set([v.vis.x, v.vis.y, v.vis.z], v.trailCount * 3);
    v.trailCount++;
    const geo = v.trail.geometry;
    geo.setDrawRange(0, v.trailCount);
    geo.attributes.position.needsUpdate = true;
  }

  let active = true;
  let elapsed = 0;
  const shakeOffset = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!active) return;
    elapsed += dt;
    const state = getState();

    // 지난 프레임의 흔들림 오프셋을 되돌려 카메라가 조금씩 밀려나지 않게 한다
    camera.position.sub(shakeOffset);
    shakeOffset.set(0, 0, 0);

    advance(
      state,
      dt,
      (ev) => {
        const bhVis = visuals.get(ev.blackHoleId);
        if (bhVis) {
          triggerShockwave(bhVis.vis, 0xff33cc, 1.2);
        }
        onAbsorb?.(ev);
      },
      (colEv) => {
        const isGiant = colEv.type === 'shatter';
        const colPos = new THREE.Vector3();
        mapPoint(colEv.position, colPos);
        triggerShockwave(colPos, isGiant ? 0xff2200 : 0xff7700, isGiant ? 2.0 : 1.1);
        triggerExplosionSparks(colPos, isGiant);
        startCameraShake(isGiant ? 1.4 : 0.65);
        if (isGiant) {
          playExplosionSound();
        } else {
          playImpactSound();
        }
        onCollision?.(colEv);
      },
    );

    updateVisuals(state.bodies, dt, elapsed);
    updateShockwaves(dt);
    updateSparks(dt);
    starfield.update(elapsed);

    // 선택 또는 포커스된 천체를 카메라가 부드럽게 추적
    const targetId = focusedBodyId ?? selectedId;
    const sel = targetId ? state.bodies.find((b) => b.id === targetId) : undefined;
    const goal = sel && visuals.has(sel.id) ? visuals.get(sel.id)!.vis : tmp.set(0, 0, 0);
    prevTarget.copy(controls.target);
    controls.target.lerp(goal, 0.08);
    camera.position.add(prevTarget.sub(controls.target).negate());

    // 타깃 선택 네온 링 애니메이션
    const activeSel = selectedId ? state.bodies.find((b) => b.id === selectedId) : undefined;
    selRing.visible = !!activeSel && visuals.has(activeSel.id);
    if (activeSel && selRing.visible) {
      selRing.position.copy(visuals.get(activeSel.id)!.vis);
      selRing.scale.setScalar(Math.max(activeSel.visualRadius * 1.5, 0.6));
      selRing.quaternion.copy(camera.quaternion);
      selRing.rotation.z += 0.04;
    }

    controls.update();

    // 충돌 시 카메라 흔들림 (다음 프레임 시작 때 되돌림)
    if (shakeTime > 0) {
      shakeTime -= dt;
      const s = shakeIntensity * Math.max(0, shakeTime / 0.45);
      shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      camera.position.add(shakeOffset);
    }

    sky.position.copy(camera.position);
    bloom.render();
  }

  // ---------- 크기 변경 (화면 / 모니터 보정) ----------
  const updateSize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(updateSize);
  ro.observe(container);
  window.addEventListener('resize', updateSize);

  // ---------- 클릭 & 대포 모드 드래그 조준 & 소행성 타겟팅 클릭 발사 ----------
  const raycaster = new THREE.Raycaster();
  const down = { x: 0, y: 0 };
  const el = renderer.domElement;
  const planeHit = new THREE.Vector3();

  // ---------- 마우스 3D 직접 궤도 배치 프리뷰 ----------
  let placementConfig: PlacementConfig | null = null;
  let onPlacementHoverCb: ((info: PlacementInfo | null) => void) | null = null;
  let onPlacementConfirmCb: ((pos: Vec3) => void) | null = null;

  const placementPreviewMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    roughness: 0.35,
    metalness: 0.2,
    emissive: 0x0284c7,
    emissiveIntensity: 0.5,
  });
  const placementPreviewSphere = new THREE.Mesh(sphereGeo, placementPreviewMat);
  placementPreviewSphere.visible = false;
  scene.add(placementPreviewSphere);

  const placementOrbitPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) placementOrbitPts.push(new THREE.Vector3());
  const placementOrbitGeo = new THREE.BufferGeometry().setFromPoints(placementOrbitPts);
  const placementOrbitLine = new THREE.Line(
    placementOrbitGeo,
    new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    }),
  );
  placementOrbitLine.visible = false;
  scene.add(placementOrbitLine);

  const getNDC = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  };

  const onDown = (e: PointerEvent) => {
    down.x = e.clientX;
    down.y = e.clientY;

    if (cannonActive) {
      raycaster.setFromCamera(getNDC(e), camera);
      if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
        isDraggingCannon = true;
        cannonStart.copy(planeHit);
        cannonCurrent.copy(planeHit);
        controls.enabled = false;

        muzzleRing.position.copy(cannonStart);
        muzzleRing.position.y = 0.05;
        muzzleRing.visible = true;

        trajLine.visible = true;
        trajGeo.setDrawRange(0, 0);
      }
    }
  };

  const onMove = (e: PointerEvent) => {
    // 0. 마우스 행성 궤도 배치 모드 프리뷰 & 안내
    if (placementConfig) {
      raycaster.setFromCamera(getNDC(e), camera);
      if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
        placementPreviewSphere.visible = true;
        placementPreviewSphere.position.copy(planeHit);
        placementPreviewSphere.position.y = 0.05;
        placementPreviewSphere.scale.setScalar(Math.max(0.4, placementConfig.visualRadius));

        const R = Math.hypot(planeHit.x, planeHit.z);
        const posAttr = placementOrbitGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= 128; i++) {
          const t = (i / 128) * Math.PI * 2;
          posAttr.setXYZ(i, Math.cos(t) * R, 0.02, -Math.sin(t) * R);
        }
        posAttr.needsUpdate = true;
        placementOrbitLine.visible = true;

        const posAU = unmapPoint(planeHit);
        const rAU = length(posAU);
        const sun = getState().bodies.find((b) => b.id === 'sun');
        const mSun = sun ? sun.mass : SUN_MASS;
        const vCirc = calculateCircularSpeed(mSun, rAU);
        onPlacementHoverCb?.({
          distanceAU: rAU,
          millionKm: rAU * 149.6,
          circularSpeedKmS: vCirc * AU_PER_DAY_TO_KM_S,
          position: posAU,
        });
      }
      return;
    }

    // 1. 소행성이 조준된 상태이면 마우스 위치로 레이저선 표시
    if (aimingAsteroidId) {
      const astVis = visuals.get(aimingAsteroidId);
      if (astVis && astVis.group.visible) {
        raycaster.setFromCamera(getNDC(e), camera);
        if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
          laserLine.visible = true;
          targetRing.visible = true;
          targetRing.position.copy(planeHit);
          targetRing.position.y = 0.05;

          const pArr = laserPos;
          pArr[0] = astVis.vis.x;
          pArr[1] = astVis.vis.y;
          pArr[2] = astVis.vis.z;
          pArr[3] = planeHit.x;
          pArr[4] = 0.05;
          pArr[5] = planeHit.z;
          laserGeo.setDrawRange(0, 2);
          laserGeo.attributes.position.needsUpdate = true;
        }
      } else {
        aimingAsteroidId = null;
        laserLine.visible = false;
        targetRing.visible = false;
      }
    }

    // 2. 대포 드래그 조준 중이면 예측 궤적선 표시
    if (!cannonActive || !isDraggingCannon) return;

    raycaster.setFromCamera(getNDC(e), camera);
    if (!raycaster.ray.intersectPlane(groundPlane, planeHit)) return;

    cannonCurrent.copy(planeHit);
    const dragVec = cannonCurrent.clone().sub(cannonStart);
    const dist = dragVec.length();

    if (dist < 0.3) {
      trajGeo.setDrawRange(0, 0);
      onAimInfo?.(null);
      return;
    }

    const vMag = Math.max(0.008, Math.min(0.095, dist * 0.0055));
    const dirX = dragVec.x / dist;
    const dirZ = dragVec.z / dist;
    const vx = dirX * vMag;
    const vy = -dirZ * vMag;
    const speedKmS = vMag * AU_PER_DAY_TO_KM_S;

    onAimInfo?.({ active: true, speedKmS, massType: cannonMassType });

    const startP = unmapPoint(cannonStart);
    let curPx = startP[0];
    let curPy = startP[1];
    let curVx = vx;
    let curVy = vy;
    const dtStep = 0.45;

    const tmpPt = new THREE.Vector3();
    const pArr = trajPos;
    let ptCount = 0;

    pArr[0] = cannonStart.x;
    pArr[1] = 0.05;
    pArr[2] = cannonStart.z;
    ptCount++;

    for (let step = 0; step < MAX_TRAJ_PTS - 1; step++) {
      const r2 = curPx * curPx + curPy * curPy + 0.0001;
      const r = Math.sqrt(r2);
      const acc = (G * SUN_MASS) / (r2 * r);
      curVx -= curPx * acc * dtStep;
      curVy -= curPy * acc * dtStep;
      curPx += curVx * dtStep;
      curPy += curVy * dtStep;

      mapPoint([curPx, curPy, 0], tmpPt);
      pArr[ptCount * 3] = tmpPt.x;
      pArr[ptCount * 3 + 1] = 0.05;
      pArr[ptCount * 3 + 2] = tmpPt.z;
      ptCount++;
    }

    trajGeo.setDrawRange(0, ptCount);
    trajGeo.attributes.position.needsUpdate = true;
  };

  const onUp = (e: PointerEvent) => {
    if (cannonActive && isDraggingCannon) {
      isDraggingCannon = false;
      controls.enabled = true;
      muzzleRing.visible = false;
      trajLine.visible = false;
      trajGeo.setDrawRange(0, 0);

      const dragVec = cannonCurrent.clone().sub(cannonStart);
      const dist = dragVec.length();

      if (dist >= 0.8) {
        const vMag = Math.max(0.008, Math.min(0.095, dist * 0.0055));
        const dirX = dragVec.x / dist;
        const dirZ = dragVec.z / dist;
        const launchPos = unmapPoint(cannonStart);
        const launchVel: Vec3 = [dirX * vMag, -dirZ * vMag, 0];

        onLaunchAsteroid?.(launchPos, launchVel, cannonMassType);
        playLaunchSound();
        triggerShockwave(cannonStart, 0xffaa00, 0.5);
      }
      onAimInfo?.(null);
      return;
    }

    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;

    // 마우스 행성 궤도 배치 모드 클릭 안착
    if (placementConfig) {
      raycaster.setFromCamera(getNDC(e), camera);
      if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
        const posAU = unmapPoint(planeHit);
        triggerShockwave(planeHit, 0x38bdf8, 1.2);
        playLaunchSound();
        onPlacementConfirmCb?.(posAU);
      }
      return;
    }

    const ndc = getNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const alive = new Set(getState().bodies.map((b) => b.id));
    const hits = raycaster.intersectObjects(hitMeshes.filter((m) => alive.has(m.userData.id)), false);

    let best: string | null = null;
    let bestD = Infinity;
    for (const h of hits) {
      const v = visuals.get(h.object.userData.id)!;
      const d = raycaster.ray.distanceToPoint(v.vis);
      if (d < bestD) {
        bestD = d;
        best = h.object.userData.id;
      }
    }

    // [핵심] 사용자가 소행성을 클릭한 후, 화면의 원하는 방향이나 목표 행성을 클릭한 경우:
    // 그쪽 방향으로 소행성이 즉시 발사되어 날아감!
    if (aimingAsteroidId) {
      if (best === aimingAsteroidId) {
        // 이미 조준 중인 소행성을 다시 클릭하면 취소
        aimingAsteroidId = null;
        laserLine.visible = false;
        targetRing.visible = false;
        onPick(null);
        return;
      }

      let targetPos: Vec3;
      if (best) {
        const tgtBody = getState().bodies.find((b) => b.id === best);
        targetPos = tgtBody ? [...tgtBody.position] : [0, 0, 0];
      } else {
        if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
          targetPos = unmapPoint(planeHit);
        } else {
          targetPos = [0, 0, 0];
        }
      }

      const astVis = visuals.get(aimingAsteroidId);
      if (astVis) {
        triggerShockwave(astVis.vis, 0xff7700, 0.8);
      }
      onFireAsteroid?.(aimingAsteroidId, targetPos);
      playLaunchSound();

      aimingAsteroidId = null;
      laserLine.visible = false;
      targetRing.visible = false;
      return;
    }

    // 소행성을 처음 클릭한 경우 -> 조준 모드 진입!
    if (best && (best.includes('asteroid') || best.includes('fragment'))) {
      aimingAsteroidId = best;
      laserLine.visible = true;
      targetRing.visible = true;
      onPick(best);
      return;
    }

    onPick(best);
  };

  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  frame();

  return {
    clearTrails() {
      for (const v of visuals.values()) {
        v.trailCount = 0;
        v.trail.geometry.setDrawRange(0, 0);
      }
      for (const sw of shockwaves) {
        scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mat.dispose();
      }
      shockwaves.length = 0;
      for (const sp of sparkSystems) {
        scene.remove(sp.mesh);
        sp.geo.dispose();
        sp.mat.dispose();
      }
      sparkSystems.length = 0;
    },
    setSelected(id) {
      selectedId = id;
    },
    setCannonMode(active, massType = 'normal') {
      cannonActive = active;
      cannonMassType = massType;
      el.style.cursor = active ? 'crosshair' : 'grab';
      if (!active) {
        isDraggingCannon = false;
        controls.enabled = true;
        muzzleRing.visible = false;
        trajLine.visible = false;
        onAimInfo?.(null);
      }
    },
    setAimingAsteroid(id) {
      aimingAsteroidId = id;
      if (!id) {
        laserLine.visible = false;
        targetRing.visible = false;
      }
    },
    setPlacementMode(config, onHover, onConfirm) {
      placementConfig = config;
      onPlacementHoverCb = onHover ?? null;
      onPlacementConfirmCb = onConfirm ?? null;
      el.style.cursor = config ? 'crosshair' : 'grab';
      if (!config) {
        placementPreviewSphere.visible = false;
        placementOrbitLine.visible = false;
        onPlacementHoverCb?.(null);
      }
    },
    focusBody(id) {
      focusedBodyId = id;
      if (id && visuals.has(id)) {
        controls.target.copy(visuals.get(id)!.vis);
      }
    },
    resetCamera() {
      focusedBodyId = null;
      controls.target.set(0, 0, 0);
      camera.position.set(0, 48, 62);
    },
    setActive(next) {
      active = next;
      renderer.domElement.style.visibility = next ? 'visible' : 'hidden';
      clock.getDelta();
    },
    dispose() {
      cancelAnimationFrame(raf);
      bloom.dispose();
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
      el.remove();
    },
  };
}

// ---------- 꾸미기 (고리, 나선은하, 소행성) ----------

function makeProceduralRing(planetId: string, innerR: number, outerR: number): THREE.Mesh {
  // 고리를 따라 줄무늬가 돌도록 (반지름, 각도) UV 를 쓴다
  const geo = setRadialRingUVs(new THREE.RingGeometry(innerR, outerR, 192, 1), innerR, outerR);
  const mat = new THREE.MeshBasicMaterial({
    map: createRingTexture(planetId),
    color: 0xd8d2c8,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** 나선은하 안드로스(Andros) 3D 성운 원반 & 나선팔 별무리 파티클 시스템 */
function makeSpiralGalaxyDisc(): THREE.Group {
  const group = new THREE.Group();

  // 1. 은하 중심 성운 글로우 원반
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  grad.addColorStop(0, 'rgba(235, 215, 255, 0.95)');
  grad.addColorStop(0.12, 'rgba(190, 130, 255, 0.75)');
  grad.addColorStop(0.35, 'rgba(90, 140, 255, 0.45)');
  grad.addColorStop(0.65, 'rgba(147, 51, 234, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 2개의 주 나선팔 그리기
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
  ctx.lineWidth = 16;
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    const baseAngle = arm * Math.PI;
    for (let r = 25; r < 240; r += 5) {
      const theta = baseAngle + r * 0.026;
      const x = 256 + Math.cos(theta) * r;
      const y = 256 + Math.sin(theta) * r;
      if (r === 25) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const planeGeo = new THREE.PlaneGeometry(36, 36);
  const planeMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  group.add(plane);

  // 2. 나선팔 별무리 파티클들 (600개 입체 별무리)
  const starCount = 600;
  const starPos = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const arm = i % 2;
    const r = 2.0 + Math.pow(Math.random(), 1.4) * 16.0;
    const theta = arm * Math.PI + r * 0.42 + (Math.random() - 0.5) * 0.55;
    const x = Math.cos(theta) * r + (Math.random() - 0.5) * 0.9;
    const z = Math.sin(theta) * r + (Math.random() - 0.5) * 0.9;
    const y = (Math.random() - 0.5) * 0.7 * Math.max(0.2, 1.0 - r / 18.0);
    starPos[i * 3] = x;
    starPos[i * 3 + 1] = y;
    starPos[i * 3 + 2] = z;

    const colRand = Math.random();
    if (colRand < 0.35) {
      colors[i * 3] = 0.45; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 1.0;
    } else if (colRand < 0.75) {
      colors[i * 3] = 0.85; colors[i * 3 + 1] = 0.45; colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.92; colors[i * 3 + 2] = 0.65;
    }
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.38,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, softenPoints(starMat));
  group.add(stars);

  return group;
}

/** 소행성 표면 텍스처 (크레이터 및 불타는 균열) */
function makeAsteroidTexture(isGiant: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = isGiant ? '#4a1515' : '#2b231d';
  g.fillRect(0, 0, 256, 256);

  let seed = 1234;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 40; i++) {
    const cx = rnd() * 256;
    const cy = rnd() * 256;
    const r = 4 + rnd() * 24;
    g.fillStyle = isGiant ? `rgba(255, ${Math.floor(rnd() * 80)}, 0, ${0.4 + rnd() * 0.4})` : `rgba(0, 0, 0, ${0.3 + rnd() * 0.4})`;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = isGiant ? '#ffaa00' : '#524337';
    g.lineWidth = 2;
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 소행성 불꽃 오라 스프라이트 */
function makeAsteroidFlameGlow(isGiant: boolean): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (isGiant) {
    grad.addColorStop(0, 'rgba(255, 255, 200, 0.95)');
    grad.addColorStop(0.25, 'rgba(255, 80, 20, 0.6)');
    grad.addColorStop(0.65, 'rgba(200, 20, 20, 0.2)');
    grad.addColorStop(1, 'rgba(200, 0, 0, 0)');
  } else {
    grad.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
    grad.addColorStop(0.28, 'rgba(255, 140, 30, 0.5)');
    grad.addColorStop(0.7, 'rgba(255, 70, 0, 0.15)');
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  // 본체(반지름 1) 기준 크기 — 이전 절대 크기(일반 2.0 / 거대 3.5)와 화면상 같은 크기
  sprite.scale.setScalar(isGiant ? 4.1 : 4.6);
  return sprite;
}

