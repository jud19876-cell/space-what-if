// N-body 중력 계산.
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

// 만유인력 상수 G 를 AU^3 / (kg * day^2) 로 변환한 값.
// GM_sun = k^2 = 2.9591220828559e-4 AU^3/day^2 (가우스 중력 상수)
export const SUN_MASS = 1.98847e30;
export const G = 2.9591220828559e-4 / SUN_MASS;

// AU/day -> km/s
export const AU_PER_DAY_TO_KM_S = 1.495978707e8 / 86400;

const KM_TO_AU = 1 / 1.495978707e8;

// 소프트닝: 두 천체가 겹칠 때 힘이 무한대로 커지는 것을 막는다.
// 두 천체의 실제 반지름 합을 쓰며, 블랙홀의 경우 수치 안정성을 위해 최소 30,000km 완충 반경을 둔다.
function softening2(a: Body, b: Body): number {
  const isBh = a.id.includes('black_hole') || b.id.includes('black_hole');
  const minKm = isBh ? 30000 : 0;
  const s = Math.max(a.physicalRadius + b.physicalRadius, minKm) * KM_TO_AU;
  return s * s;
}
const BASE_DT = 0.05; // 기본 스텝 (일). 달 공전(27일)도 충분히 안정적.
const ETA = 0.02; // 가까이 접근하면 스텝을 자동으로 줄이는 비율

/** 모든 천체의 가속도와, 가장 빠른 상호작용 시간 규모(tmin)를 계산한다. O(N^2) */
function computeAccelerations(bodies: Body[]): { acc: Float64Array; tmin: number } {
  const n = bodies.length;
  const acc = new Float64Array(n * 3);
  let tmin = Infinity;
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      const dx = b.position[0] - a.position[0];
      const dy = b.position[1] - a.position[1];
      const dz = b.position[2] - a.position[2];
      const r2 = dx * dx + dy * dy + dz * dz + softening2(a, b);
      const r = Math.sqrt(r2);
      const invR3 = 1 / (r2 * r);
      // a_i += G m_j r_ij / |r|^3 , a_j -= G m_i r_ij / |r|^3
      const fa = G * b.mass * invR3;
      const fb = G * a.mass * invR3;
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
 * Velocity Verlet(Leapfrog, kick-drift-kick) 적분으로 `days` 만큼 시간을 진행한다.
 * 천체끼리 가까워지면 스텝 크기를 자동으로 줄인다.
 * 반환값: 실제로 진행한 시간(일). maxSteps 에 막히면 days 보다 작을 수 있다.
 */
export function stepBodies(bodies: Body[], days: number, maxSteps = 20000): number {
  if (bodies.length === 0 || days <= 0) return 0;
  let { acc, tmin } = computeAccelerations(bodies);
  let t = 0;
  let steps = 0;
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
