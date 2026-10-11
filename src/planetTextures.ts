import * as THREE from 'three';

/**
 * 프랙탈 브라운 운동(fBm)과 3D 구면 좌표계 기반 고해상도(1024x512) 천체 텍스처 및 노멀맵 생성기
 */

// 다중 옥타브 프랙탈 노이즈
function pseudoNoise(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// 부드러운 3D 인터폴레이션 노이즈
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

  const n000 = pseudoNoise(ix, iy, iz);
  const n100 = pseudoNoise(ix + 1, iy, iz);
  const n010 = pseudoNoise(ix, iy + 1, iz);
  const n110 = pseudoNoise(ix + 1, iy + 1, iz);
  const n001 = pseudoNoise(ix, iy, iz + 1);
  const n101 = pseudoNoise(ix + 1, iy, iz + 1);
  const n011 = pseudoNoise(ix, iy + 1, iz + 1);
  const n111 = pseudoNoise(ix + 1, iy + 1, iz + 1);

  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;

  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;

  return y0 + (y1 - y0) * w;
}

function fbm(x: number, y: number, z: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
  let sum = 0;
  let freq = 1;
  let amp = 0.5;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x * freq + i * 17.13, y * freq + z * freq * 0.5 + i * 29.37, z * freq) * amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  const clampT = Math.max(0, Math.min(1, t));
  return [
    c1[0] + (c2[0] - c1[0]) * clampT,
    c1[1] + (c2[1] - c1[1]) * clampT,
    c1[2] + (c2[2] - c1[2]) * clampT,
  ];
}

/**
 * 1024x512 고품질 행성 디퓨즈 텍스처 생성
 */
