// 시뮬레이션 상태 + Simulation Command.
// UI 버튼과 (앞으로의) AI 는 모두 executeCommand() 를 통해서만 상태를 바꾼다.
import { G, dist2, stepBodies, SUN_MASS, length, type Body, type Vec3, type AbsorptionEvent, type CollisionEvent } from './physics.ts';
import { createSolarSystem, EARTH_MASS, BODY_INFO, type BodyId } from './solarSystem.ts';

export type Speed = number; // 1 ~ 100x 자유 조절 가능

export type SimCommand =
  | { action: 'remove_body'; target: string }
  | { action: 'change_mass'; target: string; multiplier: number }
  | { action: 'change_velocity'; target: string; multiplier: number }
  | { action: 'move_body'; target: string; near: string }
  | { action: 'spawn_black_hole'; variant: 'sun_replace' | 'invader' | 'near_earth' | 'giant' | 'jupiter_replace' | 'vortex' }
  | { action: 'remove_all_black_holes' }
  | { action: 'launch_asteroid'; position: Vec3; velocity: Vec3; massType?: 'normal' | 'giant'; name?: string }
  | { action: 'fire_body_towards'; bodyId: string; targetPosition: Vec3; speedAuDay?: number }
  | { action: 'spawn_asteroid_near'; massType?: 'normal' | 'giant' }
  | { action: 'target_launch'; targetId: string; massType?: 'normal' | 'giant' }
  | { action: 'clear_asteroids' }
  | { action: 'add_body'; body: Body }
  | { action: 'reset' }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'set_speed'; speed: number };

export interface SwallowedRecord {
  id: string;
  name: string;
  emoji: string;
  by: string;
  time: number;
}

export interface SimState {
  bodies: Body[];
  time: number; // 경과 시간 (일)
  paused: boolean;
  speed: Speed;
  swallowedList: SwallowedRecord[];
  collisions: CollisionEvent[];
}

/** 1x 에서 화면 1초 = 시뮬레이션 5일 (지구 1년 ≈ 73초) */
export const DAYS_PER_SECOND = 5;

export function createInitialState(): SimState {
  return { bodies: createSolarSystem(), time: 0, paused: false, speed: 10, swallowedList: [], collisions: [] };
}

/** 화면 시간 realSeconds 만큼 시뮬레이션을 진행한다. */
export function advance(
  state: SimState,
  realSeconds: number,
  onAbsorb?: (ev: AbsorptionEvent) => void,
  onCollision?: (ev: CollisionEvent) => void,
): void {
  if (state.paused) return;
  const days = realSeconds * state.speed * DAYS_PER_SECOND;
  state.time += stepBodies(
    state.bodies,
    days,
    20000,
    (ev) => {
      const info = BODY_INFO[ev.swallowedId as BodyId];
      state.swallowedList.push({
        id: ev.swallowedId,
        name: ev.swallowedName,
        emoji: info?.emoji ?? '🪐',
        by: ev.blackHoleName,
        time: state.time,
      });
      onAbsorb?.(ev);
    },
    (ev) => {
      state.collisions.push(ev);
      onCollision?.(ev);
    },
  );
}

export function findBody(state: SimState, id: string): Body | undefined {
  return state.bodies.find((b) => b.id === id);
}

const SATELLITE_RANGE2 = 0.05 * 0.05; // AU

