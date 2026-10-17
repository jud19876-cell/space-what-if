// 지구 자전 실험실 3D 화면
// - 큰 화면: 지구 전체 (자전 속도에 따라 납작해지고, 바다가 적도/극으로 이동하고, 구름이 관성으로 밀림)
// - 지상 카메라(작은 창): 고른 도시의 거리 — 하늘의 낮밤, 몸무게 변화, 갑작스러운 변화 때 사람·차·건물이 받는 충격
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SIDEREAL_DAY_H, spinReport, suddenChangeVelocity, type SpinReport } from './earthSpinPhysics.ts';
import { createAtmosphereMaterial, createBloomPipeline, createSkyDome, createStarfield, getSoftDotTexture, setupFreeCamera } from './fx.ts';
import { createCloudTexture, createPlanetTexture, createRoughnessMap } from './planetTextures.ts';

/** gradual: 서서히 / sudden: 갑자기 (관성 충격 발생) / instant: 충격 없이 바로 (시나리오 준비용) */
export type SpinMode = 'gradual' | 'sudden' | 'instant';
export type LocationKey = 'seoul' | 'equator' | 'arctic';

export const LOCATIONS: Record<LocationKey, { name: string; lat: number; lon: number }> = {
  seoul: { name: '서울', lat: 37.5, lon: 127 },
  equator: { name: '적도 (싱가포르 부근)', lat: 0.5, lon: 103.8 },
  arctic: { name: '북극 근처 (스발바르)', lat: 78, lon: 15.6 },
};

export interface SpinSimState {
  ratio: number;
  targetRatio: number;
  location: LocationKey;
  report: SpinReport;
  /** 마지막 급변의 땅 대비 속도 (m/s, 동쪽 +). 0 이면 없음 */
  impactSpeed: number;
  /** 급변 연출 중 (슬로모션) */
  impactActive: boolean;
  /** 지상 카메라 위치의 하늘: 해의 고도 (-1 ~ 1, sin) */
  sunAltitude: number;
  /** 지상에서 날아가거나 무너진 것들의 수 */
  thrown: number;
}

export interface EarthSpinScene {
  setRatio(target: number, mode: SpinMode): void;
  setLocation(key: LocationKey): void;
  resetGround(): void;
  setInsetElement(el: HTMLElement | null): void;
  dispose(): void;
}

const R = 10; // 화면 속 지구 반지름
const HOURS_PER_SECOND = 1; // 원래 속도에서 화면 1초 = 1시간 (하루 = 24초)
const deg = Math.PI / 180;

