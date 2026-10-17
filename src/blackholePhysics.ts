// 블랙홀 시뮬레이션용 물리 계산 (슈바르츠실트 블랙홀, 회전 없음)
// 화면/Three.js 와 분리된 순수 함수 → scripts/check-physics.ts 에서 숫자로 검증한다.

export const G_SI = 6.674e-11; // m^3 / (kg s^2)
export const C_SI = 2.998e8; // m/s
export const SUN_KG = 1.989e30;
export const G0 = 9.81; // 지구 표면 중력가속도 (m/s^2)

export type SubjectKind = 'astronaut' | 'star' | 'noodle';

export interface BlackHolePreset {
  id: string;
  name: string;
  massSuns: number;
  /** 강착원반 밝기 (먹이가 많은 항성 블랙홀은 밝고, 궁수자리 A* 는 조용하다) */
  diskBrightness: number;
}

export const BH_PRESETS: Record<string, BlackHolePreset> = {
  stellar: { id: 'stellar', name: '항성 블랙홀 (태양 10배)', massSuns: 10, diskBrightness: 1.0 },
  sgrA: { id: 'sgrA', name: '궁수자리 A* (태양 430만 배)', massSuns: 4.3e6, diskBrightness: 0.55 },
};

/** 슈바르츠실트 반지름 rs = 2GM/c^2 (m) */
export function schwarzschildRadius(massKg: number): number {
  return (2 * G_SI * massKg) / (C_SI * C_SI);
}

/** 머리와 발 사이 중력 차이(조석 가속도) Δa ≈ 2GM·h / r^3 (m/s^2) */
export function tidalAcceleration(massKg: number, rMeters: number, heightMeters: number): number {
  return (2 * G_SI * massKg * heightMeters) / Math.pow(rMeters, 3);
}

/** 별이 블랙홀에 찢기는 조석 파괴 반지름 r_t ≈ R* (M_bh / M*)^(1/3) (m) */
export function tidalDisruptionRadius(bhMassKg: number, starRadiusM: number, starMassKg: number): number {
  return starRadiusM * Math.cbrt(bhMassKg / starMassKg);
}

/** 멀리 있는 관찰자가 본 시계 속도 √(1 − rs/r)  (지평선에서 0) */
export function timeDilationFactor(x: number): number {
  return x <= 1 ? 0 : Math.sqrt(1 - 1 / x);
}

// 우주인: 키 2 m, 몸이 버틸 수 있는 조석 가속도 한계를 대략 50 g 로 본다 (교육용 근사)
export const ASTRONAUT_HEIGHT_M = 2;
export const ASTRONAUT_LIMIT_MS2 = 50 * G0;
// 별: 태양과 같은 별
export const STAR_RADIUS_M = 6.96e8;
export const STAR_MASS_KG = SUN_KG;

export interface TidalReport {
  /** 거리 r / rs */
  x: number;
  rMeters: number;
  rsMeters: number;
  /** 머리-발 중력 차이 (g 단위). 별이면 별 표면 기준 */
  tidalG: number;
  /** 몸(또는 별)이 버티는 힘 대비 조석력의 비율. 1 을 넘으면 찢어지기 시작 */
  q: number;
  /** 화면에서 몸이 늘어나는 배율 */
  stretch: number;
  timeFactor: number;
  stage: 1 | 2 | 3 | 4 | 5;
}

export function tidalReport(massSuns: number, x: number, subject: SubjectKind): TidalReport {
  const mKg = massSuns * SUN_KG;
  const rs = schwarzschildRadius(mKg);
  const r = Math.max(1e-6, x) * rs;
  let q: number;
  let tidalG: number;
  if (subject === 'star') {
    const rt = tidalDisruptionRadius(mKg, STAR_RADIUS_M, STAR_MASS_KG);
    q = Math.pow(rt / r, 3);
    tidalG = tidalAcceleration(mKg, r, STAR_RADIUS_M) / G0;
  } else {
    const a = tidalAcceleration(mKg, r, ASTRONAUT_HEIGHT_M);
    tidalG = a / G0;
    q = a / ASTRONAUT_LIMIT_MS2;
  }
  return {
    x,
    rMeters: r,
    rsMeters: rs,
    tidalG,
    q,
    stretch: stretchFromQ(q),
    timeFactor: timeDilationFactor(x),
    stage: stageOf(x, q),
  };
}

