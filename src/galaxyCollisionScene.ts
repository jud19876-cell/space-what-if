// 은하 대충돌 & 심우주 실시간 3D 그래픽 씬 (Three.js)
// "우선 태양계에 우리은하에서 그 근방에 있는것들로 표현해"
// 우리은하 오리온 팔 내 태양계(Solar System) 위치 핀 마커 및
// 국부은하군(안드로메다, 삼각형자리, 대/소 마젤란 은하) 렌더링

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBloomPipeline, softenPoints } from './fx.ts';
import {
  createGalaxyScenario,
  stepGalaxySystem,
  type GalacticCore,
  type GalaxyScenarioType,
  type GalaxySimState,
} from './galaxyCollisionPhysics.ts';

export type GalaxyCameraView =
  | 'overview'      // 국부은하군 전체 조망
  | 'universe'      // 🌐 관측 가능한 전체 우주 & 거대 우주망 (Cosmic Web)
  | 'sombrero'      // 🎩 솜브레로 은하 (M104 암흑 먼지원반)
  | 'whirlpool'     // 🌀 소용돌이 은하 (M51 조석 다리)
  | 'quasar'        // ⚡ 초거대 퀘이사 (3C 273 상대론적 제트)
  | 'cartwheel'     // 🎡 수레바퀴 고리 은하 (Cartwheel 충격파 링)
  | 'solarsystem'   // ☀️ 우리들의 태양계 (오리온 팔)
  | 'milkyway'      // 🌌 우리은하 중심핵 (궁수자리 A*)
  | 'andromeda'     // 💜 안드로메다 은하 (M31)
  | 'triangulum'    // 💎 삼각형자리 은하 (M33)
  | 'magellanic'    // 🪐 대/소 마젤란은하 (LMC/SMC)
  | 'collision'     // 💥 충돌면 락온
  | 'blackhole';    // 🕳️ 가르간튀아 심연

export interface GalaxyScene {
  setScenario(scenario: GalaxyScenarioType): void;
  setSpeed(speed: number): void;
  setPlaying(playing: boolean): void;
  setViewMode(mode: GalaxyCameraView): void;
  setShowGasClouds(show: boolean): void;
  setShowTrails(show: boolean): void;
  setShowCosmicWeb(show: boolean): void;
  setGalaxyDistance(kpc: number): void;
  reset(): void;
  dispose(): void;
}

