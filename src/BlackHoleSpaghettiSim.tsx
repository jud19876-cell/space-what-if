import { useEffect, useRef, useState } from 'react';
import {
  createBlackHoleAstronautScene,
  type BlackHoleAstronautScene,
  type CameraView,
  type SpaghettiState,
} from './blackholeAstronautScene.ts';

interface BlackHoleSpaghettiSimProps {
  onBackToSolar: () => void;
}

export default function BlackHoleSpaghettiSim({ onBackToSolar }: BlackHoleSpaghettiSimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BlackHoleAstronautScene | null>(null);

  const [state, setState] = useState<SpaghettiState>({
    distance: 80,
    stretch: 1.0,
    timeDilation: 1.0,
    redshiftColor: '#ffffff',
    stage: 1,
    stageTitle: '안전 구역 (10,000 km)',
    stageDesc: '우주비행사가 둥둥 떠 있어요! 아직은 중력이 약해서 몸도 정상이고 시간도 똑같이 흘러요. 😊',
    astronautClock: 0,
    earthClock: 0,
    isWarpping: false,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [cameraView, setCameraView] = useState<CameraView>('overview');
  const [noodleMode, setNoodleMode] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = createBlackHoleAstronautScene(containerRef.current, (s) => {
      setState({ ...s });
    });
    sceneRef.current = sc;

    return () => {
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  const handlePlayToggle = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    sceneRef.current?.setPlaying(next);
  };

  const handleReset = () => {
    setIsPlaying(false);
    sceneRef.current?.reset();
  };

  const handleDistanceChange = (dist: number) => {
    setIsPlaying(false);
    sceneRef.current?.setPlaying(false);
    sceneRef.current?.setDistance(dist);
  };

  const handleJumpStage = (targetDist: number) => {
    setIsPlaying(false);
    sceneRef.current?.setPlaying(false);
    sceneRef.current?.setDistance(targetDist);
  };

  const handleCameraChange = (view: CameraView) => {
    setCameraView(view);
    sceneRef.current?.setCameraView(view);
  };

  const handleSpeedChange = (spd: number) => {
    setSpeed(spd);
    sceneRef.current?.setSpeed(spd);
  };

  const handleNoodleToggle = () => {
    const next = !noodleMode;
    setNoodleMode(next);
    sceneRef.current?.setNoodleMode(next);
  };

  const formatClock = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="spaghetti-sim-root">
      {/* 3D 캔버스 영역 */}
      <div ref={containerRef} className="spaghetti-canvas-container" />

      {/* 상단 네비게이션 헤더 */}
      <header className="spaghetti-header">
        <button className="btn btn-back-solar" onClick={onBackToSolar}>
          <span>🌌</span>
          <strong>태양계 우주로 돌아가기</strong>
        </button>

        <div className="spaghetti-title-badge">
          <span className="badge-emoji">🧑‍🚀🕳️</span>
          <div className="badge-text">
            <h1>우주비행사 블랙홀 낙하 실험</h1>
            <span className="badge-sub">사건의 지평선 & 스파게티화(조석력) 시뮬레이션</span>
          </div>
        </div>

        <button
          className={`btn btn-noodle-toggle ${noodleMode ? 'active' : ''}`}
          onClick={handleNoodleToggle}
          title="진짜 스파게티 국수와 미트볼로 변신!"
        >
          <span>🍝</span>
          <span>{noodleMode ? '우주복으로 보기' : '진짜 국수 면발 모드!'}</span>
        </button>
      </header>

      {/* 좌측: 상대성 이론 & 시간의 지평선 듀얼 시계 패널 */}
      <aside className="spaghetti-hud-clocks">
        <div className="clock-card earth">
          <div className="clock-label">
            <span className="clock-icon">🌍</span>
            <span>지구 본부 시계</span>
          </div>
          <div className="clock-time">{formatClock(state.earthClock)}</div>
          <div className="clock-meta">시간 속도: <strong>1.00x</strong> (정상 속도)</div>
        </div>

        <div className="clock-card astronaut">
          <div className="clock-label">
            <span className="clock-icon">⌚</span>
            <span>우주비행사 손목시계</span>
          </div>
          <div className={`clock-time ${state.timeDilation < 0.2 ? 'frozen' : ''}`}>
            {formatClock(state.astronautClock)}
          </div>
          <div className="clock-meta">
            시간 속도: <strong>{state.timeDilation.toFixed(2)}x</strong>
            {state.timeDilation <= 0.05 ? ' (완전히 멈춤!)' : state.timeDilation < 0.5 ? ' (극도로 느려짐)' : ''}
          </div>
        </div>

        {/* 스파게티 늘어남 게이지 */}
        <div className="stretch-meter-card">
          <div className="meter-label">
            <span>🍝 몸의 늘어남 (스파게티 지수)</span>
            <strong className="stretch-val">{state.stretch.toFixed(1)}x</strong>
          </div>
          <div className="meter-track">
            <div
              className="meter-fill"
              style={{
                width: `${Math.min(100, (state.stretch / 26) * 100)}%`,
                backgroundColor: state.redshiftColor,
              }}
            />
          </div>
          <p className="meter-comment">
            {state.stretch > 18
              ? '😱 으아악! 극도의 국수가락이 되었어요!'
              : state.stretch > 8
              ? '🍝 쫄깃한 스파게티 면처럼 쭈우욱 늘어났어요!'
              : state.stretch > 2.5
              ? '🧀 치즈처럼 발끝부터 길어지기 시작해요!'
              : '😊 아직은 몸이 보통 크기예요.'}
          </p>
        </div>

        {/* 중력 적색편이 컬러 칩 */}
        <div className="redshift-chip">
          <span className="redshift-dot" style={{ backgroundColor: state.redshiftColor }} />
          <span>중력 적색편이: {state.distance <= 10 ? '암흑' : state.distance <= 25 ? '핏빛 붉은색' : state.distance <= 45 ? '주황색' : '밝은 흰색'}</span>
        </div>
      </aside>

      {/* 중앙 상단: 현재 단계 배너 & 어린이 눈높이 쉬운 설명 카드 */}
      <div className={`spaghetti-stage-banner stage-${state.stage}`}>
        <div className="stage-badge-tag">
          {state.stage === 1 && '🟢 1단계: 안전 구역'}
          {state.stage === 2 && '🟡 2단계: 중력의 손길'}
          {state.stage === 3 && '🟠 3단계: 스파게티 현상 (조석력)'}
          {state.stage === 4 && '🔴 4단계: 시간의 지평선 (시간 정지)'}
          {state.stage === 5 && '🟣 5단계: 사건의 지평선 돌파 & 워프!'}
        </div>
        <h2 className="stage-title">{state.stageTitle}</h2>
        <p className="stage-desc">{state.stageDesc}</p>
      </div>

      {/* 하단 통합 컨트롤러 패널 */}
      <footer className="spaghetti-controls-panel">
        {/* 5단계 원클릭 빠른 이동 버튼들 */}
        <div className="stage-steps-bar">
          <span className="steps-title">단계별 바로가기:</span>
          <button
            className={`btn step-btn ${state.stage === 1 ? 'active' : ''}`}
            onClick={() => handleJumpStage(95)}
          >
            1. 🟢 보통 우주인
          </button>
          <button
            className={`btn step-btn ${state.stage === 2 ? 'active' : ''}`}
            onClick={() => handleJumpStage(58)}
          >
            2. 🟡 중력 시작
          </button>
          <button
            className={`btn step-btn highlight ${state.stage === 3 ? 'active' : ''}`}
            onClick={() => handleJumpStage(28)}
          >
            3. 🍝 스파게티화!
          </button>
          <button
            className={`btn step-btn ${state.stage === 4 ? 'active' : ''}`}
            onClick={() => handleJumpStage(8)}
          >
            4. ⏰ 시간 정지
          </button>
          <button
            className={`btn step-btn warp ${state.stage === 5 ? 'active' : ''}`}
            onClick={() => handleJumpStage(0)}
          >
            5. 🕳️ 차원 워프!
          </button>
        </div>

        {/* 거리 슬라이더 & 재생 컨트롤 */}
        <div className="controls-main-row">
          <div className="play-group">
            <button
              className={`btn btn-play-pause ${isPlaying ? 'playing' : ''}`}
              onClick={handlePlayToggle}
              aria-label={isPlaying ? '일시정지' : '낙하 시작'}
            >
              {isPlaying ? '⏸️ 일시정지' : '▶️ 블랙홀로 낙하!'}
            </button>
            <button className="btn btn-reset-sim" onClick={handleReset} title="처음 위치로">
              🔄 처음 위치
            </button>
          </div>

          <div className="slider-group">
            <div className="slider-labels">
              <span>🕳️ 사건의 지평선 (0km)</span>
              <strong>거리: {Math.round((state.distance / 100) * 10000).toLocaleString()} km</strong>
              <span>안전 구역 (10,000km) 🚀</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={state.distance}
              onChange={(e) => handleDistanceChange(parseFloat(e.target.value))}
              className="spaghetti-distance-slider"
            />
          </div>

          {/* 속도 & 카메라 조절 */}
          <div className="view-and-speed-group">
            <div className="cam-view-chips">
              <button
                className={`cam-chip ${cameraView === 'overview' ? 'active' : ''}`}
                onClick={() => handleCameraChange('overview')}
                title="전체 조망 시점"
              >
                🔭 전체 보기
              </button>
              <button
                className={`cam-chip ${cameraView === 'astronaut' ? 'active' : ''}`}
                onClick={() => handleCameraChange('astronaut')}
                title="우주비행사 밀착 시점"
              >
                🧑‍🚀 우주인 시점
              </button>
              <button
                className={`cam-chip ${cameraView === 'blackhole' ? 'active' : ''}`}
                onClick={() => handleCameraChange('blackhole')}
                title="블랙홀 중심 시점"
              >
                🕳️ 블랙홀 시점
              </button>
            </div>

            <div className="speed-chips">
              {[0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  className={`speed-chip ${speed === s ? 'active' : ''}`}
                  onClick={() => handleSpeedChange(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
