import { useEffect, useRef, useState } from 'react';
import {
  createConstellation3DScene,
  type ConstellationScene,
  type ConstellationViewMode,
} from './constellation3DScene.ts';
import {
  CONSTELLATIONS,
  SEASON_GUIDES,
  type ConstellationData,
  type SeasonKey,
  type StarData,
} from './constellationsData.ts';

interface ConstellationSimProps {
  onBackToSolar: () => void;
}

export default function ConstellationSim({ onBackToSolar }: ConstellationSimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ConstellationScene | null>(null);

  const [activeConstellation, setActiveConstellation] = useState<ConstellationData>(CONSTELLATIONS[0]); // 기본 전갈자리
  const [viewMode, setViewMode] = useState<ConstellationViewMode>('earth');
  const [showArt, setShowArt] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [selectedStar, setSelectedStar] = useState<StarData | null>(null);
  const [isStoryExpanded, setIsStoryExpanded] = useState(false); // 기본적으로 접혀서 화면 가림 방지

  // 4계절 지구 공전 시뮬레이션 상태
  const [activeSeason, setActiveSeason] = useState<SeasonKey>('summer');
  const [seasonAutoPlay, setSeasonAutoPlay] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = createConstellation3DScene(
      containerRef.current,
      activeConstellation,
      (star) => setSelectedStar(star),
    );
    sceneRef.current = sc;

    return () => {
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  const handleSelectConstellation = (c: ConstellationData) => {
    setActiveConstellation(c);
    setSelectedStar(null);
    sceneRef.current?.setConstellation(c);
    const guide = SEASON_GUIDES[c.id];
    if (guide && viewMode === 'season_orbit') {
      setActiveSeason(guide.seasonKey);
      sceneRef.current?.setSeasonAngle(guide.angleRad);
    }
  };

  const handleViewModeChange = (mode: ConstellationViewMode) => {
    setViewMode(mode);
    sceneRef.current?.setViewMode(mode);
    if (mode === 'season_orbit') {
      const guide = SEASON_GUIDES[activeConstellation.id];
      if (guide) {
        setActiveSeason(guide.seasonKey);
        sceneRef.current?.setSeasonAngle(guide.angleRad);
      }
    }
  };

  const handleToggleArt = () => {
    const next = !showArt;
    setShowArt(next);
    sceneRef.current?.setShowArt(next);
  };

  const handleToggleGuides = () => {
    const next = !showGuides;
    setShowGuides(next);
    sceneRef.current?.setShowGuides(next);
  };

  const handlePickStarFromList = (star: StarData) => {
    setSelectedStar(star);
    sceneRef.current?.setSelectedStar(star.id);
  };

  const handleResetView = () => {
    sceneRef.current?.resetView();
  };

  const handleSelectSeason = (seasonKey: SeasonKey, angleRad: number) => {
    setActiveSeason(seasonKey);
    setSeasonAutoPlay(false);
    sceneRef.current?.setSeasonAutoPlay(false);
    sceneRef.current?.setSeasonAngle(angleRad);
  };

  const handleToggleSeasonPlay = () => {
    const next = !seasonAutoPlay;
    setSeasonAutoPlay(next);
    sceneRef.current?.setSeasonAutoPlay(next);
  };

  return (
    <div className="constellation-sim-root">
      {/* 3D 캔버스 영역 */}
      <div ref={containerRef} className="constellation-canvas-container" />

      {/* 상단 메인 헤더 */}
      <header className="constellation-header">
        <button className="btn btn-back-solar" onClick={onBackToSolar}>
          <span>🌌</span>
          <strong>태양계 우주로 돌아가기</strong>
        </button>

        {/* 6대 별자리 선택 탭 바 */}
        <div className="constellation-tabs-bar">
          {CONSTELLATIONS.map((c) => (
            <button
              key={c.id}
              className={`constellation-tab-btn ${activeConstellation.id === c.id ? 'active' : ''}`}
              onClick={() => handleSelectConstellation(c)}
            >
              <span className="c-tab-emoji">{c.emoji}</span>
              <span className="c-tab-name">{c.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* 중앙 상단: 2D 평면 ↔ 3D 입체 전환 배너 & 모드 컨트롤러 */}
      <div className="constellation-mode-bar">
        <div className="view-mode-pill">
          <button
            className={`btn-view-toggle ${viewMode === 'earth' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('earth')}
            title="지구 모형 위 관측소에서 별자리를 바라보는 원근 거리감 시점"
          >
            <span>🌍 지구 관측 뷰</span>
            <small>지구 위에서 보기</small>
          </button>

          <button
            className={`btn-view-toggle highlight ${viewMode === 'space3d' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('space3d')}
            title="3D 우주 공간에서 실제 광년 거리를 입체로 확인하기"
          >
            <span>🚀 3D 입체로 보기!</span>
            <small>실제 광년 깊이</small>
          </button>

          <button
            className={`btn-view-toggle ${viewMode === 'top' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('top')}
            title="위에서 내려다보는 별들의 거리 지도"
          >
            <span>🗺️ 거리 지도 뷰</span>
            <small>위에서 보기</small>
          </button>

          <button
            className={`btn-view-toggle highlight-gold ${viewMode === 'season_orbit' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('season_orbit')}
            title="지구가 태양을 공전하면서 계절마다 별자리가 다르게 보이는 이유 확인하기"
          >
            <span>🌞 계절 공전 뷰</span>
            <small>4계절 별자리 비밀</small>
          </button>

          <button
            className="btn-view-toggle btn-reset-origin"
            onClick={handleResetView}
            title="자유롭게 확대/축소/이동한 시점을 원래 원점 위치로 되돌립니다"
          >
            <span>🎯 원점 복귀</span>
            <small>시점 리셋</small>
          </button>
        </div>

        {/* 보조 시각 효과 토글 버튼들 */}
        <div className="aux-toggles">
          <button
            className={`btn-aux-toggle ${showArt ? 'active' : ''}`}
            onClick={handleToggleArt}
            title="신비로운 네온 고스트 별자리 그림 켜기/끄기"
          >
            <span>👻</span>
            <span>고스트 그림 {showArt ? '켜짐' : '꺼짐'}</span>
          </button>

          <button
            className={`btn-aux-toggle ${showGuides ? 'active' : ''}`}
            onClick={handleToggleGuides}
            title="바닥 거리 측정 레이저 기둥 켜기/끄기"
          >
            <span>📏</span>
            <span>거리 빔 {showGuides ? '켜짐' : '꺼짐'}</span>
          </button>
        </div>
      </div>

      {/* 우측 상단/플로팅: 별자리 동화 스토리 카드 (기본 접힘, 클릭 시만 오픈) */}
      <aside className={`constellation-story-panel ${isStoryExpanded ? 'expanded' : 'collapsed'}`}>
        {!isStoryExpanded ? (
          <button
            className="story-collapsed-pill"
            onClick={() => setIsStoryExpanded(true)}
            title="별자리 이야기 펼치기"
          >
            <span className="pill-emoji">{activeConstellation.emoji}</span>
            <span className="pill-text">{activeConstellation.name} 이야기</span>
            <span className="pill-arrow">📖 보기 ▼</span>
          </button>
        ) : (
          <>
            <div className="story-header" onClick={() => setIsStoryExpanded(false)}>
              <span className="story-emoji">{activeConstellation.emoji}</span>
              <div className="story-title-group">
                <h3>{activeConstellation.story.title}</h3>
                <span className="story-tagline">{activeConstellation.story.tagline}</span>
              </div>
              <button
                className="story-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStoryExpanded(false);
                }}
                title="별자리를 크게 감상하기 위해 이야기 닫기"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="story-content">
              <div className="story-paragraphs">
                {activeConstellation.story.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              <div className="story-funfact">
                <span className="fact-badge">💡 신기한 우주 비밀!</span>
                <p>{activeConstellation.story.funFact}</p>
              </div>

              {/* 별 목록 퀵 셀렉터 (2열 그리드로 공간 절약 및 높은 가독성) */}
              <div className="stars-quick-list">
                <div className="stars-list-title">
                  <span>별을 클릭해 3D 거리를 확인해 보세요:</span>
                </div>
                <div className="stars-chips-container">
                  {activeConstellation.stars.map((s) => (
                    <button
                      key={s.id}
                      className={`star-chip ${selectedStar?.id === s.id ? 'active' : ''}`}
                      onClick={() => handlePickStarFromList(s)}
                      style={{
                        borderLeftColor: s.color,
                      }}
                    >
                      <span className="star-dot" style={{ backgroundColor: s.color }} />
                      <span className="star-name">{s.name.split(' ')[0]}</span>
                      <strong className="star-ly">{s.distanceLy}광년</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* 선택된 별 상세 정보 팝업 카드 (별을 클릭했을 때 표시) */}
      {selectedStar && (
        <div className="selected-star-card">
          <div className="star-card-header">
            <div className="star-title-wrap">
              <span className="star-color-indicator" style={{ backgroundColor: selectedStar.color }} />
              <h4>{selectedStar.name}</h4>
              <small className="star-bayer">{selectedStar.bayer ?? selectedStar.englishName}</small>
            </div>
            <button className="star-card-close" onClick={() => setSelectedStar(null)}>
              ✕
            </button>
          </div>

          <div className="star-card-body">
            <div className="star-metrics">
              <div className="metric-box distance">
                <span className="metric-lbl">지구로부터 거리</span>
                <strong className="metric-val">{selectedStar.distanceLy.toLocaleString()} 광년</strong>
                <small className="metric-note">빛의 속도로 {selectedStar.distanceLy}년 걸려요!</small>
              </div>

              <div className="metric-box spectral">
                <span className="metric-lbl">별의 종류</span>
                <strong className="metric-val" style={{ color: selectedStar.color }}>
                  {selectedStar.spectralType}
                </strong>
                <small className="metric-note">겉보기 밝기: {selectedStar.apparentMagnitude}등급</small>
              </div>
            </div>

            <p className="star-desc">{selectedStar.description}</p>
          </div>
        </div>
      )}

      {/* 4계절 지구 공전 뷰 인터랙티브 컨트롤 독 */}
      {viewMode === 'season_orbit' && (
        <div className="season-control-dock">
          <div className="season-dock-header">
            <div className="season-dock-title-wrap">
              <span className="dock-badge">🌞 4계절 지구 공전 & 별자리 비밀</span>
              <h4>지구가 태양을 돌며 밤하늘을 바라보는 방향이 달라져요!</h4>
            </div>
            <button
              className={`btn-season-play ${seasonAutoPlay ? 'playing' : ''}`}
              onClick={handleToggleSeasonPlay}
              title={seasonAutoPlay ? '자동 공전 멈춤' : '지구가 태양을 공전하는 모습 자동 재생'}
            >
              <span>{seasonAutoPlay ? '⏸ 공전 멈춤' : '▶ 자동 공전 시작'}</span>
            </button>
          </div>

          <div className="season-tabs">
            <button
              className={`season-tab-btn spring ${activeSeason === 'spring' ? 'active' : ''}`}
              onClick={() => handleSelectSeason('spring', 0)}
            >
              <span className="s-emoji">🌸</span>
              <span className="s-name">봄</span>
              <small className="s-months">3~5월</small>
            </button>
            <button
              className={`season-tab-btn summer ${activeSeason === 'summer' ? 'active' : ''}`}
              onClick={() => handleSelectSeason('summer', Math.PI * 0.5)}
            >
              <span className="s-emoji">☀️</span>
              <span className="s-name">여름</span>
              <small className="s-months">6~8월</small>
            </button>
            <button
              className={`season-tab-btn autumn ${activeSeason === 'autumn' ? 'active' : ''}`}
              onClick={() => handleSelectSeason('autumn', Math.PI)}
            >
              <span className="s-emoji">🍁</span>
              <span className="s-name">가을</span>
              <small className="s-months">9~11월</small>
            </button>
            <button
              className={`season-tab-btn winter ${activeSeason === 'winter' ? 'active' : ''}`}
              onClick={() => handleSelectSeason('winter', Math.PI * 1.5)}
            >
              <span className="s-emoji">❄️</span>
              <span className="s-name">겨울</span>
              <small className="s-months">12~2월</small>
            </button>
          </div>

          <div className="season-status-card">
            {activeSeason === SEASON_GUIDES[activeConstellation.id]?.seasonKey ? (
              <div className="status-badge match">
                <div className="badge-header">
                  <span className="badge-icon">✨</span>
                  <strong>지금이 바로 {activeConstellation.name}의 계절이에요!</strong>
                </div>
                <p>
                  지구의 어두운 밤하늘 방향(푸른 시야 콘)이 {activeConstellation.name}를 똑바로 향하고 있어요! 밤새도록 하늘 높이 밝게 반짝입니다.
                </p>
              </div>
            ) : (
              <div className="status-badge hidden">
                <div className="badge-header">
                  <span className="badge-icon">☀️</span>
                  <strong>지금은 태양 뒤편에 가려져 밤에 보이지 않아요!</strong>
                </div>
                <p>
                  지구가 태양 반대편으로 돌아 {activeConstellation.name}는 낮 하늘 쪽에 떠 있어요. 태양 빛이 너무 눈부셔서 보이지 않아요!
                </p>
              </div>
            )}
            <div className="season-tip">
              <span>💡 {SEASON_GUIDES[activeConstellation.id]?.description}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