/** 조석 비율 q → 화면 늘어남 배율 (q<0.02 이면 거의 그대로, 찢어진 뒤에는 실처럼 길게) */
export function stretchFromQ(q: number): number {
  if (q <= 0.02) return 1;
  const k = Math.log10(q / 0.02);
  return Math.min(22, 1 + 0.55 * Math.pow(k, 1.7));
}

/**
 * 단계: 1 편안함 / 2 당김 느낌 / 3 스파게티화 / 4 원자 흐름으로 찢김 / 5 사건의 지평선 안
 * (지평선 안쪽이면 q 와 상관없이 5)
 */
export function stageOf(x: number, q: number): 1 | 2 | 3 | 4 | 5 {
  if (x <= 1) return 5;
  if (q >= 60) return 4;
  if (q >= 1) return 3;
  if (q >= 0.02) return 2;
  return 1;
}

/**
 * 낙하 속도 (rs / 초, 시뮬레이션 시간).
 * - 멀리 있는 관찰자 시점: dr/dt ∝ (1 − rs/r)·√(rs/r) → 지평선에 가까울수록 느려져 영원히 닿지 않는 것처럼 보임
 * - 우주인 본인 시점: dr/dτ ∝ √(rs/r) → 유한한 시간에 지평선을 지나 특이점까지
 */
export function infallRate(x: number, observer: 'far' | 'self', k = 5): number {
  const xs = Math.max(x, 1e-3);
  if (observer === 'far') return k * Math.max(0, 1 - 1 / xs) * Math.sqrt(1 / xs);
  return k * Math.sqrt(1 / xs);
}

// ---------- 빛의 휘어짐 (슈바르츠실트 광자 궤도) ----------
// 단위 rs = 1. 광자 궤도는 a = −(3/2)·h²·r⃗ / r⁵ 운동방정식과 모양이 정확히 같다.
export interface LightRay {
  impact: number; // 충돌 매개변수 b (rs 단위)
  points: [number, number][]; // (x, y) 평면 좌표 (rs 단위)
  captured: boolean;
}

/** 임계 충돌 매개변수 b_c = (3√3/2) rs ≈ 2.598 rs. 이보다 가까이 오는 빛은 삼켜진다 */
export const CRITICAL_IMPACT = (3 * Math.sqrt(3)) / 2;

export function traceLightRay(impact: number, startX = -40, maxR = 45, step = 0.02): LightRay {
  let x = startX;
  let y = impact;
  let vx = 1;
  let vy = 0;
  const h = Math.abs(x * vy - y * vx);
  const pts: [number, number][] = [[x, y]];
  let captured = false;
  let travelled = 0;
  for (let i = 0; i < 60000; i++) {
    const r2 = x * x + y * y;
    const r = Math.sqrt(r2);
    if (r <= 1.0) {
      captured = true;
      break;
    }
    if (r > maxR && x > 0) break;
    // 반지름이 작을수록 잘게 적분 (광자구 근처에서 정확도 유지)
    const ds = step * Math.min(1, Math.max(0.05, (r - 1) * 0.5));
    const f = (-1.5 * h * h) / (r2 * r2 * r);
    // 반 스텝 속도 → 위치 → 반 스텝 속도 (leapfrog). 중심력이라 h 는 보존되고 궤도 모양이 광자 궤도와 일치
    vx += f * x * ds * 0.5;
    vy += f * y * ds * 0.5;
    x += vx * ds;
    y += vy * ds;
    const r2b = x * x + y * y;
    const rb = Math.sqrt(r2b);
    const fb = (-1.5 * h * h) / (r2b * r2b * rb);
    vx += fb * x * ds * 0.5;
    vy += fb * y * ds * 0.5;
    travelled += Math.hypot(vx, vy) * ds;
    if (travelled > (rb < 3 ? 0.06 : 0.25)) {
      pts.push([x, y]);
      travelled = 0;
    }
    if (pts.length > 6000) break;
  }
  if (travelled > 0) pts.push([x, y]);
  return { impact, points: pts, captured };
}
