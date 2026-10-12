import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ScaleLevel {
  id: number;
  key: string;
  emoji: string;
  name: string;
  subtitle: string;
  realSize: string;
  meters: number;
  lightTime: string;
  ratioFromPrev: string;
  ratioFromSeoul: string;
  analogy: string;
  description: string;
  color: string;
}

export const SCALE_LEVELS: ScaleLevel[] = [
  {
    id: 0,
    key: 'seoul',
    emoji: '🏙️',
    name: '1단계: 대한민국 서울 도심',
    subtitle: 'Seoul Metropolitan Area',
    realSize: '직경 10 km (10,000 m)',
    meters: 1e4,
    lightTime: '0.000033초 (33 µs)',
    ratioFromPrev: '기준점 (1x)',
    ratioFromSeoul: '1배 (기준점)',
    analogy: '천만 명의 인류가 생활하는 한강과 남산의 거대 메트로폴리스',
    description: '대한민국의 심장 서울입니다. 한강 줄기와 N서울타워, 수많은 고층 빌딩이 밀집해 있으나, 광활한 우주의 척도로는 먼지 하나의 원자보다 작은 영역입니다.',
    color: '#38bdf8',
  },
  {
    id: 1,
    key: 'earth',
    emoji: '🌍',
    name: '2단계: 행성 지구',
    subtitle: 'Planet Earth',
    realSize: '직경 12,742 km',
    meters: 1.2742e7,
    lightTime: '0.0425초 (빛이 1초에 7.5바퀴)',
    ratioFromPrev: '서울의 약 1,274배',
    ratioFromSeoul: '1,274배',
    analogy: '서울(10 km)은 지구 표면의 0.08%에 불과한 미세한 한 점',
    description: '인류가 살아가는 유일한 푸른 요람입니다. 지구 표면 한구석에 깜빡이는 붉은 점이 바로 방금 우리가 서 있던 서울 도심 전체입니다.',
    color: '#22c55e',
  },
  {
    id: 2,
    key: 'solarsystem',
    emoji: '☀️',
    name: '3단계: 태양계 전체 (카이퍼 벨트)',
    subtitle: 'Solar System Planetary Disk',
    realSize: '직경 100 AU (약 150억 km)',
    meters: 1.496e13,
    lightTime: '약 13.9시간',
    ratioFromPrev: '지구의 약 1,174,000배 (117만 배)',
    ratioFromSeoul: '약 15억 배',
    analogy: '태양계가 축구장(100m)이라면 지구는 0.08mm의 미세 먼지',
    description: '태양의 중력이 지배하는 8대 행성과 카이퍼 벨트 소행성대입니다. 지구(1 AU)조차 태양 바로 옆을 도는 작은 점으로 축소되며 서울은 완전히 시야에서 사라집니다.',
    color: '#eab308',
  },
  {
    id: 3,
    key: 'milkyway',
    emoji: '🌌',
    name: '4단계: 우리은하 (은하수)',
    subtitle: 'Milky Way Galaxy',
    realSize: '직경 100,000 광년 (약 9.5×10¹⁷ km)',
    meters: 9.46e20,
    lightTime: '100,000년 (10만 년)',
    ratioFromPrev: '태양계의 약 63,240,000배 (6,324만 배)',
    ratioFromSeoul: '약 10¹⁷ 배',
    analogy: '우리은하가 한반도 크기라면 태양계 전체는 모래알 1톨',
    description: '2,000억~4,000억 개의 별이 소용돌이치는 장엄한 나선은하입니다. 방금 보았던 거대한 태양계(150억 km) 전체가 오리온자리 나선팔의 반짝이는 핀 하나에 불과합니다.',
    color: '#a855f7',
  },
  {
    id: 4,
    key: 'localgroup',
    emoji: '🌀',
    name: '5단계: 국부은하군',
    subtitle: 'Local Group of Galaxies',
    realSize: '직경 10,000,000 광년 (1천만 광년)',
    meters: 9.46e22,
    lightTime: '10,000,000년 (1,000만 년)',
    ratioFromPrev: '우리은하의 약 100배',
    ratioFromSeoul: '약 10¹⁹ 배',
    analogy: '우리은하와 안드로메다(M31), 삼각형자리 은하가 모인 은하 가족',
    description: '우리은하를 포함하여 안드로메다, 삼각형자리, 마젤란 은하 등 50여 개 은하들이 중력으로 묶인 은하 군집입니다. 거대 은하들조차 우주 바다에 뜬 섬들처럼 보입니다.',
    color: '#ec4899',
  },
  {
    id: 5,
    key: 'universe',
    emoji: '🕸️',
    name: '6단계: 관측 가능한 전체 우주',
    subtitle: 'Observable Universe & Cosmic Web',
    realSize: '직경 93,000,000,000 광년 (930억 광년)',
    meters: 8.8e26,
    lightTime: '930억 년',
    ratioFromPrev: '국부은하군의 약 9,300배 (우리은하의 93만 배)',
    ratioFromSeoul: '약 10²³ 배 (1,000해 배!)',
    analogy: '서울에서 출발해 10²³배(100,000,000,000,000,000,000,000배) 확장된 궁극의 시공간',
    description: '빅뱅 이후 빛이 도달할 수 있는 2조 개 이상의 은하와 초은하단이 거미줄처럼 얽힌 거대 우주망(Cosmic Web)입니다. 우주 배경 복사(CMB) 구체가 인간 인식의 지평선을 감싸고 있습니다.',
    color: '#6366f1',
  },
];

