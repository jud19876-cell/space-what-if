// 시뮬레이션 상태 + Simulation Command.
// UI 버튼과 (앞으로의) AI 는 모두 executeCommand() 를 통해서만 상태를 바꾼다.
import {
  G,
  dist2,
  stepBodies,
  SUN_MASS,
  length,
  setGravityMultiplier,
  getGravityMultiplier,
  setDarkMatterHalo,
  setSolarWind,
  calculateCircularSpeed,
  type Body,
  type Vec3,
  type AbsorptionEvent,
  type CollisionEvent,
} from './physics.ts';
import { createSolarSystem, EARTH_MASS, BODY_INFO, type BodyId } from './solarSystem.ts';

export type Speed = number; // 1 ~ 100x 자유 조절 가능

export interface StackableConditions {
  // 연속 물리 파라미터 (자유 슬라이더)
  gravityMultiplier: number; // -1.0x ~ 10.0x (0x=무중력, -1x=반중력 척력 대팽창)
  sunMassMultiplier: number; // 0.0x ~ 50.0x (0x=태양 실종, 50x=초거대 항성)
  orbitSpeedMultiplier: number; // 0.0x ~ 3.0x (0x=정지 추락, 2x=탈출)

  // 6대 창의적 극한 우주 현상
  antiGravity: boolean; // 🧲 반중력 척력 우주 (암흑에너지 대팽창)
  darkMatterHalo: boolean; // 🌪️ 암흑물질 헤일로 (외곽 행성 은하 고속 회전)
  twinNemesis: boolean; // 🌀 침입 쌍성 난입 (태양계 쌍성계화 & 삼체 카오스)
  asteroidStorm: boolean; // ☄️ 소행성 대폭풍 지속 유입
  retrogradeFlip: boolean; // 💫 전 행성 역행 공전 반전 (180도)
  solarWindRepulsion: boolean; // 💥 초신성 플라즈마 척력 폭풍
}

export function createDefaultConditions(): StackableConditions {
  return {
    gravityMultiplier: 1.0,
    sunMassMultiplier: 1.0,
    orbitSpeedMultiplier: 1.0,
    antiGravity: false,
    darkMatterHalo: false,
    twinNemesis: false,
    asteroidStorm: false,
    retrogradeFlip: false,
    solarWindRepulsion: false,
  };
}

export type SimCommand =
  | { action: 'remove_body'; target: string }
  | { action: 'change_mass'; target: string; multiplier: number }
  | { action: 'set_mass'; target: string; massKg: number }
  | { action: 'set_mass_earth_ratio'; target: string; ratio: number }
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
  | { action: 'set_speed'; speed: number }
  | { action: 'change_visual_radius'; target: string; multiplier: number }
  | { action: 'set_visual_radius'; target: string; radius: number }
  | { action: 'change_orbit_distance'; target: string; deltaAU?: number; distanceAU?: number; circularizeSpeed?: boolean }
  | { action: 'offset_position'; target: string; delta: Vec3 }
  | { action: 'set_speed_magnitude'; target: string; speedAuDay: number }
  | { action: 'spawn_custom_planet'; name: string; typeId: string; distanceAU?: number; position?: Vec3; visualRadius: number; massMultiplier: number; hasRings?: boolean }
  | { action: 'set_condition_slider'; param: 'gravity' | 'sunMass' | 'orbitSpeed'; value: number }
  | { action: 'toggle_extreme_anomaly'; anomaly: 'antiGravity' | 'darkMatterHalo' | 'twinNemesis' | 'asteroidStorm' | 'retrogradeFlip' | 'solarWindRepulsion'; enable: boolean }
  | { action: 'collapse_to_black_hole'; target: string }
  | { action: 'restore_from_black_hole'; target: string }
  | { action: 'spawn_nearby_galaxy'; variant?: 'drift' | 'collide' }
  | { action: 'spawn_supermassive_black_hole' }
  | { action: 'collapse_all_planets_to_black_holes' };

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
  conditions?: StackableConditions;
}

