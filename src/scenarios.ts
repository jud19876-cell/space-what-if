// 하단의 "만약에?" 실험 버튼. 각 실험은 Simulation Command 목록일 뿐이다.
import type { SimCommand } from './simulation.ts';

export type ScenarioCategory = 'all' | 'solar' | 'blackhole' | 'asteroid';

export interface Scenario {
  id: string;
  emoji: string;
  label: string;
  message: string; // 실행 후 잠깐 보여 줄 말
  category?: 'solar' | 'blackhole' | 'asteroid';
  commands: SimCommand[];
}

export const SCENARIOS: Scenario[] = [
  // --- 태양계 기본 실험 ---
  { id: 'remove-sun', emoji: '☀️❌', label: '태양 없애기', category: 'solar', message: '태양이 사라졌어! 행성들이 어디로 갈까?', commands: [{ action: 'remove_body', target: 'sun' }] },
  { id: 'sun-x2', emoji: '☀️✌️', label: '태양 2배 무겁게', category: 'solar', message: '태양이 2배 무거워졌어!', commands: [{ action: 'change_mass', target: 'sun', multiplier: 2 }] },
  { id: 'sun-x10', emoji: '☀️💪', label: '태양 10배 무겁게', category: 'solar', message: '태양이 10배 무거워졌어!', commands: [{ action: 'change_mass', target: 'sun', multiplier: 10 }] },
  { id: 'earth-x10', emoji: '🌍💪', label: '지구 10배 무겁게', category: 'solar', message: '지구가 10배 무거워졌어! 달은 어떻게 될까?', commands: [{ action: 'change_mass', target: 'earth', multiplier: 10 }] },
  { id: 'earth-fast', emoji: '🌍💨', label: '지구 2배 빠르게', category: 'solar', message: '지구가 엄청 빨라졌어!', commands: [{ action: 'change_velocity', target: 'earth', multiplier: 2 }] },
  { id: 'earth-stop', emoji: '🌍✋', label: '지구 멈추기', category: 'solar', message: '지구가 멈췄어! 무슨 일이 생길까?', commands: [{ action: 'change_velocity', target: 'earth', multiplier: 0 }] },
  { id: 'remove-moon', emoji: '🌙❌', label: '달 없애기', category: 'solar', message: '달이 사라졌어!', commands: [{ action: 'remove_body', target: 'moon' }] },
  { id: 'moon-jupiter', emoji: '🌙➡️🟠', label: '달을 목성으로', category: 'solar', message: '달이 목성 옆으로 이사했어!', commands: [{ action: 'move_body', target: 'moon', near: 'jupiter' }] },
  { id: 'remove-jupiter', emoji: '🟠❌', label: '목성 없애기', category: 'solar', message: '목성이 사라졌어!', commands: [{ action: 'remove_body', target: 'jupiter' }] },

  // --- 소행성 충돌 & 궤도 변경 & 행성 폭발 시뮬레이션 ---
  {
    id: 'asteroid-earth',
    emoji: '☄️🌍',
    label: '지구 소행성 충돌 (궤도 변경)',
    category: 'asteroid',
    message: '소행성이 지구를 향해 날아갑니다! 충돌하면 충격으로 지구 궤도가 타원형으로 바뀝니다!',
    commands: [{ action: 'target_launch', targetId: 'earth', massType: 'normal' }],
  },
  {
    id: 'giant-mars',
    emoji: '💥🔴',
    label: '화성 대폭발 (산산조각)',
    category: 'asteroid',
    message: '초거대 소행성이 화성에 충돌합니다! 엄청난 대폭발과 함께 화성이 산산조각 납니다!',
    commands: [{ action: 'target_launch', targetId: 'mars', massType: 'giant' }],
  },
  {
    id: 'asteroid-jupiter',
    emoji: '☄️🟠',
    label: '목성 거대 소행성 충돌',
    category: 'asteroid',
    message: '거대한 소행성이 가스 거인 목성에 격돌합니다! 강력한 충격파를 관찰해 보세요!',
    commands: [{ action: 'target_launch', targetId: 'jupiter', massType: 'giant' }],
  },
  {
    id: 'asteroid-sun',
    emoji: '☄️☀️',
    label: '태양으로 특급 돌진',
    category: 'asteroid',
    message: '소행성이 태양 중심을 향해 초고속으로 돌진합니다!',
    commands: [
      {
        action: 'launch_asteroid',
        position: [3.2, 2.4, 0],
        velocity: [-0.075, -0.055, 0],
        massType: 'normal',
        name: '돌진 소행성',
      },
    ],
  },
  {
    id: 'clear-asteroids',
    emoji: '🧹☄️',
    label: '소행성/파편 치우기',
    category: 'asteroid',
    message: '우주 공간의 소행성과 파편들을 모두 정리했습니다!',
    commands: [{ action: 'clear_asteroids' }],
  },

  // --- 블랙홀 시뮬레이션 실험 (흡수 소멸 & 나선 낙하) ---
  {
    id: 'astronaut-spaghetti',
    emoji: '🧑‍🚀🍝',
    label: '우주인 낙하 (스파게티 현상)',
    category: 'blackhole',
    message: '우주비행사가 블랙홀로 떨어질 때 어떻게 국수가락처럼 늘어나는지 실험해 볼까요?',
    commands: [],
  },
  {
    id: 'sun-to-blackhole',
    emoji: '🕳️☀️',
    label: '태양이 블랙홀로',
    category: 'blackhole',
    message: '태양이 같은 무게의 블랙홀이 되었어! 중력은 그대로라 행성들은 계속 돌아!',
    commands: [{ action: 'spawn_black_hole', variant: 'sun_replace' }],
  },
  {
    id: 'giant-blackhole',
    emoji: '🕳️🌪️',
    label: '괴물 블랙홀 (30배)',
    category: 'blackhole',
    message: '태양 30배 괴물 블랙홀이야! 가까운 행성들부터 차례로 빨려 들어가 삼켜져!',
    commands: [{ action: 'spawn_black_hole', variant: 'giant' }],
  },
  {
    id: 'blackhole-vortex',
    emoji: '🕳️🧲',
    label: '모든 행성 빨아들이기',
    category: 'blackhole',
    message: '블랙홀 소용돌이가 시작되었어! 모든 행성이 나선형으로 차례차례 빨려 들어가!',
    commands: [{ action: 'spawn_black_hole', variant: 'vortex' }],
  },
  {
    id: 'invader-blackhole',
    emoji: '🕳️👾',
    label: '방랑 블랙홀 침입',
    category: 'blackhole',
    message: '태양계 밖에서 거대한 방랑 블랙홀이 다가와 행성들을 집어삼켜!',
    commands: [{ action: 'spawn_black_hole', variant: 'invader' }],
  },
  {
    id: 'mini-blackhole-earth',
    emoji: '🕳️✨',
    label: '지구 옆 미니 블랙홀',
    category: 'blackhole',
    message: '지구 옆에 미니 블랙홀이 나타났어! 달과 지구에 무슨 일이 생길까?',
    commands: [{ action: 'spawn_black_hole', variant: 'near_earth' }],
  },
  {
    id: 'jupiter-blackhole',
    emoji: '🕳️🟠',
    label: '목성이 블랙홀로',
    category: 'blackhole',
    message: '목성이 압축되어 블랙홀이 되었어!',
    commands: [{ action: 'spawn_black_hole', variant: 'jupiter_replace' }],
  },
  {
    id: 'remove-blackhole',
    emoji: '🕳️❌',
    label: '블랙홀 없애기',
    category: 'blackhole',
    message: '모든 블랙홀이 사라졌어!',
    commands: [{ action: 'remove_all_black_holes' }],
  },

  // --- 리셋 ---
  { id: 'reset', emoji: '🔄', label: '처음으로', message: '원래 태양계로 돌아왔어!', commands: [{ action: 'reset' }] },
];
