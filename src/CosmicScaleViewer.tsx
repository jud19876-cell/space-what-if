import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createAtmosphereMaterial, setRadialRingUVs, setupFreeCamera, softenPoints } from './fx.ts';
import { createCloudTexture, createPlanetTexture, createRingTexture, createRoughnessMap } from './planetTextures.ts';

export type CosmicCategory = 'all' | 'human_earth' | 'planets_moons' | 'stars_giants' | 'black_holes' | 'galaxies_universe';

export interface CosmicObject {
  id: string;
  name: string;
  enName: string;
  category: CosmicCategory;
  emoji: string;
  diameterMeters: number;      // 실제 물리적 직경 (미터)
  diameterDisplay: string;     // 표시용 직경 문자열
  lightCrossTime: string;      // 빛이 이 천체를 횡단하는 시간
  ratioFromEarth: number;      // 지구 직경 대비 비율
  marbleEquivalent: string;    // "지구가 1.2cm 구슬일 때" 체감 크기 비유
  description: string;         // 천체 설명
  trivia: string;              // 흥미로운 천문학적 사실
  color: string;
  meshType:
    | 'human' | 'tower' | 'mountain' | 'seoul' | 'moon' | 'terrestrial'
    | 'earth' | 'gas_giant' | 'saturn' | 'sun' | 'blue_star' | 'orange_giant'
    | 'red_supergiant' | 'stephenson' | 'black_hole_sgr' | 'black_hole_ton'
    | 'nebula' | 'solar_system' | 'galaxy_spiral' | 'galaxy_giant_ic'
    | 'local_group' | 'cosmic_web';
}

