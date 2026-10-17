// 지구 자전 속도가 바뀌면 지표면에서 생기는 일 (순수 계산 — 화면과 분리, 테스트로 검증)
export const EARTH_R = 6.371e6; // m
export const G_SURF = 9.81; // m/s^2
export const OMEGA0 = 7.2921e-5; // rad/s (항성일 23시간 56분)
export const SOUND_SPEED = 343; // m/s
export const SIDEREAL_DAY_H = 23.934;

const deg = Math.PI / 180;

export interface SpinReport {
  /** 지금 자전 속도 / 원래 자전 속도 */
  ratio: number;
  /** 하루 길이 (시간). 멈추면 Infinity */
  dayHours: number;
  /** 그 위도에서 땅이 동쪽으로 움직이는 속도 (m/s) */
  surfaceSpeed: number;
  /** 원심 가속도 (m/s^2) */
  centrifugal: number;
  /** 몸무게로 느끼는 수직 방향 중력 (m/s^2). 0 이하면 둥둥 뜸 */
  gEffective: number;
  /** 원래 몸무게 대비 비율 */
  weightRatio: number;
  /** 적도 쪽으로 끌리는 수평 방향 힘 (m/s^2) */
  equatorwardPull: number;
  /** 이 위도에서 사람이 둥둥 뜨기 시작하는 자전 배율 */
  floatRatio: number;
  /** 지구 편평도 (0 = 완전한 공) */
  flattening: number;
  /** 해수면 변화 진폭 A (m): Δh(φ) = A·(cos²φ − ⅔) */
  seaAmplitude: number;
  /** 적도 / 극 해수면 변화 (m) */
  seaEquator: number;
  seaPole: number;
}

/** 원심력 비율 m = ω²R/g */
export function spinParameter(ratio: number): number {
  return ((ratio * OMEGA0) ** 2 * EARTH_R) / G_SURF;
}

export function spinReport(ratio: number, latDeg: number): SpinReport {
  const lat = latDeg * deg;
  const w = ratio * OMEGA0;
  const c = Math.cos(lat);
  const centrifugal = w * w * EARTH_R * c;
  const gEffective = G_SURF - w * w * EARTH_R * c * c;
  const m = spinParameter(ratio);
  // 유체 행성의 평형 편평도 근사 f ≈ (5/4)m (자전이 아주 빨라 지구가 깨지기 전까지만 의미 있음)
  const flattening = Math.min(0.45, 1.25 * m);
  const seaAmplitude = ((w * w - OMEGA0 * OMEGA0) * EARTH_R * EARTH_R) / (2 * G_SURF);
  return {
    ratio,
    dayHours: ratio <= 1e-6 ? Infinity : SIDEREAL_DAY_H / ratio,
    surfaceSpeed: w * EARTH_R * c,
    centrifugal,
    gEffective,
    weightRatio: gEffective / G_SURF,
    equatorwardPull: w * w * EARTH_R * c * Math.sin(Math.abs(lat)),
    floatRatio: c < 1e-6 ? Infinity : Math.sqrt(G_SURF / (OMEGA0 * OMEGA0 * EARTH_R * c * c)),
    flattening,
    seaAmplitude,
    seaEquator: seaAmplitude * (1 - 2 / 3),
    seaPole: seaAmplitude * (0 - 2 / 3),
  };
}

/** 자전 속도가 갑자기 바뀌면, 땅에 붙어 있지 않은 것(사람·차·공기·바다)이 땅에 대해 갖게 되는 속도 (m/s, 동쪽 +) */
export function suddenChangeVelocity(fromRatio: number, toRatio: number, latDeg: number): number {
  return (fromRatio - toRatio) * OMEGA0 * EARTH_R * Math.cos(latDeg * deg);
}

export interface ImpactAssessment {
  level: 0 | 1 | 2 | 3 | 4;
  title: string;
  detail: string;
}

/** 갑작스러운 속도 변화가 사람·건물에 주는 충격 정도 */
export function assessSudden(dv: number): ImpactAssessment {
  const v = Math.abs(dv);
  const kmh = Math.round(v * 3.6).toLocaleString('ko-KR');
  if (v < 1) return { level: 0, title: '거의 느낄 수 없어요', detail: `땅과의 속도 차이가 시속 ${kmh}km 밖에 안 돼요.` };
  if (v < 15) return { level: 1, title: '휘청! 넘어질 정도', detail: `시속 ${kmh}km — 달리는 버스가 급정거한 것처럼 사람들이 넘어져요.` };
  if (v < 70) return { level: 2, title: '태풍보다 센 돌풍', detail: `시속 ${kmh}km — 가장 강한 태풍급 바람이 불고, 차와 사람이 밀려 날아가요.` };
  if (v < SOUND_SPEED) return { level: 3, title: '모든 것이 휩쓸려요', detail: `시속 ${kmh}km — 고정되지 않은 모든 것이 동쪽으로 내던져지고 건물이 무너져요.` };
  return {
    level: 4,
    title: '소리보다 빠른 충격!',
    detail: `시속 ${kmh}km — 소리보다 빠른 속도로 공기와 바다, 땅 위의 모든 것이 동쪽으로 쏟아져요. 건물은 기초째 부서지고 거대한 해일이 대륙을 덮쳐요.`,
  };
}