interface CosmicScaleViewerProps {
  onBackToGalaxyLab: () => void;
}

export default function CosmicScaleViewer({ onBackToGalaxyLab }: CosmicScaleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [autoDirection, setAutoDirection] = useState<'zoomOut' | 'zoomIn'>('zoomOut');
  const [sliderVal, setSliderVal] = useState<number>(0);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Scale object groups
  const levelGroupsRef = useRef<THREE.Group[]>([]);
  const targetCamDistRef = useRef<number>(20);
  const currentCamDistRef = useRef<number>(20);
  const pingMeshesRef = useRef<THREE.Mesh[]>([]);

  // 1. Three.js 초기화 및 6단계 3D 오브젝트 구축
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040b);
    scene.fog = new THREE.FogExp2(0x02040b, 0.0012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000);
    camera.position.set(0, 14, 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 2500;
    controls.minDistance = 2;
    controlsRef.current = controls;

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff8ee, 2.2);
    dirLight.position.set(40, 60, 40);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 1.8, 120);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // 심우주 배경 별빛
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3500;
    const starPos = new Float32Array(starCount * 3);
    const starCols = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 900 + Math.random() * 400;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);

      const colorMix = Math.random();
      starCols[i * 3] = 0.6 + colorMix * 0.4;
      starCols[i * 3 + 1] = 0.7 + (1 - colorMix) * 0.3;
      starCols[i * 3 + 2] = 1.0;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: false,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const levelGroups: THREE.Group[] = [];
    const pings: THREE.Mesh[] = [];

    // ==========================================
    // 0단계: 서울 도심 (10 km) 3D 구축
    // ==========================================
    const g0 = new THREE.Group();
    // 그리드 대지 (직경 10km 원형 디스크)
    const diskGeo = new THREE.CylinderGeometry(8, 8, 0.2, 48);
    const diskMat = new THREE.MeshStandardMaterial({
      color: 0x091428,
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x0284c7,
      emissiveIntensity: 0.12,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.position.y = -0.1;
    g0.add(disk);

    // 원형 네온 테두리 (10km 반경 링)
    const ringGeo = new THREE.RingGeometry(7.9, 8.1, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g0.add(ring);

    // 한강 (푸른 리본 곡선)
    const riverPoints = [
      new THREE.Vector3(-7.5, 0.05, 2.0),
      new THREE.Vector3(-4.0, 0.05, 0.5),
      new THREE.Vector3(-1.0, 0.05, 1.8),
      new THREE.Vector3(2.5, 0.05, 0.8),
      new THREE.Vector3(5.5, 0.05, -1.2),
      new THREE.Vector3(7.5, 0.05, -2.5),
    ];
    const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
    const riverGeo = new THREE.TubeGeometry(riverCurve, 40, 0.45, 8, false);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    g0.add(new THREE.Mesh(riverGeo, riverMat));

    // N서울타워 & 남산
    const namsanGeo = new THREE.ConeGeometry(2.2, 1.5, 16);
    const namsanMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 });
    const namsan = new THREE.Mesh(namsanGeo, namsanMat);
    namsan.position.set(-0.5, 0.75, -0.6);
    g0.add(namsan);

    // 타워 기둥 및 전망대
    const towerGeo = new THREE.CylinderGeometry(0.08, 0.14, 2.2, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, metalness: 0.8 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-0.5, 2.3, -0.6);
    g0.add(tower);

    const deckGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    const deckMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(-0.5, 2.5, -0.6);
    g0.add(deck);

    // 도심 빌딩 그리드 블록 (강남, 여의도, 종로)
    const buildingGeo = new THREE.BoxGeometry(0.35, 1.0, 0.35);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 });
    const buildingInst = new THREE.InstancedMesh(buildingGeo, buildingMat, 120);
    const dummy = new THREE.Object3D();
    let bIdx = 0;
    for (let x = -6; x <= 6; x += 1.2) {
      for (let z = -6; z <= 6; z += 1.2) {
        if (Math.hypot(x, z) < 6.8 && Math.hypot(x + 0.5, z + 0.6) > 2.0) {
          const height = 0.5 + Math.random() * 1.6;
          dummy.position.set(x + (Math.random() - 0.5) * 0.4, height / 2, z + (Math.random() - 0.5) * 0.4);
          dummy.scale.set(0.8 + Math.random() * 0.6, height, 0.8 + Math.random() * 0.6);
          dummy.updateMatrix();
          buildingInst.setMatrixAt(bIdx++, dummy.matrix);
        }
      }
    }
    buildingInst.instanceMatrix.needsUpdate = true;
    g0.add(buildingInst);

    levelGroups.push(g0);
    scene.add(g0);

    // ==========================================
    // 1단계: 지구 (12,742 km) 3D 구축
    // ==========================================
    const g1 = new THREE.Group();
    // 지구 구체
    const earthGeo = new THREE.SphereGeometry(6.5, 48, 48);
    // 절차적 대륙/해양 캔버스 텍스처
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 512;
    earthCanvas.height = 256;
    const eg = earthCanvas.getContext('2d')!;
    eg.fillStyle = '#1e3a8a'; // 깊은 대양
    eg.fillRect(0, 0, 512, 256);
    // 아시아, 한반도, 유라시아 대륙 윤곽
    eg.fillStyle = '#15803d'; // 녹색 대륙
    eg.beginPath();
    eg.ellipse(320, 100, 90, 50, 0, 0, Math.PI * 2);
    eg.fill();
    eg.beginPath();
    eg.ellipse(360, 95, 25, 35, 0.2, 0, Math.PI * 2); // 한반도/동아시아
    eg.fillStyle = '#22c55e';
    eg.fill();
    eg.beginPath();
    eg.ellipse(140, 110, 60, 45, 0.3, 0, Math.PI * 2); // 아메리카
    eg.fill();
    // 구름 층
    eg.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let c = 0; c < 20; c++) {
      eg.beginPath();
      eg.arc(Math.random() * 512, Math.random() * 256, 15 + Math.random() * 30, 0, Math.PI * 2);
      eg.fill();
    }
    const earthTex = new THREE.CanvasTexture(earthCanvas);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.5,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.y = 1.1;
    earthMesh.rotation.z = (23.5 * Math.PI) / 180; // 자전축 기울기
    g1.add(earthMesh);

    // 대기층 헤일로
    const atmoGeo = new THREE.SphereGeometry(6.65, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    g1.add(new THREE.Mesh(atmoGeo, atmoMat));

    // 서울 위치 핑 (Earth 표면 한반도 위 펄스 링)
    const seoulPingGeo = new THREE.RingGeometry(0.12, 0.28, 24);
    const seoulPingMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, side: THREE.DoubleSide });
    const seoulPing = new THREE.Mesh(seoulPingGeo, seoulPingMat);
    // 한반도 위치 좌표
    seoulPing.position.set(3.4, 4.3, 3.4);
    seoulPing.lookAt(0, 0, 0);
    g1.add(seoulPing);
    pings.push(seoulPing);

    g1.visible = false;
    levelGroups.push(g1);
    scene.add(g1);

    // ==========================================
    // 2단계: 태양계 전체 (100 AU) 3D 구축
    // ==========================================
    const g2 = new THREE.Group();
    // 중심 태양
    const sunGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    g2.add(sunMesh);

    // 태양 코로나 글로우
    const coronaGeo = new THREE.SphereGeometry(2.4, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35 });
    g2.add(new THREE.Mesh(coronaGeo, coronaMat));

    // 8대 행성 궤도 링 및 행성들
    const orbits = [
      { name: '수성', r: 3.2, col: '#94a3b8', size: 0.15 },
      { name: '금성', r: 4.8, col: '#fde047', size: 0.25 },
      { name: '지구', r: 6.8, col: '#38bdf8', size: 0.28, isEarth: true },
      { name: '화성', r: 9.0, col: '#f87171', size: 0.22 },
      { name: '목성', r: 13.5, col: '#fb923c', size: 0.65 },
      { name: '토성', r: 18.0, col: '#fcd34d', size: 0.55 },
      { name: '천왕성', r: 23.0, col: '#67e8f9', size: 0.42 },
      { name: '해왕성', r: 27.5, col: '#60a5fa', size: 0.4 },
    ];
    orbits.forEach((orb) => {
      const oRingGeo = new THREE.RingGeometry(orb.r - 0.05, orb.r + 0.05, 64);
      const oRingMat = new THREE.MeshBasicMaterial({
        color: orb.isEarth ? 0x38bdf8 : 0x475569,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: orb.isEarth ? 0.9 : 0.4,
      });
      const oRing = new THREE.Mesh(oRingGeo, oRingMat);
      oRing.rotation.x = Math.PI / 2;
      g2.add(oRing);

      // 행성 구체
      const pGeo = new THREE.SphereGeometry(orb.size, 16, 16);
      const pMat = new THREE.MeshBasicMaterial({ color: orb.col });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(Math.cos(orb.r * 1.3) * orb.r, 0, Math.sin(orb.r * 1.3) * orb.r);
      g2.add(pMesh);

      if (orb.isEarth) {
        // 지구 위치 펄스 핑
        const earthPingGeo = new THREE.RingGeometry(0.4, 0.75, 24);
        const earthPingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
        const earthPing = new THREE.Mesh(earthPingGeo, earthPingMat);
        earthPing.rotation.x = Math.PI / 2;
        earthPing.position.copy(pMesh.position);
        g2.add(earthPing);
        pings.push(earthPing);
      }
    });

    // 카이퍼 벨트 (외곽 소행성 헤일로 30~35 단위)
    const kbGeo = new THREE.RingGeometry(29.0, 36.0, 64);
    const kbMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
    });
    const kbMesh = new THREE.Mesh(kbGeo, kbMat);
    kbMesh.rotation.x = Math.PI / 2;
    g2.add(kbMesh);

    g2.visible = false;
    levelGroups.push(g2);
    scene.add(g2);

    // ==========================================
    // 3단계: 우리은하 (100,000 광년) 3D 구축
    // ==========================================
    const g3 = new THREE.Group();
    // 중심핵 궁수자리 A* 팽대부
    const mwCoreGeo = new THREE.SphereGeometry(2.2, 32, 32);
    const mwCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
    g3.add(new THREE.Mesh(mwCoreGeo, mwCoreMat));

    // 나선팔 파티클 (수만 개의 별가루)
    const mwStarGeo = new THREE.BufferGeometry();
    const mwStarCount = 14000;
    const mwPos = new Float32Array(mwStarCount * 3);
    const mwCol = new Float32Array(mwStarCount * 3);

    for (let i = 0; i < mwStarCount; i++) {
      const arm = i % 2;
      const distRatio = Math.pow(Math.random(), 0.65);
      const r = 2.0 + distRatio * 32.0;
      const theta = arm * Math.PI + Math.log(r / 2.0) * 3.8 + (Math.random() - 0.5) * 0.45;
      const z = (Math.random() - 0.5) * (1.2 + (r / 32.0) * 1.5);

      mwPos[i * 3] = Math.cos(theta) * r;
      mwPos[i * 3 + 1] = z;
      mwPos[i * 3 + 2] = Math.sin(theta) * r;

      if (r < 7.0) {
        mwCol[i * 3] = 1.0;
        mwCol[i * 3 + 1] = 0.9;
        mwCol[i * 3 + 2] = 0.6; // 중심 팽대부 노란빛
      } else {
        mwCol[i * 3] = 0.35 + Math.random() * 0.4;
        mwCol[i * 3 + 1] = 0.7 + Math.random() * 0.3;
        mwCol[i * 3 + 2] = 1.0; // 나선팔 청백색
      }
    }
    mwStarGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
    mwStarGeo.setAttribute('color', new THREE.BufferAttribute(mwCol, 3));
    const mwStarMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    g3.add(new THREE.Points(mwStarGeo, mwStarMat));

    // 태양계 위치 펄스 핑 (오리온자리 팔 R=16.5)
    const solarPingGeo = new THREE.RingGeometry(0.6, 1.2, 24);
    const solarPingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    const solarPing = new THREE.Mesh(solarPingGeo, solarPingMat);
    solarPing.rotation.x = Math.PI / 2;
    const solarAngle = 1.2;
    const solarR = 16.5;
    solarPing.position.set(Math.cos(solarAngle) * solarR, 0.2, Math.sin(solarAngle) * solarR);
    g3.add(solarPing);
    pings.push(solarPing);

    g3.visible = false;
    levelGroups.push(g3);
    scene.add(g3);

    // ==========================================
    // 4단계: 국부은하군 (1,000만 광년) 3D 구축
    // ==========================================
    const g4 = new THREE.Group();
    // 1) 우리은하 (미니어처 나선)
    const mwMini = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 4.0, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true }),
    );
    mwMini.position.set(-8, 0, 0);
    g4.add(mwMini);

    // 2) 안드로메다 은하 (M31) - 더 거대한 나선
    const androMini = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xc084fc, wireframe: true }),
    );
    androMini.position.set(16, 4, -6);
    androMini.rotation.z = 0.4;
    g4.add(androMini);

    // 3) 삼각형자리 은하 (M33)
    const triMini = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf, wireframe: true }),
    );
    triMini.position.set(10, -8, 8);
    g4.add(triMini);

    // 4) 마젤란 은하들
    const lmc = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    lmc.position.set(-11, -2, 2);
    g4.add(lmc);

    // 은하 간 조석 필라멘트 선
    const filamentGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-8, 0, 0),
      new THREE.Vector3(16, 4, -6),
      new THREE.Vector3(10, -8, 8),
      new THREE.Vector3(-8, 0, 0),
    ]);
    const filamentMat = new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.3 });
    g4.add(new THREE.Line(filamentGeo, filamentMat));

    // 우리은하 위치 핑
    const mwGroupPing = new THREE.RingGeometry(1.2, 2.0, 24);
    const mwGroupPingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const mwGPing = new THREE.Mesh(mwGroupPing, mwGroupPingMat);
    mwGPing.rotation.x = Math.PI / 2;
    mwGPing.position.set(-8, 0.5, 0);
    g4.add(mwGPing);
    pings.push(mwGPing);

    g4.visible = false;
    levelGroups.push(g4);
    scene.add(g4);

    // ==========================================
    // 5단계: 관측 가능한 전체 우주 (930억 광년) 3D 구축
    // ==========================================
    const g5 = new THREE.Group();
    // 거대 우주망 (Cosmic Web 파티클 및 필라멘트)
    const webGeo = new THREE.BufferGeometry();
    const webCount = 18000;
    const webPos = new Float32Array(webCount * 3);
    const webCol = new Float32Array(webCount * 3);

    for (let i = 0; i < webCount; i++) {
      const u = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = Math.pow(u, 0.7) * 45;

      webPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      webPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      webPos[i * 3 + 2] = r * Math.cos(phi);

      const clusterMix = Math.random();
      webCol[i * 3] = 0.5 + clusterMix * 0.5;
      webCol[i * 3 + 1] = 0.6 + (1 - clusterMix) * 0.4;
      webCol[i * 3 + 2] = 1.0;
    }
    webGeo.setAttribute('position', new THREE.BufferAttribute(webPos, 3));
    webGeo.setAttribute('color', new THREE.BufferAttribute(webCol, 3));
    const webMat = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    g5.add(new THREE.Points(webGeo, webMat));

    // CMB 우주 배경 복사 외곽 구체 (930억 광년 지평선)
    const cmbGeo = new THREE.SphereGeometry(48, 36, 36);
    const cmbMat = new THREE.MeshBasicMaterial({
      color: 0x4338ca,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    g5.add(new THREE.Mesh(cmbGeo, cmbMat));

    // 중심부 국부은하군 위치 핑
    const univPing = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.8, 24),
      new THREE.MeshBasicMaterial({ color: 0xec4899, side: THREE.DoubleSide }),
    );
    univPing.rotation.x = Math.PI / 2;
    univPing.position.set(0, 0, 0);
    g5.add(univPing);
    pings.push(univPing);

    g5.visible = false;
    levelGroups.push(g5);
    scene.add(g5);

    levelGroupsRef.current = levelGroups;
    pingMeshesRef.current = pings;

    // 렌더 애니메이션 루프
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // 자전 및 애니메이션
      if (g0.visible) g0.rotation.y += 0.08 * delta;
      if (g1.visible) earthMesh.rotation.y += 0.15 * delta;
      if (g2.visible) g2.rotation.y += 0.05 * delta;
      if (g3.visible) g3.rotation.y += 0.06 * delta;
      if (g4.visible) g4.rotation.y += 0.04 * delta;
      if (g5.visible) g5.rotation.y += 0.02 * delta;

      // 펄스 핑 스케일 펄스
      pings.forEach((p, idx) => {
        const pulse = 1.0 + Math.sin(elapsed * 4 + idx) * 0.25;
        p.scale.set(pulse, pulse, pulse);
      });

      // 카메라 거리 부드러운 보간 (Lerp)
      const curDist = currentCamDistRef.current;
      const targetDist = targetCamDistRef.current;
      if (Math.abs(curDist - targetDist) > 0.05) {
        currentCamDistRef.current += (targetDist - curDist) * 0.08;
        const dir = camera.position.clone().normalize();
        camera.position.copy(dir.multiplyScalar(currentCamDistRef.current));
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []);

  // 레벨 전환 함수
  const switchLevel = (lvl: number) => {
    const clamped = Math.max(0, Math.min(5, lvl));
    setCurrentLevel(clamped);
    setSliderVal(clamped);

    levelGroupsRef.current.forEach((grp, idx) => {
      grp.visible = idx === clamped;
    });

    // 각 레벨별 최적 카메라 뷰 거리 설정
    const distMap = [18, 22, 45, 55, 60, 95];
    targetCamDistRef.current = distMap[clamped];
  };

  // 슬라이더 연속 드래그 처리
  const handleSliderChange = (val: number) => {
    setSliderVal(val);
    const intLvl = Math.round(val);
    if (intLvl !== currentLevel) {
      switchLevel(intLvl);
    }
  };

  // 자동 줌 투어 타이머
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentLevel((prev) => {
        let next = prev;
        if (autoDirection === 'zoomOut') {
          if (prev < 5) {
            next = prev + 1;
          } else {
            setAutoDirection('zoomIn');
            next = 4;
          }
        } else {
          if (prev > 0) {
            next = prev - 1;
          } else {
            setAutoDirection('zoomOut');
            next = 1;
          }
        }
        switchLevel(next);
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [isAutoPlaying, autoDirection]);

  const currentInfo = SCALE_LEVELS[currentLevel];

  return (
    <div className="cosmic-scale-root">
      {/* 3D WebGL 캔버스 */}
      <div ref={containerRef} className="cosmic-scale-canvas" />

      {/* 상단 헤더 & 모드 복귀 버튼 */}
      <header className="cosmic-scale-header">
        <div className="scale-header-left">
          <button className="btn btn-back-galaxy" onClick={onBackToGalaxyLab} title="은하 충돌 시뮬레이터로 복귀">
            <span>🌌</span>
            <strong>은하 연구소로 돌아가기</strong>
          </button>
          <div className="scale-title-group">
            <h1 className="scale-main-title">
              <span className="scale-title-icon">📐</span>
              우주 크기 비교 시뮬레이터 (Powers of Ten)
            </h1>
            <span className="scale-badge">지구 서울 10km ➔ 관측 가능한 전체 우주 930억 광년</span>
          </div>
        </div>

        {/* 자동 투어 재생 컨트롤 */}
        <div className="scale-tour-controls">
          <button
            className={`btn-tour-play ${isAutoPlaying ? 'active' : ''}`}
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            title="서울에서 전 우주까지 자동으로 줌아웃/줌인하며 크기를 비교하는 시네마틱 투어"
          >
            <span>{isAutoPlaying ? '⏸️ 자동 투어 일시정지' : '▶️ 10의 거듭제곱 연속 줌 투어'}</span>
          </button>
        </div>
      </header>

      {/* 중앙 하단: 6단계 스텝 버튼 바 */}
      <div className="scale-steps-bar">
        {SCALE_LEVELS.map((lvl) => (
          <button
            key={lvl.id}
            className={`scale-step-btn ${currentLevel === lvl.id ? 'active' : ''}`}
            onClick={() => {
              setIsAutoPlaying(false);
              switchLevel(lvl.id);
            }}
            style={{
              borderColor: currentLevel === lvl.id ? lvl.color : undefined,
              boxShadow: currentLevel === lvl.id ? `0 0 16px ${lvl.color}66` : undefined,
            }}
          >
            <span className="step-emoji">{lvl.emoji}</span>
            <span className="step-label">{lvl.name}</span>
          </button>
        ))}
      </div>

      {/* 하단 연속 슬라이더 바 */}
      <div className="scale-slider-container">
        <div className="scale-slider-labels">
          <span>🏙️ 서울 (10⁴ m)</span>
          <span>🌍 지구 (10⁷ m)</span>
          <span>☀️ 태양계 (10¹³ m)</span>
          <span>🌌 우리은하 (10²¹ m)</span>
          <span>🌀 국부은하군 (10²³ m)</span>
          <span>🕸️ 전체 우주 (10²⁶ m)</span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={sliderVal}
          onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          className="scale-range-slider"
        />
      </div>

      {/* 좌측 상세 인포그래픽 카드 */}
      <div className="scale-info-card">
        <div className="info-header" style={{ borderLeftColor: currentInfo.color }}>
          <span className="info-badge" style={{ backgroundColor: `${currentInfo.color}22`, color: currentInfo.color }}>
            {currentInfo.emoji} {currentInfo.name}
          </span>
          <h2 className="info-title">{currentInfo.subtitle}</h2>
        </div>

        <p className="info-desc">{currentInfo.description}</p>

        <div className="info-metrics-grid">
          <div className="metric-box">
            <span className="metric-label">실제 물리적 직경</span>
            <span className="metric-val" style={{ color: currentInfo.color }}>{currentInfo.realSize}</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">직전 단계 대비 배율</span>
            <span className="metric-val text-amber">{currentInfo.ratioFromPrev}</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">빛의 속도 횡단 시간</span>
            <span className="metric-val text-cyan">{currentInfo.lightTime}</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">서울(10 km) 대비 누적 배율</span>
            <span className="metric-val text-rose">{currentInfo.ratioFromSeoul}</span>
          </div>
        </div>

        <div className="info-analogy-box">
          <span className="analogy-icon">💡</span>
          <div className="analogy-text">
            <strong>직관적 비유:</strong> {currentInfo.analogy}
          </div>
        </div>
      </div>
    </div>
  );
}
