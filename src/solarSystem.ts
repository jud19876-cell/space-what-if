// 태양계 초기 상태와 어린이용 설명.
import { G, SUN_MASS, type Body, type Vec3 } from './physics.ts';

export type BodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'black_hole'
  | 'invader_black_hole'
  | 'giant_black_hole'
  | 'mini_black_hole'
  | 'black_hole_jupiter'
  | (string & {});

export const EARTH_MASS = 5.972e24;
const MOON_MASS = 7.342e22;
const EARTH_MOON_DIST = 0.00257; // AU (약 38만 km)

interface PlanetDef {
  id: BodyId;
  name: string;
  mass: number; // kg
  radiusKm: number;
  a: number; // 태양과의 거리 (AU), 원 궤도로 단순화
  angleDeg: number; // 시작 위치 (보기 좋게 흩어 놓음)
  visualRadius: number;
}

const PLANETS: PlanetDef[] = [
  { id: 'mercury', name: '수성', mass: 3.301e23, radiusKm: 2440, a: 0.387, angleDeg: 20, visualRadius: 0.35 },
  { id: 'venus', name: '금성', mass: 4.867e24, radiusKm: 6052, a: 0.723, angleDeg: 140, visualRadius: 0.55 },
  { id: 'earth', name: '지구', mass: EARTH_MASS, radiusKm: 6371, a: 1.0, angleDeg: 250, visualRadius: 0.6 },
  { id: 'mars', name: '화성', mass: 6.417e23, radiusKm: 3390, a: 1.524, angleDeg: 330, visualRadius: 0.45 },
  { id: 'jupiter', name: '목성', mass: 1.898e27, radiusKm: 69911, a: 5.203, angleDeg: 60, visualRadius: 1.6 },
  { id: 'saturn', name: '토성', mass: 5.683e26, radiusKm: 58232, a: 9.537, angleDeg: 200, visualRadius: 1.35 },
  { id: 'uranus', name: '천왕성', mass: 8.681e25, radiusKm: 25362, a: 19.19, angleDeg: 290, visualRadius: 0.95 },
  { id: 'neptune', name: '해왕성', mass: 1.024e26, radiusKm: 24622, a: 30.07, angleDeg: 110, visualRadius: 0.95 },
];

/** 항상 똑같은 초기 상태를 새로 만든다. (Reset 은 이 함수를 다시 부른다) */
export function createSolarSystem(): Body[] {
  const bodies: Body[] = [
    {
      id: 'sun',
      name: '태양',
      mass: SUN_MASS,
      position: [0, 0, 0],
      velocity: [0, 0, 0],
      physicalRadius: 696340,
      visualRadius: 2.4,
    },
  ];

  for (const p of PLANETS) {
    const th = (p.angleDeg * Math.PI) / 180;
    const dir: Vec3 = [Math.cos(th), Math.sin(th), 0];
    const tangent: Vec3 = [-Math.sin(th), Math.cos(th), 0]; // 반시계 방향 공전

    if (p.id === 'earth') {
      // 지구-달 무게중심이 태양 주위를 돌고, 지구와 달은 그 무게중심을 서로 돈다.
      const total = EARTH_MASS + MOON_MASS;
      const vBary = Math.sqrt((G * (SUN_MASS + total)) / p.a);
      const vRel = Math.sqrt((G * total) / EARTH_MOON_DIST);
      const fe = MOON_MASS / total;
      const fm = EARTH_MASS / total;
      bodies.push({
        id: 'earth',
        name: p.name,
        mass: p.mass,
        position: [dir[0] * (p.a - fe * EARTH_MOON_DIST), dir[1] * (p.a - fe * EARTH_MOON_DIST), 0],
        velocity: [tangent[0] * (vBary - fe * vRel), tangent[1] * (vBary - fe * vRel), 0],
        physicalRadius: p.radiusKm,
        visualRadius: p.visualRadius,
      });
      bodies.push({
        id: 'moon',
        name: '달',
        mass: MOON_MASS,
        position: [dir[0] * (p.a + fm * EARTH_MOON_DIST), dir[1] * (p.a + fm * EARTH_MOON_DIST), 0],
        velocity: [tangent[0] * (vBary + fm * vRel), tangent[1] * (vBary + fm * vRel), 0],
        physicalRadius: 1737,
        visualRadius: 0.22,
      });
      continue;
    }

    const v = Math.sqrt((G * (SUN_MASS + p.mass)) / p.a);
    bodies.push({
      id: p.id,
      name: p.name,
      mass: p.mass,
      position: [dir[0] * p.a, dir[1] * p.a, 0],
      velocity: [tangent[0] * v, tangent[1] * v, 0],
      physicalRadius: p.radiusKm,
      visualRadius: p.visualRadius,
    });
  }

  // 전체 질량중심을 원점에, 전체 운동량을 0 으로 맞춘다. (태양계가 화면 밖으로 흘러가지 않게)
  let m = 0;
  const cp: Vec3 = [0, 0, 0];
  const cv: Vec3 = [0, 0, 0];
  for (const b of bodies) {
    m += b.mass;
    for (let k = 0; k < 3; k++) {
      cp[k] += b.mass * b.position[k];
      cv[k] += b.mass * b.velocity[k];
    }
  }
  for (const b of bodies) {
    for (let k = 0; k < 3; k++) {
      b.position[k] -= cp[k] / m;
      b.velocity[k] -= cv[k] / m;
    }
  }
  return bodies;
}

