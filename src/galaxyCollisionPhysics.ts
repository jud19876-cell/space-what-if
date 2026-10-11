// 은하 대충돌 & 심우주 N-Body 천체물리 엔진
// 두 거대 나선은하(우리은하 & 안드로스/안드로메다)의 상호 중력 섭동, 조석 꼬리(Tidal Tails),
// 성운 가스 구름 및 초대질량 블랙홀의 은하 포식 현상을 정밀 시뮬레이션한다.

export interface GalacticCore {
  id: string;
  name: string;
  mass: number;
  pos: [number, number, number];
  vel: [number, number, number];
  radius: number;
  color: string;
  isBlackHole?: boolean;
}

export interface GalaxyParticles {
  pos: Float32Array;      // [x, y, z] * count
  vel: Float32Array;      // [vx, vy, vz] * count
  color: Float32Array;    // [r, g, b] * count
  size: Float32Array;     // [size] * count
  galaxyId: Uint8Array;   // 0: 우리은하, 1: 안드로스은하, 2: 포획/가스
  isGas: Uint8Array;      // 0: 별(Star), 1: 성운 가스 구름(Nebula Gas Cloud)
  alive: Uint8Array;      // 1: 생존, 0: 블랙홀 흡수
  count: number;
}

export type GalaxyScenarioType =
  | 'head_on'       // 💥 정면 관통 대충돌 (고리 은하 형성)
  | 'grazing'       // 🌀 조석 꼬리 스침 충돌 (더듬이/생쥐 은하)
  | 'supermassive'  // 🕳️ 초대질량 괴물 블랙홀 [가르간튀아]의 은하 쌍포식
  | 'binary_dance'  // 💫 쌍은하 안정적 공전 군무
  | 'cannibalism';  // 🪐 거대 은하의 왜소은하 포식 합병

export interface GalaxySimState {
  cores: GalacticCore[];
  particles: GalaxyParticles;
  timeMyr: number;        // 경과 시간 (백만 년, Myr)
  paused: boolean;
  speed: number;          // 1x ~ 50x
  scenario: GalaxyScenarioType;
  distanceKpc: number;    // 두 은하 중심핵 간의 실시간 거리 (kpc)
  swallowedCount: number; // 블랙홀에 흡수된 별 수
  tidalDistortion: number;// 조석 변형률 (0.0 ~ 1.0)
}

const G_GALACTIC = 1.2;     // 은하 단위계 중력 상수
const CORE_SOFTENING2 = 4.0 * 4.0;   // 중심핵 연화 거리 제곱 (kpc^2)
const STAR_SOFTENING2 = 2.5 * 2.5;   // 별 연화 거리 제곱 (kpc^2)

/** 은하 초기화 헬퍼: 3D 회전 행렬 생성 (경사각 및 방위각) */
function makeRotationMatrix(tiltXDeg: number, tiltYDeg: number, tiltZDeg: number) {
  const rx = (tiltXDeg * Math.PI) / 180;
  const ry = (tiltYDeg * Math.PI) / 180;
  const rz = (tiltZDeg * Math.PI) / 180;

  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // Z * Y * X
  return [
    cy * cz, cz * sx * sy - cx * sz, cx * cz * sy + sx * sz,
    cy * sz, cx * cz + sx * sy * sz, -cz * sx + cx * sy * sz,
    -sy,     cy * sx,                cx * cy,
  ];
}

function applyRotation(mat: number[], v: [number, number, number]): [number, number, number] {
  return [
    mat[0] * v[0] + mat[1] * v[1] + mat[2] * v[2],
    mat[3] * v[0] + mat[4] * v[1] + mat[5] * v[2],
    mat[6] * v[0] + mat[7] * v[1] + mat[8] * v[2],
  ];
}

/**
 * 대규모 나선은하 생성기
 * 로그 나선팔 밀도파와 암흑물질 헤일로 평탄 회전 곡선(Flat Rotation Curve) 적용
 */
