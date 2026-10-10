import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type ConstellationData, type StarData } from './constellationsData.ts';
import { generateGhostCanvas } from './constellationGhostArt.ts';

export type ConstellationViewMode = 'earth' | 'space3d' | 'top';

export interface ConstellationScene {
  setConstellation(constellation: ConstellationData): void;
  setViewMode(mode: ConstellationViewMode): void;
  resetView(): void;
  setShowArt(show: boolean): void;
  setShowGuides(show: boolean): void;
  setSelectedStar(starId: string | null): void;
  onSelectStar?: (star: StarData | null) => void;
  dispose(): void;
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
  // 거리 스케일 (30 광년 ~ 2600 광년)
  // 제곱근 스케일링으로 깊이감을 또렷하게 분별 가능하도록 변환
  const minLy = 30;
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
  controls.enablePan = true;
  controls.screenSpacePanning = true;

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

  // 1. 깊고 아름다운 우주 은하수 배경 별무리
  const bgStarsCount = 2000;
  const bgGeo = new THREE.BufferGeometry();
  const bgPos = new Float32Array(bgStarsCount * 3);
  const bgCols = new Float32Array(bgStarsCount * 3);
  for (let i = 0; i < bgStarsCount; i++) {
    const r = 180 + Math.random() * 220;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgPos[i * 3 + 2] = r * Math.cos(phi);

    const hue = Math.random();
    const c = new THREE.Color().setHSL(hue > 0.7 ? 0.6 : hue > 0.4 ? 0.15 : 0.8, 0.8, 0.85);
    bgCols[i * 3] = c.r;
    bgCols[i * 3 + 1] = c.g;
    bgCols[i * 3 + 2] = c.b;
  }
  bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCols, 3));
  const bgPoints = new THREE.Points(
    bgGeo,
    new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.75 }),
  );
  scene.add(bgPoints);

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
      const offX = isNarrow ? 0 : 1.6;
      const offY = isNarrow ? -1.0 : 0;
      return {
        pos: new THREE.Vector3(offX, offY, -CAM_EARTH_DIST),
        look: new THREE.Vector3(offX, offY, 16),
      };
    } else if (mode === 'space3d') {
      return {
        pos: new THREE.Vector3(34, 20, -6),
        look: new THREE.Vector3(0, 0, 16),
      };
    } else {
      return {
        pos: new THREE.Vector3(0, 52, 16),
        look: new THREE.Vector3(0, 0, 16),
      };
    }
  }

  // 뷰 모드 업데이트
  function applyViewMode(mode: ConstellationViewMode) {
    viewMode = mode;
    controls.enableRotate = true; // 모든 모드에서 자유 회전 허용!
    controls.enableZoom = true;
    controls.enablePan = true;
    const { pos, look } = getModeDefaults(mode);
    targetCamPos.copy(pos);
    targetCamLook.copy(look);
    isAnimatingCamera = true;
    if (mode === 'earth') playStarChime(440);
    else if (mode === 'space3d') playWarpChime();
    else playStarChime(660);
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
  function animate() {
    animId = requestAnimationFrame(animate);

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
