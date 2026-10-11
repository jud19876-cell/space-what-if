// 은하 대충돌 & 심우주 실시간 3D 그래픽 씬 (Three.js)
// "우선 태양계에 우리은하에서 그 근방에 있는것들로 표현해"
// 우리은하 오리온 팔 내 태양계(Solar System) 위치 핀 마커 및
// 국부은하군(안드로메다, 삼각형자리, 대/소 마젤란 은하) 렌더링

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createGalaxyScenario,
  stepGalaxySystem,
  type GalacticCore,
  type GalaxyScenarioType,
  type GalaxySimState,
} from './galaxyCollisionPhysics.ts';

export type GalaxyCameraView =
  | 'overview'      // 국부은하군 전체 조망
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

export function createGalaxyScene(
  container: HTMLElement,
  initialScenario: GalaxyScenarioType = 'local_group',
  onStateUpdate?: (state: GalaxySimState) => void,
): GalaxyScene {
  let simState = createGalaxyScenario(initialScenario);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03030d');
  scene.fog = new THREE.FogExp2(0x03030d, 0.0005);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 5000);
  camera.position.set(0, 220, 360);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 8;
  controls.maxDistance = 2200;

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

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
  scene.add(new THREE.Points(bgStarGeo, bgStarMat));

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
      }

      const light = new THREE.PointLight(lightColor, lightIntensity, 450, 1.2);
      light.position.set(...c.pos);
      scene.add(light);

      // 은하 이름 3D 태그 라벨
      const labelSprite = makeCoreLabelSprite(c.name, c.color);
      labelSprite.position.set(0, c.radius * 2.2 + 3.2, 0);
      group.add(labelSprite);

      scene.add(group);

      coreMeshes.push({ group, light, coreId: c.id, disk, ring });

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
  const clock = new THREE.Clock();
  let rafId = 0;

  const targetLerp = new THREE.Vector3(0, 0, 0);

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.08);

    stepGalaxySystem(simState, dt);
    onStateUpdate?.(simState);

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
      case 'overview': {
        targetLerp.set(cores.length > 2 ? 60 : 0, 0, 0);
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

    renderer.render(scene, camera);
  }

  frame();

  const handleResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      if (mode === 'overview') {
        camera.position.set(60, 220, 360);
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
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