export function createSpiralGalaxyParticles(
  coreMass: number,
  centerPos: [number, number, number],
  centerVel: [number, number, number],
  galaxyIndex: number,
  starCount: number,
  gasCount: number,
  radiusKpc: number,
  tiltX: number,
  tiltY: number,
  tiltZ: number,
  baseColor: [number, number, number],
  armColor: [number, number, number],
): { pos: number[]; vel: number[]; col: number[]; sz: number[]; gid: number[]; isGas: number[] } {
  const rotMat = makeRotationMatrix(tiltX, tiltY, tiltZ);

  const pos: number[] = [];
  const vel: number[] = [];
  const col: number[] = [];
  const sz: number[] = [];
  const gid: number[] = [];
  const isGas: number[] = [];

  const totalCount = starCount + gasCount;
  const arms = 2; // 2개의 주 나선팔
  const pitchAngle = 0.28; // 나선팔 감김각

  for (let i = 0; i < totalCount; i++) {
    const isThisGas = i >= starCount;
    // 반경 분포: 중심 밀집 지수 분포 (Exponential Disk)
    const u = Math.random();
    const r = Math.max(1.8, Math.min(radiusKpc, -Math.log(1 - u * 0.96) * (radiusKpc * 0.32)));

    // 나선팔 각도 + 퍼짐 오차
    const armIdx = i % arms;
    const baseTheta = (armIdx * 2 * Math.PI) / arms;
    const spiralTheta = baseTheta + Math.log(r / 1.5) / pitchAngle;
    const spread = (Math.random() - 0.5) * (0.45 + r * 0.015);
    const theta = spiralTheta + spread;

    // 수직 원반 두께 (Thin Disk)
    const zThickness = (Math.random() - 0.5) * (0.8 + r * 0.04);

    const localP: [number, number, number] = [Math.cos(theta) * r, Math.sin(theta) * r, zThickness];

    // 평탄한 암흑물질 헤일로 공전 속도 (플러머 코어 + 헤일로 잠재력)
    const vPlummer2 = (G_GALACTIC * coreMass * r * r) / Math.pow(r * r + 16.0, 1.5);
    const vHalo2 = (G_GALACTIC * coreMass * 0.85 * r * r) / (r * r + 36.0);
    const vCirc = Math.sqrt(Math.max(0.1, vPlummer2 + vHalo2));

    // 공전 속도 벡터 (수직 접선 방향 + 미세 분산)
    const localV: [number, number, number] = [
      -Math.sin(theta) * vCirc + (Math.random() - 0.5) * 0.3,
      Math.cos(theta) * vCirc + (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.2,
    ];

    // 은하 고유 회전각 적용 후 전체 은하 중심 및 속도 합산
    const worldP = applyRotation(rotMat, localP);
    const worldV = applyRotation(rotMat, localV);

    pos.push(centerPos[0] + worldP[0], centerPos[1] + worldP[1], centerPos[2] + worldP[2]);
    vel.push(centerVel[0] + worldV[0], centerVel[1] + worldV[1], centerVel[2] + worldV[2]);

    gid.push(galaxyIndex);
    isGas.push(isThisGas ? 1 : 0);

    if (isThisGas) {
      // 성운 가스 구름: 더 크고 부드러우며 신비로운 색상
      sz.push(3.5 + Math.random() * 3.5);
      const mix = Math.random();
      col.push(
        armColor[0] * mix + baseColor[0] * (1 - mix) + (Math.random() - 0.5) * 0.15,
        armColor[1] * mix + baseColor[1] * (1 - mix) + (Math.random() - 0.5) * 0.15,
        armColor[2] * mix + baseColor[2] * (1 - mix) + (Math.random() - 0.5) * 0.15,
      );
    } else {
      // 별: 은하 중심부는 밝은 금빛/백색, 외곽 나선팔은 찬란한 성운색
      const rRatio = r / radiusKpc;
      sz.push(0.7 + Math.random() * 1.6);
      if (rRatio < 0.22) {
        // 중심 은하 팽대부 별무리 (밝은 백금색)
        col.push(1.0, 0.95, 0.82);
      } else {
        const mix = Math.random();
        col.push(
          armColor[0] * mix + baseColor[0] * (1 - mix),
          armColor[1] * mix + baseColor[1] * (1 - mix),
          armColor[2] * mix + baseColor[2] * (1 - mix),
        );
      }
    }
  }

  return { pos, vel, col, sz, gid, isGas };
}

/** 은하 시나리오별 초기 물리 상태 생성 */
export function createGalaxyScenario(scenario: GalaxyScenarioType): GalaxySimState {
  const cores: GalacticCore[] = [];
  let allPos: number[] = [];
  let allVel: number[] = [];
  let allCol: number[] = [];
  let allSz: number[] = [];
  let allGid: number[] = [];
  let allIsGas: number[] = [];

  const starN = 1400; // 은하당 별 수
  const gasN = 250;   // 은하당 성운 가스 구름 수

  switch (scenario) {
    case 'head_on': {
      // 💥 정면 관통 대충돌 (거리 220 kpc, 정면 돌진 속도 14.5)
      cores.push(
        {
          id: 'core_milkyway',
          name: '우리은하 중심핵',
          mass: 2800,
          pos: [-100, 0, 0],
          vel: [7.2, 0, 0],
          radius: 3.5,
          color: '#38bdf8',
        },
        {
          id: 'core_andros',
          name: '안드로스 은하 중심핵',
          mass: 3200,
          pos: [100, 0, 0],
          vel: [-7.2, 0, 0],
          radius: 3.8,
          color: '#c084fc',
        },
      );

      // 우리은하 (에메랄드-시안-골드)
      const g1 = createSpiralGalaxyParticles(
        2800, [-100, 0, 0], [7.2, 0, 0], 0, starN, gasN, 32,
        0, 0, 0, [0.2, 0.7, 1.0], [1.0, 0.85, 0.35],
      );
      // 안드로스 은하 (마젠타-퍼플-바이올렛) - 원반 45도 기울어짐
      const g2 = createSpiralGalaxyParticles(
        3200, [100, 0, 0], [-7.2, 0, 0], 1, starN, gasN, 34,
        45, 20, 15, [0.85, 0.25, 0.95], [0.45, 0.2, 1.0],
      );

      allPos = [...g1.pos, ...g2.pos];
      allVel = [...g1.vel, ...g2.vel];
      allCol = [...g1.col, ...g2.col];
      allSz = [...g1.sz, ...g2.sz];
      allGid = [...g1.gid, ...g2.gid];
      allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'grazing': {
      // 🌀 조석 꼬리 스침 충돌 (더듬이 은하 / 생쥐 은하)
      // 충돌 모수가 있어 스쳐 지나가며 거대한 조석 다리와 나선 꼬리를 형성
      cores.push(
        {
          id: 'core_milkyway',
          name: '우리은하 중심핵',
          mass: 3000,
          pos: [-120, -35, 0],
          vel: [6.8, 2.2, 0],
          radius: 3.5,
          color: '#38bdf8',
        },
        {
          id: 'core_andros',
          name: '안드로스 은하 중심핵',
          mass: 3200,
          pos: [120, 35, 0],
          vel: [-6.8, -2.2, 0],
          radius: 3.8,
          color: '#e879f9',
        },
      );

      const g1 = createSpiralGalaxyParticles(
        3000, [-120, -35, 0], [6.8, 2.2, 0], 0, starN, gasN, 35,
        15, 10, 0, [0.25, 0.75, 1.0], [0.95, 0.9, 0.4],
      );
      const g2 = createSpiralGalaxyParticles(
        3200, [120, 35, 0], [-6.8, -2.2, 0], 1, starN, gasN, 36,
        -35, 40, 25, [0.95, 0.35, 0.85], [0.65, 0.2, 1.0],
      );

      allPos = [...g1.pos, ...g2.pos];
      allVel = [...g1.vel, ...g2.vel];
      allCol = [...g1.col, ...g2.col];
      allSz = [...g1.sz, ...g2.sz];
      allGid = [...g1.gid, ...g2.gid];
      allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'supermassive': {
      // 🕳️ 초대질량 괴물 블랙홀 [가르간튀아]의 은하 쌍포식
      // 중앙에 초거대 질량(12,000)의 괴물 블랙홀이 위치하여 두 은하를 동시에 심연으로 삼킴
      cores.push(
        {
          id: 'gargantua_monster',
          name: '초대질량 괴물 블랙홀 [가르간튀아]',
          mass: 12500,
          pos: [0, 0, 0],
          vel: [0, 0, 0],
          radius: 7.5,
          color: '#a855f7',
          isBlackHole: true,
        },
        {
          id: 'core_milkyway',
          name: '우리은하 중심핵',
          mass: 2500,
          pos: [-110, 30, 0],
          vel: [3.8, -4.5, 0],
          radius: 3.2,
          color: '#38bdf8',
        },
        {
          id: 'core_andros',
          name: '안드로스 은하 중심핵',
          mass: 2800,
          pos: [110, -30, 0],
          vel: [-3.8, 4.5, 0],
          radius: 3.5,
          color: '#f43f5e',
        },
      );

      const g1 = createSpiralGalaxyParticles(
        2500, [-110, 30, 0], [3.8, -4.5, 0], 0, starN, gasN, 30,
        20, 15, -10, [0.3, 0.8, 1.0], [0.3, 1.0, 0.7],
      );
      const g2 = createSpiralGalaxyParticles(
        2800, [110, -30, 0], [-3.8, 4.5, 0], 1, starN, gasN, 32,
        -25, -20, 15, [1.0, 0.35, 0.5], [1.0, 0.7, 0.2],
      );

      allPos = [...g1.pos, ...g2.pos];
      allVel = [...g1.vel, ...g2.vel];
      allCol = [...g1.col, ...g2.col];
      allSz = [...g1.sz, ...g2.sz];
      allGid = [...g1.gid, ...g2.gid];
      allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'binary_dance': {
      // 💫 안정적 쌍은하 공전 군무
      // 두 은하가 충돌하지 않고 안정적인 케플러 타원 궤도로 영구히 춤추며 공전
      cores.push(
        {
          id: 'core_milkyway',
          name: '우리은하 중심핵',
          mass: 3000,
          pos: [-85, 0, 0],
          vel: [0, 4.8, 0],
          radius: 3.5,
          color: '#38bdf8',
        },
        {
          id: 'core_andros',
          name: '안드로스 은하 중심핵',
          mass: 3000,
          pos: [85, 0, 0],
          vel: [0, -4.8, 0],
          radius: 3.5,
          color: '#c084fc',
        },
      );

      const g1 = createSpiralGalaxyParticles(
        3000, [-85, 0, 0], [0, 4.8, 0], 0, starN, gasN, 28,
        0, 0, 0, [0.3, 0.75, 1.0], [1.0, 0.85, 0.3],
      );
      const g2 = createSpiralGalaxyParticles(
        3000, [85, 0, 0], [0, -4.8, 0], 1, starN, gasN, 28,
        25, 0, 0, [0.85, 0.35, 0.95], [0.55, 0.3, 1.0],
      );

      allPos = [...g1.pos, ...g2.pos];
      allVel = [...g1.vel, ...g2.vel];
      allCol = [...g1.col, ...g2.col];
      allSz = [...g1.sz, ...g2.sz];
      allGid = [...g1.gid, ...g2.gid];
      allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'cannibalism': {
      // 🪐 왜소은하 포식 합병 (거대 은하 대 1/5 소형 은하)
      cores.push(
        {
          id: 'core_milkyway',
          name: '거대 우리은하',
          mass: 4500,
          pos: [-40, -10, 0],
          vel: [0.8, 0.5, 0],
          radius: 4.5,
          color: '#38bdf8',
        },
        {
          id: 'core_dwarf',
          name: '왜소은하 안드로스 주니어',
          mass: 750,
          pos: [110, 35, 0],
          vel: [-5.2, -3.2, 0],
          radius: 2.0,
          color: '#fb923c',
        },
      );

      const g1 = createSpiralGalaxyParticles(
        4500, [-40, -10, 0], [0.8, 0.5, 0], 0, Math.floor(starN * 1.3), Math.floor(gasN * 1.3), 42,
        0, 0, 0, [0.25, 0.75, 1.0], [0.4, 0.95, 0.7],
      );
      const g2 = createSpiralGalaxyParticles(
        750, [110, 35, 0], [-5.2, -3.2, 0], 1, Math.floor(starN * 0.4), Math.floor(gasN * 0.4), 16,
        40, -30, 20, [1.0, 0.5, 0.2], [1.0, 0.85, 0.3],
      );

      allPos = [...g1.pos, ...g2.pos];
      allVel = [...g1.vel, ...g2.vel];
      allCol = [...g1.col, ...g2.col];
      allSz = [...g1.sz, ...g2.sz];
      allGid = [...g1.gid, ...g2.gid];
      allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }
  }

  const count = allGid.length;
  const aliveArr = new Uint8Array(count);
  aliveArr.fill(1);

  const particles: GalaxyParticles = {
    pos: new Float32Array(allPos),
    vel: new Float32Array(allVel),
    color: new Float32Array(allCol),
    size: new Float32Array(allSz),
    galaxyId: new Uint8Array(allGid),
    isGas: new Uint8Array(allIsGas),
    alive: aliveArr,
    count,
  };

  const dist0 = Math.hypot(
    cores[0].pos[0] - cores[1].pos[0],
    cores[0].pos[1] - cores[1].pos[1],
    cores[0].pos[2] - cores[1].pos[2],
  );

  return {
    cores,
    particles,
    timeMyr: 0,
    paused: false,
    speed: 10,
    scenario,
    distanceKpc: dist0,
    swallowedCount: 0,
    tidalDistortion: 0,
  };
}

/**
 * 실시간 N-Body 은하 중력 적분기 (Leapfrog / Velocity-Verlet)
 * - 중심핵 상호 중력 가속도 계산
 * - 수천 개의 별과 성운 가스 구름에 작용하는 복합 조석 중력장 계산
 * - 블랙홀 사건의 지평선 흡수 및 조석 섭동률 산출
 */
export function stepGalaxySystem(state: GalaxySimState, dtSec: number): void {
  if (state.paused) return;

  const dt = dtSec * (state.speed * 0.12); // 적분 시간 간격
  state.timeMyr += dt * 3.5; // 실제 백만 년(Myr) 시간 경과

  const cores = state.cores;
  const nCores = cores.length;

  // 1. 중심핵 간의 상호 중력 가속도 계산
  const coreAcc: [number, number, number][] = cores.map(() => [0, 0, 0]);

  for (let i = 0; i < nCores; i++) {
    for (let j = i + 1; j < nCores; j++) {
      const c1 = cores[i];
      const c2 = cores[j];
      const dx = c2.pos[0] - c1.pos[0];
      const dy = c2.pos[1] - c1.pos[1];
      const dz = c2.pos[2] - c1.pos[2];
      const r2 = dx * dx + dy * dy + dz * dz;
      const invR3 = 1.0 / Math.pow(r2 + CORE_SOFTENING2, 1.5);

      const fX = G_GALACTIC * dx * invR3;
      const fY = G_GALACTIC * dy * invR3;
      const fZ = G_GALACTIC * dz * invR3;

      coreAcc[i][0] += fX * c2.mass;
      coreAcc[i][1] += fY * c2.mass;
      coreAcc[i][2] += fZ * c2.mass;

      coreAcc[j][0] -= fX * c1.mass;
      coreAcc[j][1] -= fY * c1.mass;
      coreAcc[j][2] -= fZ * c1.mass;
    }
  }

  // 중심핵 위치 및 속도 전진
  for (let i = 0; i < nCores; i++) {
    const c = cores[i];
    c.vel[0] += coreAcc[i][0] * dt;
    c.vel[1] += coreAcc[i][1] * dt;
    c.vel[2] += coreAcc[i][2] * dt;

    c.pos[0] += c.vel[0] * dt;
    c.pos[1] += c.vel[1] * dt;
    c.pos[2] += c.vel[2] * dt;
  }

  // 두 주 은하 간 거리 갱신
  if (nCores >= 2) {
    const cA = cores[0].isBlackHole && nCores >= 3 ? cores[1] : cores[0];
    const cB = cores[0].isBlackHole && nCores >= 3 ? cores[2] : cores[1];
    state.distanceKpc = Math.hypot(cA.pos[0] - cB.pos[0], cA.pos[1] - cB.pos[1], cA.pos[2] - cB.pos[2]);
  }

  // 2. 수천 개의 별과 가스 구름에 대한 조석 중력 가속도 계산
  const p = state.particles;
  const pos = p.pos;
  const vel = p.vel;
  const alive = p.alive;
  const count = p.count;

  let totalDisplacement = 0;
  let activeStarCount = 0;

  for (let i = 0; i < count; i++) {
    if (alive[i] === 0) continue;

    const idx = i * 3;
    const px = pos[idx];
    const py = pos[idx + 1];
    const pz = pos[idx + 2];

    let ax = 0;
    let ay = 0;
    let az = 0;

    for (let c = 0; c < nCores; c++) {
      const core = cores[c];
      const dx = core.pos[0] - px;
      const dy = core.pos[1] - py;
      const dz = core.pos[2] - pz;
      const r2 = dx * dx + dy * dy + dz * dz;

      // 블랙홀 사건의 지평선 흡수 검증
      if (core.isBlackHole && r2 < core.radius * core.radius * 1.3) {
        alive[i] = 0;
        state.swallowedCount++;
        break;
      }

      const invR3 = (G_GALACTIC * core.mass) / Math.pow(r2 + STAR_SOFTENING2, 1.5);
      ax += dx * invR3;
      ay += dy * invR3;
      az += dz * invR3;
    }

    if (alive[i] === 0) continue;

    vel[idx] += ax * dt;
    vel[idx + 1] += ay * dt;
    vel[idx + 2] += az * dt;

    pos[idx] += vel[idx] * dt;
    pos[idx + 1] += vel[idx + 1] * dt;
    pos[idx + 2] += vel[idx + 2] * dt;

    // 조석 변형률 추적용
    totalDisplacement += Math.abs(ax) + Math.abs(ay);
    activeStarCount++;
  }

  // 조석 변형률 (Tidal Distortion Index) 0.0 ~ 1.0 정규화
  if (activeStarCount > 0) {
    const rawTide = (totalDisplacement / activeStarCount) * 1.5;
    state.tidalDistortion = Math.min(1.0, Math.max(0.05, rawTide));
  }
}
