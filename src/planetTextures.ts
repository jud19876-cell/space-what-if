import * as THREE from 'three';

/**
 * 3D 구면 좌표 기반 절차적 천체 텍스처 생성기 (1024x512).
 * 모든 무늬를 구 위의 3D 점에서 계산하므로 경도 0°/360° 이음매와 극점 찌그러짐이 없다.
 */

// ---------- 값 노이즈 + fBm ----------
function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);
  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm(x: number, y: number, z: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x + i * 17.13, y + i * 29.37, z + i * 7.91) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

/** 능선형 노이즈 (산맥, 크레이터 테두리 느낌) */
function ridged(x: number, y: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(smoothNoise(x + i * 11.1, y + i * 5.3, z + i * 3.7) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    x *= 2.1;
    y *= 2.1;
    z *= 2.1;
    amp *= 0.5;
  }
  return sum / norm;
}

type RGB = [number, number, number];

function mix(a: RGB, b: RGB, t: number): RGB {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 위도 띠 색 지도에서 보간 (가스 행성용) */
function bandPalette(stops: RGB[], t: number): RGB {
  const x = (((t % 1) + 1) % 1) * stops.length;
  const i = Math.floor(x);
  return mix(stops[i % stops.length], stops[(i + 1) % stops.length], smooth(0, 1, x - i));
}

/**
 * 구 위의 크레이터 음영 버퍼 (바닥은 어둡게, 테두리는 밝게).
 * 크레이터마다 위·경도 경계 상자 안의 픽셀만 계산해서 빠르다.
 */
function bakeCraters(seed: number, count: number, minR: number, maxR: number, width: number, height: number): Float32Array {
  const shade = new Float32Array(width * height);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const k = Math.sqrt(1 - u * u);
    const cx = k * Math.cos(t);
    const cy = u;
    const cz = k * Math.sin(t);
    const r = minR + Math.pow(rnd(), 3) * (maxR - minR);
    const reach = r * 1.2; // 현의 길이 ≈ 각거리
    const latC = Math.asin(cy);
    const y0 = Math.max(0, Math.floor((0.5 - (latC + reach) / Math.PI) * height));
    const y1 = Math.min(height - 1, Math.ceil((0.5 - (latC - reach) / Math.PI) * height));
    const lonC = Math.atan2(cz, cx);
    for (let y = y0; y <= y1; y++) {
      const lat = (0.5 - y / height) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const span = cosLat > 0.05 ? Math.min(Math.PI, reach / cosLat) : Math.PI;
      let xs = Math.floor(((lonC - span) / (Math.PI * 2)) * width);
      let xe = Math.ceil(((lonC + span) / (Math.PI * 2)) * width);
      if (xe - xs >= width) {
        xs = 0;
        xe = width - 1;
      }
      for (let xi = xs; xi <= xe; xi++) {
        const x = ((xi % width) + width) % width;
        const lon = (x / width) * Math.PI * 2;
        const dx = cosLat * Math.cos(lon) - cx;
        const dy = sinLat - cy;
        const dz = cosLat * Math.sin(lon) - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / r;
        if (d >= 1.15) continue;
        const idx = y * width + x;
        if (d < 0.85) shade[idx] -= 0.22 * (1 - d * d * 0.5);
        else shade[idx] += 0.18 * (1 - Math.abs(d - 1) / 0.15);
      }
    }
  }
  return shade;
}

interface PlanetMaps {
  diffuse: THREE.CanvasTexture;
  roughness?: THREE.CanvasTexture;
}

const mapCache = new Map<string, PlanetMaps>();

function makeCanvasTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

