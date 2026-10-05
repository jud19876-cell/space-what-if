// 시뮬레이션 상태 + Simulation Command.
// UI 버튼과 (앞으로의) AI 는 모두 executeCommand() 를 통해서만 상태를 바꾼다.
import { G, dist2, stepBodies, SUN_MASS, type Body, type Vec3 } from './physics.ts';
import { createSolarSystem, EARTH_MASS } from './solarSystem.ts';

export type Speed = 1 | 10 | 100;

export type SimCommand =
  | { action: 'remove_body'; target: string }
  | { action: 'change_mass'; target: string; multiplier: number }
  | { action: 'change_velocity'; target: string; multiplier: number }
  | { action: 'move_body'; target: string; near: string }
  | { action: 'spawn_black_hole'; variant: 'sun_replace' | 'invader' | 'near_earth' | 'giant' | 'jupiter_replace' }
  | { action: 'remove_all_black_holes' }
  | { action: 'add_body'; body: Body }
  | { action: 'reset' }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'set_speed'; speed: Speed };

export interface SimState {
  bodies: Body[];
  time: number; // 경과 시간 (일)
  paused: boolean;
  speed: Speed;
}

/** 1x 에서 화면 1초 = 시뮬레이션 5일 (지구 1년 ≈ 73초) */
export const DAYS_PER_SECOND = 5;

export function createInitialState(): SimState {
  return { bodies: createSolarSystem(), time: 0, paused: false, speed: 1 };
}

/** 화면 시간 realSeconds 만큼 시뮬레이션을 진행한다. */
export function advance(state: SimState, realSeconds: number): void {
  if (state.paused) return;
  state.time += stepBodies(state.bodies, realSeconds * state.speed * DAYS_PER_SECOND);
}

export function findBody(state: SimState, id: string): Body | undefined {
  return state.bodies.find((b) => b.id === id);
}

const SATELLITE_RANGE2 = 0.05 * 0.05; // AU

