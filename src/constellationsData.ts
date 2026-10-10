export interface StarData {
  id: string;
  name: string; // 한글 명칭
  englishName: string;
  bayer?: string; // 바이어 기호 (알파, 베타 등)
  color: string; // 별의 분광형 색상 (hex)
  apparentMagnitude: number; // 겉보기 등급 (작을수록 밝음)
  spectralType: string; // 분광형 및 별 종류 (예: M형 붉은 초거성)
  distanceLy: number; // 지구로부터의 실제 거리 (광년 - Light Years)
  description: string; // 6세 어린이 눈높이 별 소개
  skyPos: [number, number]; // 지구에서 본 2D 밤하늘 평면 투영 좌표 [-10 ~ 10]
}

export interface ConstellationStory {
  title: string;
  tagline: string;
  paragraphs: string[];
  funFact: string; // 아이들이 놀랄만한 우주 상식
}

export interface ConstellationData {
  id: string;
  name: string;
  englishName: string;
  emoji: string;
  season: string; // 계절 (여름, 겨울, 봄 등)
  overview: string;
  story: ConstellationStory;
  stars: StarData[];
  lines: [string, string][]; // 연결선 [starId, starId]
  silhouetteType: 'scorpion' | 'hunter' | 'bear' | 'crown' | 'swan' | 'lion';
}