function generatePlanetMaps(id: string, width: number, height: number): PlanetMaps {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const wantsRough = id === 'earth';
  let roughCanvas: HTMLCanvasElement | null = null;
  let roughImg: ImageData | null = null;
  if (wantsRough) {
    roughCanvas = document.createElement('canvas');
    roughCanvas.width = width;
    roughCanvas.height = height;
    roughImg = roughCanvas.getContext('2d')!.createImageData(width, height);
  }

  const craters =
    id === 'moon'
      ? bakeCraters(7, 260, 0.02, 0.22, width, height)
      : id === 'mercury'
        ? bakeCraters(13, 340, 0.015, 0.16, width, height)
        : id === 'mars'
          ? bakeCraters(29, 90, 0.015, 0.09, width, height)
          : null;

  const hash = Math.abs(id.split('').reduce((acc, ch) => (acc << 5) - acc + ch.charCodeAt(0), 0));

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = (0.5 - v) * Math.PI; // 위쪽이 북극
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const absLat = Math.abs(lat) / (Math.PI / 2); // 0 적도 ~ 1 극

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      let rgb: RGB = [200, 200, 200];
      let rough = 255;

      switch (id) {
        case 'sun': {
          const plasma = fbm(nx * 3, ny * 3, nz * 3, 4) * 0.7 + fbm(nx * 9 + 5, ny * 9 + 5, nz * 9, 3) * 0.3;
          rgb = mix([215, 40, 5], [255, 140, 20], smooth(0.3, 0.55, plasma));
          rgb = mix(rgb, [255, 238, 170], smooth(0.6, 0.8, plasma));
          break;
        }
        case 'earth': {
          // 도메인 왜곡으로 해안선이 복잡한 대륙
          const wx = fbm(nx * 1.6 + 3.1, ny * 1.6, nz * 1.6, 2) - 0.5;
          const wy = fbm(nx * 1.6, ny * 1.6 + 7.7, nz * 1.6, 2) - 0.5;
          const h = fbm(nx * 1.9 + wx * 1.4 + 10, ny * 1.9 + wy * 1.4 + 10, nz * 1.9 + 10, 6);
          const sea = 0.5;
          if (h < sea) {
            const depth = (sea - h) / sea;
            rgb = mix([28, 92, 150], [6, 28, 78], smooth(0, 0.45, depth));
            rgb = mix(rgb, [52, 140, 170], smooth(0.06, 0, depth) * 0.7); // 얕은 바다
            rough = 70;
          } else {
            const e = (h - sea) / (1 - sea);
            const moist = fbm(nx * 3 + 50, ny * 3 + 50, nz * 3 + 50, 4);
            // 위도 ±20~30° 사막대, 적도 열대우림, 고위도 툰드라
            const desertBelt = Math.exp(-Math.pow((absLat - 0.28) / 0.12, 2));
            const dryness = desertBelt * 0.9 + (1 - moist) * 0.5;
            const forest: RGB = absLat < 0.18 ? [28, 92, 34] : [52, 104, 46];
            const grass: RGB = [104, 128, 62];
            const desert: RGB = [196, 164, 112];
            rgb = mix(forest, grass, smooth(0.25, 0.6, dryness));
            rgb = mix(rgb, desert, smooth(0.6, 0.85, dryness));
            rgb = mix(rgb, [112, 104, 96], smooth(0.45, 0.75, e)); // 고산 암석
            rgb = mix(rgb, [236, 238, 244], smooth(0.78, 0.92, e)); // 만년설
            rgb = mix(rgb, [150, 150, 128], smooth(0.62, 0.8, absLat)); // 툰드라
            rgb = mix([214, 196, 150], rgb, smooth(0, 0.025, e)); // 해변
            rough = 235;
          }
          // 극지방 빙하 (가장자리를 노이즈로 들쭉날쭉하게)
          const ice = absLat < 0.78 ? 0 : smooth(0.86, 0.92, absLat + (fbm(nx * 5, ny * 5, nz * 5, 3) - 0.5) * 0.12);
          rgb = mix(rgb, [240, 246, 252], ice);
          if (ice > 0.5) rough = 180;
          break;
        }
        case 'jupiter': {
          const warp = (fbm(nx * 4 + 1, ny * 4, nz * 4, 4) - 0.5) * 0.55;
          const turb = (fbm(nx * 12, ny * 30, nz * 12, 3) - 0.5) * 0.12;
          const t = sinLat * 5.2 + warp + turb;
          const bands: RGB[] = [
            [236, 222, 200],
            [196, 150, 112],
            [226, 200, 166],
            [168, 112, 78],
            [240, 230, 214],
            [186, 128, 88],
            [214, 180, 140],
            [150, 104, 78],
          ];
          rgb = bandPalette(bands, t * 0.5 + 0.5);
          // 극지방은 어둡고 푸르스름
          rgb = mix(rgb, [120, 112, 116], smooth(0.62, 0.95, absLat));
          // 대적점 (남반구 22°)
          const lonS = 4.0;
          const dLon = Math.atan2(Math.sin(lon - lonS), Math.cos(lon - lonS));
          const ex = dLon / 0.3;
          const ey = (lat + 0.39) / 0.12;
          const spot = ex * ex + ey * ey;
          if (spot < 1.6) {
            const swirl = fbm(ex * 2 + 3, ey * 2, 1.7, 3);
            rgb = mix(rgb, mix([196, 92, 58], [232, 150, 110], swirl), smooth(1.6, 0.6, spot));
          }
          break;
        }
        case 'saturn': {
          const warp = (fbm(nx * 3, ny * 3, nz * 3, 3) - 0.5) * 0.25;
          const t = sinLat * 6 + warp + (fbm(nx * 10, ny * 26, nz * 10, 2) - 0.5) * 0.08;
          const bands: RGB[] = [
            [234, 214, 170],
            [214, 184, 132],
            [242, 226, 186],
            [200, 168, 120],
            [228, 204, 156],
          ];
          rgb = bandPalette(bands, t * 0.5 + 0.5);
          rgb = mix(rgb, [176, 172, 150], smooth(0.75, 1, absLat));
          break;
        }
        case 'mars': {
          const terr = fbm(nx * 3.2 + 2, ny * 3.2 + 2, nz * 3.2, 6);
          const dark = fbm(nx * 1.6 + 9, ny * 1.6, nz * 1.6 + 4, 4); // 시르티스 같은 어두운 지대
          rgb = mix([150, 66, 34], [214, 112, 62], terr);
          rgb = mix(rgb, [96, 52, 36], smooth(0.55, 0.7, dark) * 0.75);
          rgb = mix(rgb, [232, 168, 120], smooth(0.62, 0.8, terr) * 0.5);
          if (craters) {
            const c = craters[y * width + x];
            rgb = [rgb[0] * (1 + c), rgb[1] * (1 + c), rgb[2] * (1 + c)];
          }
          const cap = smooth(0.88, 0.94, absLat + (fbm(nx * 6, ny * 6, nz * 6, 2) - 0.5) * 0.1);
          rgb = mix(rgb, [246, 242, 236], cap);
          break;
        }
        case 'venus': {
          const warp = fbm(nx * 2, ny * 2, nz * 2, 3);
          const c = fbm(nx * 3 + warp * 2, ny * 6 + warp, nz * 3, 5);
          rgb = mix([176, 120, 60], [236, 196, 130], c);
          rgb = mix(rgb, [248, 228, 178], smooth(0.62, 0.85, c));
          break;
        }
        case 'mercury': {
          const rock = fbm(nx * 6 + 3, ny * 6 + 3, nz * 6, 5);
          rgb = mix([86, 82, 80], [170, 164, 158], rock);
          if (craters) {
            const c = craters[y * width + x];
            rgb = [rgb[0] * (1 + c), rgb[1] * (1 + c), rgb[2] * (1 + c)];
          }
          break;
        }
        case 'moon': {
          const mare = fbm(nx * 1.8 + 7, ny * 1.8 + 7, nz * 1.8, 4);
          const rock = fbm(nx * 9, ny * 9, nz * 9, 4);
          rgb = mix([196, 194, 190], [218, 216, 212], rock);
          rgb = mix(rgb, [92, 94, 100], smooth(0.52, 0.62, mare) * 0.85); // 달의 바다
          if (craters) {
            const c = craters[y * width + x];
            rgb = [rgb[0] * (1 + c), rgb[1] * (1 + c), rgb[2] * (1 + c)];
          }
          break;
        }
        case 'uranus': {
          const t = sinLat * 3 + (fbm(nx * 4, ny * 8, nz * 4, 3) - 0.5) * 0.15;
          rgb = mix([148, 214, 224], [176, 230, 236], t * 0.5 + 0.5);
          rgb = mix(rgb, [196, 238, 240], smooth(0.7, 1, absLat) * 0.6);
          break;
        }
        case 'neptune': {
          const warp = (fbm(nx * 3, ny * 3, nz * 3, 3) - 0.5) * 0.4;
          const t = sinLat * 4 + warp;
          rgb = bandPalette(
            [
              [44, 86, 210],
              [62, 116, 232],
              [38, 72, 190],
              [80, 140, 240],
            ],
            t * 0.5 + 0.5,
          );
          // 하얀 권운 줄무늬
          const cirrus = fbm(nx * 8, ny * 24, nz * 8, 3);
          rgb = mix(rgb, [210, 230, 255], smooth(0.72, 0.85, cirrus) * 0.7);
          // 대흑점
          const dLon = Math.atan2(Math.sin(lon - 2.4), Math.cos(lon - 2.4));
          const sp = Math.pow(dLon / 0.28, 2) + Math.pow((lat + 0.36) / 0.1, 2);
          if (sp < 1) rgb = mix(rgb, [22, 40, 120], smooth(1, 0.3, sp));
          break;
        }
        case 'pluto': {
          const terr = fbm(nx * 4 + 1, ny * 4, nz * 4, 5);
          rgb = mix([126, 92, 70], [204, 176, 150], terr);
          rgb = mix(rgb, [88, 52, 40], smooth(0.55, 0.7, fbm(nx * 2, ny * 2 + 3, nz * 2, 3)) * 0.6);
          // 하트 모양의 톰보 지역 (밝은 질소 얼음)
          const dLon = Math.atan2(Math.sin(lon - 1.2), Math.cos(lon - 1.2));
          const hx = dLon / 0.55;
          const hy = (lat - 0.05) / 0.5;
          const heart = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * Math.pow(hy, 3);
          if (heart < 0) rgb = mix(rgb, [244, 236, 226], 0.85);
          break;
        }
        default: {
          // 커스텀 외계 행성: 이름 해시로 정해지는 고유 색 + 대륙/띠 혼합
          const r1 = (hash % 100) / 100;
          const g1 = ((hash >> 3) % 100) / 100;
          const b1 = ((hash >> 6) % 100) / 100;
          const banded = hash % 2 === 0;
          const n = banded
            ? fbm(nx * 2, ny * 2, nz * 2, 3) * 0.3 + (Math.sin(sinLat * 9 + fbm(nx * 4, ny * 4, nz * 4, 3) * 3) * 0.5 + 0.5) * 0.7
            : fbm(nx * 3 + r1 * 10, ny * 3 + g1 * 10, nz * 3, 5);
          const c1: RGB = [60 + r1 * 180, 60 + g1 * 180, 60 + b1 * 180];
          const c2: RGB = [255 - g1 * 160, 255 - b1 * 160, 255 - r1 * 160];
          rgb = mix(c1, c2, smooth(0.3, 0.75, n));
          break;
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = rgb[0] < 0 ? 0 : rgb[0] > 255 ? 255 : rgb[0];
      data[idx + 1] = rgb[1] < 0 ? 0 : rgb[1] > 255 ? 255 : rgb[1];
      data[idx + 2] = rgb[2] < 0 ? 0 : rgb[2] > 255 ? 255 : rgb[2];
      data[idx + 3] = 255;
      if (roughImg) {
        roughImg.data[idx] = roughImg.data[idx + 1] = roughImg.data[idx + 2] = rough;
        roughImg.data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  const maps: PlanetMaps = { diffuse: makeCanvasTexture(canvas, true) };
  if (roughCanvas && roughImg) {
    roughCanvas.getContext('2d')!.putImageData(roughImg, 0, 0);
    maps.roughness = makeCanvasTexture(roughCanvas, false);
  }
  return maps;
}

function getMaps(id: string, width: number, height: number): PlanetMaps {
  const key = `${id}_${width}x${height}`;
  let m = mapCache.get(key);
  if (!m) {
    m = generatePlanetMaps(id, width, height);
    mapCache.set(key, m);
  }
  return m;
}

// 화면에 작게 보이는 천체는 512 해상도로 충분 (시작 로딩 시간 단축)
const SMALL_BODIES = new Set(['mercury', 'venus', 'moon', 'mars', 'pluto', 'uranus', 'neptune']);
function defaultWidth(id: string): number {
  return SMALL_BODIES.has(id) ? 512 : 1024;
}

/** 행성 디퓨즈(색) 텍스처 */
export function createPlanetTexture(id: string, width = defaultWidth(id), height = width / 2): THREE.CanvasTexture {
  return getMaps(id, width, height).diffuse;
}

/** 표면 거칠기 맵 (지구: 바다는 매끈해서 햇빛이 반짝, 육지는 거침). 없으면 undefined */
export function createRoughnessMap(id: string, width = defaultWidth(id), height = width / 2): THREE.CanvasTexture | undefined {
  return getMaps(id, width, height).roughness;
}

let cloudTex: THREE.CanvasTexture | null = null;
/** 지구 구름층 (알파 채널에 구름 밀도) */
export function createCloudTexture(width = 1024, height = 512): THREE.CanvasTexture {
  if (cloudTex) return cloudTex;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    const lat = (0.5 - y / height) * Math.PI;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const absLat = Math.abs(lat) / (Math.PI / 2);
    // 적도 수렴대·중위도 폭풍대에 구름이 많고 아열대 고기압대는 맑음
    const belt = 0.55 + 0.25 * Math.exp(-Math.pow(absLat / 0.08, 2)) + 0.2 * Math.exp(-Math.pow((absLat - 0.6) / 0.12, 2)) - 0.18 * Math.exp(-Math.pow((absLat - 0.3) / 0.08, 2));
    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);
      const w = fbm(nx * 2 + 4, ny * 2, nz * 2, 3);
      const c = fbm(nx * 4 + w * 2.2, ny * 7 + w, nz * 4 - w * 1.5, 6);
      const a = smooth(0.62 - belt * 0.18, 0.82 - belt * 0.18, c);
      const idx = (y * width + x) * 4;
      img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = 255;
      img.data[idx + 3] = a * 235;
    }
  }
  ctx.putImageData(img, 0, 0);
  cloudTex = makeCanvasTexture(canvas, true);
  return cloudTex;
}

