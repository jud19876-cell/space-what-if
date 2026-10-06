import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SpaghettiState {
  distance: number; // 0 (사건의 지평선) ~ 100 (안전 구역)
  stretch: number; // 늘어남 비율 (1.0x ~ 25x)
  timeDilation: number; // 시간 흐름 속도 (1.0x ~ 0.0x)
  redshiftColor: string; // 현재 적색편이 색상 (hex)
  stage: 1 | 2 | 3 | 4 | 5; // 1: 안전, 2: 중력 시작, 3: 스파게티화, 4: 시간의 지평선, 5: 웜홀 워프
  stageTitle: string;
  stageDesc: string;
  astronautClock: number; // 우주비행사의 경과 시간 (초)
  earthClock: number; // 지구 본부 경과 시간 (초)
  isWarpping: boolean;
}

export type CameraView = 'overview' | 'astronaut' | 'blackhole';

export interface BlackHoleAstronautScene {
  setDistance(dist: number): void;
  setPlaying(play: boolean): void;
  setSpeed(speed: number): void;
  setCameraView(view: CameraView): void;
  setNoodleMode(enabled: boolean): void; // 재미있는 진짜 국수 파스타 모드
  reset(): void;
  getState(): SpaghettiState;
  onStateUpdate?: (state: SpaghettiState) => void;
  dispose(): void;
}

// Web Audio API 효과음 합성기
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

export function playStretchSound(factor: number) {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // 띠요오오옹 스프링 느낌
  osc.type = 'sawtooth';
  const startFreq = 180 + Math.min(factor * 20, 400);
  const endFreq = Math.max(60, startFreq - 100);
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.25);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function playWarpSound() {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  osc1.frequency.setValueAtTime(200, now);
  osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);
  osc2.frequency.setValueAtTime(400, now);
  osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.4);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.52);
  osc2.stop(now + 0.52);
}