export const CONSTELLATIONS: ConstellationData[] = [
  // 1. 전갈자리 (Scorpius) - 사용자 특별 요청
  {
    id: 'scorpius',
    name: '전갈자리',
    englishName: 'Scorpius',
    emoji: '🦂',
    season: '여름철 남쪽 밤하늘',
    overview: '붉게 뛰는 심장 안타레스와 날카로운 독침 꼬리를 가진 용감한 우주 전갈자리',
    story: {
      title: '오리온을 깜짝 놀라게 한 우주 슈퍼 전갈 이야기',
      tagline: '쿵쾅쿵쾅 뛰는 빨간 심장을 가진 여름 밤하늘의 왕!',
      paragraphs: [
        '옛날 옛적, 사냥꾼 오리온이 "세상에 나보다 힘센 자는 없다!" 하고 매일매일 자랑을 했어요.',
        '이를 들은 우주 여신님이 "진짜 용감함은 겸손한 것이란다" 하고 꼬리에 빛나는 황금 독침을 단 전갈을 보냈답니다.',
        '작지만 날쌘 전갈은 살금살금 다가가 오리온의 발가락을 "찌릿!" 건드렸고, 깜짝 놀란 오리온은 엉덩방아를 찧고 말았어요!',
        '용감함을 인정받은 전갈은 여름 밤하늘의 반짝이는 별자리가 되었답니다. 그래서 지금도 전갈자리가 하늘에 뜨면, 오리온자리는 무서워서 반대편 겨울 하늘로 도망간대요!',
        '전갈자리 한가운데에서 활활 타오르는 붉은 별 "안타레스"는 전갈이 씩씩하게 살아 숨 쉬는 심장이랍니다!'
      ],
      funFact: '지구에서 볼 땐 전갈 몸통의 별들이 나란히 붙어 보이지만, 꼬리별 "웨이"는 65광년으로 우리에게 아주 가깝고, 심장별 "안타레스"는 550광년이나 멀리 떨어져 있어요!'
    },
    stars: [
      {
        id: 'antares',
        name: '안타레스 (전갈의 심장)',
        englishName: 'Antares',
        bayer: 'Alpha Scorpii',
        color: '#ff4422',
        apparentMagnitude: 1.06,
        spectralType: 'M1.5 붉은 초거성',
        distanceLy: 550,
        description: '전갈의 심장이에요! 태양보다 700배나 크고 붉게 활활 타오르는 거대한 초거성이랍니다. 붉은 행성 화성과 색깔이 닮아 "화성의 라이벌"이라고도 불러요!',
        skyPos: [0.2, 0.4]
      },
      {
        id: 'acrab',
        name: '아크라브 (집게발)',
        englishName: 'Acrab (Graffias)',
        bayer: 'Beta Scorpii',
        color: '#88ccff',
        apparentMagnitude: 2.6,
        spectralType: 'B0 푸른 다중성',
        distanceLy: 400,
        description: '전갈의 오른쪽 집게발 끝에 있는 푸른 별이에요! 망원경으로 보면 3개의 별이 서로 춤추며 도는 신기한 삼중성이랍니다.',
        skyPos: [-2.4, 3.8]
      },
      {
        id: 'dschubba',
        name: '드슈바 (전갈의 이마)',
        englishName: 'Dschubba',
        bayer: 'Delta Scorpii',
        color: '#99d5ff',
        apparentMagnitude: 2.3,
        spectralType: 'B0 푸른 거성',
        distanceLy: 490,
        description: '아라비아어로 "전갈의 이마"라는 뜻이에요. 아주 뜨겁고 푸른빛을 뿜어내고 있어요!',
        skyPos: [-1.4, 2.7]
      },
      {
        id: 'pi_sco',
        name: '피 (왼쪽 집게발)',
        englishName: 'Pi Scorpii',
        bayer: 'Pi Scorpii',
        color: '#aaccff',
        apparentMagnitude: 2.9,
        spectralType: 'B1 청백색 주계열성',
        distanceLy: 460,
        description: '전갈의 왼쪽 집게발 관절이에요. 두 개의 별이 빛의 속도로 뱅글뱅글 돌고 있어요.',
        skyPos: [-0.5, 4.4]
      },
      {
        id: 'alniyat',
        name: '알니아트 (심장의 보호벽)',
        englishName: 'Alniyat',
        bayer: 'Sigma Scorpii',
        color: '#cce5ff',
        apparentMagnitude: 2.9,
        spectralType: 'B2 거성',
        distanceLy: 730,
        description: '심장 안타레스의 바로 옆에서 심장을 지켜주는 보디가드 별이에요!',
        skyPos: [-0.8, 0.8]
      },
      {
        id: 'wei',
        name: '웨이 (등허리)',
        englishName: 'Wei',
        bayer: 'Epsilon Scorpii',
        color: '#ffbb44',
        apparentMagnitude: 2.3,
        spectralType: 'K2 오렌지 거성',
        distanceLy: 65,
        description: '전갈자리 별들 중 지구에서 가장 가까운 별이에요! (단 65광년!) 3D 우주에서 보면 다른 별들보다 지구 쪽으로 쑥 튀어나와 있답니다.',
        skyPos: [1.2, -1.2]
      },
      {
        id: 'eta_sco',
        name: '에타 (꼬리 관절)',
        englishName: 'Eta Scorpii',
        bayer: 'Eta Scorpii',
        color: '#ffffcc',
        apparentMagnitude: 3.3,
        spectralType: 'F0 백색 거성',
        distanceLy: 72,
        description: '전갈의 꼬리가 아래로 굽어지기 시작하는 허리 별이에요.',
        skyPos: [2.1, -2.6]
      },
      {
        id: 'sargas',
        name: '사르가스 (꼬리 마디)',
        englishName: 'Sargas',
        bayer: 'Theta Scorpii',
        color: '#ffe5aa',
        apparentMagnitude: 1.86,
        spectralType: 'F1 황백색 밝은 거성',
        distanceLy: 300,
        description: '전갈의 꼬리가 낚싯바늘처럼 위로 말려 올라가는 곳에 위치한 반짝이는 노란 거성이랍니다.',
        skyPos: [2.8, -4.2]
      },
      {
        id: 'shaula',
        name: '샤울라 (독침 끝)',
        englishName: 'Shaula',
        bayer: 'Lambda Scorpii',
        color: '#77b5ff',
        apparentMagnitude: 1.62,
        spectralType: 'B2 푸른 초거성',
        distanceLy: 570,
        description: '전갈자리 꼬리의 가장 끝에 위치한 무서운 독침 별이에요! 아라비아어로 "치켜든 꼬리"라는 뜻을 가지고 있어요.',
        skyPos: [3.9, -3.2]
      },
      {
        id: 'lesath',
        name: '레사트 (독침 바늘)',
        englishName: 'Lesath',
        bayer: 'Upsilon Scorpii',
        color: '#99ccff',
        apparentMagnitude: 2.7,
        spectralType: 'B2 푸른 거성',
        distanceLy: 520,
        description: '샤울라와 쌍을 이루어 독침의 뾰족한 끝을 완성하는 단짝 별이에요!',
        skyPos: [3.5, -2.4]
      }
    ],
    lines: [
      ['acrab', 'dschubba'],
      ['dschubba', 'pi_sco'],
      ['dschubba', 'alniyat'],
      ['alniyat', 'antares'],
      ['antares', 'wei'],
      ['wei', 'eta_sco'],
      ['eta_sco', 'sargas'],
      ['sargas', 'shaula'],
      ['shaula', 'lesath']
    ],
    silhouetteType: 'scorpion'
  },

  // 2. 오리온자리 (Orion)
  {
    id: 'orion',
    name: '오리온자리',
    englishName: 'Orion',
    emoji: '🏹',
    season: '겨울철 남쪽 밤하늘',
    overview: '황금 활과 빛나는 삼태성 허리띠를 찬 밤하늘 최고의 우주 거인 사냥꾼',
    story: {
      title: '반짝이는 세 별 허리띠를 찬 거인 사냥꾼 오리온',
      tagline: '하늘에서 가장 멋진 방패와 허리띠를 자랑하는 겨울의 주인공!',
      paragraphs: [
        '오리온은 키가 산처럼 크고 힘이 센 우주 사냥꾼이었어요. 하늘을 누비며 반짝이는 별의 활을 쏘았지요!',
        '오리온의 양어깨에는 붉은 초거성 "베텔게우스"와 "벨라트릭스"가, 두 발에는 푸른 보석 같은 "리겔"과 "사이프"가 빛나고 있어요.',
        '그리고 허리에는 나란히 붙어 있는 세 개의 예쁜 별(삼태성) 허리띠를 차고 있답니다.',
        '오리온은 용감하지만 전갈을 무서워해서, 전갈자리가 뜨는 여름에는 하늘 아래로 숨어 있다가 전갈이 잠드는 겨울이 되면 다시 나타나요!'
      ],
      funFact: '오리온의 허리띠 삼태성 세 별(알니탁, 알닐람, 민타카)은 지구에선 나란히 붙어 보이지만, 가운데 별 알닐람은 2,000광년이나 멀리 있고 양쪽 별은 약 800광년 떨어져 있어요!'
    },
    stars: [
      {
        id: 'betelgeuse',
        name: '베텔게우스 (오른쪽 어깨)',
        englishName: 'Betelgeuse',
        bayer: 'Alpha Orionis',
        color: '#ff3311',
        apparentMagnitude: 0.5,
        spectralType: 'M2 붉은 초거성',
        distanceLy: 640,
        description: '오리온의 오른쪽 어깨예요! 태양보다 1,000배나 크고 수명이 다해 언제든 초신성 폭발을 일으킬 수 있는 거대한 붉은 별이랍니다.',
        skyPos: [-2.2, 2.5]
      },
      {
        id: 'bellatrix',
        name: '벨라트릭스 (왼쪽 어깨)',
        englishName: 'Bellatrix',
        bayer: 'Gamma Orionis',
        color: '#88bbff',
        apparentMagnitude: 1.64,
        spectralType: 'B2 청백색 거성',
        distanceLy: 245,
        description: '오리온의 왼쪽 어깨 별이에요! "여전사"라는 뜻의 이름을 가진 뜨거운 별이랍니다.',
        skyPos: [2.2, 2.8]
      },
      {
        id: 'alnitak',
        name: '알니탁 (허리띠 1)',
        englishName: 'Alnitak',
        bayer: 'Zeta Orionis',
        color: '#77aaff',
        apparentMagnitude: 1.74,
        spectralType: 'O9 청색 초거성',
        distanceLy: 820,
        description: '오리온 허리띠 삼태성의 첫 번째 별이에요. 근처에 말머리 성운이 숨어 있어요!',
        skyPos: [-1.1, 0.1]
      },
      {
        id: 'alnilam',
        name: '알닐람 (허리띠 2)',
        englishName: 'Alnilam',
        bayer: 'Epsilon Orionis',
        color: '#88ccff',
        apparentMagnitude: 1.69,
        spectralType: 'B0 푸른 초거성',
        distanceLy: 2000,
        description: '허리띠 가운데에 위치한 별로, 무려 2,000광년이나 멀리 떨어져 있어요! 태양보다 50만 배나 밝답니다.',
        skyPos: [0.0, 0.0]
      },
      {
        id: 'mintaka',
        name: '민타카 (허리띠 3)',
        englishName: 'Mintaka',
        bayer: 'Delta Orionis',
        color: '#99ddff',
        apparentMagnitude: 2.23,
        spectralType: 'O9 다중성계',
        distanceLy: 915,
        description: '허리띠의 세 번째 별이에요. 천구의 적도에 거의 정확하게 걸쳐 있답니다.',
        skyPos: [1.1, -0.1]
      },
      {
        id: 'saiph',
        name: '사이프 (오른쪽 무릎)',
        englishName: 'Saiph',
        bayer: 'Kappa Orionis',
        color: '#77aaff',
        apparentMagnitude: 2.07,
        spectralType: 'B0.5 초거성',
        distanceLy: 720,
        description: '오리온의 오른쪽 다리에 있는 별이에요.',
        skyPos: [-1.8, -2.8]
      },
      {
        id: 'rigel',
        name: '리겔 (왼쪽 발)',
        englishName: 'Rigel',
        bayer: 'Beta Orionis',
        color: '#66aaff',
        apparentMagnitude: 0.18,
        spectralType: 'B8 청백색 초거성',
        distanceLy: 860,
        description: '오리온자리에서 가장 밝은 별이에요! 눈부신 푸른 다이아몬드처럼 빛나는 거대한 초거성이랍니다.',
        skyPos: [2.0, -2.6]
      }
    ],
    lines: [
      ['betelgeuse', 'bellatrix'],
      ['betelgeuse', 'alnitak'],
      ['bellatrix', 'mintaka'],
      ['alnitak', 'alnilam'],
      ['alnilam', 'mintaka'],
      ['alnitak', 'saiph'],
      ['mintaka', 'rigel'],
      ['saiph', 'rigel']
    ],
    silhouetteType: 'hunter'
  },

  // 3. 큰곰자리 (북두칠성 - Ursa Major / Big Dipper)
  {
    id: 'ursa_major',
    name: '큰곰자리 (북두칠성)',
    englishName: 'Ursa Major',
    emoji: '🐻',
    season: '사계절 내내 보이는 북쪽 밤하늘',
    overview: '반짝이는 국자 모양의 일곱 별 북두칠성을 품은 신비로운 큰곰자리',
    story: {
      title: '북극성을 가리켜 주는 우주의 별빛 큰 국자',
      tagline: '길을 잃지 않게 도와주는 밤하늘 최고의 길잡이!',
      paragraphs: [
        '밤하늘을 올려다보면 국자 모양으로 총총총 이어진 7개의 밝은 별(북두칠성)이 보여요.',
        '이 별자리는 사실 하늘을 걷고 있는 거대한 곰 엄마의 모습이랍니다!',
        '국자 끝의 두 별(메라크와 두베)을 선으로 이어 위로 5배 뻗어나가면, 길을 잃은 사람들을 지켜주는 "북극성"을 바로 찾을 수 있어요.',
        '옛날 바다를 건너던 항해사들과 사막을 걷던 낙타 대상들은 매일 밤 큰곰자리를 보며 집으로 돌아가는 길을 찾았답니다.'
      ],
      funFact: '북두칠성의 7개 별 중 5개는 약 80광년 거리에 함께 모여 있지만, 국자 손잡이 끝의 "알카이드"는 101광년, 앞머리 "두베"는 124광년으로 훨씬 멀리 있어요!'
    },
    stars: [
      {
        id: 'dubhe',
        name: '두베 (국자 앞머리)',
        englishName: 'Dubhe',
        bayer: 'Alpha Ursae Majoris',
        color: '#ffcc55',
        apparentMagnitude: 1.79,
        spectralType: 'K0 주황색 거성',
        distanceLy: 124,
        description: '국자 머리의 윗별이에요! 메라크와 함께 북극성을 가리키는 지남철 별이랍니다.',
        skyPos: [1.8, 2.4]
      },
      {
        id: 'merak',
        name: '메라크 (국자 바닥)',
        englishName: 'Merak',
        bayer: 'Beta Ursae Majoris',
        color: '#ffffff',
        apparentMagnitude: 2.37,
        spectralType: 'A1 백색 주계열성',
        distanceLy: 79,
        description: '국자 앞면의 아랫별이에요. 두베와 함께 북극성을 향하는 화살표를 만들어요.',
        skyPos: [1.6, 0.4]
      },
      {
        id: 'phecda',
        name: '페크다 (국자 허리)',
        englishName: 'Phecda',
        bayer: 'Gamma Ursae Majoris',
        color: '#f0f5ff',
        apparentMagnitude: 2.44,
        spectralType: 'A0 백색 주계열성',
        distanceLy: 84,
        description: '국자의 바닥 안쪽에 있는 별이에요.',
        skyPos: [-0.6, 0.2]
      },
      {
        id: 'megrez',
        name: '메그레즈 (손잡이 이음새)',
        englishName: 'Megrez',
        bayer: 'Delta Ursae Majoris',
        color: '#eef3ff',
        apparentMagnitude: 3.31,
        spectralType: 'A3 백색별',
        distanceLy: 81,
        description: '국자 그릇과 손잡이가 연결되는 관절 별이에요. 일곱 별 중 가장 귀엽고 앙증맞게 빛나요.',
        skyPos: [-0.4, 2.0]
      },
      {
        id: 'alioth',
        name: '알리오츠 (손잡이 첫째)',
        englishName: 'Alioth',
        bayer: 'Epsilon Ursae Majoris',
        color: '#ffffff',
        apparentMagnitude: 1.77,
        spectralType: 'A1 특이별',
        distanceLy: 81,
        description: '북두칠성에서 가장 밝은 별이에요! 곰의 꼬리가 시작되는 부분에 위치해요.',
        skyPos: [-2.0, 2.4]
      },
      {
        id: 'mizar',
        name: '미자르 (손잡이 둘째 쌍둥이)',
        englishName: 'Mizar',
        bayer: 'Zeta Ursae Majoris',
        color: '#ddeeff',
        apparentMagnitude: 2.23,
        spectralType: 'A2 사중성계',
        distanceLy: 83,
        description: '눈이 좋은 어린이는 미자르 바로 옆에 찰떡처럼 붙어 있는 작은 별 "알코르"를 볼 수 있어요! 옛날 시력 검사용 별이었답니다.',
        skyPos: [-3.4, 1.8]
      },
      {
        id: 'alkaid',
        name: '알카이드 (손잡이 끝)',
        englishName: 'Alkaid',
        bayer: 'Eta Ursae Majoris',
        color: '#88bbff',
        apparentMagnitude: 1.86,
        spectralType: 'B3 청백색 주계열성',
        distanceLy: 101,
        description: '국자 손잡이의 가장 맨 끝에 위치한 푸르고 젊은 에너지가 넘치는 별이에요!',
        skyPos: [-4.6, 0.4]
      }
    ],
    lines: [
      ['dubhe', 'merak'],
      ['merak', 'phecda'],
      ['phecda', 'megrez'],
      ['megrez', 'dubhe'],
      ['megrez', 'alioth'],
      ['alioth', 'mizar'],
      ['mizar', 'alkaid']
    ],
    silhouetteType: 'bear'
  },

  // 4. 카시오페이아자리 (Cassiopeia)
  {
    id: 'cassiopeia',
    name: '카시오페이아자리',
    englishName: 'Cassiopeia',
    emoji: '👑',
    season: '가을/겨울철 북쪽 밤하늘',
    overview: '알파벳 W 모양으로 빛나는 밤하늘 여왕의 빛나는 황금 왕관 별자리',
    story: {
      title: '하늘에 뜬 눈부신 W 모양 황금 왕관',
      tagline: '글자 W처럼 생긴 반짝이는 여왕님의 마법 의자!',
      paragraphs: [
        '북쪽 하늘을 보면 알파벳 W나 M처럼 뾰족뾰족 이어진 다섯 별이 보여요.',
        '이 별자리는 고대 에티오피아의 아름다운 카시오페이아 여왕의 별자리랍니다.',
        '여왕님은 거울을 보며 "내가 세상에서 제일 예뻐!" 하고 자랑하다가 밤하늘의 의자에 앉아 영원히 빛나게 되었대요.',
        '북두칠성이 지평선 아래로 내려갈 때, 카시오페이아자리가 반대편에서 높이 떠올라 북극성을 찾을 수 있게 도와준답니다!'
      ],
      funFact: '다섯 별 중 카프는 54광년으로 우리 동네 이웃이지만, 한가운데 감마 카시오페이아는 610광년이나 떨어져 있어 깊이 차이가 무려 10배가 넘어요!'
    },
    stars: [
      {
        id: 'caph',
        name: '카프 (W의 첫 획)',
        englishName: 'Caph',
        bayer: 'Beta Cassiopeiae',
        color: '#fffaee',
        apparentMagnitude: 2.28,
        spectralType: 'F2 노란색 거성',
        distanceLy: 54,
        description: 'W 모양의 맨 오른쪽 별이에요. 단 54광년 거리에 있어 카시오페이아에서 가장 가까워요!',
        skyPos: [3.2, 1.2]
      },
      {
        id: 'schedar',
        name: '쉐다르 (여왕의 가슴)',
        englishName: 'Schedar',
        bayer: 'Alpha Cassiopeiae',
        color: '#ffaa44',
        apparentMagnitude: 2.24,
        spectralType: 'K0 주황색 거성',
        distanceLy: 228,
        description: '카시오페이아자리에서 가장 밝고 품위 있게 빛나는 주황색 거성이랍니다.',
        skyPos: [1.6, -0.8]
      },
      {
        id: 'gamma_cas',
        name: '감마 카시오페이아 (가운데 꼭짓점)',
        englishName: 'Navi (Gamma Cas)',
        bayer: 'Gamma Cassiopeiae',
        color: '#77aaff',
        apparentMagnitude: 2.15,
        spectralType: 'B0 푸른 변광성',
        distanceLy: 610,
        description: 'W자의 뾰족한 가운데 꼭짓점 별이에요. 610광년이나 먼 우주에서 회전하며 빛을 뿜고 있어요!',
        skyPos: [0.0, 1.8]
      },
      {
        id: 'ruchbah',
        name: '루크바 (여왕의 무릎)',
        englishName: 'Ruchbah',
        bayer: 'Delta Cassiopeiae',
        color: '#eef5ff',
        apparentMagnitude: 2.68,
        spectralType: 'A5 백색 주계열성',
        distanceLy: 99,
        description: 'W자의 왼쪽 계곡에 위치한 백색 별이에요. 99광년 거리에 있어요.',
        skyPos: [-1.8, -0.4]
      },
      {
        id: 'segin',
        name: '세긴 (W의 끝 획)',
        englishName: 'Segin',
        bayer: 'Epsilon Cassiopeiae',
        color: '#99ccee',
        apparentMagnitude: 3.35,
        spectralType: 'B3 청백색 거성',
        distanceLy: 440,
        description: 'W자의 맨 왼쪽 끝을 닫아주는 푸른 거성이에요!',
        skyPos: [-3.4, 1.0]
      }
    ],
    lines: [
      ['caph', 'schedar'],
      ['schedar', 'gamma_cas'],
      ['gamma_cas', 'ruchbah'],
      ['ruchbah', 'segin']
    ],
    silhouetteType: 'crown'
  },

  // 5. 백조자리 (Cygnus)
  {
    id: 'cygnus',
    name: '백조자리',
    englishName: 'Cygnus',
    emoji: '🦢',
    season: '여름철 은하수 한가운데',
    overview: '은하수 강물을 따라 은빛 날개를 활짝 펴고 날아가는 밤하늘의 십자가 백조',
    story: {
      title: '은하수를 건너는 날개 달린 우주 백조',
      tagline: '여름 밤하늘의 은하수 강 위를 멋지게 헤엄치는 백조자리!',
      paragraphs: [
        '여름 밤 쏟아지는 은하수 한가운데를 보면, 커다란 십자가(북십자성) 모양으로 날개를 활짝 편 백조가 보여요.',
        '백조의 꼬리에 있는 "데네브"는 태양보다 수만 배나 밝고 강력한 슈퍼 거성이에요.',
        '백조의 부리 끝에 있는 "알비레오"는 망원경으로 보면 황금빛 별과 푸른 사파이어 별이 다정하게 붙어 있는 우주에서 가장 예쁜 이중성이랍니다.',
        '은빛 깃털을 휘날리며 은하수를 날아가는 백조자리는 여름 밤하늘의 눈부신 보석이에요!'
      ],
      funFact: '꼬리별 데네브는 무려 2,600광년이나 멀리 있지만, 빛이 너무나 강력해서 지구에서도 아주 밝게 보여요!'
    },
    stars: [
      {
        id: 'deneb',
        name: '데네브 (백조의 꼬리)',
        englishName: 'Deneb',
        bayer: 'Alpha Cygni',
        color: '#ffffff',
        apparentMagnitude: 1.25,
        spectralType: 'A2 백색 초거성',
        distanceLy: 2600,
        description: '여름철 대삼각형의 주인공 중 하나예요! 2,600광년이라는 엄청난 거리에서도 밝게 빛나는 초거성이랍니다.',
        skyPos: [0.0, 3.2]
      },
      {
        id: 'sadr',
        name: '사드르 (백조의 가슴)',
        englishName: 'Sadr',
        bayer: 'Gamma Cygni',
        color: '#fffae8',
        apparentMagnitude: 2.23,
        spectralType: 'F8 황백색 초거성',
        distanceLy: 1800,
        description: '십자가의 중심이자 백조의 가슴이에요. 주변에 환상적인 성운들이 가득해요.',
        skyPos: [0.0, 0.4]
      },
      {
        id: 'albireo',
        name: '알비레오 (백조의 부리)',
        englishName: 'Albireo',
        bayer: 'Beta Cygni',
        color: '#ffcc33',
        apparentMagnitude: 3.05,
        spectralType: 'K3 황금색 거성 + 청색별',
        distanceLy: 430,
        description: '우주에서 가장 아름다운 보석 별이에요! 황금빛 별과 파란색 별이 꼭 붙어 있답니다.',
        skyPos: [0.0, -3.2]
      },
      {
        id: 'gienah',
        name: '기에나 (동쪽 날개)',
        englishName: 'Gienah',
        bayer: 'Epsilon Cygni',
        color: '#ffdd77',
        apparentMagnitude: 2.48,
        spectralType: 'K0 주황색 거성',
        distanceLy: 72,
        description: '백조의 오른쪽 날개 끝이에요. 단 72광년으로 백조자리 중에서 지구에 가장 가까워요!',
        skyPos: [2.6, 0.2]
      },
      {
        id: 'fawaris',
        name: '파와리스 (서쪽 날개)',
        englishName: 'Delta Cygni',
        bayer: 'Delta Cygni',
        color: '#ddecff',
        apparentMagnitude: 2.87,
        spectralType: 'B9 청백색 준거성',
        distanceLy: 165,
        description: '백조의 왼쪽 날개 끝을 장식하는 별이랍니다.',
        skyPos: [-2.4, 0.6]
      }
    ],
    lines: [
      ['deneb', 'sadr'],
      ['sadr', 'albireo'],
      ['sadr', 'gienah'],
      ['sadr', 'fawaris']
    ],
    silhouetteType: 'swan'
  },

  // 6. 사자자리 (Leo)
  {
    id: 'leo',
    name: '사자자리',
    englishName: 'Leo',
    emoji: '🦁',
    season: '봄철 남쪽 밤하늘',
    overview: '물음표를 뒤집은 듯한 낫 모양 머리와 황금 갈기를 휘날리는 우주의 숲속 왕 사자',
    story: {
      title: '용감한 황금 갈기 아기 사자 레굴루스 이야기',
      tagline: '하늘의 작은 왕이라 불리는 봄 밤하늘의 씩씩한 사자!',
      paragraphs: [
        '봄바람이 살랑살랑 불어올 때 밤하늘을 보면 거대한 사자 한 마리가 늠름하게 엎드려 있어요.',
        '사자의 머리는 마치 물음표(?)를 거꾸로 뒤집어 놓은 낫 모양으로 멋진 갈기를 표현하고 있답니다.',
        '사자의 심장에 있는 가장 밝은 별 "레굴루스"는 라틴어로 "작은 왕(Little King)"이라는 뜻이에요!',
        '어린이들이 밤하늘을 보며 "어흥!" 하고 외치면, 하늘의 별 사자가 별빛 눈을 깜빡이며 웃어줄 거예요!'
      ],
      funFact: '사자의 심장별 레굴루스는 77광년, 꼬리별 데네볼라는 36광년으로 우리에게 아주 친근한 이웃 별들이에요!'
    },
    stars: [
      {
        id: 'regulus',
        name: '레굴루스 (사자의 심장 / 작은 왕)',
        englishName: 'Regulus',
        bayer: 'Alpha Leonis',
        color: '#88bbff',
        apparentMagnitude: 1.36,
        spectralType: 'B7 청백색 주계열성',
        distanceLy: 77,
        description: '사자의 심장이에요! "작은 왕"이라는 뜻으로, 너무 빨리 자전해서 럭비공처럼 납작해진 신기한 별이랍니다.',
        skyPos: [-2.0, -1.8]
      },
      {
        id: 'denebola',
        name: '데네볼라 (사자의 꼬리)',
        englishName: 'Denebola',
        bayer: 'Beta Leonis',
        color: '#ffffff',
        apparentMagnitude: 2.14,
        spectralType: 'A3 백색 주계열성',
        distanceLy: 36,
        description: '아라비아어로 "사자의 꼬리"라는 뜻이에요. 단 36광년 거리에 있어 사자자리에서 가장 가까워요!',
        skyPos: [3.4, 0.4]
      },
      {
        id: 'algieba',
        name: '알기에바 (사자의 갈기)',
        englishName: 'Algieba',
        bayer: 'Gamma Leonis',
        color: '#ffcc44',
        apparentMagnitude: 2.01,
        spectralType: 'K1 황금빛 쌍성',
        distanceLy: 130,
        description: '사자의 멋진 목덜미 갈기를 이루는 황금빛 쌍둥이 별이랍니다.',
        skyPos: [-1.2, 0.8]
      },
      {
        id: 'zosma',
        name: '조스마 (사자의 등허리)',
        englishName: 'Zosma',
        bayer: 'Delta Leonis',
        color: '#f0f5ff',
        apparentMagnitude: 2.56,
        spectralType: 'A4 백색별',
        distanceLy: 58,
        description: '사자의 등허리에 위치한 하얀 별이에요.',
        skyPos: [1.6, 1.2]
      },
      {
        id: 'chertan',
        name: '체르탄 (사자의 뒷다리)',
        englishName: 'Chertan',
        bayer: 'Theta Leonis',
        color: '#ffffff',
        apparentMagnitude: 3.33,
        spectralType: 'A2 주계열성',
        distanceLy: 165,
        description: '사자가 웅크리고 있는 뒷다리를 받쳐주는 별이에요.',
        skyPos: [1.8, -0.6]
      },
      {
        id: 'adhafera',
        name: '알다페라 (갈기 꼭대기)',
        englishName: 'Adhafera',
        bayer: 'Zeta Leonis',
        color: '#fff0cc',
        apparentMagnitude: 3.43,
        spectralType: 'F0 거성',
        distanceLy: 260,
        description: '물음표 모양 갈기의 머리 꼭대기 별이에요.',
        skyPos: [-0.6, 2.2]
      }
    ],
    lines: [
      ['regulus', 'algieba'],
      ['algieba', 'adhafera'],
      ['algieba', 'zosma'],
      ['zosma', 'denebola'],
      ['zosma', 'chertan'],
      ['chertan', 'denebola'],
      ['regulus', 'chertan']
    ],
    silhouetteType: 'lion'
  }
];

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonConstellationGuide {
  seasonKey: SeasonKey;
  seasonName: string;
  seasonEmoji: string;
  angleRad: number; // 봄: 0, 여름: PI/2, 가을: PI, 겨울: 3PI/2
  headline: string;
  description: string;
}