/** 바다 재배치 · 해일 띠 · 물 반사를 지구 재질에 주입 */
function applyOceanShader(mat: THREE.MeshStandardMaterial, u: { uSeaA: { value: number }; uWaveLon: { value: number }; uWaveAmp: { value: number } }) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSeaA;
        uniform float uWaveLon;
        uniform float uWaveAmp;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // 고도(m) 와 위도별 새 해수면: Δh(φ) = A·(cos²φ − ⅔)
        float hRaw = texture2D( roughnessMap, vRoughnessMapUv ).r * 0.6 + 0.2;
        float elev = ( hRaw - 0.5 ) * 16000.0;
        float latR = ( vRoughnessMapUv.y - 0.5 ) * 3.14159265;
        float cl = cos( latR );
        float seaLevel = uSeaA * ( cl * cl - 2.0 / 3.0 );
        float wasWater = step( elev, 0.0 );
        float isWater = step( elev, seaLevel );
        if ( isWater > 0.5 && wasWater < 0.5 ) {
          // 바닷물에 잠긴 땅
          float depth = seaLevel - elev;
          diffuseColor.rgb = mix( vec3( 0.09, 0.38, 0.50 ), vec3( 0.02, 0.10, 0.28 ), clamp( depth / 4000.0, 0.0, 1.0 ) );
        } else if ( isWater < 0.5 && wasWater > 0.5 ) {
          // 물이 빠져 드러난 해저 (소금 평원 → 깊은 해저 암석)
          diffuseColor.rgb = mix( vec3( 0.74, 0.69, 0.58 ), vec3( 0.38, 0.35, 0.34 ), clamp( -elev / 5000.0, 0.0, 1.0 ) );
        } else if ( isWater > 0.5 ) {
          float depth = seaLevel - elev;
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.02, 0.09, 0.26 ), clamp( ( depth - 3000.0 ) / 9000.0, 0.0, 0.7 ) );
        }
        // 갑자기 멈췄을 때 동쪽으로 쏟아지는 거대한 해일 띠
        float lonR = vRoughnessMapUv.x * 6.2831853;
        float dl = atan( sin( lonR - uWaveLon ), cos( lonR - uWaveLon ) );
        float wave = uWaveAmp * exp( -dl * dl / 0.012 ) * isWater;
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.92, 0.97, 1.0 ), clamp( wave, 0.0, 0.85 ) );
        float waterMask = isWater;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix( 0.95, 0.28, waterMask );`,
      );
  };
  mat.customProgramCacheKey = () => 'ocean-shift';
}

/** 건물 벽 텍스처 + 같은 배치의 '불 켜진 창문만' 발광 텍스처 (밤에 벽까지 빛나지 않게) */
function windowTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    return c;
  };
  const a = make();
  const b = make();
  const ga = a.getContext('2d')!;
  const gb = b.getContext('2d')!;
  ga.fillStyle = '#8d96a8';
  ga.fillRect(0, 0, 64, 32);
  gb.fillStyle = '#000000';
  gb.fillRect(0, 0, 64, 32);
  for (let x = 0; x < 4; x++) {
    const lit = Math.random() < 0.55;
    ga.fillStyle = lit ? '#ffd98a' : '#2c3a52';
    ga.fillRect(4 + x * 15, 9, 10, 14);
    if (lit) {
      gb.fillStyle = '#ffcf70';
      gb.fillRect(4 + x * 15, 9, 10, 14);
    }
  }
  const wrap = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  return { map: wrap(a), glow: wrap(b) };
}

interface Loose {
  obj: THREE.Object3D;
  kind: 'person' | 'car' | 'tree' | 'floor' | 'debris';
  home: THREE.Vector3;
  homeRot: THREE.Euler;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  free: boolean;
  /** 사람 걷기·차 주행용 */
  walk: number;
  phase: number;
  /** 층 조각이면 0(맨 아래) ~ 1(꼭대기) */
  heightFrac: number;
  /** 바닥에서의 높이 (중심이 땅에 닿을 때 y) */
  rest: number;
}

export function createEarthSpinScene(container: HTMLDivElement, onUpdate: (s: SpinSimState) => void): EarthSpinScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // ===================== 지구 전체 =====================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030b);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 6000);
  camera.position.set(6, 9, 38);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 13;
  controls.maxDistance = 140;
  const freeCam = setupFreeCamera(controls, renderer.domElement);

  const sky = new THREE.Group();
  sky.add(createSkyDome(2400, 1.0));
  const stars = createStarfield({ count: 6000, radius: 1800, size: 2.2 });
  sky.add(stars.points);
  scene.add(sky);

  scene.add(new THREE.AmbientLight(0x7c88b8, 0.08));
  const sunLight = new THREE.DirectionalLight(0xfff3e0, 3.2);
  sunLight.position.set(60, 12, 30);
  scene.add(sunLight);
  const sunWorld = sunLight.position.clone().normalize().multiplyScalar(500);

  const tilt = new THREE.Group();
  tilt.rotation.z = 23.44 * deg;
  scene.add(tilt);
  const shape = new THREE.Group(); // 편평도 (자전축 = y 방향으로 납작)
  tilt.add(shape);
  const spin = new THREE.Group();
  shape.add(spin);

  const oceanU = { uSeaA: { value: 0 }, uWaveLon: { value: 0 }, uWaveAmp: { value: 0 } };
  const earthMat = new THREE.MeshStandardMaterial({
    map: createPlanetTexture('earth'),
    roughnessMap: createRoughnessMap('earth') ?? null,
    roughness: 1,
    metalness: 0,
  });
  applyOceanShader(earthMat, oceanU);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 112), earthMat);
  spin.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.012, 128, 96),
    new THREE.MeshStandardMaterial({ map: createCloudTexture(), transparent: true, depthWrite: false, roughness: 1 }),
  );
  spin.add(clouds);

  const atmoMat = createAtmosphereMaterial(0x4d9dff, { power: 2.3, intensity: 1.7 });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 96, 64), atmoMat);
  shape.add(atmo);

  // 지상 카메라 위치 표시 (자전과 함께 돎)
  const pin = new THREE.Group();
  const pinDot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffb238 }));
  const pinRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb238, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  pin.add(pinDot, pinRing);
  spin.add(pin);

  // ===================== 지상 카메라 (거리 풍경) =====================
  const ground = new THREE.Scene();
  const gCam = new THREE.PerspectiveCamera(46, 1.6, 0.1, 2000);
  gCam.position.set(0, 5.5, 36);
  gCam.lookAt(0, 6, 0);
  const gSkyColor = new THREE.Color();
  ground.background = gSkyColor;
  ground.fog = new THREE.Fog(0x9ec9f0, 120, 420);
  const gAmb = new THREE.HemisphereLight(0xcfe4ff, 0x3a3326, 0.7);
  ground.add(gAmb);
  const gSun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  ground.add(gSun);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 });
  const gPlane = new THREE.Mesh(new THREE.PlaneGeometry(1200, 400), groundMat);
  gPlane.rotation.x = -Math.PI / 2;
  ground.add(gPlane);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1200, 9), new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, 12);
  ground.add(road);
  const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(1200, 4), new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 1 }));
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.set(0, 0.03, 18.5);
  ground.add(sidewalk);
  for (let x = -300; x < 300; x += 8) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.3), new THREE.MeshBasicMaterial({ color: 0xe8e2c8 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(x, 0.04, 12);
    ground.add(lane);
  }

  // 별 (밤하늘)
  const gStarsGeo = new THREE.BufferGeometry();
  const gStarPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    gStarPos.set([(Math.random() - 0.5) * 1400, 40 + Math.random() * 500, -300 - Math.random() * 200], i * 3);
  }
  gStarsGeo.setAttribute('position', new THREE.BufferAttribute(gStarPos, 3));
  const gStarsMat = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, map: getSoftDotTexture(), transparent: true, depthWrite: false, color: 0xffffff });
  ground.add(new THREE.Points(gStarsGeo, gStarsMat));

  // 하늘의 해
  const gSunDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: getSoftDotTexture(), color: 0xfff1c4, transparent: true, depthWrite: false, fog: false }),
  );
  gSunDisc.scale.setScalar(70);
  ground.add(gSunDisc);

  const loose: Loose[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  const shirtColors = [0xe4572e, 0x29335c, 0xf3a712, 0x669bbc, 0xa8c686, 0xd1495b, 0xffffff, 0x2a9d8f];
  const carColors = [0xd62828, 0x003049, 0xf77f00, 0xeae2b7, 0x2a9d8f];

  function addLoose(obj: THREE.Object3D, kind: Loose['kind'], rest: number, heightFrac = 0) {
    ground.add(obj);
    loose.push({
      obj,
      kind,
      home: obj.position.clone(),
      homeRot: obj.rotation.clone(),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      free: false,
      walk: (Math.random() - 0.5) * 2.4,
      phase: Math.random() * 10,
      heightFrac,
      rest,
    });
  }

  function buildStreet() {
    for (const l of loose) {
      ground.remove(l.obj);
    }
    loose.length = 0;
    windowMats.length = 0;
    // 건물: 층 단위 조각으로 쌓아서 충격 때 층별로 부서지게
    const bxs = [-58, -38, -20, 4, 22, 40, 60];
    bxs.forEach((bx, bi) => {
      const floors = 3 + Math.floor(Math.random() * 7);
      const w = 9 + Math.random() * 6;
      const d = 8 + Math.random() * 4;
      const tint = new THREE.Color().setHSL(0.58 + Math.random() * 0.08, 0.12, 0.55 + Math.random() * 0.2);
      for (let f = 0; f < floors; f++) {
        const { map: tex, glow } = windowTextures();
        tex.repeat.set(Math.round(w / 3), 1);
        glow.repeat.copy(tex.repeat);
        const slabMat = new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.75, metalness: 0.1, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0 });
        windowMats.push(slabMat);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), slabMat);
        slab.position.set(bx, 1.6 + f * 3.2, -6 - (bi % 2) * 6);
        addLoose(slab, 'floor', 1.6, floors > 1 ? f / (floors - 1) : 0);
      }
    });
    // 나무
    for (let i = 0; i < 9; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 8), new THREE.MeshStandardMaterial({ color: 0x6b4b2a }));
      trunk.position.y = 1.5;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.9 }));
      crown.position.y = 4;
      tree.add(trunk, crown);
      tree.position.set(-70 + i * 17 + Math.random() * 4, 0, 21.5);
      addLoose(tree, 'tree', 0);
    }
    // 차
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Group();
      const color = carColors[i % carColors.length];
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.9), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 }));
      body.position.y = 0.95;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.7), new THREE.MeshStandardMaterial({ color: 0x1c2b3a, roughness: 0.2, metalness: 0.6 }));
      cabin.position.set(-0.2, 1.9, 0);
      car.add(body, cabin);
      for (const [wx, wz] of [[-1.3, 0.95], [1.3, 0.95], [-1.3, -0.95], [1.3, -0.95]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.42, wz);
        car.add(wheel);
      }
      car.position.set(-60 + i * 22, 0, i % 2 ? 10 : 14);
      if (i % 2) car.rotation.y = Math.PI;
      addLoose(car, 'car', 0);
      loose[loose.length - 1].walk = i % 2 ? -6 : 6;
    }
    // 사람
    for (let i = 0; i < 22; i++) {
      const p = new THREE.Group();
      const shirt = shirtColors[i % shirtColors.length];
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 4, 10), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }));
      body.position.y = 1.0;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.7 }));
      head.position.y = 1.72;
      const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2d3142 }));
      legs.position.y = 0.42;
      p.add(legs, body, head);
      p.position.set(-70 + Math.random() * 140, 0, 17 + Math.random() * 3);
      p.scale.setScalar(1.5);
      addLoose(p, 'person', 0);
    }
  }
  buildStreet();

  // 바람 줄 (공기가 땅보다 빠르게 흐를 때)
  const STREAKS = 160;
  const streakGeo = new THREE.BufferGeometry();
  const streakPos = new Float32Array(STREAKS * 6);
  const streakSeed = new Float32Array(STREAKS * 3);
  for (let i = 0; i < STREAKS; i++) {
    streakSeed.set([(Math.random() - 0.5) * 220, 0.5 + Math.random() * 30, -20 + Math.random() * 60], i * 3);
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  ground.add(streaks);

  // 먼지·파편 입자
  const DUST = 900;
  const dustPos = new Float32Array(DUST * 3);
  const dustVel = new Float32Array(DUST * 3);
  const dustLife = new Float32Array(DUST);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ size: 1.6, map: getSoftDotTexture(), color: 0xb9a98c, transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  dust.frustumCulled = false;
  ground.add(dust);
  let dustCursor = 0;
  for (let i = 0; i < DUST; i++) dustPos[i * 3 + 1] = -999;

  function emitDust(at: THREE.Vector3, vx: number, n: number) {
    for (let k = 0; k < n; k++) {
      const i = dustCursor;
      dustCursor = (dustCursor + 1) % DUST;
      dustPos.set([at.x + (Math.random() - 0.5) * 6, at.y + Math.random() * 3, at.z + (Math.random() - 0.5) * 6], i * 3);
      dustVel.set([vx * (0.5 + Math.random() * 0.7), 1 + Math.random() * 6, (Math.random() - 0.5) * 6], i * 3);
      dustLife[i] = 2 + Math.random() * 3;
    }
  }

  // ===================== 상태 =====================
  let ratio = 1;
  let targetRatio = 1;
  let location: LocationKey = 'seoul';
  let spinAngle = 0; // 지구 자전 각도 (rad)
  let cloudLag = 0; // 구름(대기)이 땅보다 앞서 도는 각속도 (rad/s, 화면 기준)
  let impactSpeed = 0;
  let impactTimer = 0; // > 0 이면 슬로모션 연출 중
  let windRel = 0; // 지상 공기가 땅에 대해 흐르는 속도 (m/s)
  let waveLon = 0;
  let seaShown = 0;
  let waveAmp = 0;
  let shake = 0;
  let thrown = 0;
  let insetEl: HTMLElement | null = null;
  let report = spinReport(ratio, LOCATIONS[location].lat);

  function placePin() {
    const L = LOCATIONS[location];
    const lat = L.lat * deg;
    // three.js 구 UV 와 같은 경도 기준 (u = 경도/360 + 0.5, x = −cos φ_uv)
    const phi = ((L.lon + 180) / 360) * Math.PI * 2;
    const p = new THREE.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat)).multiplyScalar(R * 1.004);
    pin.position.copy(p);
    pin.lookAt(p.clone().multiplyScalar(2));
  }
  placePin();

  const SLOWMO = 0.04;

  function triggerImpact(dv: number) {
    impactSpeed = dv;
    impactTimer = 6;
    windRel = dv;
    shake = Math.min(1.2, Math.abs(dv) / 300);
    // 지구 전체: 대기(구름)는 원래 속도로 계속 돌고, 바다는 거대한 해일이 되어 쏟아진다
    const dOmega = (dv / (465 * Math.cos(LOCATIONS[location].lat * deg) || 1)) * ((2 * Math.PI) / (24 / HOURS_PER_SECOND));
    cloudLag = dOmega;
    waveAmp = Math.min(1, Math.abs(dv) / 200);
    waveLon = 0;
    const v = Math.abs(dv);
    if (v < 1) return;
    // 지상: 땅에 붙어 있지 않은 것들은 원래 속도(m/s)로 계속 날아간다. 화면은 슬로모션(0.04배)으로 진행
    const visual = dv;
    for (const l of loose) {
      if (l.kind === 'floor') {
        // 건물: 기초는 땅과 함께 멈추고, 위층일수록 관성으로 더 크게 밀려 부서진다
        const breakAt = 22; // m/s 이상이면 구조가 버티지 못함
        if (v < breakAt || l.heightFrac < 0.01) continue;
        l.free = true;
        l.vel.set(visual * (0.15 + 0.85 * l.heightFrac) * (0.8 + Math.random() * 0.4), 1 + Math.random() * 3, (Math.random() - 0.5) * 2);
        l.spin.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, -Math.sign(dv) * (0.5 + Math.random() * 1.5));
        thrown++;
        emitDust(l.obj.position, visual * 0.6, 14);
      } else if (l.kind === 'tree') {
        if (v < 12) continue;
        l.free = true;
        l.vel.set(visual * (0.7 + Math.random() * 0.4), 2 + Math.random() * 4, (Math.random() - 0.5) * 3);
        l.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, -Math.sign(dv) * (2 + Math.random() * 3));
        thrown++;
      } else {
        if (v < 3) continue;
        l.free = true;
        const k = l.kind === 'car' ? 0.92 : 1.0;
        l.vel.set(visual * k * (0.85 + Math.random() * 0.3), (l.kind === 'car' ? 1 : 3) + Math.random() * 5, (Math.random() - 0.5) * 4);
        l.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, -Math.sign(dv) * (3 + Math.random() * 6));
        thrown++;
        if (l.kind === 'car') emitDust(l.obj.position, visual * 0.5, 6);
      }
    }
  }

  function updateGround(dt: number, simDt: number, time: number) {
    const L = LOCATIONS[location];
    const gEff = report.gEffective;
    const pull = report.equatorwardPull;
    // --- 하늘: 해의 고도 (춘분 기준, 적위 0): sin(고도) = cos(위도)·cos(시간각)
    const hourAngle = spinAngle + (L.lon * deg);
    const sinAlt = Math.cos(L.lat * deg) * Math.cos(hourAngle);
    const day = THREE.MathUtils.smoothstep(sinAlt, -0.15, 0.25);
    const dusk = Math.exp(-Math.pow(sinAlt / 0.12, 2));
    gSkyColor.setRGB(0.02 + 0.45 * day, 0.03 + 0.62 * day, 0.08 + 0.86 * day).lerp(new THREE.Color(1.0, 0.55, 0.3), dusk * 0.55);
    (ground.fog as THREE.Fog).color.copy(gSkyColor);
    gSun.intensity = 2.4 * day;
    // 밤에도 거리가 보이도록 은은한 달빛 + 창문 불빛
    gAmb.intensity = 0.42 + 0.4 * day;
    gAmb.color.setRGB(0.55 + 0.26 * day, 0.62 + 0.27 * day, 0.95 + 0.05 * day);
    for (const m of windowMats) m.emissiveIntensity = 0.9 * (1 - day);
    gStarsMat.opacity = 1 - day;
    // 해는 동쪽(+x)에서 떠서 서쪽(−x)으로 진다
    const az = -Math.sin(hourAngle);
    gSunDisc.position.set(az * 380, 20 + sinAlt * 260, -320);
    gSunDisc.visible = sinAlt > -0.2;
    gSun.position.set(az * 100, Math.max(5, sinAlt * 120), 40);

    // --- 바람 줄 (공기는 마찰로 서서히 땅을 따라잡음)
    windRel *= Math.exp(-simDt / 0.25);
    const windVis = windRel * (simDt / Math.max(dt, 1e-4));
    streakMat.opacity = Math.min(0.75, Math.abs(windRel) / 60);
    for (let i = 0; i < STREAKS; i++) {
      streakSeed[i * 3] += windVis * dt * (0.8 + (i % 5) * 0.1);
      if (streakSeed[i * 3] > 110) streakSeed[i * 3] -= 220;
      if (streakSeed[i * 3] < -110) streakSeed[i * 3] += 220;
      const len = Math.min(18, Math.abs(windVis) * 0.4 + 1);
      streakPos.set([streakSeed[i * 3], streakSeed[i * 3 + 1], streakSeed[i * 3 + 2], streakSeed[i * 3] - Math.sign(windVis || 1) * len, streakSeed[i * 3 + 1], streakSeed[i * 3 + 2]], i * 6);
    }
    streakGeo.attributes.position.needsUpdate = true;

    // --- 사람·차·나무·건물
    // 화면 1단위 = 1m, 속도는 실제 m/s, 시간은 슬로모션이 반영된 simDt
    const step = simDt;
    for (const l of loose) {
      const o = l.obj;
      if (!l.free) {
        // 체감 중력이 0 아래로 내려가면 떠오른다. 땅에 묶인 정도에 따라: 사람 → 차 → 나무(뿌리) → 건물(기초)
        const holdsUntil = l.kind === 'person' ? 0 : l.kind === 'car' ? -0.3 : l.kind === 'tree' ? -1.5 : l.heightFrac > 0 ? -3 : -6;
        if (gEff < holdsUntil || (l.kind === 'person' && gEff <= 0)) {
          l.free = true;
          l.vel.set((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.6, 0);
          l.spin.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
          thrown++;
          continue;
        }
        // 평소 움직임: 사람은 걷고 깡충, 차는 달림. 중력이 약할수록 한 번 뛸 때 더 높이 오래 뜬다
        if (l.kind === 'person') {
          o.position.x += l.walk * dt;
          if (o.position.x > 80) o.position.x = -80;
          if (o.position.x < -80) o.position.x = 80;
          o.rotation.y = l.walk > 0 ? Math.PI / 2 : -Math.PI / 2;
          const v0 = 2.2;
          const g = Math.max(0.15, gEff);
          const period = (2 * v0) / g;
          const t = ((time + l.phase) % (period + 0.6)) - 0.6;
          o.position.y = t > 0 ? v0 * t - 0.5 * g * t * t : 0;
        } else if (l.kind === 'car') {
          o.position.x += l.walk * dt;
          if (o.position.x > 90) o.position.x = -90;
          if (o.position.x < -90) o.position.x = 90;
        }
        continue;
      }
      // 자유 비행: 체감 중력 + 적도 쪽 당김 + 남은 바람
      l.vel.y -= gEff * step;
      l.vel.z += pull * step;
      if (Math.abs(windRel) > 5) l.vel.x += (windRel - l.vel.x) * 0.3 * step;
      o.position.addScaledVector(l.vel, step);
      // 슬로모션에서도 굴러가는 모습이 보이도록 회전은 화면 시간 기준
      o.rotation.x += l.spin.x * dt * 0.25;
      o.rotation.y += l.spin.y * dt * 0.25;
      o.rotation.z += l.spin.z * dt * 0.25;
      // 땅에 부딪히면 튕기고 끌림
      if (o.position.y < l.rest && gEff > 0) {
        o.position.y = l.rest;
        if (l.vel.y < 0) l.vel.y *= -0.25;
        l.vel.x *= 0.92;
        l.vel.z *= 0.92;
        l.spin.multiplyScalar(0.9);
        if (Math.abs(l.vel.x) > 3 && Math.random() < 0.2) emitDust(o.position, l.vel.x * 0.3, 1);
      }
    }

    // --- 먼지
    for (let i = 0; i < DUST; i++) {
      if (dustLife[i] <= 0) continue;
      dustLife[i] -= step;
      dustVel[i * 3 + 1] -= Math.max(0, gEff) * 0.15 * step;
      dustPos[i * 3] += dustVel[i * 3] * step;
      dustPos[i * 3 + 1] = Math.max(0.2, dustPos[i * 3 + 1] + dustVel[i * 3 + 1] * step);
      dustPos[i * 3 + 2] += dustVel[i * 3 + 2] * step;
      if (dustLife[i] <= 0) dustPos[i * 3 + 1] = -999;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // --- 카메라 흔들림
    shake *= Math.exp(-dt / 0.8);
    gCam.position.set((Math.random() - 0.5) * shake * 2, 5.5 + (Math.random() - 0.5) * shake * 2, 36);
    gCam.lookAt(0, 6, 0);
  }

  // ===================== 루프 =====================
  const bloom = createBloomPipeline(renderer, scene, camera, { strength: 0.55, radius: 0.5, threshold: 0.9 });
  let raf = 0;
  let last = performance.now();
  let lastEmit = 0;
  const insetRect = { x: 0, y: 0, w: 0, h: 0 };

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = now * 0.001;

    // 서서히 변경: 로그 눈금으로 부드럽게 목표 속도에 다가감 (멈춤은 선형으로)
    if (ratio !== targetRatio) {
      const k = 1 - Math.pow(0.55, dt);
      if (targetRatio < 0.02 || ratio < 0.02) ratio += (targetRatio - ratio) * k + Math.sign(targetRatio - ratio) * 0.02 * dt;
      else ratio = Math.exp(Math.log(ratio) + (Math.log(targetRatio) - Math.log(ratio)) * k);
      if (Math.abs(ratio - targetRatio) < 0.002) ratio = targetRatio;
    }
    report = spinReport(ratio, LOCATIONS[location].lat);

    const slow = impactTimer > 0 ? SLOWMO : 1;
    impactTimer = Math.max(0, impactTimer - dt);
    const simDt = dt * slow;

    // 지구 자전: 원래 속도에서 하루 = 24초
    const omegaVis = ratio * ((2 * Math.PI) / (SIDEREAL_DAY_H / HOURS_PER_SECOND));
    spinAngle += omegaVis * simDt;
    spin.rotation.y = spinAngle;
    // 대기(구름)는 급변 뒤 관성으로 계속 돌다가 마찰로 서서히 땅을 따라감
    cloudLag *= Math.exp(-simDt / 4);
    clouds.rotation.y += cloudLag * simDt + 0.004 * dt;
    // 편평도 (적도 쪽이 불룩, 극 쪽이 납작): 부피 보존
    const f = report.flattening;
    const eq = 1 / Math.sqrt(1 - f);
    shape.scale.set(eq, 1 - f, eq);
    // 바다 재배치: 물이 흘러가는 데 시간이 걸리므로 몇 초에 걸쳐 새 해수면으로
    seaShown += (report.seaAmplitude - seaShown) * (1 - Math.exp(-dt / 3));
    oceanU.uSeaA.value = seaShown;
    // 해일 띠: 동쪽으로 진행하며 약해짐
    if (waveAmp > 0.001) {
      waveLon += 1.6 * dt * Math.sign(impactSpeed || 1);
      waveAmp *= Math.exp(-dt / 5);
    }
    oceanU.uWaveLon.value = waveLon - spinAngle;
    oceanU.uWaveAmp.value = waveAmp;
    atmoMat.uniforms.uSunPos.value.copy(sunWorld);
    pinRing.material.opacity = 0.5 + 0.4 * Math.sin(time * 4);

    updateGround(dt, simDt, time);

    controls.update();
    stars.update(time);
    sky.position.copy(camera.position);

    // 큰 화면: 지구 (블룸)
    renderer.setScissorTest(false);
    renderer.clear();
    bloom.render();

    // 작은 창: 지상 카메라
    if (insetEl) {
      const cr = container.getBoundingClientRect();
      const r = insetEl.getBoundingClientRect();
      insetRect.x = r.left - cr.left;
      insetRect.y = cr.bottom - r.bottom;
      insetRect.w = r.width;
      insetRect.h = r.height;
      if (insetRect.w > 4 && insetRect.h > 4) {
        renderer.setScissorTest(true);
        renderer.setScissor(insetRect.x, insetRect.y, insetRect.w, insetRect.h);
        renderer.setViewport(insetRect.x, insetRect.y, insetRect.w, insetRect.h);
        gCam.aspect = insetRect.w / insetRect.h;
        gCam.updateProjectionMatrix();
        renderer.clear();
        renderer.render(ground, gCam);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
      }
    }

    if (now - lastEmit > 90) {
      lastEmit = now;
      onUpdate({
        ratio,
        targetRatio,
        location,
        report,
        impactSpeed,
        impactActive: impactTimer > 0,
        sunAltitude: Math.cos(LOCATIONS[location].lat * deg) * Math.cos(spinAngle + LOCATIONS[location].lon * deg),
        thrown,
      });
    }
  }
  raf = requestAnimationFrame(frame);

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

  return {
    setRatio(t, mode) {
      const clamped = Math.max(0, Math.min(25, t));
      if (mode === 'sudden') {
        const dv = suddenChangeVelocity(ratio, clamped, LOCATIONS[location].lat);
        ratio = clamped;
        targetRatio = clamped;
        triggerImpact(dv);
      } else if (mode === 'instant') {
        ratio = clamped;
        targetRatio = clamped;
      } else {
        targetRatio = clamped;
      }
    },
    setLocation(key) {
      location = key;
      placePin();
      buildStreet();
      thrown = 0;
      impactSpeed = 0;
      windRel = 0;
    },
    resetGround() {
      buildStreet();
      thrown = 0;
      impactSpeed = 0;
      impactTimer = 0;
      windRel = 0;
      waveAmp = 0;
      cloudLag = 0;
      seaShown = report.seaAmplitude;
      dustLife.fill(0);
      for (let i = 0; i < DUST; i++) dustPos[i * 3 + 1] = -999;
    },
    setInsetElement(el) {
      insetEl = el;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      freeCam.dispose();
      controls.dispose();
      bloom.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