const normalMapCache = new Map<string, THREE.CanvasTexture>();

/**
 * 디퓨즈 캔버스로부터 입체 노멀맵(Normal Map) 자동 생성
 */
export function createNormalMap(diffuseTexture: THREE.CanvasTexture, bumpStrength = 2.0): THREE.CanvasTexture {
  const cacheKey = `${diffuseTexture.uuid}_${bumpStrength}`;
  if (normalMapCache.has(cacheKey)) {
    return normalMapCache.get(cacheKey)!;
  }

  const srcCanvas = diffuseTexture.image as HTMLCanvasElement;
  const width = srcCanvas.width;
  const height = srcCanvas.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const srcData = srcCanvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = (srcData[i * 4] * 0.299 + srcData[i * 4 + 1] * 0.587 + srcData[i * 4 + 2] * 0.114) / 255;
  }

  const normalImg = ctx.createImageData(width, height);
  const dstData = normalImg.data;

  for (let y = 0; y < height; y++) {
    const yDown = Math.max(0, y - 1);
    const yUp = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xLeft = (x - 1 + width) % width;
      const xRight = (x + 1) % width;
      const dX = (gray[y * width + xLeft] - gray[y * width + xRight]) * bumpStrength;
      const dY = (gray[yDown * width + x] - gray[yUp * width + x]) * bumpStrength;
      const len = Math.sqrt(dX * dX + dY * dY + 1.0);
      const idx = (y * width + x) * 4;
      dstData[idx] = ((dX / len) * 0.5 + 0.5) * 255;
      dstData[idx + 1] = ((dY / len) * 0.5 + 0.5) * 255;
      dstData[idx + 2] = ((1.0 / len) * 0.5 + 0.5) * 255;
      dstData[idx + 3] = 255;
    }
  }

  ctx.putImageData(normalImg, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  normalMapCache.set(cacheKey, texture);
  return texture;
}

const ringTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * 토성/천왕성 고리 텍스처. 가로(u) = 안쪽(0) → 바깥쪽(1) 반지름 방향.
 * (RingGeometry 에 fx.setRadialRingUVs 를 적용해서 써야 고리를 따라 줄무늬가 돈다)
 */
export function createRingTexture(planetId = 'saturn', width = 1024, height = 4): THREE.CanvasTexture {
  const cacheKey = `${planetId}_${width}x${height}`;
  if (ringTextureCache.has(cacheKey)) {
    return ringTextureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  const isSaturn = planetId === 'saturn';

  for (let x = 0; x < width; x++) {
    const t = x / width;
    let alpha: number;
    let rgb: RGB;
    // 미세한 수백 개의 고리띠
    const fine = fbm(t * 220, 0.5, 0.5, 3);
    if (isSaturn) {
      // C 고리(희미) → B 고리(밝고 두꺼움) → 카시니 간극 → A 고리 → 엔케 간극 → F 고리
      if (t < 0.22) {
        alpha = 0.15 + t * 1.2;
        rgb = [150, 136, 118];
      } else if (t < 0.6) {
        alpha = 0.75 + (fine - 0.5) * 0.5;
        rgb = mix([214, 196, 160], [238, 222, 188], (t - 0.22) / 0.38);
      } else if (t < 0.665) {
        alpha = 0.04; // 카시니 간극
        rgb = [90, 80, 70];
      } else if (t < 0.93) {
        alpha = 0.55 + (fine - 0.5) * 0.4;
        rgb = [206, 190, 158];
        if (t > 0.875 && t < 0.89) alpha *= 0.15; // 엔케 간극
      } else if (t < 0.96) {
        alpha = 0.03;
        rgb = [120, 110, 100];
      } else {
        alpha = 0.35 * (1 - Math.abs(t - 0.975) / 0.015); // F 고리
        rgb = [226, 214, 196];
      }
      if (t < 0.02) alpha *= t / 0.02;
    } else {
      // 천왕성: 가늘고 어두운 몇 가닥의 고리
      const strands = [0.1, 0.22, 0.31, 0.44, 0.52, 0.63, 0.86];
      alpha = 0.04;
      for (const s of strands) alpha += 0.55 * Math.exp(-Math.pow((t - s) / 0.008, 2));
      alpha += 0.7 * Math.exp(-Math.pow((t - 0.95) / 0.018, 2)); // 엡실론 고리
      rgb = [150, 196, 210];
    }
    const shade = 0.88 + fine * 0.24;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.min(255, rgb[0] * shade);
      data[idx + 1] = Math.min(255, rgb[1] * shade);
      data[idx + 2] = Math.min(255, rgb[2] * shade);
      data[idx + 3] = Math.max(0, Math.min(1, alpha)) * 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  ringTextureCache.set(cacheKey, texture);
  return texture;
}