export function createBlackHoleAstronautScene(
  container: HTMLDivElement,
  onUpdate?: (state: SpaghettiState) => void,
): BlackHoleAstronautScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040c);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 22, 60);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 200;

  // 조명
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(30, 40, 20);
  scene.add(dirLight);

  const blackholeGlow = new THREE.PointLight(0xff7722, 3.5, 90, 1.2);
  scene.add(blackholeGlow);

  // 1. 별빛 우주 배경
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1800;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 200 + Math.random() * 250;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);

    const hue = Math.random();
    const c = new THREE.Color().setHSL(hue > 0.8 ? 0.6 : hue > 0.6 ? 0.12 : 0.85, 0.7, 0.85);
    starColors[i * 3] = c.r;
    starColors[i * 3 + 1] = c.g;
    starColors[i * 3 + 2] = c.b;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.6, vertexColors: true, transparent: true, opacity: 0.85 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // 2. 블랙홀 모델
  // (1) 사건의 지평선 (완전한 칠흑의 구체, 반지름 = 8)
  const HORIZON_R = 7.5;
  const horizonGeo = new THREE.SphereGeometry(HORIZON_R, 64, 48);
  const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eventHorizon = new THREE.Mesh(horizonGeo, horizonMat);
  scene.add(eventHorizon);

  // (2) 광자구 (Photon Sphere) - 얇은 백색/청색 빛 링
  const photonSphereRadius = HORIZON_R * 1.5;
  const photonSphereGeo = new THREE.RingGeometry(photonSphereRadius - 0.2, photonSphereRadius + 0.2, 96);
  const photonSphereMat = new THREE.MeshBasicMaterial({
    color: 0x88ccff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
  });
  const photonSphere = new THREE.Mesh(photonSphereGeo, photonSphereMat);
  photonSphere.rotation.x = Math.PI / 2;
  scene.add(photonSphere);

  // (3) 찬란한 강착원반 (Accretion Disk) - 2중 레이어
  const diskInner = HORIZON_R * 1.55;
  const diskOuter = HORIZON_R * 4.6;
  const diskGeo = new THREE.RingGeometry(diskInner, diskOuter, 96, 8);
  const diskMat = new THREE.MeshBasicMaterial({
    color: 0xff6611,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
  });
  const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
  accretionDisk.rotation.x = Math.PI / 2.2;
  scene.add(accretionDisk);

  // 강착원반 소용돌이 파티클
  const diskParticleCount = 900;
  const diskPartPos = new Float32Array(diskParticleCount * 3);
  const diskPartColors = new Float32Array(diskParticleCount * 3);
  const diskPartAngles: number[] = [];
  const diskPartRadii: number[] = [];
  const diskPartSpeeds: number[] = [];

  for (let i = 0; i < diskParticleCount; i++) {
    const r = diskInner + Math.random() * (diskOuter - diskInner);
    const a = Math.random() * Math.PI * 2;
    diskPartRadii.push(r);
    diskPartAngles.push(a);
    diskPartSpeeds.push((0.8 + Math.random() * 0.6) / Math.sqrt(r));

    diskPartPos[i * 3] = Math.cos(a) * r;
    diskPartPos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
    diskPartPos[i * 3 + 2] = Math.sin(a) * r;

    const col = new THREE.Color().setHSL(0.08 + Math.random() * 0.08, 1.0, 0.65);
    diskPartColors[i * 3] = col.r;
    diskPartColors[i * 3 + 1] = col.g;
    diskPartColors[i * 3 + 2] = col.b;
  }
  const diskPartGeo = new THREE.BufferGeometry();
  diskPartGeo.setAttribute('position', new THREE.BufferAttribute(diskPartPos, 3));
  diskPartGeo.setAttribute('color', new THREE.BufferAttribute(diskPartColors, 3));
  const diskPartMat = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const diskParticles = new THREE.Points(diskPartGeo, diskPartMat);
  diskParticles.rotation.x = accretionDisk.rotation.x;
  scene.add(diskParticles);

  // (4) 중력 렌즈 효과 후광 (Halo Ring)
  const haloGeo = new THREE.RingGeometry(HORIZON_R * 1.05, HORIZON_R * 2.4, 64);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffaa44,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  scene.add(halo);

  // 3. 우주비행사 캐릭터 3D 모델 그룹
  const astronautGroup = new THREE.Group();
  scene.add(astronautGroup);

  // 우주비행사 파트별 메시 구성
  // (스파게티화 변형 시 전체 그룹 및 부위별 정밀 스케일링/변형을 적용)
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0xff8800,
    emissiveIntensity: 0.25,
  });

  const packMat = new THREE.MeshStandardMaterial({
    color: 0x334466,
    roughness: 0.5,
  });

  // 머리 헬멧
  const headGeo = new THREE.SphereGeometry(1.2, 32, 24);
  const head = new THREE.Mesh(headGeo, suitMat);
  head.position.y = 2.4;
  astronautGroup.add(head);

  // 바이저 (반사면)
  const visorGeo = new THREE.SphereGeometry(0.85, 24, 16, 0, Math.PI);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.rotation.y = Math.PI / 2;
  visor.position.set(0.4, 2.4, 0);
  astronautGroup.add(visor);

  // 귀여운 헬멧 눈동자 (스파게티화에 따라 커짐!)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
  eyeL.position.set(1.1, 2.5, 0.35);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
  eyeR.position.set(1.1, 2.5, -0.35);
  astronautGroup.add(eyeL);
  astronautGroup.add(eyeR);

  // 몸통 (Torso)
  const bodyGeo = new THREE.CylinderGeometry(0.9, 1.0, 2.2, 24);
  const body = new THREE.Mesh(bodyGeo, suitMat);
  body.position.y = 0.8;
  astronautGroup.add(body);

  // 생명 유지 배낭 (Backpack)
  const packGeo = new THREE.BoxGeometry(0.9, 1.8, 1.4);
  const backpack = new THREE.Mesh(packGeo, packMat);
  backpack.position.set(-1.0, 0.9, 0);
  astronautGroup.add(backpack);

  // 팔 2개
  const armGeo = new THREE.CylinderGeometry(0.32, 0.35, 1.8, 16);
  const armL = new THREE.Mesh(armGeo, suitMat);
  armL.position.set(0, 1.1, 1.5);
  armL.rotation.x = 0.3;
  armL.rotation.z = -0.3;
  const armR = new THREE.Mesh(armGeo, suitMat);
  armR.position.set(0, 1.1, -1.5);
  armR.rotation.x = -0.3;
  armR.rotation.z = -0.3;
  astronautGroup.add(armL);
  astronautGroup.add(armR);

  // 다리 2개 (발이 블랙홀 쪽으로 먼저 당겨지는 핵심 부위!)
  const legGeo = new THREE.CylinderGeometry(0.38, 0.42, 2.2, 16);
  const legL = new THREE.Mesh(legGeo, suitMat);
  legL.position.set(0, -1.2, 0.6);
  const legR = new THREE.Mesh(legGeo, suitMat);
  legR.position.set(0, -1.2, -0.6);
  astronautGroup.add(legL);
  astronautGroup.add(legR);

  // 진짜 국수가락 스파게티 모드용 메쉬 (면발 + 미트볼)
  const noodleGroup = new THREE.Group();
  noodleGroup.visible = false;
  scene.add(noodleGroup);

  const noodleCount = 12;
  const noodleLines: THREE.Line[] = [];
  const noodleMat = new THREE.LineBasicMaterial({ color: 0xffd152, linewidth: 3 });
  for (let n = 0; n < noodleCount; n++) {
    const pts: THREE.Vector3[] = [];
    for (let p = 0; p <= 32; p++) {
      pts.push(new THREE.Vector3(0, 0, 0));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lineGeo, noodleMat);
    noodleLines.push(line);
    noodleGroup.add(line);
  }
  // 미트볼 3개
  const meatballMat = new THREE.MeshStandardMaterial({ color: 0x8b3a1a, roughness: 0.8 });
  const meatballs: THREE.Mesh[] = [];
  for (let m = 0; m < 3; m++) {
    const mb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), meatballMat);
    meatballs.push(mb);
    noodleGroup.add(mb);
  }

  // 4. 무지개 웜홀 워프 터널 (사건의 지평선 돌파 시 축제 연출!)
  const warpTunnelGroup = new THREE.Group();
  warpTunnelGroup.visible = false;
  scene.add(warpTunnelGroup);

  const warpCount = 600;
  const warpPos = new Float32Array(warpCount * 3);
  const warpCols = new Float32Array(warpCount * 3);
  for (let i = 0; i < warpCount; i++) {
    const r = 2 + Math.random() * 18;
    const ang = Math.random() * Math.PI * 2;
    const z = (Math.random() - 0.5) * 80;
    warpPos[i * 3] = Math.cos(ang) * r;
    warpPos[i * 3 + 1] = Math.sin(ang) * r;
    warpPos[i * 3 + 2] = z;

    const col = new THREE.Color().setHSL((i / warpCount + 0.5) % 1, 1, 0.7);
    warpCols[i * 3] = col.r;
    warpCols[i * 3 + 1] = col.g;
    warpCols[i * 3 + 2] = col.b;
  }
  const warpGeo = new THREE.BufferGeometry();
  warpGeo.setAttribute('position', new THREE.BufferAttribute(warpPos, 3));
  warpGeo.setAttribute('color', new THREE.BufferAttribute(warpCols, 3));
  const warpPoints = new THREE.Points(
    warpGeo,
    new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
  );
  warpTunnelGroup.add(warpPoints);

  // 5. 시뮬레이션 상태 변수
  let currentDist = 80; // 0 (지평선) ~ 100 (안전 구역)
  let isPlaying = false;
  let animSpeed = 1.0;
  let cameraMode: CameraView = 'overview';
  let noodleMode = false;
  let earthClock = 0;
  let astronautClock = 0;
  let lastTime = performance.now();
  let lastSoundStretch = 1;

  // 단계 계산 함수
  function calculateSpaghetti(dist: number): SpaghettiState {
    // dist: 100 = 가장 멈(안전), 0 = 사건의 지평선 돌파
    // 물리 반지름 R_s = 7.5
    // 실제 거리 좌표 x = HORIZON_R + (dist / 100) * 45
    const actualR = HORIZON_R + (dist / 100) * 42;

    // 조석력에 의한 스파게티화 스트레치 계산
    // 거리가 가까워질수록 국수가락처럼 급격히 늘어남 (1.0x -> 최대 26x)
    const delta = Math.max(0.1, actualR - HORIZON_R);
    const stretch = Math.min(26, Math.max(1.0, 1.0 + Math.pow(HORIZON_R / (delta + 1.2), 2.2) * 2.8));

    // 일반 상대성 이론 시간 팽창 factor (1.0 -> 0.0)
    const timeFactor = Math.max(0, Math.min(1.0, Math.sqrt(Math.max(0, 1.0 - (HORIZON_R / actualR)))));

    // 중력 적색편이 컬러 (흰색 -> 노랑 -> 주황 -> 핏빛 붉은색 -> 칠흑)
    let colorHex = '#ffffff';
    if (dist < 10) colorHex = '#991122';
    else if (dist < 25) colorHex = '#ee3322';
    else if (dist < 45) colorHex = '#ff7711';
    else if (dist < 70) colorHex = '#ffcc33';

    let stage: 1 | 2 | 3 | 4 | 5 = 1;
    let stageTitle = '안전 구역 (10,000 km)';
    let stageDesc = '우주비행사가 둥둥 떠 있어요! 아직은 중력이 약해서 몸도 정상이고 시간도 똑같이 흘러요. 😊';

    if (dist <= 0) {
      stage = 5;
      stageTitle = '사건의 지평선 돌파! 웜홀 차원 워프';
      stageDesc = '빛도 못 빠져나오는 경계를 넘었어요! 반대편 신비로운 무지개 우주 차원으로 뿅~! 🎉✨';
    } else if (dist <= 15) {
      stage = 4;
      stageTitle = '시간의 지평선 (빛의 고리 광자구)';
      stageDesc = '시계가 거의 멈췄어요! 밖에서 보면 우주비행사가 빨갛게 얼어붙은 것처럼 보여요. ⏰😱';
    } else if (dist <= 40) {
      stage = 3;
      stageTitle = '스파게티 현상 (조석력 극대화!)';
      stageDesc = '머리보다 발에 걸리는 중력이 엄청나게 세서 몸이 치즈나 국수가락처럼 쭈우욱 길어져요! 🍝😵‍💫';
    } else if (dist <= 70) {
      stage = 2;
      stageTitle = '중력의 손길 시작';
      stageDesc = '블랙홀의 거대한 중력이 느껴져요! 발끝이 살짝 당겨지며 시계가 천천히 가기 시작해요. 😮';
    }

    return {
      distance: dist,
      stretch,
      timeDilation: timeFactor,
      redshiftColor: colorHex,
      stage,
      stageTitle,
      stageDesc,
      astronautClock,
      earthClock,
      isWarpping: dist <= 0,
    };
  }

  function applyVisuals(s: SpaghettiState, time: number) {
    const actualR = HORIZON_R + (s.distance / 100) * 42;

    // 1. 우주비행사 위치 설정 (X축 기준 접근)
    // 약간의 궤도 경사 및 공전 회전
    const angle = time * 0.15;
    const posX = Math.cos(angle) * actualR;
    const posZ = Math.sin(angle) * actualR;
    const posY = 0;

    astronautGroup.position.set(posX, posY, posZ);
    // 항상 블랙홀 중심(0, 0, 0)을 향해 발이 당겨지도록 회전
    astronautGroup.lookAt(0, 0, 0);
    astronautGroup.rotateX(Math.PI / 2); // 발이 블랙홀 중심 방향

    // 2. 스파게티화 스케일 변형
    // 길이 축(Y)으로는 쭈욱 늘어나고, 둘레 축(X, Z)으로는 가늘어짐!
    const stretchY = s.stretch;
    const squashXZ = Math.max(0.18, 1 / Math.sqrt(s.stretch));

    if (!noodleMode) {
      astronautGroup.visible = s.distance > 0;
      noodleGroup.visible = false;

      astronautGroup.scale.set(squashXZ, stretchY, squashXZ);

      // 다리와 팔을 스파게티처럼 파도치게 와글와글 흔들기
      const wiggle = Math.sin(time * 6) * Math.min(s.stretch * 0.08, 0.6);
      legL.rotation.z = wiggle;
      legR.rotation.z = -wiggle;
      legL.scale.set(1, 1 + s.stretch * 0.15, 1);
      legR.scale.set(1, 1 + s.stretch * 0.15, 1);

      armL.rotation.x = 0.3 + wiggle * 2;
      armR.rotation.x = -0.3 - wiggle * 2;

      // 눈알 크기 변경 (놀람!)
      const eyeScale = Math.min(3.5, 1 + (s.stretch - 1) * 0.25);
      eyeL.scale.set(eyeScale, eyeScale, eyeScale);
      eyeR.scale.set(eyeScale, eyeScale, eyeScale);

      // 적색편이 컬러 적용
      const c = new THREE.Color(s.redshiftColor);
      suitMat.color.copy(c);
      suitMat.emissive.copy(c).multiplyScalar(0.2);
    } else {
      // 국수 파스타 모드!
      astronautGroup.visible = false;
      noodleGroup.visible = s.distance > 0;
      noodleGroup.position.copy(astronautGroup.position);
      noodleGroup.rotation.copy(astronautGroup.rotation);

      // 국수 선들 꿈틀꿈틀 업데이트
      noodleLines.forEach((line, idx) => {
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const pArr = posAttr.array as Float32Array;
        const offsetAng = (idx / noodleCount) * Math.PI * 2;
        const rad = 0.4 * squashXZ;

        for (let i = 0; i <= 32; i++) {
          const t = i / 32;
          const y = (t - 0.5) * 6 * stretchY;
          const curl = Math.sin(time * 8 + t * 6 + idx) * 0.8 * squashXZ;
          const px = Math.cos(offsetAng + t * 4) * rad + curl;
          const pz = Math.sin(offsetAng + t * 4) * rad;

          pArr[i * 3] = px;
          pArr[i * 3 + 1] = y;
          pArr[i * 3 + 2] = pz;
        }
        posAttr.needsUpdate = true;
      });

      // 미트볼 위치 업데이트
      meatballs.forEach((mb, idx) => {
        const yPos = (idx - 1) * 2.5 * stretchY * 0.4;
        mb.position.set(Math.sin(time * 3 + idx) * 0.5, yPos, Math.cos(time * 3 + idx) * 0.5);
      });
    }

    // 3. 지평선 돌파 시 무지개 웜홀 터널 활성화
    if (s.distance <= 0) {
      warpTunnelGroup.visible = true;
      warpTunnelGroup.rotation.z += 0.04;
      warpPoints.position.z = (warpPoints.position.z + 1.2) % 40;
    } else {
      warpTunnelGroup.visible = false;
    }

    // 4. 강착원반 & 파티클 회전
    accretionDisk.rotation.z += 0.008;
    const pArr = diskPartGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < diskParticleCount; i++) {
      diskPartAngles[i] += diskPartSpeeds[i] * 0.02;
      const r = diskPartRadii[i];
      const a = diskPartAngles[i];
      pArr[i * 3] = Math.cos(a) * r;
      pArr[i * 3 + 2] = Math.sin(a) * r;
    }
    diskPartGeo.attributes.position.needsUpdate = true;

    // 5. 카메라 뷰 모드 처리
    if (cameraMode === 'astronaut') {
      // 우주비행사 밀착 시점
      const camTarget = astronautGroup.position.clone();
      const camPos = camTarget.clone().add(new THREE.Vector3(0, 4, 9));
      camera.position.lerp(camPos, 0.08);
      controls.target.lerp(camTarget, 0.08);
    } else if (cameraMode === 'blackhole') {
      // 블랙홀 중심에서 빨려들어오는 우주비행사를 올려다보는 시점
      camera.position.lerp(new THREE.Vector3(0, 2, 0), 0.06);
      controls.target.lerp(astronautGroup.position, 0.08);
    } else {
      // 전체 조망 뷰
      controls.target.set(0, 0, 0);
    }

    // 사운드 트리거 (스파게티 늘어남이 크게 변할 때)
    if (Math.abs(s.stretch - lastSoundStretch) > 2.5) {
      playStretchSound(s.stretch);
      lastSoundStretch = s.stretch;
    }
  }

  // 렌더 루프
  let animId = 0;
  function animate(now: number) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (isPlaying) {
      // 거리 감소 (안전 -> 블랙홀 낙하)
      currentDist = Math.max(0, currentDist - dt * 6.5 * animSpeed);

      // 지구 시계는 정상 속도로 흐름
      earthClock += dt * animSpeed;

      // 우주비행사의 시계는 시간 팽창에 따라 느려짐!
      const curState = calculateSpaghetti(currentDist);
      astronautClock += dt * animSpeed * curState.timeDilation;

      if (currentDist <= 0) {
        // 지평선 돌파 워프 도달 시 사운드
        playWarpSound();
        isPlaying = false;
      }
    }

    const curState = calculateSpaghetti(currentDist);
    curState.astronautClock = astronautClock;
    curState.earthClock = earthClock;

    applyVisuals(curState, now * 0.001);
    controls.update();
    renderer.render(scene, camera);

    onUpdate?.(curState);
  }

  animId = requestAnimationFrame(animate);

  const onResize = () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  return {
    setDistance(dist: number) {
      currentDist = Math.max(0, Math.min(100, dist));
    },
    setPlaying(play: boolean) {
      isPlaying = play;
      if (play && currentDist <= 0) {
        currentDist = 100;
        astronautClock = 0;
        earthClock = 0;
      }
    },
    setSpeed(speed: number) {
      animSpeed = speed;
    },
    setCameraView(view: CameraView) {
      cameraMode = view;
      if (view === 'overview') {
        camera.position.set(0, 22, 60);
        controls.target.set(0, 0, 0);
      }
    },
    setNoodleMode(enabled: boolean) {
      noodleMode = enabled;
    },
    reset() {
      currentDist = 80;
      isPlaying = false;
      astronautClock = 0;
      earthClock = 0;
      lastSoundStretch = 1;
      camera.position.set(0, 22, 60);
      controls.target.set(0, 0, 0);
    },
    getState() {
      const s = calculateSpaghetti(currentDist);
      s.astronautClock = astronautClock;
      s.earthClock = earthClock;
      return s;
    },
    dispose() {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}
