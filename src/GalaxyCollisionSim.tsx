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
    name: '우리은하 & 국부은하군 (기본)',
    desc: '태양계가 위치한 우리은하를 중심으로 안드로메다(M31), 삼각형자리(M33), 대/소 마젤란 은하 등 실제 인접 은하 군집을 평화롭게 탐험합니다',
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
  const [showGasClouds, setShowGasClouds] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [customDistance, setCustomDistance] = useState(240);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
            className={`btn-view-toggle ${cameraView === 'overview' ? 'active' : ''}`}
            onClick={() => handleViewChange('overview')}
            title="국부은하군 우주 전체에서 모든 은하의 조화로운 배치 조망"
          >
            <span>🔭 전체 은하군 조망</span>
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
          {activeScenario !== 'local_group' && (
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

      {/* 좌측 상단: 실시간 천체물리 모니터링 HUD */}
      <aside className="galaxy-hud-panel">
        <div className="hud-header">
          <span className="hud-icon">📊</span>
          <span className="hud-title">국부은하군 천체물리 지표</span>
        </div>

        <div className="hud-metrics-list">
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
          <div className="hud-metric-row">
            <span className="metric-label">✨ 관측 중인 은하 군집</span>
            <strong className="metric-val">5대 은하 (4,450개 천체)</strong>
            <small className="metric-sub">우리은하, 안드로메다, 삼각형자리, 대/소 마젤란</small>
          </div>
        </div>

        {/* 시나리오 설명 */}
        {currentScInfo && (
          <div className="hud-scenario-desc">
            <strong>{currentScInfo.emoji} {currentScInfo.name}</strong>
            <p>{currentScInfo.desc}</p>
          </div>
        )}
      </aside>

      {/* 우측 상단: 천문학 가이드 토글 패널 */}
      <div className="galaxy-guide-box">
        <button className="btn-guide-toggle" onClick={() => setIsGuideOpen(!isGuideOpen)}>
          <span>💡 우리은하와 국부은하군의 비밀 {isGuideOpen ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {isGuideOpen && (
          <div className="guide-content">
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
            <p>
              <strong>💥 약 45억 년 뒤 일어날 일:</strong>
              <br />
              우리은하와 안드로메다 은하는 현재 초속 110km로 서로를 향해 접근 중이며,
              먼 미래에 충돌하여 하나의 거대한 <strong>밀코메다(Milkomeda) 타원 은하</strong>로 합병될 예정입니다!
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
