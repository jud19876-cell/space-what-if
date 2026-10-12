import { useEffect, useRef, useState } from 'react';
import {
  createGalaxyScene,
  type GalaxyCameraView,
  type GalaxyScene,
} from './galaxyCollisionScene.ts';
import {
  type GalaxyScenarioType,
  type GalaxySimState,
} from './galaxyCollisionPhysics.ts';
import CosmicScaleViewer from './CosmicScaleViewer.tsx';

interface GalaxyCollisionSimProps {
  onBackToSolar: () => void;
  initialScenario?: GalaxyScenarioType;
}

const SCENARIOS: {
  id: GalaxyScenarioType;
  emoji: string;
  name: string;
  desc: string;
}[] = [
  {
    id: 'local_group',
    emoji: '🌌',
    name: '우리은하 & 국부은하군 (기본 뷰)',
    desc: '기본 뷰 모드로 은하 간 상호 중력이 작용하지 않아 태양계와 주변 은하들의 온전한 모습을 평화롭게 관찰합니다. (하단 조건을 누르면 상호 중력 및 충돌 시뮬레이션 개시)',
  },
  {
    id: 'sombrero',
    emoji: '🎩',
    name: '솜브레로 은하 (M104 먼지원반)',
    desc: '거대한 구형 팽대부와 은하 원반 전체를 둘러싼 짙은 암흑 성간 먼지 고리(Dark Dust Lane) 및 수천 개 구상성단 모델',
  },
  {
    id: 'whirlpool',
    emoji: '🌀',
    name: '소용돌이 은하 (Whirlpool M51 & NGC 5195)',
    desc: '우아한 대칭 나선팔 끝이 동반은하 NGC 5195와 아름다운 조석 별빛 다리(Tidal Stellar Bridge)로 연결된 명품 은하 모델',
  },
  {
    id: 'quasar',
    emoji: '⚡',
    name: '초거대 퀘이사 [3C 273 제트 광선]',
    desc: '활동은하핵 중심 초대질량 블랙홀에서 빛의 99% 속도로 분출되는 3D 상대론적 플라즈마 제트 빔 광선 모델',
  },
  {
    id: 'cartwheel',
    emoji: '🎡',
    name: '수레바퀴 고리 은하 (Cartwheel)',
    desc: '소은하가 중심을 수직 관통하여 초속 200km로 팽창 중인 거대한 푸른 별 폭발 고리와 8개의 방사형 스포크 바큇살 모델',
  },
  {
    id: 'head_on',
    emoji: '💥',
    name: '두 은하 정면 대충돌',
    desc: '우리은하와 안드로메다가 정면 관통 충돌하여 초신성 충격파와 거대한 고리 은하를 형성합니다',
  },
  {
    id: 'grazing',
    emoji: '🌀',
    name: '조석 꼬리 스침 충돌',
    desc: '두 은하가 스쳐 지나가며 우주 공간으로 수만 광년 길이의 조석 꼬리와 은하 다리를 뿜어냅니다 (더듬이/생쥐 은하)',
  },
  {
    id: 'supermassive',
    emoji: '🕳️',
    name: '괴물 블랙홀 은하 쌍포식',
    desc: '태양 14,000배 괴물 블랙홀 [가르간튀아]가 양쪽 은하의 별과 가스 구름을 거대한 소용돌이로 집어삼킵니다',
  },
  {
    id: 'cannibalism',
    emoji: '🪐',
    name: '위성은하(마젤란) 조석 흡수',
    desc: '거대한 우리은하가 위성은하인 대마젤란·소마젤란 은하를 조석력으로 갈기갈기 찢어 은하 헤일로로 흡수합병합니다',
  },
  {
    id: 'binary_dance',
    emoji: '💫',
    name: '안정적 쌍은하 군무',
    desc: '두 은하가 충돌하지 않고 안정적인 케플러 궤도로 서로를 공전하며 장엄한 나선 춤을 춥니다',
  },
];