export const SEASON_GUIDES: Record<string, SeasonConstellationGuide> = {
  scorpius: {
    seasonKey: 'summer',
    seasonName: '여름',
    seasonEmoji: '☀️',
    angleRad: Math.PI * 0.5,
    headline: '전갈자리는 대표적인 한여름 밤하늘의 왕!',
    description: '지구가 여름 위치에 있을 때 밤하늘 방향이 전갈자리를 향해요! 반대로 겨울에는 태양이 전갈자리 앞을 가려서 볼 수 없답니다.',
  },
  orion: {
    seasonKey: 'winter',
    seasonName: '겨울',
    seasonEmoji: '❄️',
    angleRad: Math.PI * 1.5,
    headline: '오리온자리는 대표적인 한겨울 밤하늘의 주인공!',
    description: '지구가 겨울 위치에 오면 밤하늘 방향에 오리온자리가 웅장하게 떠올라요! 여름에는 태양 뒤에 숨어 있어서 전갈자리와 절대 마주치지 않아요.',
  },
  ursa_major: {
    seasonKey: 'spring',
    seasonName: '봄',
    seasonEmoji: '🌸',
    angleRad: 0,
    headline: '큰곰자리(북두칠성)는 봄철 밤하늘 가장 높이 솟아올라요!',
    description: '지구가 봄 궤도에 있을 때 북쪽 하늘 높은 곳에서 국자 모양 북두칠성이 밝고 선명하게 보여요.',
  },
  cassiopeia: {
    seasonKey: 'autumn',
    seasonName: '가을',
    seasonEmoji: '🍁',
    angleRad: Math.PI,
    headline: '카시오페이아자리는 가을철 밤하늘의 여왕 왕관!',
    description: '지구가 가을 궤도를 지날 때 가을 밤하늘 높은 곳에서 빛나는 W자 여왕의 왕관을 볼 수 있어요.',
  },
  cygnus: {
    seasonKey: 'summer',
    seasonName: '여름',
    seasonEmoji: '☀️',
    angleRad: Math.PI * 0.5,
    headline: '백조자리는 여름철 은하수를 날아가는 은빛 백조!',
    description: '여름철 밤하늘, 은하수를 따라 거문고자리, 독수리자리와 함께 [여름철 대삼각형]을 이루며 아름답게 날아갑니다.',
  },
  leo: {
    seasonKey: 'spring',
    seasonName: '봄',
    seasonEmoji: '🌸',
    angleRad: 0,
    headline: '사자자리는 따뜻한 봄밤을 알리는 봄의 전령사!',
    description: '지구가 봄 위치에 있을 때 머리와 심장별 레굴루스가 으르렁거리며 봄밤 하늘의 중앙을 장식해요.',
  },
};