export const COSMIC_CATALOG: CosmicObject[] = [
  // 1. 인간 & 지구 지역 (Human & Earth Scale)
  {
    id: 'human',
    name: '인간 (Human)',
    enName: 'Human Being',
    category: 'human_earth',
    emoji: '🧍',
    diameterMeters: 1.8,
    diameterDisplay: '1.8 m',
    lightCrossTime: '0.000000006초 (6 ns)',
    ratioFromEarth: 1.8 / 1.2742e7,
    marbleEquivalent: '0.00000017 mm (DNA 한 가닥 크기)',
    description: '우주를 탐구하고 스스로를 인식하는 의식을 가진 생명체입니다.',
    trivia: '인간의 몸을 이루는 원소(탄소, 산소, 철)는 수십억 년 전 초신성 폭발에서 만들어진 별의 먼지입니다.',
    color: '#f43f5e',
    meshType: 'human',
  },
  {
    id: 'lotte_tower',
    name: '롯데월드타워 (Lotte World Tower)',
    enName: 'Lotte World Tower (Seoul)',
    category: 'human_earth',
    emoji: '🗼',
    diameterMeters: 555,
    diameterDisplay: '555 m',
    lightCrossTime: '0.00000185초 (1.85 µs)',
    ratioFromEarth: 555 / 1.2742e7,
    marbleEquivalent: '0.00005 mm (세균 1마리 크기)',
    description: '대한민국 서울에 우뚝 솟은 높이 555m, 123층의 초고층 랜드마크 마천루입니다.',
    trivia: '세계에서 6번째로 높은 건축물로, 지상에서 구름을 뚫고 솟아 있습니다.',
    color: '#06b6d4',
    meshType: 'tower',
  },
  {
    id: 'everest',
    name: '에베레스트 산 (Mt. Everest)',
    enName: 'Mount Everest',
    category: 'human_earth',
    emoji: '🏔️',
    diameterMeters: 8848,
    diameterDisplay: '8,848 m (8.85 km)',
    lightCrossTime: '0.0000295초 (29.5 µs)',
    ratioFromEarth: 8848 / 1.2742e7,
    marbleEquivalent: '0.008 mm (적혈구 1개 크기)',
    description: '지구상에서 가장 높은 산으로 해발 8,848m의 험준한 히말라야 봉우리입니다.',
    trivia: '인도 판과 유라시아 판의 충돌로 인해 매년 약 4mm씩 여전히 하늘로 솟구치고 있습니다.',
    color: '#94a3b8',
    meshType: 'mountain',
  },
  {
    id: 'seoul',
    name: '대한민국 서울 (Seoul)',
    enName: 'Seoul Metropolitan Area',
    category: 'human_earth',
    emoji: '🏙️',
    diameterMeters: 10000,
    diameterDisplay: '10 km (10,000 m)',
    lightCrossTime: '0.000033초 (33 µs)',
    ratioFromEarth: 10000 / 1.2742e7,
    marbleEquivalent: '0.0094 mm (미세먼지 1톨 크기)',
    description: '천만 명의 인류가 생활하는 한강과 남산타워를 품은 거대 메트로폴리스입니다.',
    trivia: '이 거대한 대도시조차 지구 전체 표면적의 0.08%에 불과한 찰나의 영역입니다.',
    color: '#38bdf8',
    meshType: 'seoul',
  },

  // 2. 위성 & 왜소행성 & 암석행성 (Moons & Rocky Planets)
  {
    id: 'ceres',
    name: '세레스 (Ceres)',
    enName: 'Dwarf Planet Ceres',
    category: 'planets_moons',
    emoji: '☄️',
    diameterMeters: 940000,
    diameterDisplay: '940 km',
    lightCrossTime: '0.0031초',
    ratioFromEarth: 940000 / 1.2742e7,
    marbleEquivalent: '0.88 mm (모래알 크기)',
    description: '화성과 목성 사이 소행성대에 위치한 가장 거대한 왜소행성입니다.',
    trivia: '표면 아래에 거대한 얼음 바다가 존재할 가능성이 높아 생명체 탐사의 핵심 후보입니다.',
    color: '#a1a1aa',
    meshType: 'moon',
  },
  {
    id: 'moon',
    name: '달 (The Moon)',
    enName: 'Earth Moon',
    category: 'planets_moons',
    emoji: '🌕',
    diameterMeters: 3474000,
    diameterDisplay: '3,474 km',
    lightCrossTime: '0.0116초',
    ratioFromEarth: 3474000 / 1.2742e7,
    marbleEquivalent: '3.3 mm (참깨 1알 크기)',
    description: '지구의 유일한 자연위성으로 수많은 운석 충돌구(크레이터)를 간직하고 있습니다.',
    trivia: '지구가 1.2cm 구슬이라면 달은 3.3mm 참깨 크기로 약 36cm 떨어진 곳을 돌고 있습니다.',
    color: '#e2e8f0',
    meshType: 'moon',
  },
  {
    id: 'mercury',
    name: '수성 (Mercury)',
    enName: 'Planet Mercury',
    category: 'planets_moons',
    emoji: '🩶',
    diameterMeters: 4879000,
    diameterDisplay: '4,879 km',
    lightCrossTime: '0.0163초',
    ratioFromEarth: 4879000 / 1.2742e7,
    marbleEquivalent: '4.6 mm (작은 콩알 크기)',
    description: '태양에 가장 가까운 행성으로 낮에는 430도, 밤에는 영하 180도에 달합니다.',
    trivia: '거대한 철질 핵이 행성 부피의 60%를 차지하는 금속 덩어리 행성입니다.',
    color: '#94a3b8',
    meshType: 'terrestrial',
  },
  {
    id: 'mars',
    name: '화성 (Mars)',
    enName: 'Planet Mars',
    category: 'planets_moons',
    emoji: '🔴',
    diameterMeters: 6779000,
    diameterDisplay: '6,779 km',
    lightCrossTime: '0.0226초',
    ratioFromEarth: 6779000 / 1.2742e7,
    marbleEquivalent: '6.4 mm (BB탄 총알 크기)',
    description: '산화철 붉은 먼지로 뒤덮인 붉은 행성으로 태양계 최대 화산 올림포스 산을 가집니다.',
    trivia: '지구의 절반 크기이지만 육지 면적만 따지면 지구의 전체 대륙 면적과 거의 같습니다.',
    color: '#f87171',
    meshType: 'terrestrial',
  },
  {
    id: 'venus',
    name: '금성 (Venus)',
    enName: 'Planet Venus',
    category: 'planets_moons',
    emoji: '🟡',
    diameterMeters: 12104000,
    diameterDisplay: '12,104 km',
    lightCrossTime: '0.0404초',
    ratioFromEarth: 12104000 / 1.2742e7,
    marbleEquivalent: '1.14 cm (지구 구슬과 거의 같은 크기)',
    description: '지구의 쌍둥이 행성이지만 농도 96%의 이산화탄소와 황산 구름으로 불타는 지옥입니다.',
    trivia: '표면 기압이 수심 900m와 같고 온도는 470도로 납도 녹아내립니다.',
    color: '#fde047',
    meshType: 'terrestrial',
  },
  {
    id: 'earth',
    name: '지구 (Earth)',
    enName: 'Planet Earth [Baseline]',
    category: 'planets_moons',
    emoji: '🌍',
    diameterMeters: 12742000,
    diameterDisplay: '12,742 km',
    lightCrossTime: '0.0425초 (1초에 지구 7.5바퀴)',
    ratioFromEarth: 1.0,
    marbleEquivalent: '1.20 cm (손바닥 위의 유리구슬 - 기준점)',
    description: '인류가 살아 숨 쉬는 푸른 대양과 생명의 요람, 이 모든 비교의 절대 기준점입니다.',
    trivia: '이 시뮬레이터에서 지구를 1.2cm 구슬로 상상하면 우주 전체의 크기를 온몸으로 체감할 수 있습니다!',
    color: '#22c55e',
    meshType: 'earth',
  },

  // 3. 거대 가스/얼음 행성 (Giant Planets)
  {
    id: 'neptune',
    name: '해왕성 (Neptune)',
    enName: 'Ice Giant Neptune',
    category: 'planets_moons',
    emoji: '🔵',
    diameterMeters: 49244000,
    diameterDisplay: '49,244 km',
    lightCrossTime: '0.164초',
    ratioFromEarth: 49244000 / 1.2742e7,
    marbleEquivalent: '4.6 cm (탁구공 크기)',
    description: '메탄 대기가 빚어낸 짙은 청색의 얼음 거대행성으로 시속 2,100km의 태풍이 붑니다.',
    trivia: '태양계 최강의 폭풍이 휘몰아치는 혹한의 얼음 세상입니다.',
    color: '#3b82f6',
    meshType: 'gas_giant',
  },
  {
    id: 'uranus',
    name: '천왕성 (Uranus)',
    enName: 'Ice Giant Uranus',
    category: 'planets_moons',
    emoji: '🩵',
    diameterMeters: 50724000,
    diameterDisplay: '50,724 km',
    lightCrossTime: '0.169초',
    ratioFromEarth: 50724000 / 1.2742e7,
    marbleEquivalent: '4.8 cm (골프공 크기)',
    description: '자전축이 98도 옆으로 누운 채 공전하는 기묘하고 차가운 청록색 행성입니다.',
    trivia: '극지방이 태양을 정면으로 마주보며 42년 동안 낮, 42년 동안 밤이 이어집니다.',
    color: '#67e8f9',
    meshType: 'gas_giant',
  },
  {
    id: 'saturn',
    name: '토성 (Saturn + Rings)',
    enName: 'Saturn & Majestic Rings',
    category: 'planets_moons',
    emoji: '🪐',
    diameterMeters: 116460000,
    diameterDisplay: '본체 116,460 km (고리 282,000 km)',
    lightCrossTime: '0.388초 (고리 0.94초)',
    ratioFromEarth: 116460000 / 1.2742e7,
    marbleEquivalent: '11.0 cm (오렌지 크기 / 고리 27cm 접시)',
    description: '얼음과 암석 파편으로 이루어진 장엄하고 화려한 거대 고리를 두른 행성입니다.',
    trivia: '밀도가 0.69 g/cm³로 물보다 가벼워, 거대한 욕조가 있다면 물에 둥둥 뜹니다.',
    color: '#fcd34d',
    meshType: 'saturn',
  },
  {
    id: 'jupiter',
    name: '목성 (Jupiter)',
    enName: 'Gas Giant Jupiter',
    category: 'planets_moons',
    emoji: '🟠',
    diameterMeters: 139820000,
    diameterDisplay: '139,820 km',
    lightCrossTime: '0.466초',
    ratioFromEarth: 139820000 / 1.2742e7,
    marbleEquivalent: '13.2 cm (자몽 / 작은 멜론 크기)',
    description: '태양계 모든 행성을 합친 것보다 2.5배 무거운 태양계 행성의 제왕입니다.',
    trivia: '지구 1,321개가 목성 내부에 들어가며, 대적점 폭풍 하나에만 지구가 통째로 들어갑니다.',
    color: '#fb923c',
    meshType: 'gas_giant',
  },

  // 4. 항성 & 초거대성 (Stars & Hypergiants)
  {
    id: 'sun',
    name: '태양 (The Sun)',
    enName: 'Yellow Dwarf Sun',
    category: 'stars_giants',
    emoji: '☀️',
    diameterMeters: 1392700000,
    diameterDisplay: '1,392,700 km',
    lightCrossTime: '4.65초',
    ratioFromEarth: 1392700000 / 1.2742e7,
    marbleEquivalent: '1.31 m (사람 키만한 거대한 비치볼/황금 구체)',
    description: '태양계 질량의 99.86%를 차지하며 빛과 열을 뿜어내는 중심 항성입니다.',
    trivia: '지구 109개를 일렬로 세운 지름이며, 내부에는 지구 130만 개가 들어갑니다.',
    color: '#facc15',
    meshType: 'sun',
  },
  {
    id: 'sirius_a',
    name: '시리우스 A (Sirius A)',
    enName: 'Brightest Star Sirius A',
    category: 'stars_giants',
    emoji: '💎',
    diameterMeters: 2380000000,
    diameterDisplay: '2,380,000 km',
    lightCrossTime: '7.94초',
    ratioFromEarth: 2380000000 / 1.2742e7,
    marbleEquivalent: '2.24 m (태양의 1.7배)',
    description: '지구 밤하늘에서 가장 밝게 빛나는 큰개자리의 눈부신 청백색 주계열성입니다.',
    trivia: '태양보다 25배 밝으며 표면온도는 9,940K에 이릅니다.',
    color: '#93c5fd',
    meshType: 'blue_star',
  },
  {
    id: 'pollux',
    name: '폴룩스 (Pollux)',
    enName: 'Orange Giant Pollux',
    category: 'stars_giants',
    emoji: '🌟',
    diameterMeters: 12500000000,
    diameterDisplay: '12,500,000 km',
    lightCrossTime: '41.7초',
    ratioFromEarth: 12500000000 / 1.2742e7,
    marbleEquivalent: '11.8 m (건물 4층 높이의 거대 별)',
    description: '쌍둥이자리에서 가장 밝은 주황색 거성으로 중심부 헬륨 융합 단계에 있습니다.',
    trivia: '태양 지름의 약 9배에 달하며 주위를 도는 외계행성도 발견되었습니다.',
    color: '#fdba74',
    meshType: 'orange_giant',
  },
  {
    id: 'arcturus',
    name: '아크투루스 (Arcturus)',
    enName: 'Red Giant Arcturus',
    category: 'stars_giants',
    emoji: '🏵️',
    diameterMeters: 35400000000,
    diameterDisplay: '35,400,000 km',
    lightCrossTime: '118초 (약 2분)',
    ratioFromEarth: 35400000000 / 1.2742e7,
    marbleEquivalent: '33.3 m (아파트 12층 높이 거대 구체)',
    description: '목동자리의 붉은 거성으로 태양 지름의 25배에 달하는 거대한 항성입니다.',
    trivia: '태양보다 170배 많은 에너지를 방출하며 수십억 년 뒤 태양의 미래 모습이기도 합니다.',
    color: '#fb923c',
    meshType: 'orange_giant',
  },
  {
    id: 'betelgeuse',
    name: '베텔게우스 (Betelgeuse)',
    enName: 'Red Supergiant Betelgeuse',
    category: 'stars_giants',
    emoji: '🏮',
    diameterMeters: 1060000000000,
    diameterDisplay: '1,060,000,000 km (약 7.1 AU)',
    lightCrossTime: '58.9분 (약 1시간)',
    ratioFromEarth: 1.06e12 / 1.2742e7,
    marbleEquivalent: '1.0 km (마을/테마파크 전체를 덮는 초대형 별)',
    description: '오리온자리의 어깨에 위치한 붉은 초거성으로 언제든 초신성 폭발을 앞두고 있습니다.',
    trivia: '태양 위치에 두면 수성, 금성, 지구, 화성은 물론 목성 궤도까지 통째로 삼켜버립니다.',
    color: '#ef4444',
    meshType: 'red_supergiant',
  },
  {
    id: 'stephenson',
    name: '스티븐슨 2-18 (Stephenson 2-18)',
    enName: 'Hypergiant Stephenson 2-18',
    category: 'stars_giants',
    emoji: '👑',
    diameterMeters: 2990000000000,
    diameterDisplay: '2,990,000,000 km (약 20 AU)',
    lightCrossTime: '2.77시간',
    ratioFromEarth: 2.99e12 / 1.2742e7,
    marbleEquivalent: '2.81 km (거대한 산맥 / 지리산 정상 크기!)',
    description: '인류가 관측한 우주 역사상 가장 거대한 극대거성(Hypergiant)입니다.',
    trivia: '태양 2,150개를 나란히 놓은 크기로, 태양계 토성 궤도(20 AU)를 집어삼키고도 남습니다!',
    color: '#dc2626',
    meshType: 'stephenson',
  },

  // 5. 괴물 블랙홀 & 성운 & 행성계 (Black Holes & Nebulae)
  {
    id: 'sgr_a',
    name: '궁수자리 A* (Sagittarius A*)',
    enName: 'Milky Way Central Black Hole',
    category: 'black_holes',
    emoji: '🕳️',
    diameterMeters: 24000000000,
    diameterDisplay: '사건의 지평선 24,000,000 km',
    lightCrossTime: '80초',
    ratioFromEarth: 24000000000 / 1.2742e7,
    marbleEquivalent: '22.6 m (대형 건물 크기)',
    description: '우리은하의 중심에서 400만 태양질량으로 은하 전체를 지배하는 초대질량 블랙홀입니다.',
    trivia: '2022년 사건지평선망원경(EHT)에 의해 인류 최초로 그림자가 직접 촬영되었습니다.',
    color: '#a855f7',
    meshType: 'black_hole_sgr',
  },
  {
    id: 'm87_blackhole',
    name: 'M87* 초대질량 블랙홀',
    enName: 'M87 Supermassive Black Hole',
    category: 'black_holes',
    emoji: '🕳️',
    diameterMeters: 38000000000000,
    diameterDisplay: '사건의 지평선 380억 km (약 250 AU)',
    lightCrossTime: '35.2시간',
    ratioFromEarth: 3.8e13 / 1.2742e7,
    marbleEquivalent: '35.8 km (서울시 전체 면적 크기)',
    description: '처녀자리 A 은하 중심의 65억 태양질량 블랙홀로 인류 역사상 최초로 사진이 찍힌 블랙홀입니다.',
    trivia: '명왕성 궤도(80 AU) 전체의 3배가 넘는 거대한 암흑의 싱크홀입니다.',
    color: '#e11d48',
    meshType: 'black_hole_ton',
  },
  {
    id: 'ton_618',
    name: 'TON 618 (우주 최대 괴물 블랙홀)',
    enName: 'Hypermassive Black Hole TON 618',
    category: 'black_holes',
    emoji: '🌌🕳️',
    diameterMeters: 390000000000000,
    diameterDisplay: '사건의 지평선 3,900억 km (약 2,600 AU)',
    lightCrossTime: '15일 (빛으로도 보름이 걸림!)',
    ratioFromEarth: 3.9e14 / 1.2742e7,
    marbleEquivalent: '367 km (서울에서 부산까지의 거리!)',
    description: '태양 660억 배 질량의 인류가 발견한 우주 최대 크기의 초대질량 블랙홀 괴물입니다.',
    trivia: '태양계 전체(명왕성 궤도)를 33번 삼키고도 남으며, 태양 140조 개 밝기의 퀘이사 빛을 뿜습니다!',
    color: '#7c3aed',
    meshType: 'black_hole_ton',
  },
  {
    id: 'cat_eye_nebula',
    name: '고양이 눈 성운 (Cat Eye Nebula)',
    enName: 'Planetary Nebula NGC 6543',
    category: 'black_holes',
    emoji: '👁️',
    diameterMeters: 4.73e15,
    diameterDisplay: '직경 0.5 광년 (약 4.7조 km)',
    lightCrossTime: '6개월 (0.5년)',
    ratioFromEarth: 4.73e15 / 1.2742e7,
    marbleEquivalent: '4,450 km (서울에서 괌/하와이 거리)',
    description: '죽어가는 별이 가스를 동심원으로 뿜어내며 만든 신비로운 동심원 성운입니다.',
    trivia: '허블 우주망원경이 촬영한 가장 복잡하고 정교한 가스 매듭 구조를 자랑합니다.',
    color: '#06b6d4',
    meshType: 'nebula',
  },
  {
    id: 'solar_system_oort',
    name: '태양계 전체 (오르트 구름)',
    enName: 'Full Solar System (Oort Cloud)',
    category: 'black_holes',
    emoji: '☀️🪐',
    diameterMeters: 1.89e16,
    diameterDisplay: '직경 2 광년 (약 19조 km)',
    lightCrossTime: '2년',
    ratioFromEarth: 1.89e16 / 1.2742e7,
    marbleEquivalent: '17,800 km (지구 지름의 1.4배 거리)',
    description: '태양의 중력이 미치는 최외곽 혜성 구름으로 수조 개의 얼음 덩어리가 둘러싸고 있습니다.',
    trivia: '카이퍼 벨트를 지나 태양과 가장 가까운 별 프록시마 센타우리 절반까지 뻗어 있습니다.',
    color: '#eab308',
    meshType: 'solar_system',
  },

  // 6. 은하 & 우주 거대구조 (Galaxies & The Universe)
  {
    id: 'milky_way',
    name: '우리은하 (Milky Way Galaxy)',
    enName: 'Milky Way Spiral Galaxy',
    category: 'galaxies_universe',
    emoji: '🌌',
    diameterMeters: 9.46e20,
    diameterDisplay: '100,000 광년 (약 9.5×10¹⁷ km)',
    lightCrossTime: '100,000년 (10만 년)',
    ratioFromEarth: 9.46e20 / 1.2742e7,
    marbleEquivalent: '890,000 km (지구-달 거리의 2.3배!)',
    description: '2,000억~4,000억 개의 별이 소용돌이치는 장엄한 막대나선은하입니다.',
    trivia: '태양계는 중심에서 26,000광년 떨어진 오리온자리 팔에서 시속 80만 km로 은하를 공전합니다.',
    color: '#38bdf8',
    meshType: 'galaxy_spiral',
  },
  {
    id: 'andromeda',
    name: '안드로메다 은하 (Andromeda M31)',
    enName: 'Andromeda Spiral Galaxy',
    category: 'galaxies_universe',
    emoji: '💜',
    diameterMeters: 2.08e21,
    diameterDisplay: '220,000 광년 (우리은하의 2.2배)',
    lightCrossTime: '220,000년',
    ratioFromEarth: 2.08e21 / 1.2742e7,
    marbleEquivalent: '1,960,000 km (지구-달 거리의 5배)',
    description: '국부은하군에서 가장 거대한 은하로 1조 개 이상의 별을 품고 있습니다.',
    trivia: '약 45억 년 뒤 우리은하와 정면 충돌하여 거대한 밀코메다(Milkomeda) 타원은하가 됩니다.',
    color: '#c084fc',
    meshType: 'galaxy_spiral',
  },
  {
    id: 'ic_1101',
    name: 'IC 1101 (우주 최대 괴물 타원은하)',
    enName: 'Supergiant Galaxy IC 1101',
    category: 'galaxies_universe',
    emoji: '👑🌌',
    diameterMeters: 5.68e22,
    diameterDisplay: '6,000,000 광년 (우리은하의 60배!)',
    lightCrossTime: '6,000,000년 (600만 년)',
    ratioFromEarth: 5.68e22 / 1.2742e7,
    marbleEquivalent: '53,400,000 km (지구-화성 간 거리!)',
    description: '인류가 발견한 관측 가능한 우주 역사상 가장 거대한 괴물 거대은하입니다.',
    trivia: '우리은하를 60개 나란히 놓을 수 있으며, 100조 개 이상의 별이 들어찬 우주의 거인입니다!',
    color: '#fbbf24',
    meshType: 'galaxy_giant_ic',
  },
  {
    id: 'local_group',
    name: '국부은하군 (Local Group)',
    enName: 'Local Group of Galaxies',
    category: 'galaxies_universe',
    emoji: '🌀',
    diameterMeters: 9.46e22,
    diameterDisplay: '10,000,000 광년 (1천만 광년)',
    lightCrossTime: '10,000,000년 (1천만 년)',
    ratioFromEarth: 9.46e22 / 1.2742e7,
    marbleEquivalent: '89,000,000 km',
    description: '우리은하, 안드로메다, 삼각형자리 등 50여 개 은하들이 중력으로 묶인 은하 가족입니다.',
    trivia: '은하들이 거대한 우주의 섬처럼 모여 서로를 끌어당기며 군무를 펼칩니다.',
    color: '#ec4899',
    meshType: 'local_group',
  },
  {
    id: 'laniakea',
    name: '라니아케아 초은하단 (Laniakea)',
    enName: 'Laniakea Supercluster',
    category: 'galaxies_universe',
    emoji: '🌊✨',
    diameterMeters: 4.92e24,
    diameterDisplay: '520,000,000 광년 (5.2억 광년)',
    lightCrossTime: '5.2억 년',
    ratioFromEarth: 4.92e24 / 1.2742e7,
    marbleEquivalent: '4,630,000,000 km (지구에서 명왕성 거리!)',
    description: '하와이어로 "끝없는 천국"을 뜻하며 10만 개 은하들이 중력 흐름을 이루는 거대 초은하단입니다.',
    trivia: '모든 은하들이 신비로운 미지의 거대 인력체(Great Attractor)를 향해 강물처럼 흐르고 있습니다.',
    color: '#f59e0b',
    meshType: 'cosmic_web',
  },
  {
    id: 'observable_universe',
    name: '관측 가능한 전체 우주',
    enName: 'Observable Universe & Cosmic Web',
    category: 'galaxies_universe',
    emoji: '🕸️🌐',
    diameterMeters: 8.8e26,
    diameterDisplay: '93,000,000,000 광년 (930억 광년)',
    lightCrossTime: '930억 년',
    ratioFromEarth: 8.8e26 / 1.2742e7,
    marbleEquivalent: '829,000,000,000 km (지구가 구슬일 때도 태양계의 60배!)',
    description: '빅뱅 이후 빛이 도달할 수 있는 2조 개 이상의 은하들이 엮인 궁극의 거대 우주망입니다.',
    trivia: '우리가 출발했던 인간(1.8m)이나 서울(10km)에서 무려 10²³배(1,000해 배) 확장된 시공간입니다.',
    color: '#6366f1',
    meshType: 'cosmic_web',
  },
];

