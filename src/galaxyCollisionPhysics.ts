// 은하 대충돌 & 심우주 N-Body 천체물리 엔진
// "우선 태양계에 우리은하에서 그 근방에 있는것들로 표현해"
// 기본 상태: 우리은하(태양계 오리온자리 팔 표기) 및 국부은하군(안드로메다 M31, 삼각형자리 M33, 대마젤란은하 LMC, 소마젤란은하 SMC)
// 조건 트리거: 두 은하 정면 충돌, 조석 꼬리 스침, 괴물 블랙홀 포식, 위성은하 흡수 등

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
  galaxyId: Uint8Array;   // 0: 우리은하, 1: 안드로메다, 2: 삼각형자리, 3: 대마젤란, 4: 소마젤란, 5: 블랙홀
  isGas: Uint8Array;      // 0: 별(Star), 1: 성운 가스 구름(Nebula Gas Cloud)
  alive: Uint8Array;      // 1: 생존, 0: 블랙홀 흡수
  count: number;
}

export type GalaxyScenarioType =
  | 'local_group'   // 🌌 [기본] 우리은하 & 국부은하군 (태양계 위치 표기 + 인근 은하 군집 평형)
  | 'head_on'       // 💥 정면 관통 대충돌 (고리 은하 형성)
  | 'grazing'       // 🌀 조석 꼬리 스침 충돌 (더듬이/생쥐 은하)
  | 'supermassive'  // 🕳️ 초대질량 괴물 블랙홀 [가르간튀아]의 은하 쌍포식
  | 'binary_dance'  // 💫 쌍은하 안정적 공전 군무
  | 'cannibalism';  // 🪐 거대 은하의 위성은하(대/소마젤란) 포식 합병

export interface GalaxySimState {
  cores: GalacticCore[];
  particles: GalaxyParticles;
  solarSystemPos: [number, number, number]; // 우리은하 내 태양계 실시간 3D 위치
  solarAngleRad: number;
  timeMyr: number;        // 경과 시간 (백만 년, Myr)
  paused: boolean;
  speed: number;          // 1x ~ 50x
  scenario: GalaxyScenarioType;
  distanceKpc: number;    // 주 은하 간 실시간 거리 (kpc)
  swallowedCount: number; // 블랙홀에 흡수된 별 수
  tidalDistortion: number;// 조석 변형률 (0.0 ~ 1.0)
}

const G_GALACTIC = 1.2;              // 은하 단위계 중력 상수
const CORE_SOFTENING2 = 4.0 * 4.0;   // 중심핵 연화 거리 제곱 (kpc^2)
const STAR_SOFTENING2 = 2.5 * 2.5;   // 별 연화 거리 제곱 (kpc^2)

