// 하단의 "만약에?" 실험 버튼. 각 실험은 Simulation Command 목록일 뿐이다.
import type { SimCommand } from './simulation.ts';

export interface Scenario {
  id: string;
  emoji: string;
  label: string;
  message: string; // 실행 후 잠깐 보여 줄 말
  commands: SimCommand[];
}

export const SCENARIOS: Scenario[] = [
  { id: 'remove-sun', emoji: '☀️❌', label: '태양 없애기', message: '태양이 사라졌어! 행성들이 어디로 갈까?', commands: [{ action: 'remove_body', target: 'sun' }] },
  { id: 'sun-x2', emoji: '☀️✌️', label: '태양 2배 무겁게', message: '태양이 2배 무거워졌어!', commands: [{ action: 'change_mass', target: 'sun', multiplier: 2 }] },
  { id: 'sun-x10', emoji: '☀️💪', label: '태양 10배 무겁게', message: '태양이 10배 무거워졌어!', commands: [{ action: 'change_mass', target: 'sun', multiplier: 10 }] },
  { id: 'earth-x10', emoji: '🌍💪', label: '지구 10배 무겁게', message: '지구가 10배 무거워졌어! 달은 어떻게 될까?', commands: [{ action: 'change_mass', target: 'earth', multiplier: 10 }] },
  { id: 'earth-fast', emoji: '🌍💨', label: '지구 2배 빠르게', message: '지구가 엄청 빨라졌어!', commands: [{ action: 'change_velocity', target: 'earth', multiplier: 2 }] },
  { id: 'earth-stop', emoji: '🌍✋', label: '지구 멈추기', message: '지구가 멈췄어! 무슨 일이 생길까?', commands: [{ action: 'change_velocity', target: 'earth', multiplier: 0 }] },
  { id: 'remove-moon', emoji: '🌙❌', label: '달 없애기', message: '달이 사라졌어!', commands: [{ action: 'remove_body', target: 'moon' }] },
  { id: 'moon-jupiter', emoji: '🌙➡️🟠', label: '달을 목성으로', message: '달이 목성 옆으로 이사했어!', commands: [{ action: 'move_body', target: 'moon', near: 'jupiter' }] },
  { id: 'remove-jupiter', emoji: '🟠❌', label: '목성 없애기', message: '목성이 사라졌어!', commands: [{ action: 'remove_body', target: 'jupiter' }] },
  { id: 'reset', emoji: '🔄', label: '처음으로', message: '원래 태양계로 돌아왔어!', commands: [{ action: 'reset' }] },
];