/** 1x 에서 화면 1초 = 시뮬레이션 5일 (지구 1년 ≈ 73초) */
export const DAYS_PER_SECOND = 5;

export function createInitialState(): SimState {
  return { bodies: createSolarSystem(), time: 0, paused: false, speed: 10, swallowedList: [], collisions: [], conditions: createDefaultConditions() };
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

  // 소행성 대폭풍 활성화 시 우주 외곽에서 지속적 소행성 침입
  if (state.conditions?.asteroidStorm && !state.paused) {
    const activeStormAsteroids = state.bodies.filter((b) => b.id.includes('storm_ast')).length;
    if (activeStormAsteroids < 10 && Math.random() < 0.15 * realSeconds * state.speed) {
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const angle = Math.random() * Math.PI * 2;
      const r = 16.0 + Math.random() * 4.0;
      const speed = 0.055 + Math.random() * 0.035;
      const tgtOffset = (Math.random() - 0.5) * 0.4;
      state.bodies.push({
        id: `storm_ast_${uid}`,
        name: `폭풍 소행성 ${uid.slice(-3)}`,
        mass: EARTH_MASS * 0.04,
        position: [Math.cos(angle) * r, Math.sin(angle) * r, 0],
        velocity: [-Math.cos(angle + tgtOffset) * speed, -Math.sin(angle + tgtOffset) * speed, 0],
        physicalRadius: 900,
        visualRadius: 0.42,
      });
    }
  }
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

/** 인접 나선은하 안드로스(Andros) 천계 생성 (중심핵 항성 + 외계 항성 및 행성군) */
export function createAndrosGalaxy(center: Vec3, bulkVelocity: Vec3): Body[] {
  const bodies: Body[] = [];
  const coreMass = SUN_MASS * 4.5;

  // 1. 은하 중심핵 거대 항성 (Andros Core Star)
  bodies.push({
    id: 'andros_core',
    name: '안드로스 은하 중심핵',
    mass: coreMass,
    position: [...center],
    velocity: [...bulkVelocity],
    physicalRadius: 1200000,
    visualRadius: 3.5,
  });

  // 2. 은하 소속 천체들 (외계 거성, 슈퍼지구, 해양행성, 고리행성 등)
  const members: Array<{ id: string; name: string; mass: number; r: number; theta: number; physR: number; visR: number; isBh?: boolean }> = [
    { id: 'andros_valcan', name: '용암행성 발칸', mass: EARTH_MASS * 3.2, r: 1.5, theta: 0.5, physR: 7800, visR: 0.7 },
    { id: 'andros_elysium', name: '외계슈퍼지구 엘리시움', mass: EARTH_MASS * 6.5, r: 3.0, theta: 2.1, physR: 11000, visR: 0.95 },
    { id: 'andros_oceanus', name: '해양행성 오케아누스', mass: EARTH_MASS * 4.2, r: 4.6, theta: 3.7, physR: 8900, visR: 0.85 },
    { id: 'andros_sirius', name: '청색거성 시리우스 프라임', mass: SUN_MASS * 2.2, r: 6.8, theta: 5.1, physR: 980000, visR: 2.5 },
    { id: 'andros_titan', name: '고리행성 크로노스', mass: EARTH_MASS * 320, r: 9.2, theta: 1.1, physR: 71000, visR: 1.7 },
    { id: 'andros_betelgeuse', name: '적색초거성 베텔게우스', mass: SUN_MASS * 3.5, r: 12.5, theta: 2.9, physR: 1600000, visR: 3.2 },
  ];

  for (const m of members) {
    const rx = Math.cos(m.theta) * m.r;
    const ry = Math.sin(m.theta) * m.r;
    const vCirc = Math.sqrt((G * (coreMass + m.mass)) / m.r);
    const vx = -Math.sin(m.theta) * vCirc;
    const vy = Math.cos(m.theta) * vCirc;

    bodies.push({
      id: m.id,
      name: m.name,
      mass: m.mass,
      position: [center[0] + rx, center[1] + ry, center[2]],
      velocity: [bulkVelocity[0] + vx, bulkVelocity[1] + vy, bulkVelocity[2]],
      physicalRadius: m.physR,
      visualRadius: m.visR,
      isBlackHole: m.isBh,
    });
  }

  return bodies;
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
      state.conditions = createDefaultConditions();
      setGravityMultiplier(1.0);
      setDarkMatterHalo(false);
      setSolarWind(false);
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

    case 'spawn_custom_planet': {
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const id = `custom_${cmd.typeId}_${uid}`;
      const mass = EARTH_MASS * cmd.massMultiplier;
      let pos: Vec3;
      let vel: Vec3;

      const sun = findBody(state, 'sun');
      const mSun = sun ? sun.mass : SUN_MASS;

      if (cmd.position) {
        pos = [cmd.position[0], cmd.position[1], cmd.position[2]];
        const r = Math.max(0.1, length(pos));
        const vCirc = calculateCircularSpeed(mSun, r);
        vel = [-pos[1] / r * vCirc, pos[0] / r * vCirc, 0];
      } else {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.max(0.2, cmd.distanceAU ?? 2.0);
        pos = [Math.cos(angle) * r, Math.sin(angle) * r, 0];
        const vCirc = calculateCircularSpeed(mSun, r);
        vel = [-Math.sin(angle) * vCirc, Math.cos(angle) * vCirc, 0];
      }

      const physicalRadius = Math.round(6371 * Math.sqrt(cmd.massMultiplier));

      state.bodies.push({
        id,
        name: cmd.name,
        mass,
        position: pos,
        velocity: vel,
        physicalRadius,
        visualRadius: cmd.visualRadius,
      });
      return true;
    }

    case 'set_condition_slider': {
      if (!state.conditions) state.conditions = createDefaultConditions();
      if (cmd.param === 'gravity') {
        state.conditions.gravityMultiplier = cmd.value;
        setGravityMultiplier(cmd.value);
      } else if (cmd.param === 'sunMass') {
        state.conditions.sunMassMultiplier = cmd.value;
        const sun = findBody(state, 'sun');
        if (sun) sun.mass = SUN_MASS * Math.max(0, cmd.value);
      } else if (cmd.param === 'orbitSpeed') {
        const oldMult = state.conditions.orbitSpeedMultiplier || 1.0;
        const newMult = Math.max(0, cmd.value);
        state.conditions.orbitSpeedMultiplier = newMult;
        const factor = oldMult > 1e-4 ? newMult / oldMult : newMult;
        for (const b of state.bodies) {
          if (b.id !== 'sun' && !b.id.includes('black_hole') && !b.id.includes('nemesis')) {
            b.velocity[0] *= factor;
            b.velocity[1] *= factor;
            b.velocity[2] *= factor;
          }
        }
      }
      return true;
    }

    case 'toggle_extreme_anomaly': {
      if (!state.conditions) state.conditions = createDefaultConditions();
      const anom = cmd.anomaly;
      const enable = cmd.enable;
      state.conditions[anom] = enable;

      switch (anom) {
        case 'antiGravity': {
          setGravityMultiplier(enable ? -1.0 : state.conditions.gravityMultiplier);
          break;
        }
        case 'darkMatterHalo': {
          setDarkMatterHalo(enable);
          break;
        }
        case 'twinNemesis': {
          if (enable) {
            state.bodies = state.bodies.filter((b) => b.id !== 'twin_nemesis');
            state.bodies.push({
              id: 'twin_nemesis',
              name: '청색 쌍성 네메시스',
              mass: SUN_MASS * 1.3,
              position: [7.5, 3.2, 0],
              velocity: [-0.007, 0.015, 0],
              physicalRadius: 850000,
              visualRadius: 2.2,
            });
          } else {
            state.bodies = state.bodies.filter((b) => b.id !== 'twin_nemesis');
          }
          break;
        }
        case 'asteroidStorm': {
          break;
        }
        case 'retrogradeFlip': {
          for (const b of state.bodies) {
            if (b.id !== 'sun' && !b.id.includes('black_hole')) {
              b.velocity[0] *= -1;
              b.velocity[1] *= -1;
              b.velocity[2] *= -1;
            }
          }
          break;
        }
        case 'solarWindRepulsion': {
          setSolarWind(enable);
          break;
        }
      }
      return true;
    }

    case 'spawn_nearby_galaxy': {
      const isCollide = cmd.variant === 'collide';
      state.bodies = state.bodies.filter((b) => !b.id.startsWith('andros_'));
      const center: Vec3 = isCollide ? [20.0, 13.0, 0] : [32.0, 22.0, 0];
      const bulkVel: Vec3 = isCollide ? [-0.018, -0.012, 0] : [-0.003, 0.003, 0];
      const galaxyBodies = createAndrosGalaxy(center, bulkVel);
      for (const gb of galaxyBodies) {
        state.bodies.push(gb);
      }
      return true;
    }

    case 'spawn_supermassive_black_hole': {
      state.bodies = state.bodies.filter((b) => b.id !== 'supermassive_black_hole');
      state.bodies.push({
        id: 'supermassive_black_hole',
        name: '초대질량 블랙홀 [가르간튀아]',
        mass: SUN_MASS * 350,
        position: [16.0, 11.0, 0],
        velocity: [-0.003, -0.002, 0],
        physicalRadius: 300000,
        visualRadius: 6.8,
        isBlackHole: true,
      });

      const hasAndros = state.bodies.some((b) => b.id === 'andros_core');
      if (!hasAndros) {
        const galaxyBodies = createAndrosGalaxy([26.0, 20.0, 0], [-0.008, -0.006, 0]);
        for (const gb of galaxyBodies) {
          state.bodies.push(gb);
        }
      }
      return true;
    }

    case 'collapse_all_planets_to_black_holes': {
      for (const b of state.bodies) {
        if (b.id === 'sun' || b.id.includes('black_hole')) continue;
        b.isBlackHole = true;
        if (!b.name.includes('블랙홀')) {
          b.name = `${b.name} 블랙홀`;
        }
        b.mass = Math.max(EARTH_MASS * 2500, b.mass * 2.0);
        b.visualRadius = Math.max(1.3, Math.min(3.5, 1.0 * Math.pow(b.mass / EARTH_MASS, 0.16)));
        b.physicalRadius = 30;
      }
      return true;
    }
  }

  const body = findBody(state, cmd.target);
  if (!body) return false;

  const BLACK_HOLE_COLLAPSE_THRESHOLD = EARTH_MASS * 1500;

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
      // 질량이 임계치(지구 1500배) 이상에 도달하면 찬드라세카르/TOV 한계 돌파로 블랙홀 자동 각성
      if (body.id !== 'sun' && !body.id.includes('core') && body.mass >= BLACK_HOLE_COLLAPSE_THRESHOLD && !body.isBlackHole) {
        body.isBlackHole = true;
        if (!body.name.includes('블랙홀')) {
          body.name = `${body.name} 블랙홀`;
        }
      }
      body.visualRadius = Math.max(0.08, Math.min(60.0, body.visualRadius * Math.pow(cmd.multiplier, 0.18)));
      body.physicalRadius = Math.min(1500000, Math.round(body.physicalRadius * Math.cbrt(cmd.multiplier)));
      return true;
    }

    case 'set_mass': {
      const targetMass = Math.max(1e18, cmd.massKg);
      const ratio = targetMass / body.mass;
      body.mass = targetMass;
      if (body.id !== 'sun' && !body.id.includes('core') && body.mass >= BLACK_HOLE_COLLAPSE_THRESHOLD && !body.isBlackHole) {
        body.isBlackHole = true;
        if (!body.name.includes('블랙홀')) {
          body.name = `${body.name} 블랙홀`;
        }
      }
      body.visualRadius = Math.max(0.08, Math.min(60.0, body.visualRadius * Math.pow(ratio, 0.18)));
      body.physicalRadius = Math.min(1500000, Math.round(body.physicalRadius * Math.cbrt(ratio)));
      return true;
    }

    case 'set_mass_earth_ratio': {
      const targetMass = Math.max(1e18, EARTH_MASS * cmd.ratio);
      const ratio = targetMass / body.mass;
      body.mass = targetMass;
      if (body.id !== 'sun' && !body.id.includes('core') && body.mass >= BLACK_HOLE_COLLAPSE_THRESHOLD && !body.isBlackHole) {
        body.isBlackHole = true;
        if (!body.name.includes('블랙홀')) {
          body.name = `${body.name} 블랙홀`;
        }
      }
      body.visualRadius = Math.max(0.08, Math.min(60.0, body.visualRadius * Math.pow(ratio, 0.18)));
      body.physicalRadius = Math.min(1500000, Math.round(body.physicalRadius * Math.cbrt(ratio)));
      return true;
    }

    case 'collapse_to_black_hole': {
      body.isBlackHole = true;
      if (!body.name.includes('블랙홀')) {
        body.name = `${body.name} 블랙홀`;
      }
      // 블랙홀 임계 질량 부여 (지구의 2500배 이상)
      body.mass = Math.max(EARTH_MASS * 2500, body.mass * 2.0);
      body.visualRadius = Math.max(1.6, Math.min(6.5, 1.2 * Math.pow(body.mass / EARTH_MASS, 0.18)));
      body.physicalRadius = 30; // 슈바르츠실트 반경 (km)
      return true;
    }

    case 'restore_from_black_hole': {
      body.isBlackHole = false;
      body.name = body.name.replace(' 블랙홀', '').replace('블랙홀 ', '');
      body.mass = body.id === 'earth' ? EARTH_MASS : body.id === 'mars' ? 6.417e23 : body.id === 'jupiter' ? 1.898e27 : EARTH_MASS * 10;
      body.visualRadius = body.id === 'jupiter' ? 1.6 : 0.6;
      body.physicalRadius = body.id === 'jupiter' ? 69911 : 6371;
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

    case 'change_visual_radius': {
      body.visualRadius = Math.max(0.05, Math.min(100.0, body.visualRadius * cmd.multiplier));
      return true;
    }

    case 'set_visual_radius': {
      body.visualRadius = Math.max(0.05, Math.min(100.0, cmd.radius));
      return true;
    }

    case 'change_orbit_distance': {
      const currentR = Math.hypot(body.position[0], body.position[1]);
      if (currentR < 1e-4) return false;
      const newR = cmd.distanceAU !== undefined ? cmd.distanceAU : Math.max(0.1, currentR + (cmd.deltaAU ?? 0));
      const angle = Math.atan2(body.position[1], body.position[0]);
      body.position[0] = Math.cos(angle) * newR;
      body.position[1] = Math.sin(angle) * newR;
      if (cmd.circularizeSpeed) {
        const sun = findBody(state, 'sun');
        const m = sun ? sun.mass : SUN_MASS;
        const v = calculateCircularSpeed(m, newR);
        body.velocity[0] = -Math.sin(angle) * v;
        body.velocity[1] = Math.cos(angle) * v;
        body.velocity[2] = 0;
      }
      return true;
    }

    case 'offset_position': {
      body.position[0] += cmd.delta[0];
      body.position[1] += cmd.delta[1];
      body.position[2] += cmd.delta[2];
      return true;
    }

    case 'set_speed_magnitude': {
      const curSpeed = Math.hypot(body.velocity[0], body.velocity[1], body.velocity[2]);
      if (curSpeed < 1e-8) {
        body.velocity[1] = cmd.speedAuDay;
        return true;
      }
      const ratio = cmd.speedAuDay / curSpeed;
      body.velocity[0] *= ratio;
      body.velocity[1] *= ratio;
      body.velocity[2] *= ratio;
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