/** body 가 어떤 행성 곁을 도는 위성이면 그 행성을 돌려준다. (태양 및 블랙홀은 제외) */
export function findHost(bodies: Body[], body: Body): Body | undefined {
  let best: Body | undefined;
  let bestD = SATELLITE_RANGE2;
  for (const h of bodies) {
    if (h === body || h.id === 'sun' || h.id.includes('black_hole') || h.mass < body.mass * 10) continue;
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
      state.swallowedList = [];
      state.collisions = [];
      return true;
    case 'pause':
      state.paused = true;
      return true;
    case 'resume':
      state.paused = false;
      return true;
    case 'set_speed':
      if (typeof cmd.speed !== 'number' || isNaN(cmd.speed)) return false;
      state.speed = Math.max(1, Math.min(100, Math.round(cmd.speed)));
      return true;
    case 'clear_asteroids':
      state.bodies = state.bodies.filter((b) => !b.id.includes('asteroid') && !b.id.includes('fragment'));
      return true;
    case 'launch_asteroid': {
      const isGiant = cmd.massType === 'giant';
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const id = isGiant ? `giant_asteroid_${uid}` : `asteroid_${uid}`;
      const name = cmd.name ?? (isGiant ? '거대 소행성' : '소행성');
      const mass = isGiant ? EARTH_MASS * 0.35 : EARTH_MASS * 0.04;
      const physicalRadius = isGiant ? 3500 : 900;
      const visualRadius = isGiant ? 0.85 : 0.42;

      state.bodies.push({
        id,
        name,
        mass,
        position: [...cmd.position],
        velocity: [...cmd.velocity],
        physicalRadius,
        visualRadius,
      });
      return true;
    }
    case 'fire_body_towards': {
      const b = findBody(state, cmd.bodyId);
      if (!b) return false;
      const dx = cmd.targetPosition[0] - b.position[0];
      const dy = cmd.targetPosition[1] - b.position[1];
      const dz = cmd.targetPosition[2] - b.position[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-5) return false;
      const speed = cmd.speedAuDay ?? 0.075; // 약 130 km/s (고속 돌진)
      b.velocity[0] = (dx / d) * speed;
      b.velocity[1] = (dy / d) * speed;
      b.velocity[2] = (dz / d) * speed;
      return true;
    }
    case 'spawn_asteroid_near': {
      const isGiant = cmd.massType === 'giant';
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const id = isGiant ? `giant_asteroid_${uid}` : `asteroid_${uid}`;
      const name = isGiant ? '거대 소행성' : '소행성';
      const mass = isGiant ? EARTH_MASS * 0.35 : EARTH_MASS * 0.04;
      const physicalRadius = isGiant ? 3500 : 900;
      const visualRadius = isGiant ? 0.85 : 0.42;

      // 지구-화성 사이 (약 1.3 AU)에 소환하여 클릭 대기
      const ang = Math.random() * Math.PI * 2;
      const r = 1.35;
      const pos: Vec3 = [Math.cos(ang) * r, Math.sin(ang) * r, 0];
      const vCirc = Math.sqrt((G * SUN_MASS) / r);
      const vel: Vec3 = [-Math.sin(ang) * vCirc, Math.cos(ang) * vCirc, 0];

      state.bodies.push({
        id,
        name,
        mass,
        position: pos,
        velocity: vel,
        physicalRadius,
        visualRadius,
      });
      return true;
    }
    case 'target_launch': {
      const target = findBody(state, cmd.targetId);
      if (!target) return false;
      const isGiant = cmd.massType === 'giant';
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const id = isGiant ? `giant_asteroid_${uid}` : `asteroid_${uid}`;
      const name = isGiant ? `거대 소행성 (${target.name} 표적)` : `소행성 (${target.name} 표적)`;
      const mass = isGiant ? EARTH_MASS * 0.35 : EARTH_MASS * 0.04;
      const physicalRadius = isGiant ? 3500 : 900;
      const visualRadius = isGiant ? 0.85 : 0.42;

      // 목표 행성 기준으로 0.22 AU 거리에서 상대 속도를 가지고 정확히 정면 돌진
      const targetAngle = Math.atan2(target.position[1], target.position[0]);
      const offsetDist = 0.22;
      const offsetAngle = targetAngle + 0.32;
      const launchPos: Vec3 = [
        target.position[0] + Math.cos(offsetAngle) * offsetDist,
        target.position[1] + Math.sin(offsetAngle) * offsetDist,
        target.position[2],
      ];

      // 약 2.2일 만에 목표와 충돌하도록 상대 속도 부여
      const flightDays = 2.2;
      const relSpeed = offsetDist / flightDays;
      const launchVel: Vec3 = [
        target.velocity[0] - Math.cos(offsetAngle) * relSpeed,
        target.velocity[1] - Math.sin(offsetAngle) * relSpeed,
        target.velocity[2],
      ];

      state.bodies.push({
        id,
        name,
        mass,
        position: launchPos,
        velocity: launchVel,
        physicalRadius,
        visualRadius,
      });
      return true;
    }
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
        case 'vortex': {
          // 대흡수 소용돌이: 20배 블랙홀이 중심에 자리잡고 모든 행성이 아름다운 나선형으로 차례차례 빨려 들어감
          const sun = findBody(state, 'sun');
          const pos: Vec3 = sun ? [...sun.position] : [0, 0, 0];
          const vel: Vec3 = sun ? [...sun.velocity] : [0, 0, 0];
          state.bodies = state.bodies.filter((b) => b.id !== 'sun' && b.id !== 'giant_black_hole');
          state.bodies.unshift({
            id: 'giant_black_hole',
            name: '대흡수 블랙홀',
            mass: SUN_MASS * 25,
            position: pos,
            velocity: vel,
            physicalRadius: 50000,
            visualRadius: 4.8,
          });
          for (const b of state.bodies) {
            if (b.id.includes('black_hole')) continue;
            b.velocity[0] *= 0.6;
            b.velocity[1] *= 0.6;
            b.velocity[2] *= 0.6;
          }
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
      body.visualRadius *= Math.pow(cmd.multiplier, 0.25);
      body.physicalRadius *= Math.cbrt(cmd.multiplier);
      return true;
    }

    case 'change_velocity': {
      const ref = findHost(state.bodies, body) ?? (body.id !== 'sun' ? findBody(state, 'sun') : undefined);
      const rv: Vec3 = ref ? ref.velocity : [0, 0, 0];
      const sats = satellitesOf(state.bodies, body);
      const before: Vec3 = [...body.velocity];
      for (let k = 0; k < 3; k++) body.velocity[k] = rv[k] + (before[k] - rv[k]) * cmd.multiplier;
      for (const s of sats) for (let k = 0; k < 3; k++) s.velocity[k] += body.velocity[k] - before[k];
      return true;
    }

    case 'move_body': {
      const host = findBody(state, cmd.near);
      if (!host || host === body) return false;
      const sun = findBody(state, 'sun');
      let d = 0.012; // AU
      const out: Vec3 = [1, 0, 0];
      if (sun && sun !== host) {
        const r = Math.sqrt(dist2(host.position, sun.position));
        const hill = r * Math.cbrt(host.mass / (3 * sun.mass));
        d = Math.min(d, 0.25 * hill);
        for (let k = 0; k < 3; k++) out[k] = (host.position[k] - sun.position[k]) / r;
      }
      const v = Math.sqrt((G * (host.mass + body.mass)) / d);
      const tangent: Vec3 = [-out[1], out[0], 0];
      for (let k = 0; k < 3; k++) {
        body.position[k] = host.position[k] + out[k] * d;
        body.velocity[k] = host.velocity[k] + tangent[k] * v;
      }
      return true;
    }
  }
}