/** 부드러운 성운 가스 구름 절차적 텍스처 */
function makeNebulaCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;

  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.2, 'rgba(230, 240, 255, 0.65)');
  grad.addColorStop(0.45, 'rgba(180, 200, 255, 0.28)');
  grad.addColorStop(0.75, 'rgba(120, 140, 240, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 별 파티클 점 광원 텍스처 */
function makeStarPointTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;

  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.25, 'rgba(255, 240, 200, 0.85)');
  grad.addColorStop(0.6, 'rgba(180, 210, 255, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 블랙홀 강착원반 텍스처 */
function makeAccretionDiskTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const cx = 128, cy = 128;

  const grad = g.createRadialGradient(cx, cy, 30, cx, cy, 125);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.08, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.25, 'rgba(255, 180, 80, 0.95)');
  grad.addColorStop(0.55, 'rgba(200, 50, 240, 0.65)');
  grad.addColorStop(0.85, 'rgba(100, 20, 200, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 125, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 태양계 위치 표시 라벨 스프라이트 */
function makeSolarSystemSprite(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;

  g.fillStyle = 'rgba(15, 23, 42, 0.85)';
  g.strokeStyle = '#f59e0b';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(10, 10, 492, 108, 24);
  g.fill();
  g.stroke();

  g.fillStyle = '#fbbf24';
  g.font = 'bold 36px sans-serif';
  g.textAlign = 'center';
  g.fillText('☀️ 우리들의 태양계 (Solar System)', 256, 54);

  g.fillStyle = '#cbd5e1';
  g.font = '24px sans-serif';
  g.fillText('📍 오리온 팔 (은하 중심에서 26,000광년)', 256, 94);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(18, 4.5, 1);
  return sprite;
}

/** 은하 중심핵 3D 이름표 라벨 스프라이트 */
function makeCoreLabelSprite(name: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 440;
  c.height = 96;
  const g = c.getContext('2d')!;

  g.fillStyle = 'rgba(10, 15, 32, 0.82)';
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(6, 6, 428, 84, 18);
  g.fill();
  g.stroke();

  g.fillStyle = '#ffffff';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.fillText(name, 220, 54);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(18, 4.0, 1);
  return sprite;
}

/** 우주 배경 복사 (CMB) 파동 텍스처 (WMAP / 플랑크 전천 지도 느낌) */
function makeCMBTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;

  g.fillStyle = '#030514';
  g.fillRect(0, 0, 512, 256);

  const colors = [
    'rgba(56, 189, 248, 0.18)',
    'rgba(168, 85, 247, 0.14)',
    'rgba(245, 158, 11, 0.16)',
    'rgba(239, 68, 68, 0.12)',
    'rgba(45, 212, 191, 0.14)',
  ];

  for (let i = 0; i < 380; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const rad = 15 + Math.random() * 55;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const col = colors[Math.floor(Math.random() * colors.length)];
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }

  // 지평선 미세 위경도 그리드 선
  g.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  g.lineWidth = 1;
  for (let y = 32; y < 256; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  for (let x = 64; x < 512; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 거대 우주 구조용 고해상도 3D 명칭 라벨 */
function makeCosmicBillboardSprite(title: string, sub: string, color: string, scaleW: number = 70, scaleH: number = 18): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;

  g.fillStyle = 'rgba(8, 12, 28, 0.86)';
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(8, 8, 496, 112, 20);
  g.fill();
  g.stroke();

  g.fillStyle = color;
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.fillText(title, 256, 52);

  g.fillStyle = '#cbd5e1';
  g.font = '20px sans-serif';
  g.fillText(sub, 256, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleW, scaleH, 1);
  return sprite;
}

/** 관측 가능한 우주 (Observable Universe) & 우주 거대구조 (Cosmic Web) 생성기 */
function buildCosmicWebVisuals(scene: THREE.Scene) {
  const cosmicGroup = new THREE.Group();

  // 1. 관측 가능한 우주 지평선 구체 (지름 약 930억 광년 상징 구체)
  const cmbGeo = new THREE.SphereGeometry(3200, 36, 24);
  const cmbMat = new THREE.MeshBasicMaterial({
    map: makeCMBTexture(),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const cmbSphere = new THREE.Mesh(cmbGeo, cmbMat);
  cosmicGroup.add(cmbSphere);

  // 2. 주요 초은하단 노드들 정의
  interface ClusterNode {
    name: string;
    sub: string;
    pos: [number, number, number];
    color: string;
    isMajor?: boolean;
  }

  const majorNodes: ClusterNode[] = [
    { name: '📍 [국부은하군]', sub: '우리은하 & 태양계 (Home)', pos: [0, 0, 0], color: '#38bdf8', isMajor: true },
    { name: '처녀자리 초은하단', sub: 'Virgo (5,400만 광년)', pos: [220, 140, -110], color: '#a78bfa', isMajor: true },
    { name: '거대 인력체 (Great Attractor)', sub: '노르마 은하단 (2.5억 광년)', pos: [-380, -160, 210], color: '#f59e0b', isMajor: true },
    { name: '페르세우스-물고기자리 초은하단', sub: 'Perseus-Pisces (2.5억 광년)', pos: [480, 310, -260], color: '#34d399', isMajor: true },
    { name: '샤플리 초은하단', sub: 'Shapley (6.5억 광년, 초대질량)', pos: [-750, -320, 420], color: '#f43f5e', isMajor: true },
    { name: '코마 초은하단', sub: 'Coma Cluster (3.2억 광년)', pos: [120, 620, -310], color: '#38bdf8', isMajor: true },
    { name: '헤라클레스자리 초은하단', sub: 'Hercules (10억 광년)', pos: [-640, -430, -390], color: '#fbbf24', isMajor: true },
    { name: '목동자리 거대 보이드', sub: 'Boötes Void (3.3억 광년 공허)', pos: [360, 510, 320], color: '#94a3b8', isMajor: true },
    { name: '슬론 장성 (Sloan Great Wall)', sub: '13.8억 광년 길이 거대벽', pos: [-880, 320, -680], color: '#e879f9', isMajor: true },
  ];

  // 총 150여 개 은하단 클러스터 노드들
  const allNodes: { pos: THREE.Vector3; color: THREE.Color }[] = [];
  for (const m of majorNodes) {
    allNodes.push({ pos: new THREE.Vector3(...m.pos), color: new THREE.Color(m.color) });
  }

  const voidCenter = new THREE.Vector3(360, 510, 320);
  const voidRadius = 240;

  for (let i = 0; i < 140; i++) {
    const rad = 350 + Math.random() * 2200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const p = new THREE.Vector3(
      rad * Math.sin(phi) * Math.cos(theta),
      rad * Math.sin(phi) * Math.sin(theta) * 0.75,
      rad * Math.cos(phi),
    );

    if (p.distanceTo(voidCenter) < voidRadius) continue;

    const hue = 0.55 + (Math.random() - 0.5) * 0.35;
    allNodes.push({ pos: p, color: new THREE.Color().setHSL(hue, 0.8, 0.7) });
  }

  // 3. 은하단 간 우주 필라멘트 선
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const filamentStarPositions: number[] = [];
  const filamentStarColors: number[] = [];

  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const d = allNodes[i].pos.distanceTo(allNodes[j].pos);
      if (d < 450) {
        const p1 = allNodes[i].pos;
        const p2 = allNodes[j].pos;
        const c1 = allNodes[i].color;
        const c2 = allNodes[j].color;

        linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        lineColors.push(c1.r * 0.65, c1.g * 0.65, c1.b * 0.65, c2.r * 0.65, c2.g * 0.65, c2.b * 0.65);

        const steps = Math.floor(d / 75);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const jitter = 16;
          const fx = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * jitter;
          const fy = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * jitter;
          const fz = p1.z + (p2.z - p1.z) * t + (Math.random() - 0.5) * jitter;
          filamentStarPositions.push(fx, fy, fz);
          filamentStarColors.push(
            c1.r * (1 - t) + c2.r * t,
            c1.g * (1 - t) + c2.g * t,
            c1.b * (1 - t) + c2.b * t,
          );
        }
      }
    }
  }

  const filamentLineGeo = new THREE.BufferGeometry();
  filamentLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  filamentLineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const filamentLineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
  });
  const filamentLines = new THREE.LineSegments(filamentLineGeo, filamentLineMat);
  cosmicGroup.add(filamentLines);

  // 4. 필라멘트 상의 수천 개 은하 군집 (Points)
  const filPointsGeo = new THREE.BufferGeometry();
  filPointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(filamentStarPositions, 3));
  filPointsGeo.setAttribute('color', new THREE.Float32BufferAttribute(filamentStarColors, 3));
  const filPointsMat = new THREE.PointsMaterial({
    size: 2.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const filPoints = new THREE.Points(filPointsGeo, softenPoints(filPointsMat));
  cosmicGroup.add(filPoints);

  // 5. 은하단 중심 노드 점무리
  const nodeGeo = new THREE.BufferGeometry();
  const nodePosArr = new Float32Array(allNodes.length * 3);
  const nodeColArr = new Float32Array(allNodes.length * 3);
  for (let i = 0; i < allNodes.length; i++) {
    nodePosArr[i * 3] = allNodes[i].pos.x;
    nodePosArr[i * 3 + 1] = allNodes[i].pos.y;
    nodePosArr[i * 3 + 2] = allNodes[i].pos.z;
    nodeColArr[i * 3] = allNodes[i].color.r;
    nodeColArr[i * 3 + 1] = allNodes[i].color.g;
    nodeColArr[i * 3 + 2] = allNodes[i].color.b;
  }
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePosArr, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColArr, 3));
  const nodeMat = new THREE.PointsMaterial({
    size: 5.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  cosmicGroup.add(new THREE.Points(nodeGeo, softenPoints(nodeMat)));

  // 6. 국부은하군 위치 거대 레이더 비콘 링
  const localRingGeo = new THREE.RingGeometry(25, 32, 48);
  const localRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const localRadarRing = new THREE.Mesh(localRingGeo, localRingMat);
  localRadarRing.rotation.x = -Math.PI / 2;
  cosmicGroup.add(localRadarRing);

  // 7. 주요 거대구조 3D 라벨 스프라이트들
  const labelSprites: THREE.Sprite[] = [];
  for (const m of majorNodes) {
    const sp = makeCosmicBillboardSprite(m.name, m.sub, m.color, m.isMajor ? 85 : 65, m.isMajor ? 21 : 16);
    sp.position.set(m.pos[0], m.pos[1] + 35, m.pos[2]);
    cosmicGroup.add(sp);
    labelSprites.push(sp);
  }

  // 지평선 라벨
  const horizonSprite = makeCosmicBillboardSprite('🌐 관측 가능한 우주 지평선', '지름 약 930억 광년 / 2조 개 은하', '#38bdf8', 120, 30);
  horizonSprite.position.set(0, 1100, -2100);
  cosmicGroup.add(horizonSprite);
  labelSprites.push(horizonSprite);

  scene.add(cosmicGroup);

  return {
    cosmicGroup,
    cmbSphere,
    localRadarRing,
    labelSprites,
  };
}

export function createGalaxyScene(
  container: HTMLElement,
  initialScenario: GalaxyScenarioType = 'local_group',
  onStateUpdate?: (state: GalaxySimState) => void,
): GalaxyScene {
  let simState = createGalaxyScenario(initialScenario);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03030d');
  scene.fog = new THREE.FogExp2(0x03030d, 0.00015);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 12000);
  camera.position.set(0, 220, 360);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 8;
  controls.maxDistance = 7500;

  // 은하 중심핵·퀘이사 제트처럼 밝은 부분만 은은하게 번지도록
  const bloom = createBloomPipeline(renderer, scene, camera, { strength: 0.55, radius: 0.5, threshold: 0.9 });

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // 관측 가능한 전체 우주 & 거대 우주망 (Cosmic Web) 비주얼
  const cosmicWeb = buildCosmicWebVisuals(scene);

  // 1. 심우주 배경 별무리
  const bgStarGeo = new THREE.BufferGeometry();
  const bgCount = 2200;
  const bgPos = new Float32Array(bgCount * 3);
  const bgCol = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount; i++) {
    const r = 900 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgPos[i * 3 + 2] = r * Math.cos(phi);

    bgCol[i * 3] = 0.6 + Math.random() * 0.4;
    bgCol[i * 3 + 1] = 0.6 + Math.random() * 0.4;
    bgCol[i * 3 + 2] = 0.8 + Math.random() * 0.2;
  }
  bgStarGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  bgStarGeo.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));
  const bgStarMat = new THREE.PointsMaterial({
    size: 1.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  scene.add(new THREE.Points(bgStarGeo, softenPoints(bgStarMat)));

  // 2. 태양계 오리온 팔 위치 마커 & 펄싱 링
  const solarGroup = new THREE.Group();
  const solarBeaconGeo = new THREE.SphereGeometry(0.85, 24, 16);
  const solarBeaconMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  const solarBeacon = new THREE.Mesh(solarBeaconGeo, solarBeaconMat);
  solarGroup.add(solarBeacon);

  // 펄싱 링
  const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const solarRing = new THREE.Mesh(ringGeo, ringMat);
  solarRing.rotation.x = -Math.PI / 2;
  solarGroup.add(solarRing);

  // 태양계 공전 궤도 원선 (R=8.5 kpc)
  const mwOrbitPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    mwOrbitPts.push(new THREE.Vector3(Math.cos(t) * 8.5, 0, Math.sin(t) * 8.5));
  }
  const mwOrbitGeo = new THREE.BufferGeometry().setFromPoints(mwOrbitPts);
  const mwOrbitLine = new THREE.Line(
    mwOrbitGeo,
    new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.35 }),
  );
  scene.add(mwOrbitLine);

  const solarLabelSprite = makeSolarSystemSprite();
  solarLabelSprite.position.set(0, 3.8, 0);
  solarGroup.add(solarLabelSprite);
  scene.add(solarGroup);

  // 3. 은하 입자 시스템 (별 + 성운 가스 구름)
  const starTex = makeStarPointTexture();
  const gasTex = makeNebulaCloudTexture();

  let starPoints: THREE.Points;
  let gasPoints: THREE.Points;
  let starGeo: THREE.BufferGeometry;
  let gasGeo: THREE.BufferGeometry;

  // 4. 중심핵 비주얼 그룹
  const coreMeshes: {
    group: THREE.Group;
    light: THREE.PointLight;
    coreId: string;
    disk?: THREE.Mesh;
    ring?: THREE.Mesh;
    jetUp?: THREE.Mesh;
    jetDown?: THREE.Mesh;
    dustRing?: THREE.Mesh;
    cartwheelRing?: THREE.Mesh;
  }[] = [];

  const TRAIL_LEN = 120;
  const coreTrails: { line: THREE.Line; posArr: Float32Array; count: number }[] = [];

  function buildCoreVisuals(cores: GalacticCore[]) {
    for (const cm of coreMeshes) {
      scene.remove(cm.group);
      scene.remove(cm.light);
    }
    coreMeshes.length = 0;

    for (const ct of coreTrails) {
      scene.remove(ct.line);
    }
    coreTrails.length = 0;

    const sphereGeo = new THREE.SphereGeometry(1, 32, 24);

    for (const c of cores) {
      const group = new THREE.Group();
      group.position.set(...c.pos);

      let lightColor = c.color;
      let lightIntensity = 3.5;
      let disk: THREE.Mesh | undefined;
      let ring: THREE.Mesh | undefined;
      let jetUp: THREE.Mesh | undefined;
      let jetDown: THREE.Mesh | undefined;
      let dustRing: THREE.Mesh | undefined;
      let cartwheelRing: THREE.Mesh | undefined;

      if (c.isBlackHole) {
        const bhSphere = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x010103 }));
        bhSphere.scale.setScalar(c.radius);
        group.add(bhSphere);

        const diskGeo = new THREE.RingGeometry(c.radius * 1.3, c.radius * 4.2, 64);
        const diskMat = new THREE.MeshBasicMaterial({
          map: makeAccretionDiskTexture(),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        disk = new THREE.Mesh(diskGeo, diskMat);
        disk.rotation.x = -Math.PI / 2 + 0.35;
        group.add(disk);

        const lensGeo = new THREE.RingGeometry(c.radius * 1.05, c.radius * 1.6, 64);
        const lensMat = new THREE.MeshBasicMaterial({
          map: makeAccretionDiskTexture(),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        ring = new THREE.Mesh(lensGeo, lensMat);
        ring.rotation.y = 0.45;
        group.add(ring);

        lightColor = '#c084fc';
        lightIntensity = 5.5;

        // 🚀 퀘이사 양극 상대론적 제트 광선 모델 (Relativistic Jets)
        if (c.hasRelativisticJet) {
          const jetGeo = new THREE.CylinderGeometry(0.8, 5.8, 68, 32, 1, true);
          const jetMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          jetUp = new THREE.Mesh(jetGeo, jetMat);
          jetUp.position.y = 35;
          group.add(jetUp);

          jetDown = new THREE.Mesh(jetGeo, jetMat);
          jetDown.position.y = -35;
          jetDown.rotation.z = Math.PI;
          group.add(jetDown);

          // 제트 충격파 펄싱 링
          for (let k = 1; k <= 3; k++) {
            const pulseRingGeo = new THREE.RingGeometry(k * 1.8, k * 1.8 + 0.8, 32);
            const pulseRingMat = new THREE.MeshBasicMaterial({
              color: 0x67e8f9,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const rUp = new THREE.Mesh(pulseRingGeo, pulseRingMat);
            rUp.position.y = k * 14;
            rUp.rotation.x = Math.PI / 2;
            group.add(rUp);

            const rDown = new THREE.Mesh(pulseRingGeo, pulseRingMat);
            rDown.position.y = -k * 14;
            rDown.rotation.x = Math.PI / 2;
            group.add(rDown);
          }
        }
      } else {
        const coreSphere = new THREE.Mesh(
          sphereGeo,
          new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color).offsetHSL(0, 0, 0.25) }),
        );
        coreSphere.scale.setScalar(c.radius);
        group.add(coreSphere);

        const shell1 = new THREE.Mesh(
          sphereGeo,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(c.color),
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
          }),
        );
        shell1.scale.setScalar(c.radius * 1.8);
        group.add(shell1);

        const shell2 = new THREE.Mesh(
          sphereGeo,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(c.color).offsetHSL(0.05, 0.2, 0.1),
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
          }),
        );
        shell2.scale.setScalar(c.radius * 3.2);
        group.add(shell2);

        // 🎩 솜브레로 은하 거대 암흑 먼지 고리 3D 모델 (Dark Dust Lane)
        if (c.hasDarkDustRing) {
          const dustGeo = new THREE.RingGeometry(c.radius * 3.5, c.radius * 7.2, 96);
          const dustMat = new THREE.MeshBasicMaterial({
            color: 0x1c0f08,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.94,
            depthWrite: true,
          });
          dustRing = new THREE.Mesh(dustGeo, dustMat);
          dustRing.rotation.x = -Math.PI / 2 + 0.22;
          group.add(dustRing);

          // 내부 황금빛 팽대부 글로우 링
          const innerGlowGeo = new THREE.RingGeometry(c.radius * 1.4, c.radius * 6.5, 96);
          const innerGlowMat = new THREE.MeshBasicMaterial({
            color: 0xfde68a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
          innerGlow.rotation.x = -Math.PI / 2 + 0.22;
          group.add(innerGlow);
        }

        // 🎡 수레바퀴 고리 은하 충격파 팽창 링 3D 모델 (Cartwheel Shock Ring)
        if (c.hasCartwheelRing) {
          const cwRingGeo = new THREE.RingGeometry(c.radius * 5.8, c.radius * 8.6, 64);
          const cwRingMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          cartwheelRing = new THREE.Mesh(cwRingGeo, cwRingMat);
          cartwheelRing.rotation.x = -Math.PI / 2 + 0.3;
          group.add(cartwheelRing);
        }
      }

      const light = new THREE.PointLight(lightColor, lightIntensity, 450, 1.2);
      light.position.set(...c.pos);
      scene.add(light);

      // 은하 이름 3D 태그 라벨
      const labelSprite = makeCoreLabelSprite(c.name, c.color);
      labelSprite.position.set(0, c.radius * 2.2 + 3.2, 0);
      group.add(labelSprite);

      scene.add(group);

      coreMeshes.push({ group, light, coreId: c.id, disk, ring, jetUp, jetDown, dustRing, cartwheelRing });

      const posArr = new Float32Array(TRAIL_LEN * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      trailGeo.setDrawRange(0, 0);
      const trail = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({
          color: new THREE.Color(c.color),
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
        }),
      );
      trail.frustumCulled = false;
      scene.add(trail);
      coreTrails.push({ line: trail, posArr, count: 0 });
    }
  }

  function buildParticleVisuals(state: GalaxySimState) {
    if (starPoints) scene.remove(starPoints);
    if (gasPoints) scene.remove(gasPoints);

    const p = state.particles;
    const count = p.count;

    const starIdxs: number[] = [];
    const gasIdxs: number[] = [];

    for (let i = 0; i < count; i++) {
      if (p.isGas[i] === 1) gasIdxs.push(i);
      else starIdxs.push(i);
    }

    starGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(starIdxs.length * 3);
    const sCol = new Float32Array(starIdxs.length * 3);
    for (let i = 0; i < starIdxs.length; i++) {
      const orig = starIdxs[i] * 3;
      sPos[i * 3] = p.pos[orig];
      sPos[i * 3 + 1] = p.pos[orig + 1];
      sPos[i * 3 + 2] = p.pos[orig + 2];
      sCol[i * 3] = p.color[orig];
      sCol[i * 3 + 1] = p.color[orig + 1];
      sCol[i * 3 + 2] = p.color[orig + 2];
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      map: starTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    starPoints = new THREE.Points(starGeo, starMat);
    starPoints.userData.starIdxs = starIdxs;
    scene.add(starPoints);

    gasGeo = new THREE.BufferGeometry();
    const gPos = new Float32Array(gasIdxs.length * 3);
    const gCol = new Float32Array(gasIdxs.length * 3);
    for (let i = 0; i < gasIdxs.length; i++) {
      const orig = gasIdxs[i] * 3;
      gPos[i * 3] = p.pos[orig];
      gPos[i * 3 + 1] = p.pos[orig + 1];
      gPos[i * 3 + 2] = p.pos[orig + 2];
      gCol[i * 3] = p.color[orig];
      gCol[i * 3 + 1] = p.color[orig + 1];
      gCol[i * 3 + 2] = p.color[orig + 2];
    }
    gasGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    gasGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));

    const gasMat = new THREE.PointsMaterial({
      size: 14.0,
      map: gasTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    gasPoints = new THREE.Points(gasGeo, gasMat);
    gasPoints.userData.gasIdxs = gasIdxs;
    scene.add(gasPoints);
  }

  buildCoreVisuals(simState.cores);
  buildParticleVisuals(simState);

  let activeView: GalaxyCameraView = 'overview';
  let showGas = true;
  let showTrails = true;
  let showCosmicWeb = true;
  const clock = new THREE.Clock();
  let rafId = 0;

  const targetLerp = new THREE.Vector3(0, 0, 0);

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.08);

    stepGalaxySystem(simState, dt);
    onStateUpdate?.(simState);

    // 전체 우주 거대구조 (Cosmic Web & CMB) 비주얼 갱신
    cosmicWeb.cosmicGroup.visible = showCosmicWeb;
    if (showCosmicWeb) {
      cosmicWeb.cmbSphere.rotation.y += 0.0001;
      cosmicWeb.localRadarRing.scale.setScalar(1.0 + Math.sin(clock.getElapsedTime() * 3.0) * 0.16);

      const camDist = camera.position.length();
      const labelAlpha = THREE.MathUtils.clamp((camDist - 350) / 450, 0.05, 1);
      for (const sp of cosmicWeb.labelSprites) {
        (sp.material as THREE.SpriteMaterial).opacity = labelAlpha;
      }
    }

    // 태양계 위치 및 펄싱 링 갱신
    solarGroup.position.set(...simState.solarSystemPos);
    solarRing.scale.setScalar(1.0 + Math.sin(clock.getElapsedTime() * 4.0) * 0.25);

    // 우리은하 중심 이동 시 공전 궤도선도 중심에 맞춤
    const mwCore = simState.cores.find((x) => x.id.includes('milkyway')) ?? simState.cores[0];
    mwOrbitLine.position.set(...mwCore.pos);

    // 중심핵 위치 및 회전 애니메이션
    for (let i = 0; i < simState.cores.length; i++) {
      const c = simState.cores[i];
      const cm = coreMeshes[i];
      if (!cm) continue;

      cm.group.position.set(...c.pos);
      cm.light.position.set(...c.pos);

      if (cm.disk) cm.disk.rotation.z += 0.035;
      if (cm.ring) cm.ring.rotation.z -= 0.02;
      if (cm.dustRing) cm.dustRing.rotation.z += 0.003;
      if (cm.cartwheelRing) cm.cartwheelRing.rotation.z += 0.004;
      if (cm.jetUp && cm.jetDown) {
        const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 8.0) * 0.12;
        cm.jetUp.scale.set(pulse, 1, pulse);
        cm.jetDown.scale.set(pulse, 1, pulse);
      }

      if (showTrails) {
        const ct = coreTrails[i];
        if (ct) {
          const p = ct.posArr;
          if (ct.count === TRAIL_LEN) {
            p.copyWithin(0, 3);
            ct.count--;
          }
          p.set([c.pos[0], c.pos[1], c.pos[2]], ct.count * 3);
          ct.count++;
          ct.line.geometry.setDrawRange(0, ct.count);
          (ct.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          ct.line.visible = true;
        }
      } else {
        if (coreTrails[i]) coreTrails[i].line.visible = false;
      }
    }

    // 별 파티클 위치 갱신
    const p = simState.particles;
    const starIdxs: number[] = starPoints.userData.starIdxs;
    const sPosAttr = starGeo.attributes.position as THREE.BufferAttribute;
    const sPosArr = sPosAttr.array as Float32Array;

    for (let i = 0; i < starIdxs.length; i++) {
      const orig = starIdxs[i];
      if (p.alive[orig] === 0) {
        sPosArr[i * 3] = 99999;
      } else {
        sPosArr[i * 3] = p.pos[orig * 3];
        sPosArr[i * 3 + 1] = p.pos[orig * 3 + 1];
        sPosArr[i * 3 + 2] = p.pos[orig * 3 + 2];
      }
    }
    sPosAttr.needsUpdate = true;

    // 성운 가스 구름 위치 갱신
    if (showGas) {
      gasPoints.visible = true;
      const gasIdxs: number[] = gasPoints.userData.gasIdxs;
      const gPosAttr = gasGeo.attributes.position as THREE.BufferAttribute;
      const gPosArr = gPosAttr.array as Float32Array;

      for (let i = 0; i < gasIdxs.length; i++) {
        const orig = gasIdxs[i];
        if (p.alive[orig] === 0) {
          gPosArr[i * 3] = 99999;
        } else {
          gPosArr[i * 3] = p.pos[orig * 3];
          gPosArr[i * 3 + 1] = p.pos[orig * 3 + 1];
          gPosArr[i * 3 + 2] = p.pos[orig * 3 + 2];
        }
      }
      gPosAttr.needsUpdate = true;
    } else {
      gasPoints.visible = false;
    }

    // 카메라 타깃 스무딩
    const cores = simState.cores;
    switch (activeView) {
      case 'universe': {
        targetLerp.set(0, 0, 0);
        break;
      }
      case 'overview': {
        targetLerp.set(cores.length > 2 ? 60 : 0, 0, 0);
        break;
      }
      case 'sombrero': {
        const c = cores.find((x) => x.id.includes('sombrero')) ?? cores[0];
        targetLerp.set(...c.pos);
        break;
      }
      case 'whirlpool': {
        const c = cores.find((x) => x.id.includes('m51a')) ?? cores[0];
        targetLerp.set(c.pos[0] + 10, c.pos[1] + 12, c.pos[2]);
        break;
      }
      case 'quasar': {
        const c = cores.find((x) => x.id.includes('quasar') || x.isBlackHole) ?? cores[0];
        targetLerp.set(...c.pos);
        break;
      }
      case 'cartwheel': {
        const c = cores.find((x) => x.id.includes('cartwheel')) ?? cores[0];
        targetLerp.set(...c.pos);
        break;
      }
      case 'solarsystem': {
        targetLerp.set(...simState.solarSystemPos);
        break;
      }
      case 'milkyway': {
        const c = cores.find((x) => x.id.includes('milkyway')) ?? cores[0];
        targetLerp.set(...c.pos);
        break;
      }
      case 'andromeda': {
        const c = cores.find((x) => x.id.includes('andromeda')) ?? cores[1];
        if (c) targetLerp.set(...c.pos);
        break;
      }
      case 'triangulum': {
        const c = cores.find((x) => x.id.includes('triangulum'));
        if (c) targetLerp.set(...c.pos);
        break;
      }
      case 'magellanic': {
        const c = cores.find((x) => x.id.includes('lmc')) ?? cores.find((x) => x.id.includes('smc'));
        if (c) targetLerp.set(...c.pos);
        break;
      }
      case 'collision': {
        if (cores.length >= 2) {
          targetLerp.set(
            (cores[0].pos[0] + cores[1].pos[0]) * 0.5,
            (cores[0].pos[1] + cores[1].pos[1]) * 0.5,
            (cores[0].pos[2] + cores[1].pos[2]) * 0.5,
          );
        }
        break;
      }
      case 'blackhole': {
        const bh = cores.find((x) => x.isBlackHole);
        if (bh) targetLerp.set(...bh.pos);
        break;
      }
    }

    controls.target.lerp(targetLerp, 0.06);
    controls.update();

    bloom.render();
  }

  frame();

  const handleResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(handleResize);
  ro.observe(container);
  window.addEventListener('resize', handleResize);

  return {
    setScenario(scenario) {
      simState = createGalaxyScenario(scenario);
      buildCoreVisuals(simState.cores);
      buildParticleVisuals(simState);
    },
    setSpeed(speed) {
      simState.speed = Math.max(1, Math.min(50, speed));
    },
    setPlaying(playing) {
      simState.paused = !playing;
    },
    setViewMode(mode) {
      activeView = mode;
      if (mode === 'universe') {
        camera.position.set(0, 1600, 2900);
        showCosmicWeb = true;
      } else if (mode === 'overview') {
        camera.position.set(60, 220, 360);
      } else if (mode === 'sombrero') {
        const c = simState.cores.find((x) => x.id.includes('sombrero')) ?? simState.cores[0];
        camera.position.set(c.pos[0], c.pos[1] + 18, c.pos[2] + 62);
      } else if (mode === 'whirlpool') {
        const c = simState.cores.find((x) => x.id.includes('m51a')) ?? simState.cores[0];
        camera.position.set(c.pos[0] + 10, c.pos[1] + 48, c.pos[2] + 55);
      } else if (mode === 'quasar') {
        const c = simState.cores.find((x) => x.id.includes('quasar') || x.isBlackHole) ?? simState.cores[0];
        camera.position.set(c.pos[0] + 35, c.pos[1] + 25, c.pos[2] + 45);
      } else if (mode === 'cartwheel') {
        const c = simState.cores.find((x) => x.id.includes('cartwheel')) ?? simState.cores[0];
        camera.position.set(c.pos[0], c.pos[1] + 38, c.pos[2] + 70);
      } else if (mode === 'solarsystem') {
        const p = simState.solarSystemPos;
        camera.position.set(p[0] + 4, p[1] + 12, p[2] + 18);
      } else if (mode === 'milkyway') {
        const c = simState.cores.find((x) => x.id.includes('milkyway')) ?? simState.cores[0];
        camera.position.set(c.pos[0], c.pos[1] + 55, c.pos[2] + 85);
      } else if (mode === 'andromeda') {
        const c = simState.cores.find((x) => x.id.includes('andromeda')) ?? simState.cores[1];
        if (c) camera.position.set(c.pos[0], c.pos[1] + 55, c.pos[2] + 85);
      } else if (mode === 'triangulum') {
        const c = simState.cores.find((x) => x.id.includes('triangulum'));
        if (c) camera.position.set(c.pos[0], c.pos[1] + 40, c.pos[2] + 65);
      } else if (mode === 'magellanic') {
        const c = simState.cores.find((x) => x.id.includes('lmc'));
        if (c) camera.position.set(c.pos[0], c.pos[1] + 35, c.pos[2] + 55);
      } else if (mode === 'collision') {
        camera.position.set(0, 95, 160);
      } else if (mode === 'blackhole') {
        camera.position.set(0, 45, 80);
      }
    },
    setShowGasClouds(show) {
      showGas = show;
    },
    setShowTrails(show) {
      showTrails = show;
    },
    setShowCosmicWeb(show) {
      showCosmicWeb = show;
    },
    setGalaxyDistance(kpc) {
      if (simState.cores.length >= 2) {
        const c1 = simState.cores[0];
        const c2 = simState.cores[1];
        const curDist = Math.hypot(c2.pos[0] - c1.pos[0], c2.pos[1] - c1.pos[1], c2.pos[2] - c1.pos[2]);
        if (curDist > 1e-4) {
          const ratio = kpc / curDist;
          c1.pos[0] *= ratio;
          c1.pos[1] *= ratio;
          c2.pos[0] *= ratio;
          c2.pos[1] *= ratio;
        }
      }
    },
    reset() {
      simState = createGalaxyScenario(simState.scenario);
      buildCoreVisuals(simState.cores);
      buildParticleVisuals(simState);
      camera.position.set(0, 220, 360);
      controls.target.set(0, 0, 0);
    },
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      bloom.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