interface CosmicScaleViewerProps {
  onBackToGalaxyLab: () => void;
}

export default function CosmicScaleViewer({ onBackToGalaxyLab }: CosmicScaleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 모드 상태:
  // 'arena' (1:1 실시간 3D 나란히 비교 무대 - MetaBallStudios 3D 스타일)
  // 'marble' (지구 구슬 1.2cm 축소 체감 모드 - 사용자 제공 영상 핵심 테마)
  // 'tour' (Powers of Ten 연속 비행 줌 투어)
  const [viewMode, setViewMode] = useState<'arena' | 'marble' | 'tour'>('arena');

  // 비교 대상 인덱스
  const [targetAIndex, setTargetAIndex] = useState<number>(9); // 기본 A: 지구 (Earth)
  const [targetBIndex, setTargetBIndex] = useState<number>(13); // 기본 B: 목성 (Jupiter)
  const [selectedCategory, setSelectedCategory] = useState<CosmicCategory>('all');
  const [isAutoTouring, setIsAutoTouring] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(true);
  const [tourIndex, setTourIndex] = useState<number>(9);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // 3D 무대 오브젝트 그룹
  const stageGroupRef = useRef<THREE.Group | null>(null);
  const meshARef = useRef<THREE.Group | null>(null);
  const meshBRef = useRef<THREE.Group | null>(null);
  const floorGridRef = useRef<THREE.GridHelper | null>(null);
  const caliperLineRef = useRef<THREE.Line | null>(null);

  const targetA = COSMIC_CATALOG[targetAIndex];
  const targetB = COSMIC_CATALOG[targetBIndex];

  // 필터링된 카탈로그 목록
  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'all') return COSMIC_CATALOG;
    return COSMIC_CATALOG.filter((c) => c.category === selectedCategory);
  }, [selectedCategory]);

  // 배율 계산 (B / A)
  const ratioBoverA = targetB.diameterMeters / Math.max(1e-10, targetA.diameterMeters);
  const volumeRatio = Math.pow(ratioBoverA, 3);

  // ==========================================
  // 절차적 고품질 3D 텍스처 생성 유틸리티들
  // ==========================================
  const textures = useMemo(() => {
    // 지구·목성은 planetTextures 의 절차적 텍스처를 쓴다 (buildObjectMesh 참고)
    // 3. 태양 표면 (Solar Convection Granulation + Flares)
    const sunC = document.createElement('canvas');
    sunC.width = 512;
    sunC.height = 256;
    const sg = sunC.getContext('2d')!;
    const grad = sg.createRadialGradient(256, 128, 10, 256, 128, 256);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.3, '#f59e0b');
    grad.addColorStop(0.7, '#d97706');
    grad.addColorStop(1, '#b45309');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 150; i++) {
      sg.fillStyle = `rgba(254, 240, 138, ${0.15 + Math.random() * 0.35})`;
      sg.beginPath();
      sg.arc(Math.random() * 512, Math.random() * 256, 5 + Math.random() * 25, 0, Math.PI * 2);
      sg.fill();
    }
    const sunTex = new THREE.CanvasTexture(sunC);
    sunTex.colorSpace = THREE.SRGBColorSpace;

    // 4. 초거대성 표면 (Boiling Supergiant Convection)
    const giantC = document.createElement('canvas');
    giantC.width = 512;
    giantC.height = 256;
    const gg = giantC.getContext('2d')!;
    gg.fillStyle = '#7f1d1d';
    gg.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 120; i++) {
      gg.fillStyle = `rgba(239, 68, 68, ${0.2 + Math.random() * 0.4})`;
      gg.beginPath();
      gg.arc(Math.random() * 512, Math.random() * 256, 12 + Math.random() * 40, 0, Math.PI * 2);
      gg.fill();
    }
    const giantTex = new THREE.CanvasTexture(giantC);
    giantTex.colorSpace = THREE.SRGBColorSpace;

    return { sunTex, giantTex };
  }, []);

  // 천체 3D 비주얼 모델 빌더
  const buildObjectMesh = (obj: CosmicObject, visualRadius: number): THREE.Group => {
    const group = new THREE.Group();

    switch (obj.meshType) {
      case 'human': {
        // 정교한 3D 인간 모델 (머리, 몸통, 팔, 다리)
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.5 });
        const clothMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

        const head = new THREE.Mesh(new THREE.SphereGeometry(visualRadius * 0.2, 16, 16), skinMat);
        head.position.y = visualRadius * 0.85;
        group.add(head);

        const body = new THREE.Mesh(new THREE.CylinderGeometry(visualRadius * 0.22, visualRadius * 0.2, visualRadius * 0.6, 12), clothMat);
        body.position.y = visualRadius * 0.45;
        group.add(body);

        const legL = new THREE.Mesh(new THREE.CylinderGeometry(visualRadius * 0.08, visualRadius * 0.07, visualRadius * 0.7, 8), pantsMat);
        legL.position.set(-visualRadius * 0.12, -visualRadius * 0.2, 0);
        group.add(legL);

        const legR = new THREE.Mesh(new THREE.CylinderGeometry(visualRadius * 0.08, visualRadius * 0.07, visualRadius * 0.7, 8), pantsMat);
        legR.position.set(visualRadius * 0.12, -visualRadius * 0.2, 0);
        group.add(legR);
        break;
      }

      case 'tower': {
        // 롯데월드타워 곡선 마천루
        const towerMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.15, transparent: true, opacity: 0.95 });
        const towerGeo = new THREE.CylinderGeometry(visualRadius * 0.12, visualRadius * 0.45, visualRadius * 2.0, 16);
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = visualRadius;
        group.add(tower);

        // 첨탑 비콘
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(visualRadius * 0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
        beacon.position.y = visualRadius * 2.05;
        group.add(beacon);
        break;
      }

      case 'mountain': {
        // 에베레스트 산악 지형
        const mountainGeo = new THREE.ConeGeometry(visualRadius * 1.4, visualRadius * 1.6, 7);
        const mountainMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const mountain = new THREE.Mesh(mountainGeo, mountainMat);
        mountain.position.y = visualRadius * 0.8;
        group.add(mountain);

        // 만년설 눈덮인 정상
        const snowGeo = new THREE.ConeGeometry(visualRadius * 0.6, visualRadius * 0.7, 7);
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.y = visualRadius * 1.25;
        group.add(snow);
        break;
      }

      case 'seoul': {
        // 서울 한강 & 도심 그리드 & 남산타워
        const baseGeo = new THREE.CylinderGeometry(visualRadius * 1.2, visualRadius * 1.2, visualRadius * 0.08, 36);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.2 });
        group.add(new THREE.Mesh(baseGeo, baseMat));

        // 한강 리본
        const riverGeo = new THREE.TorusGeometry(visualRadius * 0.8, visualRadius * 0.06, 8, 24, Math.PI * 0.8);
        const riverMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const river = new THREE.Mesh(riverGeo, riverMat);
        river.rotation.x = Math.PI / 2;
        group.add(river);

        // N서울타워
        const nTower = new THREE.Mesh(new THREE.CylinderGeometry(visualRadius * 0.03, visualRadius * 0.06, visualRadius * 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
        nTower.position.set(-visualRadius * 0.1, visualRadius * 0.45, 0);
        group.add(nTower);
        break;
      }

      case 'earth': {
        // 태양계 화면과 같은 절차적 지구 (대륙·기후대 + 구름층 + 대기 산란광)
        const earthMesh = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 64, 48),
          new THREE.MeshStandardMaterial({ map: createPlanetTexture('earth'), roughnessMap: createRoughnessMap('earth') ?? null, roughness: 1, metalness: 0 }),
        );
        earthMesh.rotation.z = (23.5 * Math.PI) / 180;
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius * 1.015, 64, 48),
          new THREE.MeshStandardMaterial({ map: createCloudTexture(), transparent: true, depthWrite: false }),
        );
        earthMesh.add(clouds);
        group.add(earthMesh);

        const atmo = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius * 1.06, 48, 32),
          createAtmosphereMaterial(0x4d9dff, { power: 2.4, intensity: 1.4 }),
        );
        (atmo.material as THREE.ShaderMaterial).uniforms.uSunPos.value.set(300, 500, 400);
        group.add(atmo);
        break;
      }

      case 'saturn': {
        // 토성 본체 (줄무늬 텍스처) + 실제 비율 고리 (카시니 간극)
        const saturnMesh = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 64, 48),
          new THREE.MeshStandardMaterial({ map: createPlanetTexture('saturn'), roughness: 0.85 }),
        );
        group.add(saturnMesh);

        const rIn = visualRadius * 1.24;
        const rOut = visualRadius * 2.33;
        const ringGeo = setRadialRingUVs(new THREE.RingGeometry(rIn, rOut, 192, 1), rIn, rOut);
        const ringMat = new THREE.MeshBasicMaterial({
          map: createRingTexture('saturn'),
          color: 0xd8d2c8,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2 + 0.35;
        group.add(ring);
        break;
      }

      case 'gas_giant': {
        // 목성 / 천왕성 / 해왕성 (태양계 화면과 같은 절차적 줄무늬 텍스처)
        const known = ['jupiter', 'uranus', 'neptune'].includes(obj.id);
        const giantMesh = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 64, 48),
          new THREE.MeshStandardMaterial({
            map: known ? createPlanetTexture(obj.id) : undefined,
            color: known ? undefined : obj.color,
            roughness: 0.85,
          }),
        );
        group.add(giantMesh);
        break;
      }

      case 'sun': {
        // 불타는 태양 구체 + 코로나 파티클
        const sunMesh = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 40, 40),
          new THREE.MeshStandardMaterial({ map: textures.sunTex, emissive: 0xf59e0b, emissiveIntensity: 0.7 }),
        );
        group.add(sunMesh);

        // 코로나 플레어 글로우
        const corona = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius * 1.15, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35, side: THREE.BackSide }),
        );
        group.add(corona);
        break;
      }

      case 'blue_star': {
        // 시리우스 A 등 청백색 주계열성
        const blueStar = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
        );
        group.add(blueStar);

        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius * 1.25, 20, 20),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, side: THREE.BackSide }),
        );
        group.add(halo);
        break;
      }

      case 'orange_giant':
      case 'red_supergiant':
      case 'stephenson': {
        // 베텔게우스 / 스티븐슨 2-18 등 거대/극대거성
        const giant = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 36, 36),
          new THREE.MeshStandardMaterial({ map: textures.giantTex, emissive: 0xd97706, emissiveIntensity: 0.6 }),
        );
        group.add(giant);

        const redHalo = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius * 1.2, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35, side: THREE.BackSide }),
        );
        group.add(redHalo);
        break;
      }

      case 'black_hole_ton':
      case 'black_hole_sgr': {
        // 칠흑의 사건의 지평선 구체
        const bhCore = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius * 0.9, 36, 36),
          new THREE.MeshBasicMaterial({ color: 0x000000 }),
        );
        group.add(bhCore);

        // 광자 링 (Photon Ring)
        const photonRing = new THREE.Mesh(
          new THREE.RingGeometry(visualRadius * 0.92, visualRadius * 1.05, 48),
          new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
        );
        photonRing.rotation.x = Math.PI / 2;
        group.add(photonRing);

        // 상대론적 강착원반 (Accretion Disk)
        const diskGeo = new THREE.RingGeometry(visualRadius * 1.2, visualRadius * 2.8, 64);
        const diskMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        disk.rotation.x = Math.PI / 2 + 0.2;
        group.add(disk);
        break;
      }

      case 'galaxy_spiral':
      case 'galaxy_giant_ic': {
        // 수천 개 나선팔 별빛 파티클
        const starGeo = new THREE.BufferGeometry();
        const pCount = obj.meshType === 'galaxy_giant_ic' ? 8000 : 5000;
        const positions = new Float32Array(pCount * 3);
        const colors = new Float32Array(pCount * 3);

        for (let i = 0; i < pCount; i++) {
          const arm = i % (obj.meshType === 'galaxy_giant_ic' ? 4 : 2);
          const r = Math.pow(Math.random(), 0.6) * visualRadius * 1.5;
          const theta = arm * Math.PI + Math.log(Math.max(0.5, r)) * 2.8 + (Math.random() - 0.5) * 0.5;
          const z = (Math.random() - 0.5) * (visualRadius * 0.25);

          positions[i * 3] = Math.cos(theta) * r;
          positions[i * 3 + 1] = z;
          positions[i * 3 + 2] = Math.sin(theta) * r;

          const isCore = r < visualRadius * 0.35;
          colors[i * 3] = isCore ? 1.0 : 0.4;
          colors[i * 3 + 1] = isCore ? 0.9 : 0.7;
          colors[i * 3 + 2] = 1.0;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const pMat = softenPoints(new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
        group.add(new THREE.Points(starGeo, pMat));
        break;
      }

      case 'cosmic_web': {
        // 거대 우주망 파티클 & 필라멘트
        const webGeo = new THREE.BufferGeometry();
        const pCount = 6000;
        const positions = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount; i++) {
          const u = Math.random();
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);
          const r = Math.pow(u, 0.7) * visualRadius * 1.8;
          positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          positions[i * 3 + 2] = r * Math.cos(phi);
        }
        webGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const webMat = softenPoints(new THREE.PointsMaterial({ color: 0x818cf8, size: 1.6, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
        group.add(new THREE.Points(webGeo, webMat));
        break;
      }

      default: {
        // 표준 구체 (암석, 위성 등) — 태양계 천체는 절차적 표면 텍스처 사용
        const known = ['moon', 'mercury', 'mars', 'venus'].includes(obj.id);
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(visualRadius, 48, 32),
          new THREE.MeshStandardMaterial({ map: known ? createPlanetTexture(obj.id) : undefined, color: known ? undefined : obj.color, roughness: 0.9 }),
        );
        group.add(sphere);
        break;
      }
    }

    return group;
  };

  // ==========================================
  // Three.js 초기 씬 & 렌더러 설정
  // ==========================================
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040b);
    scene.fog = new THREE.FogExp2(0x02040b, 0.001);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 8000);
    camera.position.set(0, 16, 36);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 5000;
    controls.minDistance = 2;
    controlsRef.current = controls;
    const freeCam = setupFreeCamera(controls, renderer.domElement);

    // 프리미엄 스튜디오 조명 (MetaBallStudios 스타일 바닥 반사 + 림라이트)
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const mainLight = new THREE.DirectionalLight(0xfff5ea, 2.5);
    mainLight.position.set(30, 50, 40);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-30, 20, -30);
    scene.add(rimLight);

    // 하이테크 쇼룸 반사 바닥 그리드
    const grid = new THREE.GridHelper(120, 60, 0x38bdf8, 0x1e293b);
    grid.position.y = -6;
    scene.add(grid);
    floorGridRef.current = grid;

    // 심우주 별빛 파티클
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 1200 + Math.random() * 800;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, softenPoints(new THREE.PointsMaterial({ color: 0xcbd5e1, size: 1.5, sizeAttenuation: false }))));

    // 스테이지 메인 그룹
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);
    stageGroupRef.current = stageGroup;

    let animId: number;
    let clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // 오브젝트 자전
      if (meshARef.current) meshARef.current.rotation.y += 0.25 * delta;
      if (meshBRef.current) meshBRef.current.rotation.y += 0.25 * delta;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      freeCam.dispose();
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [textures]);

  // ==========================================
  // 모드별 3D 오브젝트 배치 및 렌더링 갱신
  // ==========================================
  useEffect(() => {
    if (!stageGroupRef.current || !cameraRef.current || !controlsRef.current) return;
    const stage = stageGroupRef.current;
    // 기존 메시 청소
    while (stage.children.length > 0) {
      stage.remove(stage.children[0]);
    }

    if (viewMode === 'arena') {
      // ----------------------------------------------------
      // [모드 1]: 1:1 실시간 나란히 비교 무대 (Side-by-Side Arena)
      // ----------------------------------------------------
      const ratio = targetB.diameterMeters / Math.max(1e-10, targetA.diameterMeters);

      // 시각적 크기 매핑 (너무 극단적인 배율일 경우 1~12 반경으로 적응형 스케일링)
      let radiusA = 4.0;
      let radiusB = 4.0 * Math.min(15.0, Math.max(0.08, ratio));
      if (ratio > 100) {
        radiusA = 0.6;
        radiusB = 9.0;
      } else if (ratio < 0.01) {
        radiusA = 9.0;
        radiusB = 0.6;
      }

      // 좌측 천체 A 생성
      const meshA = buildObjectMesh(targetA, radiusA);
      meshA.position.set(-radiusB * 0.9 - radiusA * 1.1, 0, 0);
      stage.add(meshA);
      meshARef.current = meshA;

      // 우측 천체 B 생성
      const meshB = buildObjectMesh(targetB, radiusB);
      meshB.position.set(radiusA * 0.9 + radiusB * 0.9, 0, 0);
      stage.add(meshB);
      meshBRef.current = meshB;

      // 두 천체 간 거리 측정선 및 높이 가이드
      const caliperGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-radiusB * 0.9 - radiusA * 1.1, -radiusA * 1.2, 0),
        new THREE.Vector3(radiusA * 0.9 + radiusB * 0.9, -radiusA * 1.2, 0),
      ]);
      const caliperMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
      stage.add(new THREE.Line(caliperGeo, caliperMat));

      // 카메라 거리 자동 피팅
      const maxDim = Math.max(radiusA, radiusB, 5);
      const camDist = maxDim * 3.8 + 10;
      cameraRef.current.position.set(0, maxDim * 0.7, camDist);
      controlsRef.current.target.set(0, 0, 0);

    } else if (viewMode === 'marble') {
      // ----------------------------------------------------
      // [모드 2]: 지구 1.2cm 구슬 축소 체감 모드 (MBS 영상 컨셉)
      // ----------------------------------------------------
      // 기준: 지구 = 반경 1.5단위 (1.2cm 유리구슬)
      const marbleEarthRadius = 1.5;
      const marbleMesh = buildObjectMesh(COSMIC_CATALOG[9], marbleEarthRadius); // Earth
      marbleMesh.position.set(-6, 0, 0);
      stage.add(marbleMesh);
      meshARef.current = marbleMesh;

      // 선택된 대상 B를 구슬 스케일 대비 축소 렌더링
      const earthMeters = 1.2742e7;
      const bRatio = targetB.diameterMeters / earthMeters;
      // 구슬 대비 스케일 계산
      const bScaledRadius = Math.max(0.15, Math.min(18.0, marbleEarthRadius * Math.pow(bRatio, 0.45)));

      const bMesh = buildObjectMesh(targetB, bScaledRadius);
      bMesh.position.set(bScaledRadius + 4, 0, 0);
      stage.add(bMesh);
      meshBRef.current = bMesh;

      cameraRef.current.position.set(0, 8, bScaledRadius * 2.8 + 18);
      controlsRef.current.target.set(0, 0, 0);

    } else if (viewMode === 'tour') {
      // ----------------------------------------------------
      // [모드 3]: 연속 줌 투어 모드 (Powers of Ten Flythrough)
      // ----------------------------------------------------
      const currentObj = COSMIC_CATALOG[tourIndex];
      const singleMesh = buildObjectMesh(currentObj, 6.0);
      stage.add(singleMesh);
      meshARef.current = singleMesh;
      meshBRef.current = null;

      cameraRef.current.position.set(0, 5, 20);
      controlsRef.current.target.set(0, 0, 0);
    }
  }, [viewMode, targetAIndex, targetBIndex, tourIndex]);

  // 투어 자동 재생 타이머
  useEffect(() => {
    if (!isAutoTouring || viewMode !== 'tour') return;
    const interval = setInterval(() => {
      setTourIndex((prev) => (prev + 1) % COSMIC_CATALOG.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isAutoTouring, viewMode]);

  // 다음 천체로 원클릭 비교 (MetaBallStudios 스타일 연속 크기 증폭)
  const handleNextStep = () => {
    if (targetBIndex < COSMIC_CATALOG.length - 1) {
      setTargetAIndex(targetBIndex);
      setTargetBIndex(targetBIndex + 1);
    } else {
      setTargetAIndex(0);
      setTargetBIndex(1);
    }
  };

  const handlePrevStep = () => {
    if (targetAIndex > 0) {
      setTargetBIndex(targetAIndex);
      setTargetAIndex(Math.max(0, targetAIndex - 1));
    }
  };

  return (
    <div className="cosmic-scale-root">
      {/* Three.js 3D 캔버스 */}
      <div ref={containerRef} className="cosmic-scale-canvas" />

      {/* 상단 통합 헤더 */}
      <header className="cosmic-scale-header">
        <div className="scale-header-left">
          <button className="btn btn-back-galaxy" onClick={onBackToGalaxyLab} title="은하 충돌 시뮬레이터로 복귀">
            <span>🌌</span>
            <strong>은하 연구소로 복귀</strong>
          </button>
          <div className="scale-title-group">
            <h1 className="scale-main-title">
              <span className="scale-title-icon">📐</span>
              우주 크기 비교 시뮬레이터 (Cosmic Size Comparison)
            </h1>
            <span className="scale-badge">인간(1.8m) ➔ 지구(1.2만km) ➔ 스티븐슨 2-18 ➔ TON 618 ➔ 전 우주(930억ly)</span>
          </div>
        </div>

        {/* 3대 모드 셀렉터 (Arena / Marble / Tour) */}
        <div className="scale-viewmode-toggle-pill">
          <button
            className={`btn-mode-tab ${viewMode === 'arena' ? 'active' : ''}`}
            onClick={() => { setViewMode('arena'); setIsAutoTouring(false); }}
            title="MetaBallStudios 스타일: 2개 천체를 1:1 3D 무대에 올려 나란히 직접 비교"
          >
            <span>🪐 1:1 나란히 3D 비교</span>
          </button>
          <button
            className={`btn-mode-tab highlight-marble ${viewMode === 'marble' ? 'active' : ''}`}
            onClick={() => { setViewMode('marble'); setIsAutoTouring(false); }}
            title="영상 컨셉: 지구가 1.2cm 구슬(Marble)이라면 다른 천체는 얼마나 거대할까?"
          >
            <span>🔮 지구 구슬(1.2cm) 축소 체감</span>
          </button>
          <button
            className={`btn-mode-tab ${viewMode === 'tour' ? 'active' : ''}`}
            onClick={() => { setViewMode('tour'); setIsAutoTouring(true); }}
            title="작은 인간에서 거대 우주 끝까지 연속적으로 비행하며 감상하는 시네마틱 투어"
          >
            <span>🚀 10의 거듭제곱 연속 투어</span>
          </button>
        </div>
      </header>

      {/* 카테고리 필터 탭 바 */}
      <div className="scale-category-bar">
        <button className={`cat-btn ${selectedCategory === 'all' ? 'active' : ''}`} onClick={() => setSelectedCategory('all')}>전체 (36)</button>
        <button className={`cat-btn ${selectedCategory === 'human_earth' ? 'active' : ''}`} onClick={() => setSelectedCategory('human_earth')}>🧍 인간 & 서울</button>
        <button className={`cat-btn ${selectedCategory === 'planets_moons' ? 'active' : ''}`} onClick={() => setSelectedCategory('planets_moons')}>🌍 행성 & 위성</button>
        <button className={`cat-btn ${selectedCategory === 'stars_giants' ? 'active' : ''}`} onClick={() => setSelectedCategory('stars_giants')}>☀️ 항성 & 초거대성</button>
        <button className={`cat-btn ${selectedCategory === 'black_holes' ? 'active' : ''}`} onClick={() => setSelectedCategory('black_holes')}>🕳️ 괴물 블랙홀</button>
        <button className={`cat-btn ${selectedCategory === 'galaxies_universe' ? 'active' : ''}`} onClick={() => setSelectedCategory('galaxies_universe')}>🌌 은하 & 전 우주</button>
      </div>

      {/* 좌측 상세 인포그래픽 비교 카드 (접기/펼치기 가능) */}
      {isInfoOpen ? (
        <div className="scale-info-card">
          <div className="info-card-top-bar">
            <span className="info-card-badge">📊 천체 상세 스펙</span>
            <button
              className="btn-info-close"
              onClick={() => setIsInfoOpen(false)}
              title="정보 카드 접기 (3D 무대 전체 보기)"
              aria-label="정보 카드 접기"
            >
              ✕ 접기
            </button>
          </div>

          {viewMode === 'arena' && (
            <>
              <div className="arena-compare-header">
                <div className="object-tag tag-a" style={{ borderLeftColor: targetA.color }}>
                  <span className="tag-label">기준 천체 [A]</span>
                  <span className="tag-name">{targetA.emoji} {targetA.name}</span>
                  <span className="tag-size">{targetA.diameterDisplay}</span>
                </div>
                <div className="compare-vs">VS</div>
                <div className="object-tag tag-b" style={{ borderLeftColor: targetB.color }}>
                  <span className="tag-label">비교 천체 [B]</span>
                  <span className="tag-name">{targetB.emoji} {targetB.name}</span>
                  <span className="tag-size">{targetB.diameterDisplay}</span>
                </div>
              </div>

              {/* 핵심 비교 수치 박스 */}
              <div className="ratio-highlight-card">
                <div className="ratio-title">⚡ 직경 및 부피 비교 배율</div>
                <div className="ratio-stat">
                  [{targetB.name}]은(는) [{targetA.name}]의{' '}
                  <strong className="text-highlight">
                    {ratioBoverA >= 1
                      ? `${ratioBoverA.toLocaleString(undefined, { maximumFractionDigits: 1 })}배`
                      : `1 / ${(1 / ratioBoverA).toLocaleString(undefined, { maximumFractionDigits: 1 })}배`}
                  </strong>{' '}
                  크기입니다!
                </div>
                <div className="ratio-sub">
                  구체 부피 기준: 약{' '}
                  <strong>
                    {volumeRatio >= 1
                      ? `${volumeRatio.toExponential(2)}배 (${volumeRatio >= 1e6 ? `${(volumeRatio / 1e6).toFixed(1)}백만` : volumeRatio.toFixed(0)}배)`
                      : `1 / ${(1 / volumeRatio).toExponential(2)}`}
                  </strong>{' '}
                  더 거대합니다.
                </div>
              </div>

              {/* 퀵 내비게이션 컨트롤 */}
              <div className="step-nav-row">
                <button className="btn-step-nav" onClick={handlePrevStep} title="이전 단계 천체 조합으로 이동">
                  ⬅️ 이전 천체 비교
                </button>
                <button className="btn-step-nav highlight" onClick={handleNextStep} title="다음 거대 천체로 순차 확장">
                  다음 천체로 크기 확장 ➡️
                </button>
              </div>
            </>
          )}

          {viewMode === 'marble' && (
            <div className="marble-mode-card">
              <div className="marble-header">
                <span className="marble-icon">🔮</span>
                <div>
                  <h3 className="marble-title">만약 지구가 1.2cm 구슬이라면?</h3>
                  <span className="marble-sub">MetaBallStudios 우주 크기 체감 컨셉</span>
                </div>
              </div>
              <div className="marble-comparison-box">
                <div className="marble-target-name">{targetB.emoji} {targetB.name}</div>
                <div className="marble-result">
                  구슬 스케일 체감 크기:<br />
                  <strong className="text-highlight-gold">{targetB.marbleEquivalent}</strong>
                </div>
              </div>
              <p className="marble-trivia">{targetB.trivia}</p>
            </div>
          )}

          {viewMode === 'tour' && (
            <div className="tour-mode-card">
              <div className="tour-header">
                <span className="tour-badge">현재 천체 ({tourIndex + 1} / {COSMIC_CATALOG.length})</span>
                <button className="btn-tour-toggle" onClick={() => setIsAutoTouring(!isAutoTouring)}>
                  {isAutoTouring ? '⏸️ 일시정지' : '▶️ 투어 재생'}
                </button>
              </div>
              <h2 className="tour-obj-title">{COSMIC_CATALOG[tourIndex].emoji} {COSMIC_CATALOG[tourIndex].name}</h2>
              <div className="tour-size-badge">{COSMIC_CATALOG[tourIndex].diameterDisplay}</div>
              <p className="tour-desc">{COSMIC_CATALOG[tourIndex].description}</p>
              <div className="tour-trivia-box">💡 {COSMIC_CATALOG[tourIndex].trivia}</div>
            </div>
          )}

          {/* 선택된 대상 B의 상세 정보 */}
          <div className="info-detail-box">
            <div className="detail-row">
              <span>빛의 속도 횡단 시간:</span>
              <strong>{targetB.lightCrossTime}</strong>
            </div>
            <div className="detail-row">
              <span>지구(12,742km) 대비 배율:</span>
              <strong>{targetB.ratioFromEarth >= 1 ? `${targetB.ratioFromEarth.toLocaleString(undefined, { maximumFractionDigits: 1 })}배` : `1/${(1 / targetB.ratioFromEarth).toFixed(1)}`}</strong>
            </div>
            <p className="detail-desc">{targetB.description}</p>
          </div>
        </div>
      ) : (
        <button
          className="btn-info-min-pill"
          onClick={() => setIsInfoOpen(true)}
          title="천체 상세 정보 카드 펼치기"
        >
          <span>ℹ️</span>
          <span>[{targetB.name}] 상세 스펙 보기</span>
        </button>
      )}

      {/* 하단 인터랙티브 천체 선택 슬라이더 덱 */}
      <div className="scale-catalog-deck">
        <div className="deck-instruction">
          <span>👇 비교하고 싶은 천체를 클릭하여 선택하세요:</span>
        </div>
        <div className="deck-scroll-container">
          {filteredCatalog.map((item) => {
            const isA = COSMIC_CATALOG.indexOf(item) === targetAIndex;
            const isB = COSMIC_CATALOG.indexOf(item) === targetBIndex;
            return (
              <button
                key={item.id}
                className={`deck-item-chip ${isA ? 'is-target-a' : ''} ${isB ? 'is-target-b' : ''}`}
                onClick={() => {
                  const idx = COSMIC_CATALOG.indexOf(item);
                  if (viewMode === 'tour') {
                    setTourIndex(idx);
                  } else {
                    setTargetBIndex(idx);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTargetAIndex(COSMIC_CATALOG.indexOf(item));
                }}
                title="좌클릭: 비교 대상[B]로 지정 | 우클릭: 기준 천체[A]로 지정"
              >
                <span className="chip-emoji">{item.emoji}</span>
                <span className="chip-name">{item.name}</span>
                <span className="chip-size">{item.diameterDisplay}</span>
                {isA && <span className="chip-badge-a">[기준 A]</span>}
                {isB && <span className="chip-badge-b">[비교 B]</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
