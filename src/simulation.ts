// 시뮬레이션 상태 + Simulation Command.
// UI 버튼과 (앞으로의) AI 는 모두 executeCommand() 를 통해서만 상태를 바꾼다.
import { G, dist2, stepBodies, type Body, type Vec3 } from './physics.ts';
import { createSolarSystem, type BodyId } from './solarSystem.ts';

export type Speed = 1 | 10 | 100;

export type SimCommand =
  | { action: 'remove_body'; target: BodyId }
  | { action: 'change_mass'; target: BodyId; multiplier: number }
  | { action: 'change_velocity'; target: BodyId; multiplier: number }
  | { action: 'move_body'; target: BodyId; near: BodyId }
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
