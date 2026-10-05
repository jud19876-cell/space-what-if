// N-body 중력 계산 + 블랙홀 조석 붕괴 및 사건의 지평선 흡수(Event Horizon Infall)
// 단위: 거리 = AU, 시간 = 일(day), 질량 = kg
// 화면 표시 크기/거리와는 완전히 분리되어 있다. (화면 변환은 scene.ts)

export type Vec3 = [number, number, number];

export interface Body {
  id: string;
  name: string;
  mass: number; // kg
  position: Vec3; // AU
  velocity: Vec3; // AU / day
  physicalRadius: number; // km (실제 반지름, 정보 표시용)
  visualRadius: number; // 화면 단위 (보기 좋게 조절한 크기)
}

export interface AbsorptionEvent {
  blackHoleId: string;
  blackHoleName: string;
  swallowedId: string;
  swallowedName: string;
}

// 만유인력 상수 G 를 AU^3 / (kg * day^2) 로 변환한 값.
// GM_sun = k^2 = 2.9591220828559e-4 AU^3/day^2 (가우스 중력 상수)
export const SUN_MASS = 1.98847e30;
export const G = 2.9591220828559e-4 / SUN_MASS;

// AU/day -> km/s
export const AU_PER_DAY_TO_KM_S = 1.495978707e8 / 86400;

const KM_TO_AU = 1 / 1.495978707e8;

// 소프트닝: 두 천체가 겹칠 때 힘이 무한대로 커지는 것을 막는다.
function softening2(a: Body, b: Body): number {
  const isBh = a.id.includes('black_hole') || b.id.includes('black_hole');
  const minKm = isBh ? 40000 : 0;
  const s = Math.max(a.physicalRadius + b.physicalRadius, minKm) * KM_TO_AU;
  return s * s;
}

const BASE_DT = 0.05; // 기본 스텝 (일). 달 공전(27일)도 충분히 안정적.
const ETA = 0.02; // 가까이 접근하면 스텝을 자동으로 줄이는 비율

/** 블랙홀 사건의 지평선 및 흡수 포획 반경 (AU) */
export function getBlackHoleCaptureRadius(bh: Body): number {
  const isMini = bh.id.includes('mini');
  if (isMini) return 0.003; // 약 45만 km
  const massRatio = Math.max(0.1, bh.mass / SUN_MASS);
  // 1 M_sun -> 0.055 AU (수성 0.387 AU보다 훨씬 안쪽, 행성 공전 안전 유지)
  // 30 M_sun -> 약 0.36 AU (내행성들을 사건의 지평선으로 흡수)
  return 0.055 * Math.pow(massRatio, 0.55);
}

/** 블랙홀 상대론적 조석 붕괴 및 소용돌이 나선 낙하 영역 (ISCO / Accretion Basin, AU) */
export function getBlackHoleInspiralRadius(bh: Body): number {
  return getBlackHoleCaptureRadius(bh) * 3.4;
}

/** 모든 천체의 가속도와, 가장 빠른 상호작용 시간 규모(tmin)를 계산한다. O(N^2) */
function computeAccelerations(bodies: Body[]): { acc: Float64Array; tmin: number } {
  const n = bodies.length;
  const acc = new Float64Array(n * 3);
  let tmin = Infinity;
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    const isBhA = a.id.includes('black_hole');
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      const isBhB = b.id.includes('black_hole');

      const dx = b.position[0] - a.position[0];
      const dy = b.position[1] - a.position[1];
      const dz = b.position[2] - a.position[2];
      const r2 = dx * dx + dy * dy + dz * dz + softening2(a, b);
      const r = Math.sqrt(r2);
      const invR3 = 1 / (r2 * r);

      let fa = G * b.mass * invR3;
      let fb = G * a.mass * invR3;

      // 블랙홀 시공간 왜곡: 조석 유인 반경 안으로 들어오면 일반 상대론적 나선 낙하(Inspiral)를 위해 인력 강화
      if (isBhA && !isBhB) {
        const rInsp = getBlackHoleInspiralRadius(a);
        if (r < rInsp) {
          const factor = 1 + Math.pow((rInsp - r) / rInsp, 1.4) * 3.5;
          fb *= factor;
        }
      } else if (isBhB && !isBhA) {
        const rInsp = getBlackHoleInspiralRadius(b);
        if (r < rInsp) {
          const factor = 1 + Math.pow((rInsp - r) / rInsp, 1.4) * 3.5;
          fa *= factor;
        }
      }

      acc[i * 3] += dx * fa;
      acc[i * 3 + 1] += dy * fa;
      acc[i * 3 + 2] += dz * fa;
      acc[j * 3] -= dx * fb;
      acc[j * 3 + 1] -= dy * fb;
      acc[j * 3 + 2] -= dz * fb;

      const gm = G * (a.mass + b.mass);
      if (gm > 0) {
        const t = Math.sqrt((r2 * r) / gm); // 자유낙하 시간 규모
        if (t < tmin) tmin = t;
      }
    }
  }
  return { acc, tmin };
}