export default function GalaxyCollisionSim({
  onBackToSolar,
  initialScenario = 'local_group',
}: GalaxyCollisionSimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GalaxyScene | null>(null);

  const [activeScenario, setActiveScenario] = useState<GalaxyScenarioType>(initialScenario);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(10);
  const [cameraView, setCameraView] = useState<GalaxyCameraView>('overview');
  const [showCosmicWeb, setShowCosmicWeb] = useState(true);
  const [showGasClouds, setShowGasClouds] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [customDistance, setCustomDistance] = useState(240);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(true);
  const [subMode, setSubMode] = useState<'galaxy' | 'cosmic_scale'>('galaxy');

  const [metrics, setMetrics] = useState({
    timeMyr: 0,
    distanceKpc: 240,
    tidalDistortion: 0.05,
    swallowedCount: 0,
    solarPos: [8.5, 0, 0] as [number, number, number],
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = createGalaxyScene(containerRef.current, initialScenario, (s: GalaxySimState) => {
      setMetrics({
        timeMyr: s.timeMyr,
        distanceKpc: s.distanceKpc,
        tidalDistortion: s.tidalDistortion,
        swallowedCount: s.swallowedCount,
        solarPos: s.solarSystemPos,
      });
    });
    sceneRef.current = sc;

    return () => {
      sc.dispose();
      sceneRef.current = null;
    };
  }, [initialScenario]);

  const handleSelectScenario = (scId: GalaxyScenarioType) => {
    setActiveScenario(scId);
    sceneRef.current?.setScenario(scId);
    sceneRef.current?.setViewMode('overview');
    setCameraView('overview');
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    sceneRef.current?.setPlaying(next);
  };

  const handleReset = () => {
    sceneRef.current?.reset();
    setIsPlaying(true);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    sceneRef.current?.setSpeed(newSpeed);
  };

  const handleViewChange = (v: GalaxyCameraView) => {
    setCameraView(v);
    sceneRef.current?.setViewMode(v);
  };

  const handleToggleCosmicWeb = () => {
    const next = !showCosmicWeb;
    setShowCosmicWeb(next);
    sceneRef.current?.setShowCosmicWeb(next);
  };

  const handleToggleGas = () => {
    const next = !showGasClouds;
    setShowGasClouds(next);
    sceneRef.current?.setShowGasClouds(next);
  };

  const handleToggleTrails = () => {
    const next = !showTrails;
    setShowTrails(next);
    sceneRef.current?.setShowTrails(next);
  };

  const handleDistanceSlider = (val: number) => {
    setCustomDistance(val);
    sceneRef.current?.setGalaxyDistance(val);
  };

  const currentScInfo = SCENARIOS.find((s) => s.id === activeScenario);

  if (subMode === 'cosmic_scale') {
    return <CosmicScaleViewer onBackToGalaxyLab={() => setSubMode('galaxy')} />;
  }

  return (
    <div className="galaxy-sim-root">
      {/* 3D 캔버스 영역 */}
      <div ref={containerRef} className="galaxy-canvas-container" />

      {/* 상단 메인 헤더 */}
      <header className="galaxy-header">
        <div className="galaxy-header-left">
          <button className="btn btn-back-solar" onClick={onBackToSolar} title="태양계 기본 시뮬레이터로 복귀">
            <span>☀️</span>
            <strong>태양계로 돌아가기</strong>
          </button>
          <div className="galaxy-title-group">
            <h1 className="galaxy-main-title">
              <span className="galaxy-title-icon">🌌</span>
              우리은하 & 국부은하군 심우주 모드
            </h1>
            <span className="galaxy-sub-badge">Local Group & Collision Lab</span>
          </div>
        </div>

        {/* 은하 연구소 vs 우주 크기 비교 메인 모드 전환 탭 */}
        <div className="galaxy-main-mode-toggle">
          <button
            className="galaxy-mode-tab-btn active"
            onClick={() => setSubMode('galaxy')}
          >
            <span>🌌 은하 관측 & 충돌</span>
          </button>
          <button
            className="galaxy-mode-tab-btn highlight-scale"
            onClick={() => setSubMode('cosmic_scale')}
            title="지구 서울(10km)부터 지구, 태양계, 우리은하, 관측 가능한 전체 우주까지 10의 거듭제곱 크기 순 비교 시뮬레이션"
          >
            <span>📐 우주 크기 비교 (Powers of Ten)</span>
          </button>
        </div>

        {/* 6대 은하 시나리오 선택 탭 바 */}
        <div className="galaxy-scenarios-bar">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              className={`galaxy-scenario-btn ${activeScenario === sc.id ? 'active' : ''}`}
              onClick={() => handleSelectScenario(sc.id)}
              title={sc.desc}
            >
              <span className="sc-emoji">{sc.emoji}</span>
              <span className="sc-name">{sc.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* 중앙 상단: 카메라 시점 모드 바 (우리은하 내 태양계 및 주변 은하 바로가기) */}
      <div className="galaxy-viewmode-bar">
        <div className="view-mode-pill">
          <button
            className="btn-view-toggle highlight-scale-pill"
            onClick={() => setSubMode('cosmic_scale')}
            title="서울(10km) - 지구 - 태양계 - 우리은하 - 전체 우주 크기 순 비교 시뮬레이션 열기"
          >
            <span>📐 크기 순 우주 비교</span>
          </button>
          <button
            className={`btn-view-toggle highlight-universe ${cameraView === 'universe' ? 'active' : ''}`}
            onClick={() => handleViewChange('universe')}
            title="지름 930억 광년 관측 가능한 전체 우주 & 거대 우주망(Cosmic Web) 초원경 조망"
          >
            <span>🌐 전체 우주 (Cosmic Web)</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'overview' ? 'active' : ''}`}
            onClick={() => handleViewChange('overview')}
            title="국부은하군 우주 전체에서 모든 은하의 조화로운 배치 조망"
          >
            <span>🔭 국부은하군 조망</span>
          </button>
          <button
            className={`btn-view-toggle highlight-gold ${cameraView === 'solarsystem' ? 'active' : ''}`}
            onClick={() => handleViewChange('solarsystem')}
            title="우리은하 오리온자리 팔에 위치한 태양계 마커 클로즈업"
          >
            <span>☀️ 우리들의 태양계 (오리온 팔)</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'milkyway' ? 'active' : ''}`}
            onClick={() => handleViewChange('milkyway')}
            title="우리은하 중심핵(궁수자리 A*) 시점 추적"
          >
            <span>🌌 우리은하 중심핵</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'andromeda' ? 'active' : ''}`}
            onClick={() => handleViewChange('andromeda')}
            title="안드로메다 은하(M31) 시점 추적"
          >
            <span>💜 안드로메다(M31)</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'triangulum' ? 'active' : ''}`}
            onClick={() => handleViewChange('triangulum')}
            title="삼각형자리 은하(M33) 시점 추적"
          >
            <span>💎 삼각형자리(M33)</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'magellanic' ? 'active' : ''}`}
            onClick={() => handleViewChange('magellanic')}
            title="대/소 마젤란 위성은하 뷰"
          >
            <span>🪐 마젤란 위성은하</span>
          </button>
          {activeScenario === 'sombrero' && (
            <button
              className={`btn-view-toggle highlight-gold ${cameraView === 'sombrero' ? 'active' : ''}`}
              onClick={() => handleViewChange('sombrero')}
              title="솜브레로 은하(M104) 거대 팽대부와 암흑 먼지원반 클로즈업"
            >
              <span>🎩 솜브레로 먼지원반</span>
            </button>
          )}
          {activeScenario === 'whirlpool' && (
            <button
              className={`btn-view-toggle highlight ${cameraView === 'whirlpool' ? 'active' : ''}`}
              onClick={() => handleViewChange('whirlpool')}
              title="소용돌이 은하 M51과 동반은하 NGC 5195 조석 다리 락온"
            >
              <span>🌀 M51 조석 다리</span>
            </button>
          )}
          {activeScenario === 'quasar' && (
            <button
              className={`btn-view-toggle highlight-purple ${cameraView === 'quasar' ? 'active' : ''}`}
              onClick={() => handleViewChange('quasar')}
              title="초거대 퀘이사 3C 273 양극 상대론적 플라즈마 제트 광선 락온"
            >
              <span>⚡ 상대론적 제트 광선</span>
            </button>
          )}
          {activeScenario === 'cartwheel' && (
            <button
              className={`btn-view-toggle highlight ${cameraView === 'cartwheel' ? 'active' : ''}`}
              onClick={() => handleViewChange('cartwheel')}
              title="수레바퀴 고리 은하(Cartwheel) 충격파 팽창 링 클로즈업"
            >
              <span>🎡 수레바퀴 팽창 링</span>
            </button>
          )}
          {activeScenario !== 'local_group' &&
            activeScenario !== 'sombrero' &&
            activeScenario !== 'whirlpool' &&
            activeScenario !== 'quasar' &&
            activeScenario !== 'cartwheel' && (
            <button
              className={`btn-view-toggle highlight ${cameraView === 'collision' ? 'active' : ''}`}
              onClick={() => handleViewChange('collision')}
              title="두 은하가 충돌하는 중앙 격돌면 클로즈업"
            >
              <span>💥 충돌면 락온</span>
            </button>
          )}
          {activeScenario === 'supermassive' && (
            <button
              className={`btn-view-toggle highlight-purple ${cameraView === 'blackhole' ? 'active' : ''}`}
              onClick={() => handleViewChange('blackhole')}
              title="초대질량 괴물 블랙홀 가르간튀아 심연 관찰"
            >
              <span>🕳️ 가르간튀아 심연</span>
            </button>
          )}
        </div>

        {/* 보조 시각 토글 */}
        <div className="aux-toggles">
          <button
            className={`btn-aux-toggle ${showCosmicWeb ? 'active' : ''}`}
            onClick={handleToggleCosmicWeb}
            title="초은하단 필라멘트와 우주 거대망(Cosmic Web) 시각화 ON/OFF"
          >
            <span>🕸️</span>
            <span>우주 거대망 {showCosmicWeb ? 'ON' : 'OFF'}</span>
          </button>
          <button
            className={`btn-aux-toggle ${showGasClouds ? 'active' : ''}`}
            onClick={handleToggleGas}
            title="광원에 구름처럼 우주전체로 도는 에테르풍 성운 가스 구름"
          >
            <span>☁️</span>
            <span>성운 가스 {showGasClouds ? 'ON' : 'OFF'}</span>
          </button>
          <button
            className={`btn-aux-toggle ${showTrails ? 'active' : ''}`}
            onClick={handleToggleTrails}
            title="은하 중심핵의 궤적 라인"
          >
            <span>🌠</span>
            <span>은하 궤적 {showTrails ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 좌측 상단: 실시간 천체물리 모니터링 HUD (접기/펼치기 가능) */}
      {isHudOpen ? (
        <aside className="galaxy-hud-panel">
          <div className="hud-header">
            <span className="hud-icon">{cameraView === 'universe' ? '🌐' : '📊'}</span>
            <span className="hud-title">
              {cameraView === 'universe' ? '관측 가능한 우주 & 거대 우주망' : '국부은하군 천체물리 지표'}
            </span>
            <button
              className="btn-hud-close"
              onClick={() => setIsHudOpen(false)}
              title="지표 패널 접기 (은하 화면 넓게 보기)"
              aria-label="지표 패널 접기"
            >
              ✕
            </button>
          </div>

          <div className="hud-metrics-list">
            {cameraView === 'universe' ? (
              <>
                <div className="hud-metric-row">
                  <span className="metric-label">🌐 우주 공간 규모</span>
                  <strong className="metric-val highlight-universe">관측 가능한 우주 (Observable Universe)</strong>
                  <small className="metric-sub">지름 약 930억 광년 (28.5 Gpc) 거대 시공간</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">✨ 추정 은하 수</span>
                  <strong className="metric-val highlight-cyan">약 2조 개 (2,000,000,000,000)</strong>
                  <small className="metric-sub">우주 거대 필라멘트 및 초은하단에 밀집 분포</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">📍 우리들의 우주 주소</span>
                  <strong className="metric-val highlight-gold">라니아케아 초은하단 외곽</strong>
                  <small className="metric-sub">처녀자리 은하단 &gt; 국부은하군 &gt; 우리은하 &gt; 태양계</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">🕸️ 우주 거대구조 (Cosmic Web)</span>
                  <strong className="metric-val highlight-magenta">필라멘트 &amp; 거대 보이드(공동)</strong>
                  <small className="metric-sub">슬론 장성, 목동자리 보이드, 샤플리 초은하단</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">📡 우주 배경 복사 (CMB)</span>
                  <strong className="metric-val">빅뱅 후 38만 년 (2.725 K)</strong>
                  <small className="metric-sub">우주 지평선 외곽 구체에 형성된 태초의 빛</small>
                </div>
              </>
            ) : (
              <>
                <div className="hud-metric-row">
                  <span className="metric-label">☀️ 우리 태양계 위치</span>
                  <strong className="metric-val highlight-gold">우리은하 오리온 팔 (Orion Arm)</strong>
                  <small className="metric-sub">은하 중심(궁수자리 A*)에서 약 26,000 광년 (8.2 kpc)</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">⏳ 경과 시간</span>
                  <strong className="metric-val">{metrics.timeMyr.toFixed(1)} 백만 년 (Myr)</strong>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">📏 안드로메다 은하 거리</span>
                  <strong className="metric-val highlight-cyan">{Math.round(metrics.distanceKpc)} kpc</strong>
                  <small className="metric-sub">약 {Math.round(metrics.distanceKpc * 3260).toLocaleString()} 광년</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">🌊 은하 조석 섭동 변형률</span>
                  <strong className="metric-val highlight-magenta">{(metrics.tidalDistortion * 100).toFixed(1)}%</strong>
                  <div className="distortion-bar-bg">
                    <div
                      className="distortion-bar-fill"
                      style={{ width: `${Math.min(100, metrics.tidalDistortion * 100)}%` }}
                    />
                  </div>
                </div>
                {activeScenario === 'supermassive' && (
                  <div className="hud-metric-row">
                    <span className="metric-label">🍽️ 블랙홀 삼킨 별</span>
                    <strong className="metric-val highlight-red">{metrics.swallowedCount}개</strong>
                  </div>
                )}
                {activeScenario === 'sombrero' && (
                  <>
                    <div className="hud-metric-row">
                      <span className="metric-label">🎩 솜브레로 은하 지름</span>
                      <strong className="metric-val highlight-gold">약 50,000 광년 (15 kpc)</strong>
                      <small className="metric-sub">처녀자리 은하단 남쪽 렌즈형/나선 은하 모델</small>
                    </div>
                    <div className="hud-metric-row">
                      <span className="metric-label">🌑 암흑 성간 먼지 고리 (Dust Lane)</span>
                      <strong className="metric-val highlight-magenta">두께 3,000 광년 고밀도 흡수대</strong>
                      <small className="metric-sub">수소 분자 가스와 차가운 우주 먼지가 둘러싼 링</small>
                    </div>
                    <div className="hud-metric-row">
                      <span className="metric-label">✨ 구상성단 보유량</span>
                      <strong className="metric-val highlight-cyan">약 2,000개 (우리은하의 10배 이상)</strong>
                      <small className="metric-sub">은하 헤일로 전역에 구상성단이 빽빽하게 공전</small>
                    </div>
                  </>
                )}
                {activeScenario === 'whirlpool' && (
                  <>
                    <div className="hud-metric-row">
                      <span className="metric-label">🌀 주 은하 M51a (소용돌이)</span>
                      <strong className="metric-val highlight-cyan">직경 약 76,000 광년 (SA 나선은하)</strong>
                      <small className="metric-sub">선명하고 웅장한 2대 나선팔과 핑크색 H II 성운</small>
                    </div>
                    <div className="hud-metric-row">
                      <span className="metric-label">🌉 조석 별빛 다리 (Tidal Bridge)</span>
                      <strong className="metric-val highlight-gold">NGC 5195와 연결된 성간 통로</strong>
                      <small className="metric-sub">동반은하를 휘감으며 별과 가스가 빨려 들어가는 장관</small>
                    </div>
                  </>
                )}
                {activeScenario === 'quasar' && (
                  <>
                    <div className="hud-metric-row">
                      <span className="metric-label">⚡ 퀘이사 3C 273 광도</span>
                      <strong className="metric-val highlight-red">태양의 4조 배 (우리은하 100배)</strong>
                      <small className="metric-sub">지구에서 24억 광년 떨어진 인류 최초 발견 퀘이사</small>
                    </div>
                    <div className="hud-metric-row">
                      <span className="metric-label">🚀 양극 상대론적 제트 (Jets)</span>
                      <strong className="metric-val highlight-cyan">광속의 99.8% 초고속 분출</strong>
                      <small className="metric-sub">수십만 광년 길이로 뿜어져 나가는 플라즈마 빔</small>
                    </div>
                  </>
                )}
                {activeScenario === 'cartwheel' && (
                  <>
                    <div className="hud-metric-row">
                      <span className="metric-label">🎡 수레바퀴 고리 직경</span>
                      <strong className="metric-val highlight-cyan">약 150,000 광년 (우리은하 1.5배)</strong>
                      <small className="metric-sub">소은하의 수직 관통 충돌 후 1억 년 뒤 형성된 고리</small>
                    </div>
                    <div className="hud-metric-row">
                      <span className="metric-label">💥 충격파 팽창 속도</span>
                      <strong className="metric-val highlight-magenta">초속 217 km/s (고속 팽창 스타버스트)</strong>
                      <small className="metric-sub">거대한 충격파가 O-B형 푸른 별 폭발을 촉발</small>
                    </div>
                  </>
                )}
                <div className="hud-metric-row">
                  <span className="metric-label">✨ 관측 중인 은하 모델</span>
                  <strong className="metric-val">{currentScInfo?.name ?? '은하 모델'}</strong>
                  <small className="metric-sub">{currentScInfo?.desc}</small>
                </div>
                <div className="hud-metric-row">
                  <span className="metric-label">⚛️ 은하 간 상호 중력</span>
                  {activeScenario === 'local_group' ? (
                    <>
                      <strong className="metric-val highlight-cyan">OFF (기본 뷰 모드)</strong>
                      <small className="metric-sub">모든 은하가 원형 유지 / 조건 버튼 클릭 시 상호 중력 개시</small>
                    </>
                  ) : (
                    <>
                      <strong className="metric-val highlight-magenta">ON (시뮬레이션 발동)</strong>
                      <small className="metric-sub">은하 간 N-Body 상호 인력 및 조석 섭동 활성화</small>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 시나리오 설명 */}
          {currentScInfo && (
            <div className="hud-scenario-desc">
              <strong>{currentScInfo.emoji} {currentScInfo.name}</strong>
              <p>{currentScInfo.desc}</p>
            </div>
          )}
        </aside>
      ) : (
        <button
          className="btn-hud-open-pill"
          onClick={() => setIsHudOpen(true)}
          title="천체물리 실시간 지표 패널 펼치기"
        >
          <span>📊</span>
          <span>지표 보기</span>
        </button>
      )}

      {/* 우측 상단: 천문학 가이드 토글 패널 */}
      <div className="galaxy-guide-box">
        <button className="btn-guide-toggle" onClick={() => setIsGuideOpen(!isGuideOpen)}>
          <span>💡 우주와 국부은하군의 비밀 {isGuideOpen ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {isGuideOpen && (
          <div className="guide-content">
            <p>
              <strong>🌐 관측 가능한 전체 우주와 거대 우주망(Cosmic Web):</strong>
              <br />
              우주를 수억~수십억 광년 단위로 멀리서 조망하면, 은하들은 거미줄처럼 이어진 <strong>우주 필라멘트(Cosmic Filaments)</strong>를 따라 늘어서 있고, 그 사이에는 은하가 거의 없는 수억 광년 크기의 <strong>우주 보이드(거대 공동)</strong>가 존재합니다.
            </p>
            <p>
              <strong>📍 우리의 우주 속 주소 (Cosmic Address):</strong>
              <br />
              태양계 ➡️ 오리온자리 나선팔 ➡️ 우리은하 ➡️ 국부은하군 ➡️ 처녀자리 초은하단 ➡️ <strong>라니아케아 초은하단(Laniakea Supercluster)</strong> ➡️ 관측 가능한 우주
            </p>
            <p>
              <strong>☀️ 태양계는 은하 어디에 있나요?</strong>
              <br />
              태양계는 우리은하 중심의 거대 블랙홀(궁수자리 A*)에서 약 2만 6천 광년 떨어진
              <strong>오리온자리 나선팔(Orion Arm)</strong>에 위치하며, 초속 220km로 은하를 공전합니다.
            </p>
            <p>
              <strong>🌌 국부은하군(Local Group)이란?</strong>
              <br />
              우리은하와 가장 가까운 거대 은하인 <strong>안드로메다 은하(M31)</strong>, 세 번째로 큰
              <strong>삼각형자리 은하(M33)</strong>, 그리고 우리은하 주위를 도는 위성은하인
              <strong>대마젤란은하(LMC)</strong>와 <strong>소마젤란은하(SMC)</strong> 등 50여 개 은하들이 중력으로 묶인 은하 군집입니다.
            </p>
          </div>
        )}
      </div>

      {/* 하단 제어 컨트롤러: 시뮬레이션 조건 버튼 & 배속/간격 슬라이더 */}
      <footer className="galaxy-control-bar">
        <div className="control-group-playback">
          <button className={`btn-ctrl-playback ${isPlaying ? 'pause' : 'play'}`} onClick={handleTogglePlay}>
            <span>{isPlaying ? '⏸️ 일시정지' : '▶️ 시뮬레이션 재생'}</span>
          </button>
          <button className="btn-ctrl-playback reset" onClick={handleReset} title="시뮬레이션 초기 상태로 리셋">
            <span>🔄 처음으로 리셋</span>
          </button>
        </div>

        {/* 빠른 충돌/포식 실험 조건 트리거 칩 버튼들 */}
        <div className="control-group-triggers">
          <span className="ctrl-label">⚡ 충돌 조건 발동:</span>
          <button
            className={`chip-trigger ${activeScenario === 'head_on' ? 'active' : ''}`}
            onClick={() => handleSelectScenario('head_on')}
            title="우리은하와 안드로메다 정면 관통 충돌 개시"
          >
            💥 정면 대충돌!
          </button>
          <button
            className={`chip-trigger ${activeScenario === 'grazing' ? 'active' : ''}`}
            onClick={() => handleSelectScenario('grazing')}
            title="두 은하가 스쳐 지나가며 조석 꼬리 분출"
          >
            🌀 조석 꼬리 스침!
          </button>
          <button
            className={`chip-trigger ${activeScenario === 'supermassive' ? 'active' : ''}`}
            onClick={() => handleSelectScenario('supermassive')}
            title="초대질량 블랙홀 소환 및 은하 쌍포식"
          >
            🕳️ 괴물 블랙홀 포식!
          </button>
          <button
            className={`chip-trigger ${activeScenario === 'cannibalism' ? 'active' : ''}`}
            onClick={() => handleSelectScenario('cannibalism')}
            title="마젤란 위성은하 중력 흡수 합병"
          >
            🪐 위성은하 흡수!
          </button>
          <button
            className={`chip-trigger ${activeScenario === 'local_group' ? 'active' : ''}`}
            onClick={() => handleSelectScenario('local_group')}
            title="국부은하군 기본 평형 복원"
          >
            🔄 국부은하군 기본
          </button>
        </div>

        {/* 배속 프리셋 */}
        <div className="control-group-speed">
          <span className="ctrl-label">배속:</span>
          {[1, 5, 10, 25, 50].map((s) => (
            <button
              key={s}
              className={`chip-speed ${speed === s ? 'active' : ''}`}
              onClick={() => handleSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* 실시간 은하 간격 슬라이더 */}
        <div className="control-group-slider">
          <span className="ctrl-label">📏 은하 간격:</span>
          <input
            type="range"
            min="60"
            max="450"
            step="10"
            value={customDistance}
            onChange={(e) => handleDistanceSlider(Number(e.target.value))}
            className="galaxy-distance-slider"
            title="은하 간의 거리를 실시간으로 조절합니다"
          />
          <span className="slider-val-badge">{customDistance} kpc</span>
        </div>
      </footer>
    </div>
  );
}
