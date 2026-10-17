// 여러 시뮬레이션 화면이 함께 쓰는 시각 효과 모음.
// (블룸 후처리, 둥근 별빛, 은하수 하늘, 태양 표면/대기/강착원반 셰이더)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ---------- GLSL 3D 심플렉스 노이즈 (Ashima Arts, MIT) + fBm ----------
export const GLSL_NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s * 0.5 + 0.5;
}
`;

// ---------- 둥근 별빛 점 텍스처 (PointsMaterial 의 네모 점 대신) ----------
let softDotTex: THREE.CanvasTexture | null = null;
export function getSoftDotTexture(): THREE.CanvasTexture {
  if (softDotTex) return softDotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  softDotTex = new THREE.CanvasTexture(c);
  softDotTex.colorSpace = THREE.SRGBColorSpace;
  return softDotTex;
}

/** PointsMaterial 을 부드러운 원형 발광 점으로 바꾼다. (크기는 원형 감쇠를 보정해 살짝 키움) */
export function softenPoints<T extends THREE.PointsMaterial>(mat: T, sizeBoost = 1.6): T {
  mat.map = getSoftDotTexture();
  mat.transparent = true;
  mat.depthWrite = false;
  mat.size *= sizeBoost;
  mat.needsUpdate = true;
  return mat;
}

// ---------- 반짝이는 배경 별 (크기·색·깜빡임이 별마다 다름) ----------
export interface Starfield {
  points: THREE.Points;
  update(time: number): void;
}

export function createStarfield(opts: { count?: number; radius?: number; spread?: number; size?: number; brightness?: number } = {}): Starfield {
  const count = opts.count ?? 6000;
  const radius = opts.radius ?? 1800;
  const spread = opts.spread ?? 0.35;
  const baseSize = opts.size ?? 2.4;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  // 실제 별의 색 분포 (청백색 ~ 적색 거성)
  const palette = [0x9bb0ff, 0xaabfff, 0xcad7ff, 0xf8f7ff, 0xfff4ea, 0xffd2a1, 0xffb56c, 0xff8a65].map((h) => new THREE.Color(h));
  const weights = [0.04, 0.08, 0.14, 0.22, 0.22, 0.16, 0.1, 0.04];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // 은하수 평면 쪽에 별이 더 몰리도록 위도를 살짝 압축
    const u = Math.random() * 2 - 1;
    const lat = Math.random() < 0.45 ? u * 0.25 : u;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - lat * lat);
    const r = radius * (1 + (Math.random() - 0.5) * spread);
    tmp.set(s * Math.cos(t), lat, s * Math.sin(t)).applyAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), 1.05);
    pos.set([tmp.x * r, tmp.y * r, tmp.z * r], i * 3);
    let k = Math.random();
    let idx = 0;
    while (idx < weights.length - 1 && k > weights[idx]) {
      k -= weights[idx];
      idx++;
    }
    const c = palette[idx];
    col.set([c.r, c.g, c.b], i * 3);
    // 대부분은 작고 희미하며 드물게 밝은 별
    const m = Math.pow(Math.random(), 6);
    size[i] = baseSize * (0.55 + m * 3.2);
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uBright: { value: opts.brightness ?? 1.25 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = aColor;
        vTwinkle = 0.7 + 0.3 * sin(uTime * (0.8 + aPhase * 2.4) + aPhase * 40.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBright;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        float a = core * core * core;
        gl_FragColor = vec4(vColor * vTwinkle * uBright * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(time) {
      mat.uniforms.uTime.value = time;
    },
  };
}

// ---------- 은하수 & 성운이 은은하게 깔린 하늘 돔 ----------
export function createSkyDome(radius = 2600, intensity = 1): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: { value: intensity },
      uBandNormal: { value: new THREE.Vector3(0.0, 1.0, 0.3).normalize().applyAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), 1.05) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform float uIntensity;
      uniform vec3 uBandNormal;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float b = dot(d, uBandNormal);
        float core = exp(-b * b / 0.010);
        float wide = exp(-b * b / 0.075);
        float n = fbm3(d * 3.2);
        float n2 = fbm3(d * 8.0 + 3.7);
        vec3 col = vec3(0.035, 0.04, 0.08) * wide * (0.3 + 0.9 * n);
        col += vec3(0.075, 0.065, 0.06) * core * (0.2 + 1.2 * n2 * n2);
        // 은하수 한가운데의 어두운 먼지 띠
        col *= 1.0 - 0.7 * smoothstep(0.5, 0.7, n2) * core;
        // 드문드문 보랏빛/청록빛 성운
        float neb = smoothstep(0.62, 0.9, fbm3(d * 1.6 + 11.0));
        float neb2 = smoothstep(0.64, 0.92, fbm3(d * 2.2 - 5.0));
        col += vec3(0.05, 0.012, 0.06) * neb + vec3(0.008, 0.035, 0.05) * neb2;
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- 자유 카메라: 왼쪽 드래그 회전 · 오른쪽(가운데) 드래그 이동 · 휠은 커서 쪽으로 확대 ----------
export interface FreeCamera {
  /** 사용자가 직접 화면을 옮겼거나 커서 쪽으로 확대했으면 true → 자동 추적을 멈춘다 */
  manual: boolean;
  /** 자동 추적으로 돌아가기 (행성 선택, 전체 조망 버튼 등) */
  release(): void;
  dispose(): void;
}

interface OrbitLike {
  enablePan: boolean;
  screenSpacePanning: boolean;
  zoomToCursor: boolean;
  mouseButtons: { LEFT?: THREE.MOUSE | null; MIDDLE?: THREE.MOUSE | null; RIGHT?: THREE.MOUSE | null };
}

export function setupFreeCamera(
  controls: OrbitLike,
  dom: HTMLElement,
  opts: { isFollowing?: () => boolean } = {},
): FreeCamera {
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
  const state: FreeCamera = {
    manual: false,
    release() {
      state.manual = false;
    },
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onMenu);
    },
  };
  const onDown = (e: PointerEvent) => {
    if (e.button === 1 || e.button === 2) state.manual = true;
  };
  // 무언가를 따라가는 중이면 그 천체를 중심으로 확대 (커서 쪽 확대는 따라가기와 충돌)
  const onWheel = () => {
    const following = opts.isFollowing?.() ?? false;
    controls.zoomToCursor = !following;
    if (!following) state.manual = true;
  };
  const onMenu = (e: Event) => e.preventDefault();
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('wheel', onWheel, { passive: true, capture: true });
  dom.addEventListener('contextmenu', onMenu);
  return state;
}

// ---------- 블룸(빛 번짐) 후처리 ----------
export interface BloomPipeline {
  render(): void;
  setSize(w: number, h: number): void;
  bloom: UnrealBloomPass;
  dispose(): void;
}

export function createBloomPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: { strength?: number; radius?: number; threshold?: number } = {},
): BloomPipeline {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(Math.max(1, size.x), Math.max(1, size.y));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), opts.strength ?? 0.9, opts.radius ?? 0.55, opts.threshold ?? 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    bloom,
    render() {
      composer.render();
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    dispose() {
      composer.dispose();
    },
  };
}

// ---------- 태양 표면 (끓어오르는 쌀알무늬 + 흑점 + 주연감광) ----------
export function createSunMaterial(intensity = 2.4): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: intensity } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        vPos = normalize(position);
        vNormalV = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform float uTime;
      uniform float uIntensity;
      varying vec3 vPos;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        float big = fbm3(vPos * 2.0 + vec3(0.0, uTime * 0.03, 0.0));
        // 쌀알무늬: 밝은 대류 세포 사이의 어두운 경계
        float gran = 1.0 - abs(snoise(vPos * 16.0 + vec3(uTime * 0.2)));
        float gran2 = snoise(vPos * 38.0 - vec3(uTime * 0.3)) * 0.5 + 0.5;
        float t = clamp(big * 0.7 + gran * 0.35 + gran2 * 0.12 - 0.12, 0.0, 1.0);
        vec3 c = mix(vec3(0.75, 0.12, 0.01), vec3(1.0, 0.45, 0.05), smoothstep(0.15, 0.55, t));
        c = mix(c, vec3(1.0, 0.8, 0.35), smoothstep(0.6, 0.92, t));
        // 흑점: 작고 드물게, 중위도 띠에만
        float band = smoothstep(0.75, 0.25, abs(vPos.y));
        float spot = smoothstep(0.83, 0.9, snoise(vPos * 3.2 + vec3(7.0, uTime * 0.01, 3.0)) * 0.5 + 0.5) * band;
        c *= 1.0 - spot * 0.8;
        // 주연감광: 가장자리로 갈수록 어둡고 붉어짐
        float mu = clamp(dot(normalize(vNormalV), normalize(-vViewPos)), 0.0, 1.0);
        float limb = 0.35 + 0.65 * pow(mu, 0.5);
        c = mix(c * vec3(1.0, 0.55, 0.3), c, smoothstep(0.0, 0.6, mu));
        gl_FragColor = vec4(c * limb * uIntensity, 1.0);
      }
    `,
  });
}