/**
 * Velocity Verlet(Leapfrog) 적분 + 블랙홀 조석 제동 및 흡수 소멸 처리.
 * 블랙홀로 낙하 시 튕겨나가는 '중력점프'를 완전히 제거하고 나선형으로 빨려 들어가 삼켜집니다.
 */
export function stepBodies(
  bodies: Body[],
  days: number,
  maxSteps = 20000,
  onAbsorb?: (ev: AbsorptionEvent) => void,
): number {
  if (bodies.length === 0 || days <= 0) return 0;
  let { acc, tmin } = computeAccelerations(bodies);
  let t = 0;
  let steps = 0;
  const absorbedSet = new Set<string>();

  while (t < days && steps < maxSteps) {
    const dt = Math.min(BASE_DT, ETA * tmin, days - t);
    const half = dt / 2;

    for (let i = 0; i < bodies.length; i++) {
      const v = bodies[i].velocity;
      const p = bodies[i].position;
      v[0] += acc[i * 3] * half;
      v[1] += acc[i * 3 + 1] * half;
      v[2] += acc[i * 3 + 2] * half;
      p[0] += v[0] * dt;
      p[1] += v[1] * dt;
      p[2] += v[2] * dt;
    }

    // 블랙홀 조석 제동 (중력점프 방지) 및 사건의 지평선 흡수 검사
    for (let i = 0; i < bodies.length; i++) {
      const bh = bodies[i];
      if (!bh.id.includes('black_hole') || absorbedSet.has(bh.id)) continue;
      const rCap = getBlackHoleCaptureRadius(bh);
      const rInsp = getBlackHoleInspiralRadius(bh);

      for (let j = 0; j < bodies.length; j++) {
        if (i === j) continue;
        const p = bodies[j];
        if (p.id.includes('black_hole') || absorbedSet.has(p.id)) continue;

        const dx = p.position[0] - bh.position[0];
        const dy = p.position[1] - bh.position[1];
        const dz = p.position[2] - bh.position[2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // 1. 사건의 지평선 통과: 완전히 흡수되어 삼켜짐 (Absorb)
        if (r <= rCap) {
          absorbedSet.add(p.id);
          bh.mass += p.mass;
          bh.visualRadius = Math.min(6.5, bh.visualRadius + 0.08);
          onAbsorb?.({
            blackHoleId: bh.id,
            blackHoleName: bh.name,
            swallowedId: p.id,
            swallowedName: p.name,
          });
          continue;
        }

        // 2. 조석 제동: 탈출하려는 외향 속도를 소용돌이 강착으로 전환 (중력점프 제거)
        if (r < rInsp) {
          const vxRel = p.velocity[0] - bh.velocity[0];
          const vyRel = p.velocity[1] - bh.velocity[1];
          const vzRel = p.velocity[2] - bh.velocity[2];
          const radSpeed = (dx * vxRel + dy * vyRel + dz * vzRel) / r;
          if (radSpeed > 0) {
            // 바깥으로 튕겨나가는 속도를 강착 마찰로 급격히 감쇠시켜 나선형 흡수로 유도
            const damp = Math.min(0.4 * dt, 0.45);
            p.velocity[0] -= (dx / r) * radSpeed * damp;
            p.velocity[1] -= (dy / r) * radSpeed * damp;
            p.velocity[2] -= (dz / r) * radSpeed * damp;
          }
        }
      }
    }

    // 흡수된 천체 즉시 제거
    if (absorbedSet.size > 0) {
      const remaining = bodies.filter((b) => !absorbedSet.has(b.id));
      bodies.length = 0;
      bodies.push(...remaining);
      absorbedSet.clear();
      if (bodies.length <= 1) {
        t += dt;
        break;
      }
    }

    ({ acc, tmin } = computeAccelerations(bodies));
    for (let i = 0; i < bodies.length; i++) {
      const v = bodies[i].velocity;
      v[0] += acc[i * 3] * half;
      v[1] += acc[i * 3 + 1] * half;
      v[2] += acc[i * 3 + 2] * half;
    }
    t += dt;
    steps++;
  }
  return t;
}

/** 전체 에너지 (운동 + 위치). 테스트용. */
export function totalEnergy(bodies: Body[]): number {
  let e = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    const v = a.velocity;
    e += 0.5 * a.mass * (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const r = Math.sqrt(dist2(a.position, b.position) + softening2(a, b));
      e -= (G * a.mass * b.mass) / r;
    }
  }
  return e;
}

export function dist2(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}
