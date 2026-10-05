// Three.js 화면. 물리 상태(AU 단위)를 "보기 좋은" 화면 좌표로 바꿔서 그린다.
// 여기서는 물리 상태를 읽기만 하고 바꾸지 않는다. (시간 진행 advance() 만 호출)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AU_PER_DAY_TO_KM_S, G, length, SUN_MASS, type Body, type Vec3, type AbsorptionEvent, type CollisionEvent } from './physics.ts';
import { advance, findHost, type SimState } from './simulation.ts';
import { BODY_INFO, ORBIT_RADII, type BodyId } from './solarSystem.ts';

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
  sphere: THREE.Mesh;
  hit: THREE.Mesh;
  trail: THREE.Line;
  trailPos: Float32Array;
  trailCount: number;
  vis: THREE.Vector3;
  accretionDisk?: THREE.Mesh;
  lensingRing?: THREE.Mesh;
}

export interface AimInfo {
  active: boolean;
  speedKmS: number;
  massType: 'normal' | 'giant';
}

export interface SpaceScene {
  clearTrails(): void;
  setSelected(id: string | null): void;
  setCannonMode(active: boolean, massType?: 'normal' | 'giant'): void;
  setAimingAsteroid(id: string | null): void;
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
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040615');

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  camera.position.set(0, 48, 62);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 400;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sunLight = new THREE.PointLight(0xfff2d0, 3.2, 0, 0);
  scene.add(sunLight);
  scene.add(makeStars());

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
    const isBlackHole = b.id.includes('black_hole');
    const isAsteroid = b.id.includes('asteroid') || b.id.includes('fragment');
    const isGiant = b.id.includes('giant');
    const info = BODY_INFO[id] ?? (isBlackHole ? BODY_INFO['black_hole'] : isAsteroid ? (isGiant ? BODY_INFO['giant_asteroid'] : BODY_INFO['asteroid']) : { emoji: '🪐', color: '#888888', lines: [] });
    const group = new THREE.Group();

    let sphere: THREE.Mesh;
    let accretionDisk: THREE.Mesh | undefined;
    let lensingRing: THREE.Mesh | undefined;