/** 태양 코로나 빛무리 스프라이트 (블룸과 함께 쓰면 자연스럽게 번짐) */
export function createCoronaSprite(color = 0xffb347, scale = 6): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.32, 'rgba(255,255,255,0.28)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
  );
  sprite.scale.setScalar(scale);
  return sprite;
}

// ---------- 행성 대기 (가장자리에서 빛나고 태양 쪽이 더 밝은 산란광) ----------
export function createAtmosphereMaterial(color: THREE.ColorRepresentation, opts: { power?: number; intensity?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSunPos: { value: new THREE.Vector3() },
      uPower: { value: opts.power ?? 3.0 },
      uIntensity: { value: opts.intensity ?? 1.6 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uSunPos;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), uPower);
        float lit = clamp(dot(n, normalize(uSunPos - vWorldPos)) * 0.7 + 0.35, 0.08, 1.0);
        gl_FragColor = vec4(uColor * fres * lit * uIntensity, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------- 고리(RingGeometry) UV 를 (반지름, 각도) 로 바꾸기 ----------
// 기본 UV 는 평면 투영이라 줄무늬 텍스처가 고리를 가로질러 "바코드"처럼 보인다.
export function setRadialRingUVs(geo: THREE.RingGeometry, inner: number, outer: number): THREE.RingGeometry {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.y);
    let a = Math.atan2(v.y, v.x) / (Math.PI * 2);
    if (a < 0) a += 1;
    uv.setXY(i, (r - inner) / (outer - inner), a);
  }
  uv.needsUpdate = true;
  return geo;
}