/** 3D 회전 행렬 생성 (경사각 및 방위각) */
function makeRotationMatrix(tiltXDeg: number, tiltYDeg: number, tiltZDeg: number) {
  const rx = (tiltXDeg * Math.PI) / 180;
  const ry = (tiltYDeg * Math.PI) / 180;
  const rz = (tiltZDeg * Math.PI) / 180;

  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

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
 * 대규모 나선 및 왜소은하 입자 생성기
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
  const pitchAngle = 0.28;

  for (let i = 0; i < totalCount; i++) {
    const isThisGas = i >= starCount;
    const u = Math.random();
    const r = Math.max(1.5, Math.min(radiusKpc, -Math.log(1 - u * 0.96) * (radiusKpc * 0.32)));

    const armIdx = i % arms;
    const baseTheta = (armIdx * 2 * Math.PI) / arms;
    const spiralTheta = baseTheta + Math.log(r / 1.5) / pitchAngle;
    const spread = (Math.random() - 0.5) * (0.45 + r * 0.015);
    const theta = spiralTheta + spread;

    const zThickness = (Math.random() - 0.5) * (0.8 + r * 0.04);
    const localP: [number, number, number] = [Math.cos(theta) * r, Math.sin(theta) * r, zThickness];

    // 암흑물질 헤일로 평탄 회전 곡선
    const vPlummer2 = (G_GALACTIC * coreMass * r * r) / Math.pow(r * r + 16.0, 1.5);
    const vHalo2 = (G_GALACTIC * coreMass * 0.85 * r * r) / (r * r + 36.0);
    const vCirc = Math.sqrt(Math.max(0.1, vPlummer2 + vHalo2));

    const localV: [number, number, number] = [
      -Math.sin(theta) * vCirc + (Math.random() - 0.5) * 0.25,
      Math.cos(theta) * vCirc + (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.15,
    ];

    const worldP = applyRotation(rotMat, localP);
    const worldV = applyRotation(rotMat, localV);

    pos.push(centerPos[0] + worldP[0], centerPos[1] + worldP[1], centerPos[2] + worldP[2]);
    vel.push(centerVel[0] + worldV[0], centerVel[1] + worldV[1], centerVel[2] + worldV[2]);

    gid.push(galaxyIndex);
    isGas.push(isThisGas ? 1 : 0);

    if (isThisGas) {
      sz.push(3.5 + Math.random() * 3.5);
      const mix = Math.random();
      col.push(
        armColor[0] * mix + baseColor[0] * (1 - mix) + (Math.random() - 0.5) * 0.1,
        armColor[1] * mix + baseColor[1] * (1 - mix) + (Math.random() - 0.5) * 0.1,
        armColor[2] * mix + baseColor[2] * (1 - mix) + (Math.random() - 0.5) * 0.1,
      );
    } else {
      const rRatio = r / radiusKpc;
      sz.push(0.7 + Math.random() * 1.5);
      if (rRatio < 0.2) {
        col.push(1.0, 0.95, 0.82); // 중심 팽대부
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

/** 시나리오별 초기 물리 상태 생성 (기본: 국부은하군 평형 모드) */
export function createGalaxyScenario(scenario: GalaxyScenarioType): GalaxySimState {
  const cores: GalacticCore[] = [];
  let allPos: number[] = [];
  let allVel: number[] = [];
  let allCol: number[] = [];
  let allSz: number[] = [];
  let allGid: number[] = [];
  let allIsGas: number[] = [];

  switch (scenario) {
    case 'local_group': {
      // 🌌 [기본] 우리은하 및 국부은하군 (Local Group Cosmic Neighborhood)
      // 1. 우리은하 (Milky Way Galaxy) - 태양계가 위치한 중심 은하
      cores.push({
        id: 'core_milkyway',
        name: '우리은하 (궁수자리 A*)',
        mass: 3200,
        pos: [0, 0, 0],
        vel: [0, 0, 0],
        radius: 3.8,
        color: '#38bdf8',
      });
      const gMilkyWay = createSpiralGalaxyParticles(
        3200, [0, 0, 0], [0, 0, 0], 0, 1400, 250, 32,
        0, 0, 0, [0.25, 0.75, 1.0], [1.0, 0.88, 0.4],
      );

      // 2. 안드로메다 은하 (Andromeda Galaxy M31) - 약 230 kpc 거리에 위치
      cores.push({
        id: 'core_andromeda',
        name: '안드로메다 은하 (M31)',
        mass: 3500,
        pos: [210, 40, -30],
        vel: [-0.9, -0.3, 0.1],
        radius: 4.0,
        color: '#c084fc',
      });
      const gAndromeda = createSpiralGalaxyParticles(
        3500, [210, 40, -30], [-0.9, -0.3, 0.1], 1, 1400, 250, 35,
        45, 25, 10, [0.85, 0.3, 0.95], [0.45, 0.2, 1.0],
      );

      // 3. 삼각형자리 은하 (Triangulum Galaxy M33)
      cores.push({
        id: 'core_triangulum',
        name: '삼각형자리 은하 (M33)',
        mass: 800,
        pos: [150, -85, 35],
        vel: [-0.5, 0.7, -0.2],
        radius: 2.3,
        color: '#2dd4bf',
      });
      const gTriangulum = createSpiralGalaxyParticles(
        800, [150, -85, 35], [-0.5, 0.7, -0.2], 2, 450, 80, 20,
        -25, 30, -15, [0.2, 0.9, 0.7], [0.4, 0.7, 1.0],
      );

      // 4. 대마젤란은하 (Large Magellanic Cloud LMC) - 우리은하 위성은하
      cores.push({
        id: 'core_lmc',
        name: '대마젤란은하 (LMC)',
        mass: 500,
        pos: [-45, -38, 12],
        vel: [1.6, -1.1, 0.4],
        radius: 1.9,
        color: '#fbbf24',
      });
      const gLMC = createSpiralGalaxyParticles(
        500, [-45, -38, 12], [1.6, -1.1, 0.4], 3, 300, 60, 15,
        30, -20, 10, [1.0, 0.65, 0.2], [1.0, 0.9, 0.4],
      );

      // 5. 소마젤란은하 (Small Magellanic Cloud SMC)
      cores.push({
        id: 'core_smc',
        name: '소마젤란은하 (SMC)',
        mass: 250,
        pos: [-58, -52, -10],
        vel: [1.3, -0.8, 0.3],
        radius: 1.5,
        color: '#60a5fa',
      });
      const gSMC = createSpiralGalaxyParticles(
        250, [-58, -52, -10], [1.3, -0.8, 0.3], 4, 200, 40, 12,
        15, 25, -20, [0.4, 0.6, 1.0], [0.7, 0.85, 1.0],
      );

      allPos = [...gMilkyWay.pos, ...gAndromeda.pos, ...gTriangulum.pos, ...gLMC.pos, ...gSMC.pos];
      allVel = [...gMilkyWay.vel, ...gAndromeda.vel, ...gTriangulum.vel, ...gLMC.vel, ...gSMC.vel];
      allCol = [...gMilkyWay.col, ...gAndromeda.col, ...gTriangulum.col, ...gLMC.col, ...gSMC.col];
      allSz = [...gMilkyWay.sz, ...gAndromeda.sz, ...gTriangulum.sz, ...gLMC.sz, ...gSMC.sz];
      allGid = [...gMilkyWay.gid, ...gAndromeda.gid, ...gTriangulum.gid, ...gLMC.gid, ...gSMC.gid];
      allIsGas = [...gMilkyWay.isGas, ...gAndromeda.isGas, ...gTriangulum.isGas, ...gLMC.isGas, ...gSMC.isGas];
      break;
    }

    case 'head_on': {
      // 💥 정면 관통 대충돌 (거리 200 kpc, 고속 돌진 충돌)
      cores.push(
        {
          id: 'core_milkyway',
          name: '우리은하 중심핵',
          mass: 2800,
          pos: [-95, 0, 0],
          vel: [7.5, 0, 0],
          radius: 3.5,
          color: '#38bdf8',
        },
        {
          id: 'core_andromeda',
          name: '안드로메다 중심핵',
          mass: 3200,
          pos: [95, 0, 0],
          vel: [-7.5, 0, 0],
          radius: 3.8,
          color: '#c084fc',
        },
      );
      const g1 = createSpiralGalaxyParticles(2800, [-95, 0, 0], [7.5, 0, 0], 0, 1500, 250, 32, 0, 0, 0, [0.2, 0.7, 1.0], [1.0, 0.85, 0.35]);
      const g2 = createSpiralGalaxyParticles(3200, [95, 0, 0], [-7.5, 0, 0], 1, 1500, 250, 34, 45, 20, 15, [0.85, 0.25, 0.95], [0.45, 0.2, 1.0]);
      allPos = [...g1.pos, ...g2.pos]; allVel = [...g1.vel, ...g2.vel]; allCol = [...g1.col, ...g2.col]; allSz = [...g1.sz, ...g2.sz]; allGid = [...g1.gid, ...g2.gid]; allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'grazing': {
      // 🌀 조석 꼬리 스침 충돌
      cores.push(
        {
          id: 'core_milkyway',
          name: '우리은하 중심핵',
          mass: 3000,
          pos: [-115, -35, 0],
          vel: [7.0, 2.4, 0],
          radius: 3.5,
          color: '#38bdf8',
        },
        {
          id: 'core_andromeda',
          name: '안드로메다 중심핵',
          mass: 3200,
          pos: [115, 35, 0],
          vel: [-7.0, -2.4, 0],
          radius: 3.8,
          color: '#e879f9',
        },
      );
      const g1 = createSpiralGalaxyParticles(3000, [-115, -35, 0], [7.0, 2.4, 0], 0, 1500, 250, 35, 15, 10, 0, [0.25, 0.75, 1.0], [0.95, 0.9, 0.4]);
      const g2 = createSpiralGalaxyParticles(3200, [115, 35, 0], [-7.0, -2.4, 0], 1, 1500, 250, 36, -35, 40, 25, [0.95, 0.35, 0.85], [0.65, 0.2, 1.0]);
      allPos = [...g1.pos, ...g2.pos]; allVel = [...g1.vel, ...g2.vel]; allCol = [...g1.col, ...g2.col]; allSz = [...g1.sz, ...g2.sz]; allGid = [...g1.gid, ...g2.gid]; allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'supermassive': {
      // 🕳️ 초대질량 괴물 블랙홀 [가르간튀아]의 은하 쌍포식
      cores.push(
        {
          id: 'gargantua_monster',
          name: '초대질량 괴물 블랙홀 [가르간튀아]',
          mass: 14000,
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
          pos: [-105, 30, 0],
          vel: [4.0, -4.6, 0],
          radius: 3.2,
          color: '#38bdf8',
        },
        {
          id: 'core_andromeda',
          name: '안드로메다 중심핵',
          mass: 2800,
          pos: [105, -30, 0],
          vel: [-4.0, 4.6, 0],
          radius: 3.5,
          color: '#f43f5e',
        },
      );
      const g1 = createSpiralGalaxyParticles(2500, [-105, 30, 0], [4.0, -4.6, 0], 0, 1400, 250, 30, 20, 15, -10, [0.3, 0.8, 1.0], [0.3, 1.0, 0.7]);
      const g2 = createSpiralGalaxyParticles(2800, [105, -30, 0], [-4.0, 4.6, 0], 1, 1400, 250, 32, -25, -20, 15, [1.0, 0.35, 0.5], [1.0, 0.7, 0.2]);
      allPos = [...g1.pos, ...g2.pos]; allVel = [...g1.vel, ...g2.vel]; allCol = [...g1.col, ...g2.col]; allSz = [...g1.sz, ...g2.sz]; allGid = [...g1.gid, ...g2.gid]; allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'binary_dance': {
      // 💫 안정적 쌍은하 군무
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
          id: 'core_andromeda',
          name: '안드로메다 중심핵',
          mass: 3000,
          pos: [85, 0, 0],
          vel: [0, -4.8, 0],
          radius: 3.5,
          color: '#c084fc',
        },
      );
      const g1 = createSpiralGalaxyParticles(3000, [-85, 0, 0], [0, 4.8, 0], 0, 1400, 250, 28, 0, 0, 0, [0.3, 0.75, 1.0], [1.0, 0.85, 0.3]);
      const g2 = createSpiralGalaxyParticles(3000, [85, 0, 0], [0, -4.8, 0], 1, 1400, 250, 28, 25, 0, 0, [0.85, 0.35, 0.95], [0.55, 0.3, 1.0]);
      allPos = [...g1.pos, ...g2.pos]; allVel = [...g1.vel, ...g2.vel]; allCol = [...g1.col, ...g2.col]; allSz = [...g1.sz, ...g2.sz]; allGid = [...g1.gid, ...g2.gid]; allIsGas = [...g1.isGas, ...g2.isGas];
      break;
    }

    case 'cannibalism': {
      // 🪐 왜소은하(마젤란) 조석 포식 합병
      cores.push(
        {
          id: 'core_milkyway',
          name: '거대 우리은하',
          mass: 4500,
          pos: [-35, -10, 0],
          vel: [0.8, 0.4, 0],
          radius: 4.5,
          color: '#38bdf8',
        },
        {
          id: 'core_lmc',
          name: '대마젤란은하',
          mass: 650,
          pos: [75, 40, 0],
          vel: [-4.6, -3.2, 0],
          radius: 2.1,
          color: '#fbbf24',
        },
        {
          id: 'core_smc',
          name: '소마젤란은하',
          mass: 300,
          pos: [110, 65, 0],
          vel: [-5.4, -4.0, 0],
          radius: 1.6,
          color: '#60a5fa',
        },
      );
      const g1 = createSpiralGalaxyParticles(4500, [-35, -10, 0], [0.8, 0.4, 0], 0, 1600, 300, 42, 0, 0, 0, [0.25, 0.75, 1.0], [0.4, 0.95, 0.7]);
      const g2 = createSpiralGalaxyParticles(650, [75, 40, 0], [-4.6, -3.2, 0], 1, 400, 80, 18, 35, -20, 15, [1.0, 0.65, 0.2], [1.0, 0.9, 0.4]);
      const g3 = createSpiralGalaxyParticles(300, [110, 65, 0], [-5.4, -4.0, 0], 2, 250, 50, 14, 20, 15, -20, [0.4, 0.6, 1.0], [0.7, 0.85, 1.0]);
      allPos = [...g1.pos, ...g2.pos, ...g3.pos]; allVel = [...g1.vel, ...g2.vel, ...g3.vel]; allCol = [...g1.col, ...g2.col, ...g3.col]; allSz = [...g1.sz, ...g2.sz, ...g3.sz]; allGid = [...g1.gid, ...g2.gid, ...g3.gid]; allIsGas = [...g1.isGas, ...g2.isGas, ...g3.isGas];
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

  // 우리은하 중심 기준 태양계 초기 위치 (오리온자리 팔 R=8.5 kpc)
  const mwCore = cores.find((c) => c.id.includes('milkyway')) ?? cores[0];
  const rSun = 8.5;
  const solarAngleRad = 0.8;
  const solarSystemPos: [number, number, number] = [
    mwCore.pos[0] + Math.cos(solarAngleRad) * rSun,
    mwCore.pos[1] + Math.sin(solarAngleRad) * rSun,
    mwCore.pos[2] + 0.1,
  ];

  return {
    cores,
    particles,
    solarSystemPos,
    solarAngleRad,
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
 * 실시간 N-Body 은하 중력 적분기
 */
export function stepGalaxySystem(state: GalaxySimState, dtSec: number): void {
  if (state.paused) return;

  const dt = dtSec * (state.speed * 0.12);
  state.timeMyr += dt * 3.5;

  const cores = state.cores;
  const nCores = cores.length;

  // 1. 중심핵 간 상호 중력 가속도
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

  // 중심핵 위치 전진
  for (let i = 0; i < nCores; i++) {
    const c = cores[i];
    c.vel[0] += coreAcc[i][0] * dt;
    c.vel[1] += coreAcc[i][1] * dt;
    c.vel[2] += coreAcc[i][2] * dt;

    c.pos[0] += c.vel[0] * dt;
    c.pos[1] += c.vel[1] * dt;
    c.pos[2] += c.vel[2] * dt;
  }

  // 거리 갱신
  if (nCores >= 2) {
    const cA = cores[0].isBlackHole && nCores >= 3 ? cores[1] : cores[0];
    const cB = cores[0].isBlackHole && nCores >= 3 ? cores[2] : cores[1];
    state.distanceKpc = Math.hypot(cA.pos[0] - cB.pos[0], cA.pos[1] - cB.pos[1], cA.pos[2] - cB.pos[2]);
  }

  // 우리은하 내 태양계 위치 공전 갱신
  const mwCore = cores.find((c) => c.id.includes('milkyway')) ?? cores[0];
  const rSun = 8.5;
  const omegaSun = Math.sqrt((G_GALACTIC * mwCore.mass) / (rSun * rSun * rSun)) * 0.8;
  state.solarAngleRad += omegaSun * dt;
  state.solarSystemPos[0] = mwCore.pos[0] + Math.cos(state.solarAngleRad) * rSun;
  state.solarSystemPos[1] = mwCore.pos[1] + Math.sin(state.solarAngleRad) * rSun;
  state.solarSystemPos[2] = mwCore.pos[2] + 0.1;

  // 2. 별과 가스 구름에 대한 조석 중력 가속도
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

    totalDisplacement += Math.abs(ax) + Math.abs(ay);
    activeStarCount++;
  }

  if (activeStarCount > 0) {
    const rawTide = (totalDisplacement / activeStarCount) * 1.5;
    state.tidalDistortion = Math.min(1.0, Math.max(0.05, rawTide));
  }
}
