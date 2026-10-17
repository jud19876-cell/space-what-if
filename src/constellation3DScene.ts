import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CONSTELLATIONS,
  ZODIAC_MONTHS,
  type ConstellationData,
  type StarData,
  type ZodiacMonthInfo,
} from './constellationsData.ts';
import { generateGhostCanvas } from './constellationGhostArt.ts';
import { createStarfield, createSunMaterial, getSoftDotTexture, setupFreeCamera } from './fx.ts';
import { createCloudTexture, createPlanetTexture, createRoughnessMap } from './planetTextures.ts';

export type ConstellationViewMode = 'earth' | 'space3d' | 'top' | 'season_orbit' | 'zodiac_wheel';

export interface ConstellationScene {
  setConstellation(constellation: ConstellationData): void;
  setViewMode(mode: ConstellationViewMode): void;
  resetView(): void;
  setSeasonAngle(angleRad: number): void;
  setSeasonAutoPlay(play: boolean): void;
  setZodiacWheelMonth(month: number): void;
  setZodiacWheelAutoPlay(play: boolean): void;
  setShowArt(show: boolean): void;
  setShowGuides(show: boolean): void;
  setSelectedStar(starId: string | null): void;
  onSelectStar?: (star: StarData | null) => void;
  dispose(): void;
}

export interface ConstellationSceneCallbacks {
  /** 1~12월 시계 자동 공전 중 '현재 달'이 바뀔 때 */
  onZodiacMonthChange?: (month: number) => void;
  /** 4계절 자동 공전 중 계절이 바뀔 때 */
  onSeasonChange?: (season: 'spring' | 'summer' | 'autumn' | 'winter') => void;
}

// Web Audio API 아름다운 우주 벨 & 별빛 효과음
let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
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

export function playStarChime(frequency = 523.25) {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + 0.08);
  osc.frequency.setValueAtTime(frequency, now + 0.12);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.65);
}

