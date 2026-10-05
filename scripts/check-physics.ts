// 핵심 물리 시나리오 자동 테스트.  실행: npm run test:physics  (Node 22.6+ / 24)
import { dist2, length, totalEnergy, type Body } from '../src/physics.ts';
import { createInitialState, executeCommand, findBody, advance, DAYS_PER_SECOND, type SimState } from '../src/simulation.ts';
import { createSolarSystem } from '../src/solarSystem.ts';

let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? '✅' : '❌'} ${name}  (${detail})`);
  if (!ok) failed++;
}

/** days 일 만큼 진행 (100x 배속, 60fps 프레임 단위로 실제 앱과 동일하게) */
function run(state: SimState, days: number) {
  state.speed = 100;
  const frame = 1 / 60;
  const frames = Math.round(days / (frame * 100 * DAYS_PER_SECOND));
  for (let i = 0; i < frames; i++) advance(state, frame);
}
const get = (s: SimState, id: string) => findBody(s, id) as Body;
const dist = (a: Body, b: Body) => Math.sqrt(dist2(a.position, b.position));
const r0 = (b: Body) => length(b.position);

// 1. 기본 태양계 안정성 (12년 ≈ 목성 1바퀴)
{
  const s = createInitialState();
  const sun0 = get(s, 'sun');
  const startR = new Map(s.bodies.filter((b) => b.id !== 'sun' && b.id !== 'moon').map((b) => [b.id, dist(b, sun0)]));
  const e0 = totalEnergy(s.bodies);
  let worst = 0;
  let moonMax = 0;
  const t0 = performance.now();
  for (let year = 0; year < 12; year++) {
    for (let k = 0; k < 73; k++) {
      run(s, 5);
      const sun = get(s, 'sun');
      for (const [id, r] of startR) worst = Math.max(worst, Math.abs(dist(get(s, id), sun) / r - 1));
      moonMax = Math.max(moonMax, dist(get(s, 'moon'), get(s, 'earth')));
    }
  }
  const ms = performance.now() - t0;
  const dE = Math.abs(totalEnergy(s.bodies) / e0 - 1);
  check('기본 태양계: 12년 동안 행성 궤도 반지름 변화 < 3%', worst < 0.03, `최대 변화 ${(worst * 100).toFixed(3)}%`);
  check('기본 태양계: 달이 지구 곁에 머무름', moonMax < 0.0035, `최대 거리 ${moonMax.toFixed(5)} AU`);
  check('기본 태양계: 에너지 보존', dE < 1e-4, `상대 오차 ${dE.toExponential(2)}, 계산 ${ms.toFixed(0)}ms / ${s.time.toFixed(0)}일`);
}

// 2. 태양 제거 → 행성들이 궤도를 벗어나 직선으로 날아감
{
  const s = createInitialState();
  executeCommand(s, { action: 'remove_body', target: 'sun' });
  run(s, 365);
  const e = r0(get(s, 'earth'));
  const m = r0(get(s, 'mercury'));
  check('태양 제거: 1년 뒤 지구가 원래 궤도(1 AU)에서 멀리 벗어남', e > 3, `원점에서 ${e.toFixed(2)} AU`);
  check('태양 제거: 수성도 원래 궤도(0.39 AU)에서 벗어남', m > 3, `원점에서 ${m.toFixed(2)} AU`);
  check('태양 제거: 달은 여전히 지구와 함께', dist(get(s, 'moon'), get(s, 'earth')) < 0.005, `${dist(get(s, 'moon'), get(s, 'earth')).toFixed(5)} AU`);
}

// 3. 지구 속도 0 → 태양 쪽으로 떨어짐 (자유낙하 시간 약 65일)
{
  const s = createInitialState();
  executeCommand(s, { action: 'change_velocity', target: 'earth', multiplier: 0 });
  const d0 = dist(get(s, 'earth'), get(s, 'sun'));
  const ds: number[] = [];
  for (let i = 0; i < 6; i++) {
    run(s, 10);
    ds.push(dist(get(s, 'earth'), get(s, 'sun')));
  }
  const decreasing = ds.every((d, i) => d < (i === 0 ? d0 : ds[i - 1]));
  check('지구 정지: 태양과의 거리가 계속 줄어듦', decreasing, [d0, ...ds].map((d) => d.toFixed(3)).join(' → ') + ' AU');
  run(s, 300);
  const finite = s.bodies.every((b) => b.position.every(Number.isFinite));
  check('지구 정지: 태양 통과 후에도 계산이 터지지 않음', finite, `지구-태양 ${dist(get(s, 'earth'), get(s, 'sun')).toFixed(3)} AU`);
}

// 4. 지구 속도 2배 → 탈출
{
  const s = createInitialState();
  executeCommand(s, { action: 'change_velocity', target: 'earth', multiplier: 2 });
  run(s, 730);
  const d = dist(get(s, 'earth'), get(s, 'sun'));
  check('지구 2배 속도: 태양계 밖으로 탈출', d > 3, `2년 뒤 ${d.toFixed(2)} AU`);
}

// 5. 태양 10배 → 궤도가 크게 변함
{
  const s = createInitialState();
  executeCommand(s, { action: 'change_mass', target: 'sun', multiplier: 10 });
  let minD = Infinity;
  for (let i = 0; i < 40; i++) {
    run(s, 5);
    minD = Math.min(minD, dist(get(s, 'earth'), get(s, 'sun')));
  }
  check('태양 10배: 지구가 태양 쪽으로 끌려감', minD < 0.5, `최소 거리 ${minD.toFixed(3)} AU`);
}

// 6. 달을 목성 근처로
{
  const s = createInitialState();
  executeCommand(s, { action: 'move_body', target: 'moon', near: 'jupiter' });
  let maxD = 0;
  for (let i = 0; i < 40; i++) {
    run(s, 10);
    maxD = Math.max(maxD, dist(get(s, 'moon'), get(s, 'jupiter')));
  }
  check('달→목성: 400일 동안 목성 주위를 돎', maxD < 0.03, `최대 거리 ${maxD.toFixed(4)} AU`);
}

// 7. 명령 검증
{
  const s = createInitialState();
  check('없는 천체 명령은 거부', !executeCommand(s, { action: 'remove_body', target: 'pluto' as never }), 'false 반환');
  executeCommand(s, { action: 'remove_body', target: 'jupiter' });
  check('목성 제거', !findBody(s, 'jupiter') && s.bodies.length === 9, `${s.bodies.length}개 남음`);
}

// 8. Reset → 원래 상태와 완전히 동일
{
  const s = createInitialState();
  executeCommand(s, { action: 'change_mass', target: 'sun', multiplier: 10 });
  executeCommand(s, { action: 'remove_body', target: 'moon' });
  executeCommand(s, { action: 'change_velocity', target: 'earth', multiplier: 0 });
  run(s, 200);
  executeCommand(s, { action: 'remove_body', target: 'sun' });
  executeCommand(s, { action: 'reset' });
  const same = JSON.stringify(s.bodies) === JSON.stringify(createSolarSystem()) && s.time === 0;
  check('Reset: 모든 천체의 질량/위치/속도/크기가 원래 값과 비트 단위로 동일', same, `${s.bodies.length}개 천체, time=${s.time}`);
  // reset 후 다시 돌려도 처음 돌린 것과 같은 결과인지
  const a = createInitialState();
  run(a, 100);
  run(s, 100);
  check('Reset: 이후 진행도 처음과 똑같이 재현됨', JSON.stringify(a.bodies) === JSON.stringify(s.bodies), '100일 후 비교');
}

// 9. 블랙홀: 태양이 1x 블랙홀로 교체되어도 행성 궤도는 유지됨 (과학적 사실)
{
  const s = createInitialState();
  executeCommand(s, { action: 'spawn_black_hole', variant: 'sun_replace' });
  run(s, 365.25);
  const bh = get(s, 'black_hole');
  const dEarth = dist(get(s, 'earth'), bh);
  check('블랙홀: 1x 질량 블랙홀로 교체 시 지구 궤도 유지 (<1.5% 오차)', Math.abs(dEarth - 1.0) < 0.015, `1년 후 지구 거리 ${dEarth.toFixed(4)} AU`);
}

// 10. 괴물 블랙홀 (30배): 행성들이 중심으로 빨려 들어가 삼켜짐 (흡수 소멸)
{
  const s = createInitialState();
  executeCommand(s, { action: 'spawn_black_hole', variant: 'giant' });
  for (let i = 0; i < 40; i++) {
    run(s, 5);
  }
  const swallowedEarth = s.swallowedList.some((r) => r.id === 'earth');
  const earthBody = findBody(s, 'earth');
  check('괴물 블랙홀: 지구가 중력점프 없이 블랙홀에 흡수되어 삼켜짐', swallowedEarth && !earthBody, `삼킨 천체 ${s.swallowedList.length}개`);
}

// 11. 블랙홀 생성 후 Reset 복원 검증
{
  const s = createInitialState();
  executeCommand(s, { action: 'spawn_black_hole', variant: 'invader' });
  executeCommand(s, { action: 'spawn_black_hole', variant: 'near_earth' });
  run(s, 150);
  executeCommand(s, { action: 'reset' });
  const restored = s.bodies.length === 10 && !s.bodies.some((b) => b.id.includes('black_hole')) && s.swallowedList.length === 0;
  check('블랙홀 후 Reset: 모든 블랙홀과 삼킨 목록이 초기화되고 10개 행성 원래 상태 복구', restored, `${s.bodies.length}개 천체`);
}

// 12. 중력점프 방지 검증: 정지한 지구가 블랙홀로 낙하할 때 반대편으로 튕겨나가지 않고 흡수 소멸
{
  const s = createInitialState();
  executeCommand(s, { action: 'spawn_black_hole', variant: 'sun_replace' });
  executeCommand(s, { action: 'change_velocity', target: 'earth', multiplier: 0 });
  for (let i = 0; i < 40; i++) {
    run(s, 5);
  }
  const swallowedEarth = s.swallowedList.some((r) => r.id === 'earth');
  check('중력점프 방지: 정지 낙하한 지구가 튕겨나가지 않고 사건의 지평선에 흡수됨', swallowedEarth, `지구 흡수 여부: ${swallowedEarth}`);
}

console.log(failed ? `\n${failed}개 실패` : '\n모든 테스트 통과');
(globalThis as unknown as { process: { exitCode: number } }).process.exitCode = failed ? 1 : 0;
