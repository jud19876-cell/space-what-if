// Three.js 화면. 물리 상태(AU 단위)를 "보기 좋은" 화면 좌표로 바꿔서 그린다.
// 여기서는 물리 상태를 읽기만 하고 바꾸지 않는다. (시간 진행 advance() 만 호출)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { length, type Body, type Vec3, type AbsorptionEvent } from './physics.ts';
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
function mapPoint(p: Vec3, out: THREE.Vector3): THREE.Vector3 {
  const r = length(p);
  if (r < 1e-12) return out.set(0, 0, 0);
  const s = mapRadius(r) / r;
  return out.set(p[0] * s, p[2] * s, -p[1] * s); // 물리 z-up → three.js y-up
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

export interface SpaceScene {
  clearTrails(): void;
  setSelected(id: string | null): void;
  dispose(): void;
}

export function createSpaceScene(
  container: HTMLElement,
  getState: () => SimState,
  onPick: (id: string | null) => void,
  onAbsorb?: (ev: AbsorptionEvent) => void,
): SpaceScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    const info = BODY_INFO[id] ?? (isBlackHole ? BODY_INFO['black_hole'] : { emoji: '🪐', color: '#888888', lines: [] });
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
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({
        color: isBlackHole ? 0xcc44ff : info.color,
        transparent: true,
        opacity: id === 'moon' ? 0.35 : 0.75,
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

  // 블랙홀 흡수 시 충격파(Shockwave Flash) 애니메이션 관리
  const shockwaves: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; time: number; maxTime: number }[] = [];

  function triggerShockwave(pos: THREE.Vector3) {
    const geo = new THREE.RingGeometry(0.5, 1.5, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff33cc,
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
    shockwaves.push({ mesh, mat, time: 0, maxTime: 0.9 });
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
        const s = 1 + progress * 7;
        sw.mesh.scale.set(s, s, s);
        sw.mat.opacity = 0.95 * (1 - progress);
      }
    }
  }

  // ---------- 매 프레임 ----------
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
      const w = Math.min(1, Math.max(0, (0.05 - dl) / 0.03)); // 멀어지면 자연스럽게 원래 위치로
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

    advance(state, dt, (ev) => {
      const bhVis = visuals.get(ev.blackHoleId);
      if (bhVis) {
        triggerShockwave(bhVis.vis);
      }
      onAbsorb?.(ev);
    });

    updateVisuals(state.bodies);
    updateShockwaves(dt);

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

  // ---------- 크기 변경 ----------
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  // ---------- 클릭 (드래그와 구분) ----------
  const raycaster = new THREE.Raycaster();
  const down = { x: 0, y: 0 };
  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    down.x = e.clientX;
    down.y = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const alive = new Set(getState().bodies.map((b) => b.id));
    const hits = raycaster.intersectObjects(hitMeshes.filter((m) => alive.has(m.userData.id)), false);
    // 겹치면 광선에 가장 가까운 천체 (지구와 달처럼 붙어 있을 때)
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
    onPick(best);
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);

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
    },
    setSelected(id) {
      selectedId = id;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
      el.remove();
    },
  };
}

// ---------- 꾸미기 (텍스처, 별, 태양 빛, 블랙홀 강착원반) ----------

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

  // 안쪽 초고온 백색/황금색 -> 바깥쪽 자주/보라색 그라디언트
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

  // 소용돌이 줄무늬 추가
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
  c.width = c.height = 256;
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
