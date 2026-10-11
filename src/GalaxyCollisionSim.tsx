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
    id: 'grazing',
    emoji: '🌀',
    name: '조석 꼬리 스침 충돌',
    desc: '두 은하가 스쳐 지나가며 우주 공간으로 거대한 조석 꼬리와 은하 다리를 뿜어냅니다 (더듬이/생쥐 은하)',
  },
  {
    id: 'head_on',
    emoji: '💥',
    name: '정면 관통 대충돌',
    desc: '두 은하가 정면으로 돌진 관통하여 초신성 충격파와 거대한 고리 은하를 형성합니다',
  },
  {
    id: 'supermassive',
    emoji: '🕳️',
    name: '괴물 블랙홀 은하 쌍포식',
    desc: '태양 12,500배 괴물 블랙홀 [가르간튀아]가 양쪽 은하의 수천 개 별과 가스 구름을 동시에 집어삼킵니다',
  },
  {
    id: 'binary_dance',
    emoji: '💫',
    name: '안정적 쌍은하 군무',
    desc: '두 은하가 충돌하지 않고 안정적인 케플러 궤도로 서로를 공전하며 장엄한 나선 춤을 춥니다',
  },
  {
    id: 'cannibalism',
    emoji: '🪐',
    name: '왜소은하 포식 합병',
    desc: '거대한 우리은하가 접근하는 소형 왜소은하를 조석력으로 갈기갈기 찢어 흡수합병합니다',
  },
];

export default function GalaxyCollisionSim({
  onBackToSolar,
  initialScenario = 'grazing',
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

  // 실시간 모니터링 수치
  const [metrics, setMetrics] = useState({
    timeMyr: 0,
    distanceKpc: 240,
    tidalDistortion: 0.1,
    swallowedCount: 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = createGalaxyScene(containerRef.current, initialScenario, (s: GalaxySimState) => {
      setMetrics({
        timeMyr: s.timeMyr,
        distanceKpc: s.distanceKpc,
        tidalDistortion: s.tidalDistortion,
        swallowedCount: s.swallowedCount,
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
              은하 대충돌 & 심우주 모드
            </h1>
            <span className="galaxy-sub-badge">Galaxy N-Body Physics</span>
          </div>
        </div>

        {/* 5대 은하 충돌 시나리오 선택 탭 바 */}
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

      {/* 중앙 상단: 카메라 시점 모드 바 */}
      <div className="galaxy-viewmode-bar">
        <div className="view-mode-pill">
          <button
            className={`btn-view-toggle ${cameraView === 'overview' ? 'active' : ''}`}
            onClick={() => handleViewChange('overview')}
            title="우주 전체에서 두 은하의 상호작용 조망"
          >
            <span>🔭 전체 조망</span>
          </button>
          <button
            className={`btn-view-toggle highlight ${cameraView === 'collision' ? 'active' : ''}`}
            onClick={() => handleViewChange('collision')}
            title="두 은하가 충돌하는 중앙 격돌면 클로즈업"
          >
            <span>💥 충돌면 락온</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'milkyway' ? 'active' : ''}`}
            onClick={() => handleViewChange('milkyway')}
            title="우리은하 중심핵 시점 추적"
          >
            <span>🌌 우리은하 중심</span>
          </button>
          <button
            className={`btn-view-toggle ${cameraView === 'andros' ? 'active' : ''}`}
            onClick={() => handleViewChange('andros')}
            title="안드로스 은하 중심핵 시점 추적"
          >
            <span>💜 안드로스 중심</span>
          </button>
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
          <span className="hud-title">실시간 은하 물리 지표</span>
        </div>

        <div className="hud-metrics-list">
          <div className="hud-metric-row">
            <span className="metric-label">⏳ 경과 시간</span>
            <strong className="metric-val">{metrics.timeMyr.toFixed(1)} 백만 년 (Myr)</strong>
          </div>
          <div className="hud-metric-row">
            <span className="metric-label">📏 은하 중심 간 거리</span>
            <strong className="metric-val highlight-cyan">{Math.round(metrics.distanceKpc)} kpc</strong>
            <small className="metric-sub">약 {Math.round(metrics.distanceKpc * 3260).toLocaleString()} 광년</small>
          </div>
          <div className="hud-metric-row">
            <span className="metric-label">🌊 조석 섭동 변형률</span>
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
            <span className="metric-label">✨ 시뮬레이션 입자</span>
            <strong className="metric-val">3,300개</strong>
            <small className="metric-sub">별 2,800 + 성운 가스 구름 500</small>
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
          <span>💡 은하 충돌의 신비 {isGuideOpen ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {isGuideOpen && (
          <div className="guide-content">
            <p>
              <strong>Q. 은하가 충돌하면 별끼리 부딪칠까요?</strong>
              <br />
              놀랍게도 별과 별 사이의 거리가 수 광년에 달할 만큼 너무나도 멀기 때문에,
              수천억 개의 별 중 실제로 직접 부딪치는 별은 거의 없습니다!
            </p>
            <p>
              <strong>Q. 그럼 어떤 일이 일어나나요?</strong>
              <br />
              서로의 거대한 중력에 의해 별들의 궤도가 뒤틀려 수만 광년 길이의 장엄한
              <strong> 조석 꼬리(Tidal Tails)</strong>와 <strong>은하 다리</strong>가 우주 공간으로 뿜어져 나옵니다.
              또한 성운 가스 구름이 강하게 압축되어 수많은 아기 별들이 폭발적으로 탄생합니다.
            </p>
          </div>
        )}
      </div>

      {/* 하단 제어 컨트롤러 */}
      <footer className="galaxy-control-bar">
        <div className="control-group-playback">
          <button className={`btn-ctrl-playback ${isPlaying ? 'pause' : 'play'}`} onClick={handleTogglePlay}>
            <span>{isPlaying ? '⏸️ 일시정지' : '▶️ 시뮬레이션 재생'}</span>
          </button>
          <button className="btn-ctrl-playback reset" onClick={handleReset} title="시뮬레이션 초기 상태로 리셋">
            <span>🔄 처음으로 리셋</span>
          </button>
        </div>

        {/* 배속 프리셋 */}
        <div className="control-group-speed">
          <span className="ctrl-label">⚡ 시뮬레이션 배속:</span>
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
          <span className="ctrl-label">📏 은하 간격 조절:</span>
          <input
            type="range"
            min="60"
            max="450"
            step="10"
            value={customDistance}
            onChange={(e) => handleDistanceSlider(Number(e.target.value))}
            className="galaxy-distance-slider"
            title="두 은하 중심핵 간의 거리를 실시간으로 조절합니다"
          />
          <span className="slider-val-badge">{customDistance} kpc</span>
        </div>
      </footer>
    </div>
  );
}
