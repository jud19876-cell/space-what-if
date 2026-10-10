import { useEffect, useRef, useState } from 'react';
import {
  createConstellation3DScene,
  type ConstellationScene,
  type ConstellationViewMode,
} from './constellation3DScene.ts';
import {
  CONSTELLATIONS,
  type ConstellationData,
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
  };

  const handleViewModeChange = (mode: ConstellationViewMode) => {
    setViewMode(mode);
    sceneRef.current?.setViewMode(mode);
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
            title="지구에서 보는 2D 평면 별자리 모양"
          >
            <span>🌍 지구에서 보기</span>
            <small>평면 별자리</small>
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
    </div>
  );
}