export function createPlanetTexture(id: string, width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const lon = u * Math.PI * 2;

      // 3D 구면 좌표계 단위 벡터 (극점 왜곡 없는 매끄러운 노이즈)
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      let rgb: [number, number, number] = [200, 200, 200];

      switch (id) {
        case 'sun': {
          const plasma = fbm(nx * 3, ny * 3, nz * 3, 4) * 0.7 + fbm(nx * 8 + 5, ny * 8 + 5, nz * 8, 4) * 0.3;
          if (plasma < 0.45) rgb = lerpColor([220, 30, 5], [255, 120, 10], plasma / 0.45);
          else if (plasma < 0.75) rgb = lerpColor([255, 120, 10], [255, 225, 60], (plasma - 0.45) / 0.3);
          else rgb = lerpColor([255, 225, 60], [255, 250, 220], (plasma - 0.75) / 0.25);
          // 흑점
          const sunspot = fbm(nx * 5 + 10, ny * 5 + 20, nz * 5, 3);
          if (sunspot < 0.2) rgb = lerpColor([60, 10, 5], rgb, sunspot / 0.2);
          break;
        }
        case 'earth': {
          const polar = Math.abs(v - 0.5) * 2;
          if (polar > 0.85) {
            const ice = fbm(nx * 6, ny * 6, nz * 6, 3);
            rgb = lerpColor([235, 245, 255], [255, 255, 255], ice);
          } else {
            const land = fbm(nx * 2.2 + 10, ny * 2.2 + 10, nz * 2.2 + 10, 5);
            if (land < 0.46) {
              rgb = lerpColor([5, 30, 95], [20, 95, 165], land / 0.46);
            } else {
              const tLand = (land - 0.46) / 0.54;
              if (tLand < 0.08) rgb = [195, 175, 125];
              else if (tLand < 0.55) {
                const veg = fbm(nx * 3 + 50, ny * 3 + 50, nz * 3, 3);
                rgb = veg > 0.5 ? [175, 140, 80] : [30, 125, 45];
              } else if (tLand < 0.85) {
                rgb = lerpColor([30, 125, 45], [115, 100, 95], (tLand - 0.55) / 0.3);
              } else {
                rgb = lerpColor([115, 100, 95], [245, 245, 250], (tLand - 0.85) / 0.15);
              }
            }
          }
          // 부드러운 대기 구름 소용돌이
          const cloud = fbm(u * 6 + 30, v * 3 + 20, nx * 4, 4);
          if (cloud > 0.52) {
            const cAlpha = (cloud - 0.52) / 0.48;
            rgb = lerpColor(rgb, [255, 255, 255], cAlpha * 0.82);
          }
          break;
        }
        case 'jupiter': {
          const latBand = Math.sin(v * 48) * 0.35 + Math.sin(v * 16) * 0.25 + 0.5;
          const turb = fbm(u * 14 + 5, v * 28 + 5, nx * 6, 4) * 0.4;
          const band = Math.max(0, Math.min(1, latBand + turb));
          if (band < 0.35) rgb = lerpColor([120, 70, 38], [190, 132, 86], band / 0.35);
          else if (band < 0.7) rgb = lerpColor([190, 132, 86], [210, 108, 62], (band - 0.35) / 0.35);
          else rgb = lerpColor([210, 108, 62], [242, 224, 198], (band - 0.7) / 0.3);
          // 대적점
          const dx = u - 0.58;
          const dy = (v - 0.34) * 2.8;
          const distSpot = dx * dx + dy * dy;
          if (distSpot < 0.0045) {
            const spotT = 1 - distSpot / 0.0045;
            rgb = lerpColor(rgb, [225, 65, 30], spotT);
          }
          break;
        }
        case 'saturn': {
          const band = Math.sin(v * 32) * 0.25 + Math.sin(v * 12) * 0.15 + 0.6;
          const micro = fbm(u * 8, v * 18, nx * 4, 3) * 0.15;
          const t = Math.max(0, Math.min(1, band + micro));
          rgb = t < 0.5 ? lerpColor([195, 165, 122], [230, 210, 178], t * 2) : lerpColor([230, 210, 178], [240, 216, 158], (t - 0.5) * 2);
          break;
        }
        case 'mars': {
          const polar = Math.abs(v - 0.5) * 2;
          if (polar > 0.9) rgb = [245, 245, 250];
          else {
            const terrain = fbm(nx * 3.5 + 2, ny * 3.5 + 2, nz * 3.5, 5);
            rgb = terrain < 0.4 ? lerpColor([115, 55, 30], [220, 108, 52], terrain / 0.4) : lerpColor([220, 108, 52], [235, 148, 82], (terrain - 0.4) / 0.6);
          }
          break;
        }
        case 'venus': {
          const cloud = fbm(u * 7 + 12, v * 14 + 8, nx * 5, 4);
          rgb = lerpColor([184, 132, 72], lerpColor([224, 178, 108], [245, 224, 158], cloud), cloud);
          break;
        }
        case 'mercury': {
          const rock = fbm(nx * 8 + 3, ny * 8 + 3, nz * 8, 5);
          rgb = rock < 0.5 ? lerpColor([92, 92, 98], [140, 140, 148], rock * 2) : lerpColor([140, 140, 148], [192, 192, 200], (rock - 0.5) * 2);
          break;
        }
        case 'moon': {
          const mare = fbm(nx * 2.5 + 7, ny * 2.5 + 7, nz * 2.5, 4);
          const craters = fbm(nx * 10 + 15, ny * 10 + 15, nz * 10, 4) * 0.35;
          const total = Math.max(0, Math.min(1, mare + craters));
          rgb = total < 0.45 ? lerpColor([82, 84, 92], [210, 210, 216], total / 0.45) : lerpColor([210, 210, 216], [240, 240, 245], (total - 0.45) / 0.55);
          break;
        }
        case 'uranus': {
          const band = Math.sin(v * 20) * 0.12 + 0.88;
          rgb = lerpColor([96, 184, 204], [148, 224, 235], band);
          break;
        }
        case 'neptune': {
          const storm = fbm(u * 9 + 4, v * 18 + 4, nx * 5, 4);
          rgb = lerpColor([30, 72, 225], [82, 148, 250], storm);
          // 대흑점
          const dx = u - 0.42;
          const dy = (v - 0.38) * 3;
          if (dx * dx + dy * dy < 0.003) rgb = [15, 38, 115];
          break;
        }
        default: {
          // 커스텀 외계행성
          const hash = Math.abs(id.split('').reduce((acc, ch) => (acc << 5) - acc + ch.charCodeAt(0), 0));
          const r1 = (hash % 100) / 100;
          const g1 = ((hash >> 3) % 100) / 100;
          const b1 = ((hash >> 6) % 100) / 100;
          const n = fbm(nx * 4 + r1 * 10, ny * 4 + g1 * 10, nz * 4, 4);
          rgb = lerpColor([r1 * 255, g1 * 255, b1 * 255], [(1 - g1) * 255, (1 - b1) * 255, (1 - r1) * 255], n);
          break;
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(rgb[0]);
      data[idx + 1] = Math.round(rgb[1]);
      data[idx + 2] = Math.round(rgb[2]);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * 디퓨즈 캔버스로부터 입체 노멀맵(Normal Map) 자동 생성
 */
export function createNormalMap(diffuseTexture: THREE.CanvasTexture, bumpStrength = 2.0): THREE.CanvasTexture {
  const srcCanvas = diffuseTexture.image as HTMLCanvasElement;
  const width = srcCanvas.width;
  const height = srcCanvas.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const srcCtx = srcCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, width, height).data;

  const normalImg = ctx.createImageData(width, height);
  const dstData = normalImg.data;

  for (let y = 0; y < height; y++) {
    const yDown = (y - 1 + height) % height;
    const yUp = (y + 1) % height;

    for (let x = 0; x < width; x++) {
      const xLeft = (x - 1 + width) % width;
      const xRight = (x + 1) % width;

      const getGray = (px: number, py: number) => {
        const i = (py * width + px) * 4;
        return (srcData[i] * 0.299 + srcData[i + 1] * 0.587 + srcData[i + 2] * 0.114) / 255;
      };

      const hL = getGray(xLeft, y);
      const hR = getGray(xRight, y);
      const hD = getGray(x, yDown);
      const hU = getGray(x, yUp);

      const dX = (hL - hR) * bumpStrength;
      const dY = (hD - hU) * bumpStrength;
      const len = Math.sqrt(dX * dX + dY * dY + 1.0);

      const nx = dX / len;
      const ny = dY / len;
      const nz = 1.0 / len;

      const idx = (y * width + x) * 4;
      dstData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dstData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dstData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dstData[idx + 3] = 255;
    }
  }

  ctx.putImageData(normalImg, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * 토성 및 천왕성의 정밀 알파 투명 링 텍스처 (카시니 간극 완벽 구현)
 */
export function createRingTexture(planetId = 'saturn', width = 512, height = 16): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const isSaturn = planetId === 'saturn';
  const baseColor = isSaturn ? [235, 215, 165] : [160, 225, 240];

  for (let x = 0; x < width; x++) {
    const t = x / width; // 내경(0) ~ 외경(1)
    let alpha = 0.85;

    // 가장자리 페이드
    if (t < 0.08) alpha = (t / 0.08) * 0.8;
    else if (t > 0.92) alpha = ((1 - t) / 0.08) * 0.8;

    // 카시니 간극 (Cassini Division: r = 0.66 ~ 0.74 지점 암흑 간극)
    if (isSaturn && t >= 0.66 && t <= 0.74) {
      alpha *= 0.04;
    }
    // 엔케 간극 (Encke Gap: r = 0.86 ~ 0.88)
    if (isSaturn && t >= 0.86 && t <= 0.88) {
      alpha *= 0.12;
    }

    // 미세 얼음 알갱이 띠 줄무늬
    const bandNoise = Math.sin(t * 180) * 0.15 + Math.sin(t * 450) * 0.08;
    const r = Math.min(255, Math.max(0, baseColor[0] * (1.0 + bandNoise)));
    const g = Math.min(255, Math.max(0, baseColor[1] * (1.0 + bandNoise)));
    const b = Math.min(255, Math.max(0, baseColor[2] * (1.0 + bandNoise)));

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