/** 원래 궤도 반지름 (화면에 흐린 기준선으로 그린다) */
export const ORBIT_RADII: { id: BodyId; a: number }[] = PLANETS.map((p) => ({ id: p.id, a: p.a }));

export interface BodyInfo {
  emoji: string;
  color: string;
  lines: string[];
}

export const BODY_INFO: Record<BodyId, BodyInfo> = {
  sun: { emoji: '☀️', color: '#ffcc33', lines: ['스스로 빛나는 별이야!', '태양의 중력이 행성들을 붙잡고 있어.'] },
  mercury: { emoji: '🪨', color: '#b8aea2', lines: ['태양에 가장 가까운 행성이야.', '88일이면 태양을 한 바퀴 돌아!'] },
  venus: { emoji: '🟡', color: '#e8c27a', lines: ['가장 뜨거운 행성이야!', '두꺼운 구름에 덮여 있어.'] },
  earth: { emoji: '🌍', color: '#3d8bfd', lines: ['우리가 살고 있는 행성이야!', '태양을 한 바퀴 도는 데 약 1년이 걸려.'] },
  moon: { emoji: '🌙', color: '#d6d6d6', lines: ['지구 곁을 도는 친구야.', '한 바퀴 도는 데 약 한 달이 걸려.'] },
  mars: { emoji: '🔴', color: '#e0603a', lines: ['빨간 행성이야!', '붉은 흙과 먼지로 덮여 있어.'] },
  jupiter: { emoji: '🟠', color: '#d9a066', lines: ['가장 큰 행성이야!', '지구가 1000개 넘게 들어가.'] },
  saturn: { emoji: '🪐', color: '#e8d29a', lines: ['멋진 고리를 가진 행성이야!', '고리는 얼음과 돌 조각이야.'] },
  uranus: { emoji: '🔵', color: '#8fe0e8', lines: ['옆으로 누워서 도는 행성이야.', '아주아주 추워!'] },
  neptune: { emoji: '💙', color: '#4a6cf0', lines: ['가장 멀리 있는 행성이야.', '태양을 한 바퀴 도는 데 165년!'] },
  black_hole: { emoji: '🕳️', color: '#b366ff', lines: ['빛조차 빠져나갈 수 없는 우주의 신비로운 천체야!', '태양과 무게가 같아서 행성들은 빨려 들어가지 않고 그대로 돌아!'] },
  invader_black_hole: { emoji: '🕳️👾', color: '#f43f5e', lines: ['태양계 밖에서 침입한 거대한 방랑 블랙홀이야!', '강력한 중력으로 행성들의 궤도를 흔들어 놓아.'] },
  giant_black_hole: { emoji: '🕳️🌪️', color: '#a855f7', lines: ['태양의 30배나 무거운 초대질량 괴물 블랙홀이야!', '엄청난 힘으로 주변의 모든 것을 빨아들여!'] },
  mini_black_hole: { emoji: '🕳️✨', color: '#38bdf8', lines: ['지구 곁에 나타난 작은 미니 블랙홀이야!', '작아 보여도 지구만큼 무거운 우주의 포식자야.'] },
  black_hole_jupiter: { emoji: '🕳️🟠', color: '#f97316', lines: ['목성이 초고밀도로 찌그러져 블랙홀이 되었어!', '목성의 달들이 여전히 그 주위를 맴돌고 있어.'] },
  asteroid: { emoji: '☄️', color: '#ff6622', lines: ['우주를 날아다니는 소행성이야!', '행성과 충돌하면 궤도를 흔들어 놓을 수 있어!'] },
  giant_asteroid: { emoji: '💥☄️', color: '#ff2244', lines: ['행성을 산산조각 낼 수 있는 거대 소행성이야!', '엄청난 충돌 에너지로 행성을 파괴해!'] },
  fragment: { emoji: '🪨', color: '#d0a87a', lines: ['행성이 폭발하면서 흩어진 파편이야!', '새로운 파편 조각들이 우주를 돌고 있어.'] },
};