export function playWarpChime() {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + i * 0.08;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

const CAM_EARTH_DIST = 42; // 지구 카메라 거리

/** 실제 광년 거리를 3D 깊이 Z 좌표로 매핑 */
function calculateTrue3DPos(star: StarData): THREE.Vector3 {
  // 거리 스케일 (8.6 광년[시리우스] ~ 2600 광년[데네브/알루드라])
  // 제곱근 스케일링으로 깊이감을 또렷하게 분별 가능하도록 변환
  const minLy = 8.0;
  const maxLy = 2600;
  const norm = Math.max(0, Math.min(1, (Math.sqrt(star.distanceLy) - Math.sqrt(minLy)) / (Math.sqrt(maxLy) - Math.sqrt(minLy))));
  
  // Z 깊이: 0 (가장 가까움) ~ 36 (가장 멂)
  const zDepth = norm * 34;

  // 원근 투영 역산: 지구 카메라가 (0, 0, -CAM_EARTH_DIST)에서 보았을 때
  // 화면의 (skyPos.x, skyPos.y)에 정확히 일치하도록 3D 공간 상의 X, Y를 확장
  const k = (CAM_EARTH_DIST + zDepth) / CAM_EARTH_DIST;
  const x = star.skyPos[0] * 2.8 * k;
  const y = star.skyPos[1] * 2.8 * k;

  return new THREE.Vector3(x, y, zDepth);
}

export function createConstellation3DScene(
  container: HTMLDivElement,
  initialConstellation: ConstellationData,
  onSelectStar?: (star: StarData | null) => void,
  callbacks: ConstellationSceneCallbacks = {},
): ConstellationScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030f);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  // 초기 지구 관측자 시점: Z축에서 정면을 바라봄
  camera.position.set(0, 0, -CAM_EARTH_DIST);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 16); // 별자리 중간 깊이를 중심축으로 회전
  controls.minDistance = 4;
  controls.maxDistance = 280;
  // 왼쪽 드래그 회전 · 오른쪽 드래그 이동 · 휠은 커서 쪽 확대
  const freeCam = setupFreeCamera(controls, renderer.domElement);

  let isAnimatingCamera = false;
  controls.addEventListener('start', () => {
    // 사용자가 직접 화면을 터치/드래그/휠 스크롤하면 자동 카메라 이동 즉시 중단
    isAnimatingCamera = false;
  });

  // 조명
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(20, 30, -20);
  scene.add(dirLight);

  // 1. 깊고 아름다운 우주 배경 별무리 (둥글게 반짝이는 별)
  const starfield = createStarfield({ count: 5000, radius: 330, size: 2.2 });
  scene.add(starfield.points);

  // 2. 별자리 메쉬 그룹
  const constellationGroup = new THREE.Group();
  scene.add(constellationGroup);

  // 별 메시 매핑
  const starMeshes = new Map<string, { mesh: THREE.Mesh; halo: THREE.Mesh; star: StarData; pos3D: THREE.Vector3 }>();
  let connectionLineMesh: THREE.LineSegments | null = null;
  let guideGroup: THREE.Group = new THREE.Group();
  let artGroup: THREE.Group = new THREE.Group();
  let ghostMesh: THREE.Mesh | null = null;
  let ghostMat: THREE.MeshBasicMaterial | null = null;
  scene.add(guideGroup);
  scene.add(artGroup);

  // 3D 텍스트 라벨 스프라이트 생성기
  function makeLabelSprite(
    text: string,
    bgColor = 'rgba(8, 15, 38, 0.88)',
    textColor = '#ffffff',
    borderColor = '#38bdf8',
    scaleX = 8,
    scaleY = 2
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(12, 12, 488, 104, 28);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 36px "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleX, scaleY, 1);
    return sprite;
  }

  // 3. 단독 3D 지구 모형 그룹 (지구 관측소 뷰 & 거리감 측정용)
  const earthGlobeGroup = new THREE.Group();
  scene.add(earthGlobeGroup);

  // 태양계 화면과 같은 절차적 지구 텍스처 (대륙·기후대·만년설)
  const earthTex = createPlanetTexture('earth');
  const earthGeo = new THREE.SphereGeometry(3.6, 32, 32);
  const earthMat = new THREE.MeshStandardMaterial({
    map: earthTex,
    roughness: 1,
    roughnessMap: createRoughnessMap('earth') ?? null,
    metalness: 0,
  });
  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.position.set(0, -2.2, -38);
  earthGlobeGroup.add(earthMesh);
  const earthClouds = new THREE.Mesh(
    new THREE.SphereGeometry(3.66, 48, 48),
    new THREE.MeshStandardMaterial({ map: createCloudTexture(), transparent: true, depthWrite: false }),
  );
  earthMesh.add(earthClouds);

  // 대기권 은은한 푸른 후광
  const atmoGeo = new THREE.SphereGeometry(3.85, 32, 32);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.22,
    side: THREE.BackSide,
  });
  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  atmoMesh.position.set(0, -2.2, -38);
  earthGlobeGroup.add(atmoMesh);

  // 지구 표면 천문대 돔 (관측소 위치)
  const domeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  domeMesh.position.set(0, 1.4, -38);
  earthGlobeGroup.add(domeMesh);

  // 천문대에서 우주 별자리를 향해 뻗어나가는 레이저 거리 측정 빔
  const beamPts = [new THREE.Vector3(0, 1.4, -38), new THREE.Vector3(0, 0, 16)];
  const beamGeo = new THREE.BufferGeometry().setFromPoints(beamPts);
  const beamMat = new THREE.LineDashedMaterial({
    color: 0x4fe3c1,
    dashSize: 1.5,
    gapSize: 0.8,
    transparent: true,
    opacity: 0.7,
  });
  const beamLine = new THREE.Line(beamGeo, beamMat);
  beamLine.computeLineDistances();
  earthGlobeGroup.add(beamLine);

  // 지구 및 별자리 거리 3D 라벨 배지
  // (예전 9×2.25 크기는 카메라 바로 앞이라 화면의 1/4을 가려 별자리를 덮었음)
  const earthLabelSprite = makeLabelSprite('🌍 지구 관측소 (0 광년)', 'rgba(10, 24, 60, 0.9)', '#ffffff', '#4fe3c1', 3.4, 0.85);
  earthLabelSprite.position.set(0, 2.15, -38);
  earthGlobeGroup.add(earthLabelSprite);

  const starDistanceLabel = makeLabelSprite('✨ 별자리 (우주 깊은 곳: 58+ 광년)', 'rgba(20, 15, 50, 0.9)', '#fde047', '#eab308', 11, 2.75);
  starDistanceLabel.position.set(0, 1.8, 16);
  earthGlobeGroup.add(starDistanceLabel);

  // 4. 태양 & 지구 4계절 공전 시뮬레이션 그룹
  const seasonOrbitGroup = new THREE.Group();
  seasonOrbitGroup.visible = false;
  scene.add(seasonOrbitGroup);

  const SUN_Z = -42;
  const ORBIT_R = 18;

  // 태양 중심체
  const sunGroup = new THREE.Group();
  sunGroup.position.set(0, 0, SUN_Z);
  seasonOrbitGroup.add(sunGroup);

  const seasonSunMat = createSunMaterial(1.35);
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(4.8, 48, 32), seasonSunMat);
  sunGroup.add(sunMesh);

  const sunLight = new THREE.PointLight(0xfff7ed, 2.5, 160);
  sunGroup.add(sunLight);

  const sunLabel = makeLabelSprite('☀️ 태양 (태양계 중심)', 'rgba(80, 20, 10, 0.9)', '#fef08a', '#ea580c', 9, 2.25);
  sunLabel.position.set(0, 6.2, 0);
  sunGroup.add(sunLabel);

  // 지구 공전 궤도 원형 링
  const orbitPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    orbitPts.push(new THREE.Vector3(ORBIT_R * Math.cos(a), 0, SUN_Z + ORBIT_R * Math.sin(a)));
  }
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
  const orbitLine = new THREE.Line(
    orbitGeo,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 })
  );
  seasonOrbitGroup.add(orbitLine);

  // 4계절 궤도 위치 마커 스프라이트
  const springMarker = makeLabelSprite('🌸 봄 (3~5월)', 'rgba(30, 15, 45, 0.9)', '#f472b6', '#f472b6', 7, 1.75);
  springMarker.position.set(ORBIT_R + 1, 1.2, SUN_Z);
  seasonOrbitGroup.add(springMarker);

  const summerMarker = makeLabelSprite('☀️ 여름 (6~8월: 별자리 정면!)', 'rgba(10, 40, 30, 0.9)', '#4ade80', '#22c55e', 11, 2.75);
  summerMarker.position.set(0, 1.2, SUN_Z + ORBIT_R + 1);
  seasonOrbitGroup.add(summerMarker);

  const autumnMarker = makeLabelSprite('🍁 가을 (9~11월)', 'rgba(50, 25, 10, 0.9)', '#fb923c', '#ea580c', 7, 1.75);
  autumnMarker.position.set(-ORBIT_R - 1, 1.2, SUN_Z);
  seasonOrbitGroup.add(autumnMarker);

  const winterMarker = makeLabelSprite('❄️ 겨울 (12~2월: 태양 반대편!)', 'rgba(10, 25, 55, 0.9)', '#60a5fa', '#3b82f6', 11, 2.75);
  winterMarker.position.set(0, 1.2, SUN_Z - ORBIT_R - 1);
  seasonOrbitGroup.add(winterMarker);

  // 공전하는 3D 지구 모델 & 밤하늘 시야 콘
  const orbitingEarthGroup = new THREE.Group();
  seasonOrbitGroup.add(orbitingEarthGroup);

  const orbEarthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 24, 24),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.55 })
  );
  orbitingEarthGroup.add(orbEarthMesh);

  const orbEarthLabel = makeLabelSprite('🌍 공전하는 지구', 'rgba(10, 24, 60, 0.9)', '#ffffff', '#38bdf8', 7, 1.75);
  orbEarthLabel.position.set(0, 2.6, 0);
  orbitingEarthGroup.add(orbEarthLabel);

  // 밤하늘 시야 빔 콘 (태양 반대편 어두운 밤하늘 쪽으로 뻗어나가는 신비로운 푸른 빛 콘)
  const coneGeo = new THREE.ConeGeometry(5.5, 20, 24, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const nightCone = new THREE.Mesh(coneGeo, coneMat);
  seasonOrbitGroup.add(nightCone);

  let seasonAngle = Math.PI * 0.5; // 기본 여름 위치 (별자리가 잘 보이는 방향)
  let seasonAutoPlay = false;

  function updateSeasonOrbit(angle: number) {
    const x = ORBIT_R * Math.cos(angle);
    const z = SUN_Z + ORBIT_R * Math.sin(angle);
    orbitingEarthGroup.position.set(x, 0, z);

    // 밤하늘 시선 방향: 태양(0, 0, SUN_Z)에서 지구(x, 0, z)를 향하는 외향 벡터
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);

    nightCone.position.set(x + dirX * 10, 0, z + dirZ * 10);
    nightCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dirX, 0, dirZ));
  }

  // 5. 🎡 황도 12궁 천문 시계 뷰 시뮬레이션 그룹 (1~12월 전체 시계 다이얼 & 광년 거리 3D 뷰)
  const zodiacWheelGroup = new THREE.Group();
  zodiacWheelGroup.visible = false;
  scene.add(zodiacWheelGroup);

  const ZODIAC_RING_R = 96; // 12대 별자리 원형 링 반경
  const ZODIAC_ORBIT_R = 30; // 지구 공전 궤도 반경
  const ZODIAC_DIAL_R = 122; // 시계 1시~12시 다이얼 마커 링 반경

  // 시계 좌표 변환 헬퍼 (12시: (0, -R), 1시: (R sin 30°, -R cos 30°), 3시: (R, 0), 6시: (0, R), 9시: (-R, 0))
  function getClockPos(clockHour: number, radius: number): { x: number; z: number; angle: number } {
    const angle = (clockHour * Math.PI) / 6;
    const x = radius * Math.sin(angle);
    const z = -radius * Math.cos(angle);
    return { x, z, angle };
  }

  // (1) 중앙 태양 (0, 0, 0)
  const wheelSunGroup = new THREE.Group();
  zodiacWheelGroup.add(wheelSunGroup);

  const wheelSunMat = createSunMaterial(1.35);
  const wheelSunMesh = new THREE.Mesh(new THREE.SphereGeometry(6.6, 48, 32), wheelSunMat);
  wheelSunGroup.add(wheelSunMesh);

  // 태양 코로나 글로우 링
  const wheelSunCorona = new THREE.Mesh(
    new THREE.RingGeometry(6.8, 11.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffa020,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    })
  );
  wheelSunCorona.rotation.x = Math.PI / 2;
  wheelSunGroup.add(wheelSunCorona);

  const wheelSunLight = new THREE.PointLight(0xfff7ed, 4.0, 500);
  wheelSunGroup.add(wheelSunLight);

  const wheelSunLabel = makeLabelSprite('☀️ 태양 (천문 시계 중심)', 'rgba(80, 20, 10, 0.94)', '#fef08a', '#ea580c', 11, 2.7);
  wheelSunLabel.position.set(0, 9.4, 0);
  wheelSunGroup.add(wheelSunLabel);

  // (2) 황도 12궁 황금 궤도 링 & 천문 시계 외곽 다이얼
  const eclipticPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 144; i++) {
    const a = (i / 144) * Math.PI * 2;
    eclipticPts.push(new THREE.Vector3(ZODIAC_RING_R * Math.sin(a), 0, -ZODIAC_RING_R * Math.cos(a)));
  }
  const eclipticLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(eclipticPts),
    new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45 })
  );
  zodiacWheelGroup.add(eclipticLine);

  // 시계 외곽 다이얼 링 & 60분 틱 마크
  const dialRingPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 144; i++) {
    const a = (i / 144) * Math.PI * 2;
    dialRingPts.push(new THREE.Vector3(ZODIAC_DIAL_R * Math.sin(a), 0, -ZODIAC_DIAL_R * Math.cos(a)));
  }
  const dialRingLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(dialRingPts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
  );
  zodiacWheelGroup.add(dialRingLine);

  // 60분 틱 마크
  const tickPts: THREE.Vector3[] = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const isHour = i % 5 === 0;
    const rIn = isHour ? ZODIAC_DIAL_R - 3.2 : ZODIAC_DIAL_R - 1.2;
    const rOut = ZODIAC_DIAL_R + 1.2;
    tickPts.push(
      new THREE.Vector3(rIn * Math.sin(a), 0, -rIn * Math.cos(a)),
      new THREE.Vector3(rOut * Math.sin(a), 0, -rOut * Math.cos(a))
    );
  }
  const tickSegments = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tickPts),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5 })
  );
  zodiacWheelGroup.add(tickSegments);

  // 1시 ~ 12시 시계 아워 마커 스프라이트
  for (let h = 1; h <= 12; h++) {
    const { x, z } = getClockPos(h, ZODIAC_DIAL_R + 8.5);
    const hourLabel = makeLabelSprite(
      `⏱️ ${h}시 (${h}월)`,
      'rgba(15, 23, 42, 0.92)',
      '#facc15',
      '#eab308',
      9.0,
      2.3
    );
    hourLabel.position.set(x, 0.5, z);
    zodiacWheelGroup.add(hourLabel);
  }

  // (3) 지구 공전 궤도선 & 12개 월별 궤도 위치 마커
  const wheelEarthOrbitPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    wheelEarthOrbitPts.push(new THREE.Vector3(ZODIAC_ORBIT_R * Math.sin(a), 0, -ZODIAC_ORBIT_R * Math.cos(a)));
  }
  const wheelEarthOrbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(wheelEarthOrbitPts),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
  );
  zodiacWheelGroup.add(wheelEarthOrbitLine);

  // 12개 월별 지구 공전 위치 점 마커
  const dotGeo = new THREE.SphereGeometry(0.55, 12, 12);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
  for (let m = 1; m <= 12; m++) {
    const { x, z } = getClockPos(m, ZODIAC_ORBIT_R);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, 0, z);
    zodiacWheelGroup.add(dot);
  }

  // (4) 공전 및 자전하는 지구 모델
  const wheelEarthGroup = new THREE.Group();
  zodiacWheelGroup.add(wheelEarthGroup);

  const wheelEarthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 24, 24),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.55 })
  );
  wheelEarthGroup.add(wheelEarthMesh);

  // 지구 대기권 푸른 후광
  const wheelEarthAtmo = new THREE.Mesh(
    new THREE.SphereGeometry(2.75, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.BackSide,
    })
  );
  wheelEarthGroup.add(wheelEarthAtmo);

  const wheelEarthLabel = makeLabelSprite('🌍 공전·자전 지구', 'rgba(10, 24, 60, 0.94)', '#ffffff', '#38bdf8', 9.0, 2.2);
  wheelEarthLabel.position.set(0, 4.4, 0);
  wheelEarthGroup.add(wheelEarthLabel);

  // 밤하늘 시야 빔 콘 (지구의 밤에서 바깥 해당 월 별자리를 비추는 부채꼴 콘)
  const wheelNightCone = new THREE.Mesh(
    new THREE.ConeGeometry(16, 62, 28, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  zodiacWheelGroup.add(wheelNightCone);

  // 천문 시계 바늘선 (태양 -> 지구 -> 해당 월 별자리를 잇는 황금빛 정렬 레이저)
  const clockHandGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -ZODIAC_DIAL_R),
  ]);
  const clockHandLine = new THREE.Line(
    clockHandGeo,
    new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.75 })
  );
  zodiacWheelGroup.add(clockHandLine);

  // (5) 12대 별자리 3D 입체 성좌 노드 빌드 (각 별의 실제 광년 거리에 따른 깊이감 반영)
  interface ZodiacNode {
    monthInfo: ZodiacMonthInfo;
    group: THREE.Group;
    label: THREE.Sprite;
    ghostMat: THREE.MeshBasicMaterial;
    stars: THREE.Mesh[];
  }
  const zodiacNodes: ZodiacNode[] = [];

  const miniSphereGeo = new THREE.SphereGeometry(0.85, 16, 16);
  const miniHaloPlaneGeo = new THREE.PlaneGeometry(2.8, 2.8);

  ZODIAC_MONTHS.forEach((zm) => {
    const cData = CONSTELLATIONS.find((c) => c.id === zm.id);
    if (!cData) return;

    // 시계 M시 방향 위치
    const { x: cX, z: cZ } = getClockPos(zm.month, ZODIAC_RING_R);

    const cGroup = new THREE.Group();
    cGroup.position.set(cX, 0, cZ);
    // 태양(0,0,0)을 바라보도록 회전시켜, 로컬 Z축이 태양(중심)을 향하고 로컬 -Z축이 바깥쪽 심우주를 향하도록 설정
    cGroup.lookAt(0, 0, 0);
    zodiacWheelGroup.add(cGroup);

    // 1. 라벨 스프라이트 (예: "🎂 1월 염소자리 ♑")
    const labelSprite = makeLabelSprite(
      `🎂 ${zm.month}월 ${cData.name} ${cData.emoji}`,
      'rgba(14, 20, 52, 0.94)',
      '#ffffff',
      '#38bdf8',
      13.5,
      3.2
    );
    labelSprite.position.set(0, 12.8, 0);
    cGroup.add(labelSprite);

    // 2. 네온 고스트 일러스트 (배경 깊이 z = -6에 부유)
    const ghostCanvas = generateGhostCanvas(cData.id);
    const ghostTex = new THREE.CanvasTexture(ghostCanvas);
    ghostTex.colorSpace = THREE.SRGBColorSpace;
    const gMat = new THREE.MeshBasicMaterial({
      map: ghostTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), gMat);
    gMesh.position.set(0, 0, -6);
    cGroup.add(gMesh);

    // 3. 3D 입체 별들과 연결선 (각 별의 실제 광년 거리 distanceLy를 깊이 depthZ에 매핑!)
    // cGroup은 lookAt(0,0,0) 상태이므로, 태양/지구 관측자에서 볼 때:
    // 로컬 Z=0이 별자리 중심면, 로컬 Z < 0이 관측자로부터 멀어지는 심우주 깊이 방향!
    const starMap = new Map<string, THREE.Vector3>();
    const nodeStars: THREE.Mesh[] = [];

    // 가장 밝은 대표별 1개 식별 (거리 라벨 표시용)
    const brightestStar = [...cData.stars].sort((a, b) => a.apparentMagnitude - b.apparentMagnitude)[0];

    cData.stars.forEach((star) => {
      const sx = star.skyPos[0] * 1.7;
      const sy = star.skyPos[1] * 1.7;

      // 실제 광년 거리(distanceLy)에 따른 3D 깊이 오프셋
      // 10광년 -> depthZ ~ 0, 100광년 -> depthZ ~ -4.5, 500광년 -> depthZ ~ -12.5 (심우주 뒤쪽)
      const distLy = Math.max(10, star.distanceLy || 100);
      const depthZ = -(Math.sqrt(distLy) - Math.sqrt(10)) * 0.62;

      const spos = new THREE.Vector3(sx, sy, depthZ);
      starMap.set(star.id, spos);

      // 별 구체
      const sMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(star.color),
        emissive: new THREE.Color(star.color),
        emissiveIntensity: 0.95,
      });
      const sMesh = new THREE.Mesh(miniSphereGeo, sMat);
      sMesh.position.copy(spos);
      cGroup.add(sMesh);
      nodeStars.push(sMesh);

      // 별 후광
      const hMat = new THREE.MeshBasicMaterial({
        map: getSoftDotTexture(),
        color: new THREE.Color(star.color),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const hMesh = new THREE.Mesh(miniHaloPlaneGeo, hMat);
      hMesh.position.copy(spos);
      cGroup.add(hMesh);

      // 거리 가이드 드롭선 (기준면 Z=0 과 별의 실제 3D 깊이 위치를 연결)
      if (Math.abs(depthZ) > 1.2) {
        const dropLineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(sx, sy, 0),
          spos,
        ]);
        const dropLine = new THREE.Line(
          dropLineGeo,
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 })
        );
        cGroup.add(dropLine);
      }

      // 대표 밝은 별 거리 뱃지 표시
      if (brightestStar && star.id === brightestStar.id) {
        const distTag = makeLabelSprite(
          `⭐ ${star.name.split(' ')[0]} [${star.distanceLy}광년]`,
          'rgba(3, 7, 18, 0.88)',
          '#67e8f9',
          '#0284c7',
          9.0,
          2.0
        );
        distTag.position.set(sx, sy - 2.0, depthZ);
        cGroup.add(distTag);
      }
    });

    // 별과 별을 잇는 3D 연결선 (실제 깊이가 반영된 3D 선)
    cData.lines.forEach(([idA, idB]) => {
      const pA = starMap.get(idA);
      const pB = starMap.get(idB);
      if (pA && pB) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([pA, pB]);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x6ee7b7,
          transparent: true,
          opacity: 0.8,
        });
        cGroup.add(new THREE.Line(lineGeo, lineMat));
      }
    });

    zodiacNodes.push({
      monthInfo: zm,
      group: cGroup,
      label: labelSprite,
      ghostMat: gMat,
      stars: nodeStars,
    });
  });

  let zodiacMonth = 1; // 기본 1월 염소자리
  let zodiacWheelAutoPlay = false;
  let lastReportedMonth = 1;

  // 생일 별자리(태양 뒤) / 오늘 밤 정면 별자리 안내 배지
  const birthTag = makeLabelSprite('☀️ 태양 뒤에 숨은 생일 별자리', 'rgba(70, 30, 5, 0.94)', '#fde68a', '#f59e0b', 15, 3.4);
  const nightTag = makeLabelSprite('🌙 오늘 밤 정면에 보이는 별자리', 'rgba(8, 30, 70, 0.94)', '#bae6fd', '#38bdf8', 15, 3.4);
  zodiacWheelGroup.add(birthTag, nightTag);

  function updateZodiacWheel(month: number) {
    // 그 달에는 태양이 '생일 별자리' 앞에 있다 = 지구는 태양 맞은편(시계 M+6시)에 있다.
    // 그래서 생일 별자리는 낮 하늘에 숨고, 지구의 밤하늘은 반대편(M+6월) 별자리를 바라본다.
    const { x: earthX, z: earthZ, angle } = getClockPos(month + 6, ZODIAC_ORBIT_R);
    wheelEarthGroup.position.set(earthX, 0, earthZ);

    // 밤하늘 시선 방향: 태양 → 지구 바깥쪽
    const dirX = Math.sin(angle);
    const dirZ = -Math.cos(angle);

    // 밤하늘 시야 콘 (지구 바깥쪽으로 펼쳐져 맞은편 별자리를 비춤)
    wheelNightCone.position.set(earthX + dirX * 31, 0, earthZ + dirZ * 31);
    wheelNightCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dirX, 0, dirZ));

    // 천문 시계 바늘: 지구 → 태양 → 생일 별자리 일직선 (지구에서 보면 태양이 생일 별자리 앞에 겹쳐 보임)
    const handEnd = new THREE.Vector3(-dirX * (ZODIAC_DIAL_R + 6), 0, -dirZ * (ZODIAC_DIAL_R + 6));
    clockHandLine.geometry.setFromPoints([new THREE.Vector3(earthX, 0, earthZ), handEnd]);

    // 별자리 밝기: 밤하늘 정면(맞은편) 별자리가 가장 크고 밝게, 생일 별자리는 태양빛 속에 은은하게
    zodiacNodes.forEach((node) => {
      const nodePos = getClockPos(node.monthInfo.month, 1);
      const dot = dirX * nodePos.x + dirZ * nodePos.z;
      if (dot > 0.92) {
        node.ghostMat.opacity = 0.95;
        node.group.scale.setScalar(1.22);
      } else if (dot < -0.92) {
        node.ghostMat.opacity = 0.6;
        node.group.scale.setScalar(1.1);
      } else if (dot > 0.5) {
        node.ghostMat.opacity = 0.6;
        node.group.scale.setScalar(1.05);
      } else {
        node.ghostMat.opacity = 0.4;
        node.group.scale.setScalar(1.0);
      }
    });

    const m = ((Math.round(month) - 1 + 12) % 12) + 1;
    const birthPos = getClockPos(m, ZODIAC_RING_R);
    birthTag.position.set(birthPos.x, 21, birthPos.z);
    const nightPos = getClockPos(m + 6, ZODIAC_RING_R);
    nightTag.position.set(nightPos.x, 21, nightPos.z);
  }

  // 선택 링
  const selectRingGeo = new THREE.RingGeometry(1.1, 1.3, 32);
  const selectRingMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const selectRing = new THREE.Mesh(selectRingGeo, selectRingMat);
  selectRing.visible = false;
  scene.add(selectRing);

  // 상태
  let currentConstellation: ConstellationData = initialConstellation;
  let viewMode: ConstellationViewMode = 'earth';
  let showArt = true;
  let showGuides = true;
  let selectedStarId: string | null = null;

  // 카메라 애니메이션 목표
  const targetCamPos = new THREE.Vector3(0, 0, -CAM_EARTH_DIST);
  const targetCamLook = new THREE.Vector3(0, 0, 16);

  function rebuildConstellation() {
    // 기존 메시 정리
    while (constellationGroup.children.length > 0) {
      const c = constellationGroup.children[0];
      constellationGroup.remove(c);
    }
    while (guideGroup.children.length > 0) {
      guideGroup.remove(guideGroup.children[0]);
    }
    while (artGroup.children.length > 0) {
      artGroup.remove(artGroup.children[0]);
    }
    starMeshes.clear();

    const starSphereGeo = new THREE.SphereGeometry(1, 24, 24);
    const haloGeo = new THREE.PlaneGeometry(3.5, 3.5);

    // 각 별 생성
    currentConstellation.stars.forEach((star) => {
      const pos3D = calculateTrue3DPos(star);

      // 밝기에 따른 시각적 크기 (1등급 ~ 3.5등급)
      const sizeScale = Math.max(0.45, Math.min(1.2, 1.4 - star.apparentMagnitude * 0.25));

      // 메인 별 구체
      const starColor = new THREE.Color(star.color);
      const starMat = new THREE.MeshStandardMaterial({
        color: starColor,
        emissive: starColor,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const starMesh = new THREE.Mesh(starSphereGeo, starMat);
      starMesh.position.copy(pos3D);
      starMesh.scale.setScalar(sizeScale);
      starMesh.userData = { starId: star.id };
      constellationGroup.add(starMesh);

      // 별빛 광채 후광 (Halo Billboard)
      const haloMat = new THREE.MeshBasicMaterial({
        map: getSoftDotTexture(), // 텍스처가 없으면 후광이 네모난 색 판으로 보임
        color: starColor,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(pos3D);
      haloMesh.scale.setScalar(sizeScale * 1.5);
      constellationGroup.add(haloMesh);

      starMeshes.set(star.id, { mesh: starMesh, halo: haloMesh, star, pos3D });

      // 거리 가이드 레이저 기둥 (거리 측정 모드용)
      // 바닥 기준면 Y=-14 까지 점선/기둥 연결
      const floorY = -14;
      const guidePts = [pos3D, new THREE.Vector3(pos3D.x, floorY, pos3D.z)];
      const guideLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(guidePts),
        new THREE.LineDashedMaterial({
          color: 0x5577bb,
          dashSize: 0.6,
          gapSize: 0.4,
          transparent: true,
          opacity: 0.4,
        }),
      );
      guideLine.computeLineDistances();
      guideGroup.add(guideLine);

      // 바닥면에 닿는 작은 링
      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.45, 16),
        new THREE.MeshBasicMaterial({ color: 0x4fe3c1, side: THREE.DoubleSide, transparent: true, opacity: 0.4 }),
      );
      baseRing.rotation.x = Math.PI / 2;
      baseRing.position.set(pos3D.x, floorY, pos3D.z);
      guideGroup.add(baseRing);
    });

    // 별과 별을 잇는 3D 연결선
    const linePts: THREE.Vector3[] = [];
    currentConstellation.lines.forEach(([idA, idB]) => {
      const a = starMeshes.get(idA);
      const b = starMeshes.get(idB);
      if (a && b) {
        linePts.push(a.pos3D, b.pos3D);
      }
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    connectionLineMesh = new THREE.LineSegments(lineGeo, lineMat);
    constellationGroup.add(connectionLineMesh);

    // 바닥 깊이 눈금 그리드
    const grid = new THREE.GridHelper(50, 20, 0x3355aa, 0x1a264a);
    grid.position.set(0, -14, 16);
    guideGroup.add(grid);

    // 별자리 캐릭터 네온 실루엣 일러스트 생성
    buildConstellationArt();
  }

  // 별자리 캐릭터 네온 고스트 실루엣 일러스트 생성
  function buildConstellationArt() {
    while (artGroup.children.length > 0) {
      artGroup.remove(artGroup.children[0]);
    }
    if (ghostMesh) {
      ghostMesh.geometry.dispose();
      ghostMat?.map?.dispose();
      ghostMat?.dispose();
      ghostMesh = null;
      ghostMat = null;
    }

    // 1. 고스트 캔버스 텍스처 생성 (1024x1024 네온 실루엣)
    const canvas = generateGhostCanvas(currentConstellation.id);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    // 2. 3D 깊이 Z = 16 기준 평면 크기 (skyPos [-6, 6] 범위 = 12 * 2.8 * k)
    const planeSize = 12 * 2.8 * ((CAM_EARTH_DIST + 16) / CAM_EARTH_DIST);
    const ghostGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    ghostMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.position.set(0, 0, 16);
    ghostMesh.renderOrder = 3;
    artGroup.add(ghostMesh);
  }

  function getModeDefaults(mode: ConstellationViewMode): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const isNarrow = container.clientWidth < 950;
    if (mode === 'earth') {
      // 지구 위에서 별자리를 올려다보는 시점: 지구 모형이 아래쪽에 보이고 우주 별자리가 위에 펼쳐짐!
      const offX = isNarrow ? 0 : 1.2;
      return {
        pos: new THREE.Vector3(offX, 1.8, -48),
        look: new THREE.Vector3(offX, 0.6, 16),
      };
    } else if (mode === 'space3d') {
      return {
        pos: new THREE.Vector3(34, 20, -6),
        look: new THREE.Vector3(0, 0, 16),
      };
    } else if (mode === 'top') {
      return {
        pos: new THREE.Vector3(0, 56, 16),
        look: new THREE.Vector3(0, 0, 16),
      };
    } else if (mode === 'zodiac_wheel') {
      // zodiac_wheel 모드: 1~12월 시계 다이얼과 중앙 태양, 지구 공전 궤도를 시계 방향으로 한눈에 조망하는 웅장한 부감 뷰
      // 12시가 화면 상단(-Z), 6시가 화면 하단(+Z), 3시가 우측(+X), 9시가 좌측(-X)으로 정확히 정렬됨
      // (아래 월 선택 패널에 시계판 아래쪽이 가리지 않도록 시계판을 화면 위쪽에 둔다)
      return {
        pos: new THREE.Vector3(0, 190, 96),
        look: new THREE.Vector3(0, 0, 34),
      };
    } else {
      // season_orbit 모드: 태양과 지구 공전 궤도, 밤하늘 시야 콘을 함께 조망하는 시점
      return {
        pos: new THREE.Vector3(20, 30, -66),
        look: new THREE.Vector3(0, 0, -30),
      };
    }
  }

  // 뷰 모드 업데이트
  function applyViewMode(mode: ConstellationViewMode) {
    viewMode = mode;
    controls.enableRotate = true; // 모든 모드에서 자유 회전 허용!
    controls.enableZoom = true;
    controls.enablePan = true;

    if (mode === 'season_orbit') {
      earthGlobeGroup.visible = false;
      seasonOrbitGroup.visible = true;
      zodiacWheelGroup.visible = false;
      constellationGroup.visible = true;
      updateSeasonOrbit(seasonAngle);
      playWarpChime();
    } else if (mode === 'zodiac_wheel') {
      earthGlobeGroup.visible = false;
      seasonOrbitGroup.visible = false;
      zodiacWheelGroup.visible = true;
      constellationGroup.visible = false;
      guideGroup.visible = false;
      artGroup.visible = false;
      updateZodiacWheel(zodiacMonth);
      playWarpChime();
    } else {
      earthGlobeGroup.visible = true;
      seasonOrbitGroup.visible = false;
      zodiacWheelGroup.visible = false;
      constellationGroup.visible = true;
      guideGroup.visible = showGuides;
      artGroup.visible = showArt;
      if (mode === 'earth') playStarChime(440);
      else if (mode === 'space3d') playWarpChime();
      else playStarChime(660);
    }

    const { pos, look } = getModeDefaults(mode);
    targetCamPos.copy(pos);
    targetCamLook.copy(look);
    isAnimatingCamera = true;
  }

  function resetView() {
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    const { pos, look } = getModeDefaults(viewMode);
    targetCamPos.copy(pos);
    targetCamLook.copy(look);
    isAnimatingCamera = true;
    playStarChime(520);
  }

  rebuildConstellation();
  applyViewMode('earth');

  // 클릭 레이캐스팅
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onPointerDown(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = Array.from(starMeshes.values()).map((v) => v.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const starId = hit.userData.starId as string;
      const starObj = starMeshes.get(starId);
      if (starObj) {
        selectedStarId = starId;
        selectRing.visible = true;
        selectRing.position.copy(starObj.pos3D);
        selectRing.lookAt(camera.position);
        playStarChime(580 + Math.random() * 200);
        onSelectStar?.(starObj.star);
        return;
      }
    }

    // 빈 공간 클릭 시 선택 해제
    if (e.target === renderer.domElement) {
      selectedStarId = null;
      selectRing.visible = false;
      onSelectStar?.(null);
    }
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  // 렌더 루프
  let animId = 0;
  let lastFrame = performance.now();
  let lastSeason: 'spring' | 'summer' | 'autumn' | 'winter' | null = null;
  function seasonOf(angle: number): 'spring' | 'summer' | 'autumn' | 'winter' {
    const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const k = Math.round(a / (Math.PI / 2)) % 4;
    return (['spring', 'summer', 'autumn', 'winter'] as const)[k];
  }
  function animate(now: number) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    starfield.update(now * 0.001);
    wheelSunMat.uniforms.uTime.value = now * 0.001;
    seasonSunMat.uniforms.uTime.value = now * 0.001;

    // 카메라 부드러운 전환 이동 (버튼 클릭 전환 시에만 lerp 작동하고 완료되거나 사용자 조작 시 멈춤)
    if (isAnimatingCamera) {
      camera.position.lerp(targetCamPos, 0.08);
      controls.target.lerp(targetCamLook, 0.08);
      if (camera.position.distanceTo(targetCamPos) < 0.15 && controls.target.distanceTo(targetCamLook) < 0.15) {
        camera.position.copy(targetCamPos);
        controls.target.copy(targetCamLook);
        isAnimatingCamera = false;
      }
    }
    controls.update();

    // 별빛 펄스 애니메이션 & 카메라 바라보기
    const time = performance.now() * 0.003;
    starMeshes.forEach(({ halo, star }) => {
      halo.lookAt(camera.position);
      const pulse = 1.0 + Math.sin(time + star.distanceLy * 0.1) * 0.18;
      const baseScale = Math.max(0.45, Math.min(1.2, 1.4 - star.apparentMagnitude * 0.25)) * 1.5;
      halo.scale.setScalar(baseScale * pulse);
    });

    if (selectRing.visible) {
      selectRing.lookAt(camera.position);
      selectRing.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
    }

    // 신비로운 고스트 별자리 실루엣 숨결 펄스 애니메이션
    if (ghostMat) {
      const breath = 0.78 + Math.sin(time * 1.8) * 0.15;
      ghostMat.opacity = breath;
    }

    // 3D 지구 자전 및 공전 애니메이션
    earthMesh.rotation.y += 0.18 * dt;
    earthClouds.rotation.y += 0.04 * dt;
    orbEarthMesh.rotation.y += 0.48 * dt;
    wheelEarthMesh.rotation.y += 0.72 * dt;
    wheelSunMesh.rotation.y += 0.12 * dt;

    // 자동 공전 (모니터 주사율과 무관하게 dt 기준: 1년 약 26초)
    if (viewMode === 'season_orbit' && seasonAutoPlay) {
      seasonAngle = (seasonAngle + 0.24 * dt) % (Math.PI * 2);
      updateSeasonOrbit(seasonAngle);
      const season = seasonOf(seasonAngle);
      if (season !== lastSeason) {
        lastSeason = season;
        callbacks.onSeasonChange?.(season);
      }
    }

    if (viewMode === 'zodiac_wheel' && zodiacWheelAutoPlay) {
      zodiacMonth = ((zodiacMonth - 1 + 0.46 * dt) % 12) + 1;
      updateZodiacWheel(zodiacMonth);
      const m = ((Math.round(zodiacMonth) - 1) % 12) + 1;
      if (m !== lastReportedMonth) {
        lastReportedMonth = m;
        callbacks.onZodiacMonthChange?.(m);
      }
    }

    beamMat.opacity = 0.55 + Math.sin(Date.now() * 0.005) * 0.25;

    guideGroup.visible = showGuides;
    artGroup.visible = showArt;

    renderer.render(scene, camera);
  }

  animId = requestAnimationFrame(animate);

  const onResize = () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    if (viewMode === 'earth') {
      const isNarrow = container.clientWidth < 950;
      const offX = isNarrow ? 0 : 1.6;
      const offY = isNarrow ? -1.0 : 0;
      targetCamPos.set(offX, offY, -CAM_EARTH_DIST);
      targetCamLook.set(offX, offY, 16);
    }
  };
  window.addEventListener('resize', onResize);

  return {
    setConstellation(constellation: ConstellationData) {
      currentConstellation = constellation;
      selectedStarId = null;
      selectRing.visible = false;
      onSelectStar?.(null);
      rebuildConstellation();
      applyViewMode(viewMode);
    },
    setViewMode(mode: ConstellationViewMode) {
      applyViewMode(mode);
    },
    resetView() {
      resetView();
    },
    setSeasonAngle(angleRad: number) {
      seasonAngle = angleRad;
      lastSeason = seasonOf(angleRad);
      updateSeasonOrbit(seasonAngle);
    },
    setSeasonAutoPlay(play: boolean) {
      seasonAutoPlay = play;
    },
    setZodiacWheelMonth(month: number) {
      zodiacMonth = month;
      lastReportedMonth = month;
      updateZodiacWheel(zodiacMonth);
    },
    setZodiacWheelAutoPlay(play: boolean) {
      zodiacWheelAutoPlay = play;
    },
    setShowArt(show: boolean) {
      showArt = show;
    },
    setShowGuides(show: boolean) {
      showGuides = show;
    },
    setSelectedStar(starId: string | null) {
      selectedStarId = starId;
      if (starId && starMeshes.has(starId)) {
        const item = starMeshes.get(starId)!;
        selectRing.visible = true;
        selectRing.position.copy(item.pos3D);
        selectRing.lookAt(camera.position);
      } else {
        selectRing.visible = false;
      }
    },
    dispose() {
      cancelAnimationFrame(animId);
      freeCam.dispose();
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      if (ghostMesh) {
        ghostMesh.geometry.dispose();
        ghostMat?.map?.dispose();
        ghostMat?.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}
