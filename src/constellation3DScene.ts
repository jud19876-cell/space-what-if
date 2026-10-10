import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type ConstellationData, type StarData } from './constellationsData.ts';

export type ConstellationViewMode = 'earth' | 'space3d' | 'top';

export interface ConstellationScene {
  setConstellation(constellation: ConstellationData): void;
  setViewMode(mode: ConstellationViewMode): void;
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
  controls.minDistance = 10;
  controls.maxDistance = 220;

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

  // 2. 지구 위치 마커 (초록색 빛나는 관측소 링)
  const earthMarker = new THREE.Group();
  earthMarker.position.set(0, 0, -CAM_EARTH_DIST + 1);
  const earthRingGeo = new THREE.RingGeometry(1.2, 1.4, 32);
  const earthRingMat = new THREE.MeshBasicMaterial({ color: 0x4fe3c1, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const earthRing = new THREE.Mesh(earthRingGeo, earthRingMat);
  earthMarker.add(earthRing);
  scene.add(earthMarker);

  // 3. 별자리 메쉬 그룹
  const constellationGroup = new THREE.Group();
  scene.add(constellationGroup);

  // 별 메시 매핑
  const starMeshes = new Map<string, { mesh: THREE.Mesh; halo: THREE.Mesh; star: StarData; pos3D: THREE.Vector3 }>();
  let connectionLineMesh: THREE.LineSegments | null = null;
  let guideGroup: THREE.Group = new THREE.Group();
  let artGroup: THREE.Group = new THREE.Group();
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

  // 별자리 캐릭터 실루엣 3D 곡선
  function buildConstellationArt() {
    const artPts: THREE.Vector3[] = [];
    const color = 0x66aaff;

    if (currentConstellation.silhouetteType === 'scorpion') {
      // 전갈 몸통 & 집게발 아치 곡선
      const antares = starMeshes.get('antares')?.pos3D ?? new THREE.Vector3(0, 0, 10);
      const acrab = starMeshes.get('acrab')?.pos3D ?? new THREE.Vector3(-4, 8, 8);
      const shaula = starMeshes.get('shaula')?.pos3D ?? new THREE.Vector3(8, -8, 12);

      // 집게발 둥근 곡선
      const curveL = new THREE.CatmullRomCurve3([
        antares,
        new THREE.Vector3(antares.x - 3, antares.y + 4, antares.z - 2),
        acrab,
        new THREE.Vector3(acrab.x - 2, acrab.y + 2, acrab.z),
      ]);
      artPts.push(...curveL.getPoints(24));

      // 꼬리 독침 아치
      const curveTail = new THREE.CatmullRomCurve3([
        antares,
        new THREE.Vector3(antares.x + 3, antares.y - 4, antares.z + 1),
        new THREE.Vector3(shaula.x - 2, shaula.y - 3, shaula.z),
        shaula,
      ]);
      artPts.push(...curveTail.getPoints(24));
    } else if (currentConstellation.silhouetteType === 'hunter') {
      // 오리온 방패 및 활 곡선
      const belt = starMeshes.get('alnilam')?.pos3D ?? new THREE.Vector3(0, 0, 15);
      const curveBow = new THREE.CatmullRomCurve3([
        new THREE.Vector3(belt.x + 6, belt.y + 6, belt.z),
        new THREE.Vector3(belt.x + 7, belt.y, belt.z),
        new THREE.Vector3(belt.x + 6, belt.y - 6, belt.z),
      ]);
      artPts.push(...curveBow.getPoints(20));
    }

    if (artPts.length > 0) {
      const artGeo = new THREE.BufferGeometry().setFromPoints(artPts);
      const artMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const artLine = new THREE.Line(artGeo, artMat);
      artGroup.add(artLine);
    }
  }

  // 뷰 모드 업데이트
  function applyViewMode(mode: ConstellationViewMode) {
    viewMode = mode;
    if (mode === 'earth') {
      // 지구에서 똑바로 바라보는 2D 정렬 시점
      targetCamPos.set(0, 0, -CAM_EARTH_DIST);
      targetCamLook.set(0, 0, 16);
      controls.enableRotate = false; // 정렬 상태 유지
      playStarChime(440);
    } else if (mode === 'space3d') {
      // 비스듬한 3D 우주 시점: 앞뒤 깊이 거리가 확 드러남!
      targetCamPos.set(34, 20, -6);
      targetCamLook.set(0, 0, 16);
      controls.enableRotate = true; // 자유 회전 가능
      playWarpChime();
    } else if (mode === 'top') {
      // 위에서 내려다보는 거리 지도 뷰
      targetCamPos.set(0, 52, 16);
      targetCamLook.set(0, 0, 16);
      controls.enableRotate = true;
      playStarChime(660);
    }
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

    // 카메라 부드러운 전환 이동
    camera.position.lerp(targetCamPos, 0.06);
    controls.target.lerp(targetCamLook, 0.06);
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
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}