/** body 가 어떤 행성 곁을 도는 위성이면 그 행성을 돌려준다. (태양은 제외) */
export function findHost(bodies: Body[], body: Body): Body | undefined {
  let best: Body | undefined;
  let bestD = SATELLITE_RANGE2;
  for (const h of bodies) {
    if (h === body || h.id === 'sun' || h.mass < body.mass * 10) continue;
    const d = dist2(h.position, body.position);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function satellitesOf(bodies: Body[], body: Body): Body[] {
  return bodies.filter((b) => b !== body && findHost(bodies, b) === body);
}

/**
 * 명령 하나를 실행한다. 대상이 없거나 잘못된 명령이면 false.
 * (AI 가 만든 명령도 그대로 여기로 들어온다)
 */
export function executeCommand(state: SimState, cmd: SimCommand): boolean {
  switch (cmd.action) {
    case 'reset':
      state.bodies = createSolarSystem();
      state.time = 0;
      return true;
    case 'pause':
      state.paused = true;
      return true;
    case 'resume':
      state.paused = false;
      return true;
    case 'set_speed':
      if (![1, 10, 100].includes(cmd.speed)) return false;
      state.speed = cmd.speed;
      return true;
    case 'add_body':
      state.bodies = state.bodies.filter((b) => b.id !== cmd.body.id);
      state.bodies.push(cmd.body);
      return true;
    case 'remove_all_black_holes':
      state.bodies = state.bodies.filter((b) => !b.id.includes('black_hole'));
      return true;
    case 'spawn_black_hole': {
      switch (cmd.variant) {
        case 'sun_replace': {
          const sun = findBody(state, 'sun');
          const pos: Vec3 = sun ? [...sun.position] : [0, 0, 0];
          const vel: Vec3 = sun ? [...sun.velocity] : [0, 0, 0];
          const mass = sun ? sun.mass : SUN_MASS;
          state.bodies = state.bodies.filter((b) => b.id !== 'sun' && b.id !== 'black_hole');
          state.bodies.unshift({
            id: 'black_hole',
            name: '태양 블랙홀',
            mass,
            position: pos,
            velocity: vel,
            physicalRadius: 3000,
            visualRadius: 2.4,
          });
          return true;
        }
        case 'invader': {
          state.bodies = state.bodies.filter((b) => b.id !== 'invader_black_hole');
          state.bodies.push({
            id: 'invader_black_hole',
            name: '방랑 블랙홀',
            mass: SUN_MASS * 5,
            position: [12.0, 9.5, 0],
            velocity: [-0.012, -0.009, 0],
            physicalRadius: 15000,
            visualRadius: 3.2,
          });
          return true;
        }
        case 'giant': {
          const sun = findBody(state, 'sun');
          const pos: Vec3 = sun ? [...sun.position] : [0, 0, 0];
          const vel: Vec3 = sun ? [...sun.velocity] : [0, 0, 0];
          state.bodies = state.bodies.filter((b) => b.id !== 'sun' && b.id !== 'giant_black_hole');
          state.bodies.unshift({
            id: 'giant_black_hole',
            name: '괴물 블랙홀',
            mass: SUN_MASS * 30,
            position: pos,
            velocity: vel,
            physicalRadius: 50000,
            visualRadius: 4.5,
          });
          return true;
        }
        case 'near_earth': {
          const earth = findBody(state, 'earth');
          if (!earth) return false;
          const d = 0.006;
          const mbMass = EARTH_MASS * 1.5;
          const vRel = Math.sqrt((G * (earth.mass + mbMass)) / d);
          state.bodies = state.bodies.filter((b) => b.id !== 'mini_black_hole');
          state.bodies.push({
            id: 'mini_black_hole',
            name: '미니 블랙홀',
            mass: mbMass,
            position: [earth.position[0] + d, earth.position[1], earth.position[2]],
            velocity: [earth.velocity[0], earth.velocity[1] + vRel, earth.velocity[2]],
            physicalRadius: 500,
            visualRadius: 0.7,
          });
          return true;
        }
        case 'jupiter_replace': {
          const jup = findBody(state, 'jupiter');
          if (!jup) return false;
          const pos: Vec3 = [...jup.position];
          const vel: Vec3 = [...jup.velocity];
          const mass = jup.mass;
          state.bodies = state.bodies.filter((b) => b.id !== 'jupiter' && b.id !== 'black_hole_jupiter');
          state.bodies.push({
            id: 'black_hole_jupiter',
            name: '목성 블랙홀',
            mass,
            position: pos,
            velocity: vel,
            physicalRadius: 1000,
            visualRadius: 1.5,
          });
          return true;
        }
      }
      return false;
    }
  }

  const body = findBody(state, cmd.target);
  if (!body) return false;

  switch (cmd.action) {
    case 'remove_body':
      state.bodies = state.bodies.filter((b) => b !== body);
      return true;

    case 'change_mass': {
      if (!(cmd.multiplier > 0)) {
        state.bodies = state.bodies.filter((b) => b !== body);
        return true;
      }
      body.mass *= cmd.multiplier;
      // 무거워진 게 눈에 보이도록 화면 크기도 살짝 바꾼다 (물리와는 무관)
      body.visualRadius *= Math.pow(cmd.multiplier, 0.25);
      body.physicalRadius *= Math.cbrt(cmd.multiplier);
      return true;
    }

    case 'change_velocity': {
      // 속도는 "기준 천체"(위성이면 행성, 아니면 태양) 에 대한 상대 속도로 바꾼다.
      // 예: 지구 속도 0 = 태양에 대해 멈춤.
      const ref = findHost(state.bodies, body) ?? (body.id !== 'sun' ? findBody(state, 'sun') : undefined);
      const rv: Vec3 = ref ? ref.velocity : [0, 0, 0];
      const sats = satellitesOf(state.bodies, body);
      const before: Vec3 = [...body.velocity];
      for (let k = 0; k < 3; k++) body.velocity[k] = rv[k] + (before[k] - rv[k]) * cmd.multiplier;
      // 달 같은 위성은 행성과 함께 움직이도록 같은 만큼 속도를 바꿔 준다.
      for (const s of sats) for (let k = 0; k < 3; k++) s.velocity[k] += body.velocity[k] - before[k];
      return true;
    }

    case 'move_body': {
      const host = findBody(state, cmd.near);
      if (!host || host === body) return false;
      // 행성의 힐 반경 안쪽에 원 궤도로 놓는다.
      const sun = findBody(state, 'sun');
      let d = 0.012; // AU (목성의 위성 칼리스토 정도의 거리)
      const out: Vec3 = [1, 0, 0];
      if (sun && sun !== host) {
        const r = Math.sqrt(dist2(host.position, sun.position));
        const hill = r * Math.cbrt(host.mass / (3 * sun.mass));
        d = Math.min(d, 0.25 * hill);
        for (let k = 0; k < 3; k++) out[k] = (host.position[k] - sun.position[k]) / r;
      }
      const v = Math.sqrt((G * (host.mass + body.mass)) / d);
      const tangent: Vec3 = [-out[1], out[0], 0]; // 반시계 방향
      for (let k = 0; k < 3; k++) {
        body.position[k] = host.position[k] + out[k] * d;
        body.velocity[k] = host.velocity[k] + tangent[k] * v;
      }
      return true;
    }
  }
}