    if (isBlackHole) {
      // 사건의 지평선 (완전한 칠흑의 구체)
      sphere = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x010103 }));
      group.add(sphere);

      // 강착원반 (Accretion Disk)
      const diskGeo = new THREE.RingGeometry(1.25, 3.2, 64);
      const diskMat = new THREE.MeshBasicMaterial({
        map: makeAccretionDiskTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      accretionDisk = new THREE.Mesh(diskGeo, diskMat);
      accretionDisk.rotation.x = -Math.PI / 2 + 0.35;
      accretionDisk.rotation.z = 0.2;
      group.add(accretionDisk);

      // 중력 렌징 광자 고리 (Gravitational Lensing Halo Ring)
      const lensGeo = new THREE.RingGeometry(1.05, 1.45, 64);
      const lensMat = new THREE.MeshBasicMaterial({
        map: makeAccretionDiskTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      lensingRing = new THREE.Mesh(lensGeo, lensMat);
      lensingRing.rotation.y = 0.4;
      group.add(lensingRing);

      // 오로라빛 보라/자주 광륜 (Halo Glow)
      group.add(makeBlackHoleGlow());
    } else if (isAsteroid) {
      // 소행성 및 파편: 거친 암석 표면 + 타오르는 불꽃 오라
      const mat = new THREE.MeshStandardMaterial({
        color: isGiant ? '#ff4d4d' : '#f59e0b',
        roughness: 0.9,
        metalness: 0.1,
        map: makeAsteroidTexture(isGiant),
      });
      sphere = new THREE.Mesh(sphereGeo, mat);
      group.add(sphere);
      group.add(makeAsteroidFlameGlow(isGiant));
    } else {
      const mat =
        id === 'sun'
          ? new THREE.MeshBasicMaterial({ color: '#ffd75e' })
          : new THREE.MeshStandardMaterial({ color: '#ffffff', map: makeTexture(id, info.color), roughness: 0.85 });
      sphere = new THREE.Mesh(sphereGeo, mat);
      group.add(sphere);

      if (id === 'sun') group.add(makeGlow());
      if (id === 'saturn') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.4, 2.3, 64),
          new THREE.MeshBasicMaterial({ color: '#e9d7a8', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }),
        );
        ring.rotation.x = -Math.PI / 2 + 0.45;
        sphere.add(ring);
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

    scene.add(group, trail);
    const vis: Visual = {
      group,
      sphere,
      hit,
      trail,
      trailPos,
      trailCount: 0,
      vis: new THREE.Vector3(),
      accretionDisk,
      lensingRing,
    };
    visuals.set(b.id, vis);
    return vis;
  }

  // 초기 천체 메시 생성
  for (const b of getState().bodies) {
    createVisualForBody(b);
  }

  // 선택 표시 링
  const selRing = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.55, 64),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  selRing.visible = false;
  scene.add(selRing);
  let selectedId: string | null = null;

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

    const mat = new THREE.PointsMaterial({
      size: isGiant ? 4.0 : 2.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

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

  function updateVisuals(bodies: Body[]) {
    // 새로운 천체가 생겼으면 비주얼 등록
    for (const b of bodies) {
      if (!visuals.has(b.id)) {
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
      if (!host || host.id.includes('black_hole')) continue;
      const v = visuals.get(b.id)!;
      const hv = visuals.get(host.id)!;
      const d: Vec3 = [b.position[0] - host.position[0], b.position[1] - host.position[1], b.position[2] - host.position[2]];
      const dl = length(d);
      const s = satelliteOffset(dl) / dl;
      tmp.set(hv.vis.x + d[0] * s, hv.vis.y + d[2] * s, hv.vis.z - d[1] * s);
      const w = Math.min(1, Math.max(0, (0.05 - dl) / 0.03));
      v.vis.lerp(tmp, w);
    }
    for (const b of bodies) {
      const v = visuals.get(b.id)!;
      v.group.position.copy(v.vis);
      v.sphere.scale.setScalar(b.visualRadius);
      v.hit.scale.setScalar(Math.max(b.visualRadius * 1.6, 1.1));
      v.sphere.rotation.y += 0.01;

      // 블랙홀 강착원반 & 렌징 링 회전 애니메이션
      if (v.accretionDisk) {
        v.accretionDisk.rotation.z += 0.03;
        v.accretionDisk.scale.setScalar(b.visualRadius);
      }
      if (v.lensingRing) {
        v.lensingRing.rotation.z -= 0.015;
        v.lensingRing.scale.setScalar(b.visualRadius);
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

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    const state = getState();

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

    updateVisuals(state.bodies);
    updateShockwaves(dt);
    updateSparks(dt);

    // 충돌 시 카메라 흔들림(Camera Shake)
    if (shakeTime > 0) {
      shakeTime -= dt;
      const s = shakeIntensity * (shakeTime / 0.45);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }

    // 선택한 천체를 카메라가 부드럽게 따라간다
    const sel = selectedId ? state.bodies.find((b) => b.id === selectedId) : undefined;
    const goal = sel ? visuals.get(sel.id)!.vis : tmp.set(0, 0, 0);
    prevTarget.copy(controls.target);
    controls.target.lerp(goal, 0.08);
    camera.position.add(prevTarget.sub(controls.target).negate());
    selRing.visible = !!sel;
    if (sel) {
      selRing.position.copy(visuals.get(sel.id)!.vis);
      selRing.scale.setScalar(Math.max(sel.visualRadius, 0.4));
      selRing.quaternion.copy(camera.quaternion);
    }

    controls.update();
    renderer.render(scene, camera);
  }

  // ---------- 크기 변경 (화면 / 모니터 보정) ----------
  const updateSize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    dispose() {
      cancelAnimationFrame(raf);
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

// ---------- 꾸미기 (텍스처, 별, 태양 빛, 블랙홀 강착원반, 소행성) ----------

function makeStars(): THREE.Points {
  const n = 3000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = 700 + Math.random() * 300;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.5, 0.7 + Math.random() * 0.3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true }));
}

function makeGlow(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,230,150,0.9)');
  grad.addColorStop(0.25, 'rgba(255,190,80,0.45)');
  grad.addColorStop(0.6, 'rgba(255,140,40,0.12)');
  grad.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.scale.setScalar(16);
  return sprite;
}

/** 블랙홀 강착원반(Accretion Disk) 소용돌이 텍스처 */
function makeAccretionDiskTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  const grad = g.createRadialGradient(cx, cy, 60, cx, cy, 255);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.06, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.18, 'rgba(255, 220, 110, 0.95)');
  grad.addColorStop(0.38, 'rgba(255, 100, 30, 0.85)');
  grad.addColorStop(0.65, 'rgba(190, 40, 230, 0.55)');
  grad.addColorStop(0.85, 'rgba(110, 20, 200, 0.2)');
  grad.addColorStop(1, 'rgba(60, 0, 150, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 255, 0, Math.PI * 2);
  g.fill();

  let seed = 42;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 90; i++) {
    const angle = rnd() * Math.PI * 2;
    const r = 80 + rnd() * 150;
    const len = 0.2 + rnd() * 0.45;
    g.strokeStyle = `rgba(255, ${Math.floor(160 + rnd() * 95)}, ${Math.floor(80 + rnd() * 175)}, ${0.15 + rnd() * 0.25})`;
    g.lineWidth = 2 + rnd() * 5;
    g.beginPath();
    g.arc(cx, cy, r, angle, angle + len);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 블랙홀 주변의 신비로운 보랏빛 중력 렌징 광륜 */
function makeBlackHoleGlow(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  grad.addColorStop(0.18, 'rgba(220, 110, 255, 0.55)');
  grad.addColorStop(0.42, 'rgba(130, 40, 255, 0.22)');
  grad.addColorStop(0.7, 'rgba(70, 20, 180, 0.07)');
  grad.addColorStop(1, 'rgba(30, 0, 100, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.scale.setScalar(14);
  return sprite;
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
  sprite.scale.setScalar(isGiant ? 3.5 : 2.0);
  return sprite;
}

/** 간단한 절차적 텍스처: 가스 행성은 줄무늬, 지구는 대륙, 나머지는 얼룩 */
function makeTexture(id: BodyId, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const base = new THREE.Color(color);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 128);
  let seed = id.length * 9301 + id.charCodeAt(0) * 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const shade = (k: number) => '#' + base.clone().offsetHSL(0, 0, k).getHexString();

  if (id === 'jupiter' || id === 'saturn' || id === 'uranus' || id === 'neptune') {
    const strong = id === 'jupiter' ? 0.12 : 0.05;
    for (let y = 0; y < 128; y += 4 + Math.floor(rnd() * 8)) {
      g.fillStyle = shade((rnd() - 0.5) * strong * 2);
      g.fillRect(0, y, 256, 3 + rnd() * 8);
    }
    if (id === 'jupiter') {
      g.fillStyle = '#c0583a';
      g.beginPath();
      g.ellipse(170, 80, 16, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === 'earth') {
    g.fillStyle = '#3fae5a';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(rnd() * 256, 25 + rnd() * 78, 10 + rnd() * 26, 6 + rnd() * 14, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 8);
    g.fillRect(0, 120, 256, 8);
  } else {
    for (let i = 0; i < 40; i++) {
      g.fillStyle = shade((rnd() - 0.5) * 0.18);
      g.beginPath();
      g.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 9, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