// ---------- 블랙홀 강착원반 (난류 플라스마 + 도플러 빔 효과) ----------
export function createAccretionDisk(inner: number, outer: number, opts: { intensity?: number; doppler?: number; speed?: number } = {}): THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial> {
  const geo = setRadialRingUVs(new THREE.RingGeometry(inner, outer, 160, 12), inner, outer);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: opts.intensity ?? 2.2 },
      uDoppler: { value: opts.doppler ?? 0.65 },
      uSpeed: { value: opts.speed ?? 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vCenter;
      varying vec3 vNormalW;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform float uTime;
      uniform float uIntensity;
      uniform float uDoppler;
      uniform float uSpeed;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vCenter;
      varying vec3 vNormalW;
      void main() {
        float r = vUv.x;
        float a = vUv.y * 6.2831853;
        // 안쪽일수록 빠르게 도는 차등 회전 (케플러 운동)
        float omega = 1.0 / pow(0.25 + r, 1.5);
        float aa = a - uTime * omega * 0.45 * uSpeed;
        float rr = 1.0 + r * 3.5;
        vec3 p = vec3(cos(aa) * rr, sin(aa) * rr, r * 9.0);
        float n = fbm3(p * 1.2 + vec3(0.0, 0.0, uTime * 0.04));
        float fil = snoise(vec3(cos(aa) * 6.0, sin(aa) * 6.0, r * 40.0)) * 0.5 + 0.5;
        float streak = 0.35 + 1.1 * n * (0.6 + 0.6 * fil);
        float profile = smoothstep(0.0, 0.05, r) * (1.0 - smoothstep(0.6, 1.0, r)) * pow(1.0 - r * 0.85, 2.2);
        vec3 hot = vec3(1.0, 0.96, 0.88);
        vec3 warm = vec3(1.0, 0.55, 0.16);
        vec3 cool = vec3(0.65, 0.12, 0.05);
        vec3 col = mix(hot, warm, smoothstep(0.02, 0.35, r));
        col = mix(col, cool, smoothstep(0.4, 0.95, r));
        vec3 radial = normalize(vWorldPos - vCenter);
        vec3 vel = normalize(cross(vNormalW, radial));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float beam = clamp(1.0 + uDoppler * dot(vel, viewDir), 0.2, 1.7);
        beam *= beam;
        float bright = profile * streak * beam * uIntensity;
        gl_FragColor = vec4(col * bright, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- 중력렌즈로 휘어 보이는 뒤편 원반 + 광자 고리 (항상 카메라를 향함) ----------
export function createLensingHalo(horizonR: number, opts: { intensity?: number } = {}): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const extent = horizonR * 2.2;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: opts.intensity ?? 1.8 },
      uRatio: { value: horizonR / extent },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform float uTime;
      uniform float uIntensity;
      uniform float uRatio;
      varying vec2 vUv;
      void main() {
        vec2 q = vUv * 2.0 - 1.0;
        float d = length(q) / uRatio; // 1.0 = 사건의 지평선
        float ang = atan(q.y, q.x);
        if (d < 1.0) discard;
        // 아주 얇고 밝은 광자 고리
        float photon = exp(-pow((d - 1.04) / 0.018, 2.0)) * 1.6;
        // 위·아래로 휘감긴 뒤편 강착원반 이미지
        float band = smoothstep(1.05, 1.12, d) * (1.0 - smoothstep(1.2, 1.75, d));
        float n = fbm3(vec3(cos(ang - uTime * 0.35) * 3.0, sin(ang - uTime * 0.35) * 3.0, d * 6.0));
        float arcs = 0.45 + 0.55 * pow(abs(sin(ang)), 1.5);
        float side = 1.0 + 0.45 * cos(ang);
        vec3 col = mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 0.45, 0.12), smoothstep(1.05, 1.6, d));
        float b = (photon + band * (0.35 + 0.9 * n) * arcs * side) * uIntensity;
        gl_FragColor = vec4(col * b, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(extent * 2, extent * 2), mat);
  return mesh;
}
