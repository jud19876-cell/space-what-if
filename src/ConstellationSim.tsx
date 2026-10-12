import { useEffect, useRef, useState } from 'react';
import {
  createConstellation3DScene,
  type ConstellationScene,
  type ConstellationViewMode,
} from './constellation3DScene.ts';
import {
  CONSTELLATIONS,
  SEASON_GUIDES,
  ZODIAC_MONTHS,
  type ConstellationData,
  type SeasonKey,
  type StarData,
  type ZodiacMonthInfo,
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

  // 🎡 1~12월 황도 12궁 전체 휠 시뮬레이션 상태
  const [wheelMonth, setWheelMonth] = useState(4); // 기본 4월 양자리
  const [wheelAutoPlay, setWheelAutoPlay] = useState(false);

  // 카테고리 필터: 'all' | 'zodiac' | 'spring' | 'summer' | 'autumn' | 'winter'
  type ConstellationFilterMode = 'all' | 'zodiac' | 'spring' | 'summer' | 'autumn' | 'winter';
  const [filterMode, setFilterMode] = useState<ConstellationFilterMode>('all');
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const ZODIAC_ORDER = [
    'capricorn',   // 1월 (12.22 ~ 1.19)
    'aquarius',    // 2월 (1.20 ~ 2.18)
    'pisces',      // 3월 (2.19 ~ 3.20)
    'aries',       // 4월 (3.21 ~ 4.19)
    'taurus',      // 5월 (4.20 ~ 5.20)
    'gemini',      // 6월 (5.21 ~ 6.21)
    'cancer',      // 7월 (6.22 ~ 7.22)
    'leo',         // 8월 (7.23 ~ 8.22)
    'virgo',       // 9월 (8.23 ~ 9.22)
    'libra',       // 10월 (9.23 ~ 10.23)
    'scorpius',    // 11월 (10.24 ~ 11.22)
    'sagittarius', // 12월 (11.23 ~ 12.21)
  ];

  const getFilteredList = (mode: ConstellationFilterMode) => {
    switch (mode) {
      case 'zodiac':
        return ZODIAC_ORDER.map((id) => CONSTELLATIONS.find((c) => c.id === id)!).filter(Boolean);
      case 'spring':
        return CONSTELLATIONS.filter((c) => SEASON_GUIDES[c.id]?.seasonKey === 'spring');
      case 'summer':
        return CONSTELLATIONS.filter((c) => SEASON_GUIDES[c.id]?.seasonKey === 'summer');
      case 'autumn':
        return CONSTELLATIONS.filter((c) => SEASON_GUIDES[c.id]?.seasonKey === 'autumn');
      case 'winter':
        return CONSTELLATIONS.filter((c) => SEASON_GUIDES[c.id]?.seasonKey === 'winter');
      case 'all':
      default:
        return CONSTELLATIONS;
    }
  };

  const displayedConstellations = getFilteredList(filterMode);

  const scrollTabs = (offset: number) => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  };

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
    // 선택한 탭이 화면 중앙으로 오도록 부드럽게 스크롤
    setTimeout(() => {
      const tabEl = document.getElementById(`tab-c-${c.id}`);
      tabEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 60);
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
    } else if (mode === 'zodiac_wheel') {
      sceneRef.current?.setZodiacWheelMonth(wheelMonth);
    }
  };

  const handleWheelMonthChange = (month: number) => {
    setWheelMonth(month);
    setWheelAutoPlay(false);
    sceneRef.current?.setZodiacWheelAutoPlay(false);
    sceneRef.current?.setZodiacWheelMonth(month);
  };

  const handleToggleWheelPlay = () => {
    const next = !wheelAutoPlay;
    setWheelAutoPlay(next);
    sceneRef.current?.setZodiacWheelAutoPlay(next);
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
      {/* 상단 메인 헤더 - 2행 구조 (상단 컨트롤 바 + 하단 스크롤 탭 바) */}
      <header className="constellation-header">
        <div className="constellation-header-top">
          <button className="btn btn-back-solar" onClick={onBackToSolar}>
            <span>🌌</span>
            <strong>태양계 우주로 돌아가기</strong>
          </button>

          {/* 카테고리 필터 스위치: 전체 ↔ 탄생월 12궁 ↔ 4계절 */}
          <div className="constellation-filter-switch">
            <button
              className={`btn-filter-pill ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
              title="밤하늘 전체 18대 대표 별자리 보기"
            >
              <span>✨ 전체 ({CONSTELLATIONS.length})</span>
            </button>
            <button
              className={`btn-filter-pill highlight-zodiac ${filterMode === 'zodiac' ? 'active' : ''}`}
              onClick={() => setFilterMode('zodiac')}
              title="1월부터 12월까지 내 생일 탄생월 별자리 (황도 12궁 12개) 모아보기"
            >
              <span>🎂 탄생월 12궁 (생일별)</span>
            </button>
            <button
              className={`btn-filter-pill ${filterMode === 'spring' ? 'active' : ''}`}
              onClick={() => setFilterMode('spring')}
              title="따뜻한 봄철 밤하늘 대표 별자리 보기"
            >
              <span>🌸 봄 ({getFilteredList('spring').length})</span>
            </button>
            <button
              className={`btn-filter-pill ${filterMode === 'summer' ? 'active' : ''}`}
              onClick={() => setFilterMode('summer')}
              title="여름철 은하수 주변 대표 별자리 보기"
            >
              <span>☀️ 여름 ({getFilteredList('summer').length})</span>
            </button>
            <button
              className={`btn-filter-pill ${filterMode === 'autumn' ? 'active' : ''}`}
              onClick={() => setFilterMode('autumn')}
              title="청명한 가을철 밤하늘 대표 별자리 보기"
            >
              <span>🍁 가을 ({getFilteredList('autumn').length})</span>
            </button>
            <button
              className={`btn-filter-pill ${filterMode === 'winter' ? 'active' : ''}`}
              onClick={() => setFilterMode('winter')}
              title="찬란한 겨울철 다이아몬드 별자리 보기"
            >
              <span>❄️ 겨울 ({getFilteredList('winter').length})</span>
            </button>
          </div>

          {/* 18대 전체 별자리 한눈에 보기 모달 팝업 버튼 */}
          <button
            className="btn btn-open-catalog"
            onClick={() => setIsCatalogModalOpen(true)}
            title="18대 전체 별자리를 카드 격자 형태로 한눈에 펼쳐서 선택하기"
          >
            <span>📑</span>
            <strong>전체 도감 한눈에 보기 ({displayedConstellations.length})</strong>
          </button>
        </div>

        {/* 하단 탭 바 래퍼: 좌우 스크롤 화살표 + 가로 스크롤 가능한 탭 바 */}
        <div className="constellation-tabs-wrapper">
          <button
            className="btn-tab-scroll left"
            onClick={() => scrollTabs(-320)}
            title="이전 별자리 목록으로 스크롤"
          >
            ◀
          </button>

          <div
            ref={tabsContainerRef}
            className="constellation-tabs-bar"
            onWheel={handleTabsWheel}
          >
            {displayedConstellations.map((c) => {
              const monthMatch = c.birthMonth?.match(/(\d+)월/);
              const monthLabel = monthMatch ? `${monthMatch[1]}월` : null;

              return (
                <button
                  id={`tab-c-${c.id}`}
                  key={c.id}
                  className={`constellation-tab-btn ${activeConstellation.id === c.id ? 'active' : ''} ${c.birthMonth ? 'is-zodiac' : ''}`}
                  onClick={() => handleSelectConstellation(c)}
                >
                  <span className="c-tab-emoji">{c.emoji}</span>
                  <span className="c-tab-name">{c.name}</span>
                  {monthLabel && (
                    <span className="c-tab-month-tag" title={c.birthMonth}>
                      {monthLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            className="btn-tab-scroll right"
            onClick={() => scrollTabs(320)}
            title="다음 별자리 목록으로 스크롤"
          >
            ▶
          </button>
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
            className={`btn-view-toggle highlight-rainbow ${viewMode === 'zodiac_wheel' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('zodiac_wheel')}
            title="1~12월 황도 12궁 전체가 한 화면에 360도로 다 보이며, 지구가 태양을 공전·자전함에 따라 계절별로 별자리가 달라 보이는 걸 한눈에 관측"
          >
            <span>🎡 1~12월 황도대 전체 뷰!</span>
            <small>지구 공전·자전 파노라마</small>
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
            {activeConstellation.birthMonth && (
              <span className="pill-birth-tag" title={activeConstellation.birthMonth}>
                🎂 {activeConstellation.birthMonth.split(' ')[2]?.replace(/[()]/g, '') || '생일별'}
              </span>
            )}
            <span className="pill-arrow">📖 보기 ▼</span>
          </button>
        ) : (
          <>
            <div className="story-header" onClick={() => setIsStoryExpanded(false)}>
              <span className="story-emoji">{activeConstellation.emoji}</span>
              <div className="story-title-group">
                <div className="story-title-badge-row">
                  <h3>{activeConstellation.story.title}</h3>
                  {activeConstellation.birthMonth && (
                    <span className="story-birth-badge">
                      🎂 {activeConstellation.birthMonth} {activeConstellation.zodiacSign ? `· ${activeConstellation.zodiacSign}` : ''}
                    </span>
                  )}
                </div>
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

      {/* 🎡 1~12월 황도 12궁 전체 360도 파노라마 컨트롤 독 */}
      {viewMode === 'zodiac_wheel' && (
        <div className="zodiac-wheel-dock">
          <div className="zodiac-dock-header">
            <div className="zodiac-dock-title-wrap">
              <span className="dock-badge rainbow">🎡 1~12월 황도 12궁 360도 전체 파노라마</span>
              <h4>지구가 태양을 돌며 밤에 보이는 별자리와 낮에 숨겨지는 별자리가 매달 바뀌어요!</h4>
            </div>
            <button
              className={`btn-zodiac-play ${wheelAutoPlay ? 'playing' : ''}`}
              onClick={handleToggleWheelPlay}
              title={wheelAutoPlay ? '1년 공전 멈춤' : '지구가 1년 동안 12궁을 도는 모습 자동 재생'}
            >
              <span>{wheelAutoPlay ? '⏸ 1년 공전 멈춤' : '▶ 1년 공전 자동 재생'}</span>
            </button>
          </div>

          {/* 1월부터 12월까지 월 선택 탭 그리드 */}
          <div className="zodiac-months-grid">
            {ZODIAC_MONTHS.map((zm) => (
              <button
                key={zm.month}
                className={`zodiac-month-btn ${wheelMonth === zm.month ? 'active' : ''}`}
                onClick={() => handleWheelMonthChange(zm.month)}
              >
                <span className="zm-badge">{zm.month}월</span>
                <span className="zm-emoji">{zm.emoji}</span>
                <strong className="zm-name">{zm.name}</strong>
              </button>
            ))}
          </div>

          {/* 실시간 천문 원리 설명 카드 */}
          {(() => {
            const curInfo = ZODIAC_MONTHS.find((z) => z.month === wheelMonth) || ZODIAC_MONTHS[3];
            const oppConstellation = CONSTELLATIONS.find((c) => c.id === curInfo.oppositeConstellationId);

            return (
              <div className="zodiac-insight-card">
                <div className="insight-row">
                  <div className="insight-box night">
                    <div className="insight-label">
                      <span>🌌 [한밤중 밤하늘]에 높이 뜨는 별자리</span>
                      <strong>{oppConstellation?.emoji} {oppConstellation?.name}</strong>
                    </div>
                    <p>
                      지구가 태양 반대편(어두운 우주)을 바라보는 자정에는 <strong>{oppConstellation?.name}</strong>가 남쪽 밤하늘에서 밤새도록 찬란하게 빛나요!
                    </p>
                  </div>

                  <div className="insight-box day">
                    <div className="insight-label">
                      <span>☀️ [낮 하늘] 태양 뒤편에 숨는 생일별</span>
                      <strong>{curInfo.emoji} {curInfo.sunConstellation} ({curInfo.month}월 생일별)</strong>
                    </div>
                    <p>
                      태양이 <strong>{curInfo.sunConstellation}</strong> 바로 앞에 있어서 낮 동안 눈부신 햇빛 때문에 지구에서는 보이지 않아요!
                    </p>
                  </div>
                </div>

                <div className="zodiac-story-tip">
                  <span>💡 <strong>{curInfo.month}월의 비밀:</strong> {curInfo.description}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 📑 전체 18대 별자리 한눈에 보기 팝업 모달 */}
      {isCatalogModalOpen && (
        <div className="constellation-catalog-overlay" onClick={() => setIsCatalogModalOpen(false)}>
          <div className="constellation-catalog-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="catalog-header">
              <div className="catalog-title-wrap">
                <span className="catalog-icon">🌌</span>
                <div>
                  <h3>밤하늘 18대 대표 별자리 전체 도감</h3>
                  <p>선택하고 싶은 별자리를 클릭하면 3D 우주 시점이 즉시 이동합니다.</p>
                </div>
              </div>
              <button className="catalog-close-btn" onClick={() => setIsCatalogModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="catalog-filter-bar">
              <button
                className={`catalog-filter-chip ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                ✨ 전체 ({CONSTELLATIONS.length})
              </button>
              <button
                className={`catalog-filter-chip highlight ${filterMode === 'zodiac' ? 'active' : ''}`}
                onClick={() => setFilterMode('zodiac')}
              >
                🎂 탄생월 12궁 (생일별 12개)
              </button>
              <button
                className={`catalog-filter-chip ${filterMode === 'spring' ? 'active' : ''}`}
                onClick={() => setFilterMode('spring')}
              >
                🌸 봄철 ({getFilteredList('spring').length})
              </button>
              <button
                className={`catalog-filter-chip ${filterMode === 'summer' ? 'active' : ''}`}
                onClick={() => setFilterMode('summer')}
              >
                ☀️ 여름철 ({getFilteredList('summer').length})
              </button>
              <button
                className={`catalog-filter-chip ${filterMode === 'autumn' ? 'active' : ''}`}
                onClick={() => setFilterMode('autumn')}
              >
                🍁 가을철 ({getFilteredList('autumn').length})
              </button>
              <button
                className={`catalog-filter-chip ${filterMode === 'winter' ? 'active' : ''}`}
                onClick={() => setFilterMode('winter')}
              >
                ❄️ 겨울철 ({getFilteredList('winter').length})
              </button>
            </div>

            <div className="catalog-grid">
              {displayedConstellations.map((c) => {
                const isSelected = activeConstellation.id === c.id;
                const monthMatch = c.birthMonth?.match(/(\d+)월/);
                const monthLabel = monthMatch ? `${monthMatch[1]}월 생일별` : null;

                return (
                  <div
                    key={c.id}
                    className={`catalog-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      handleSelectConstellation(c);
                      setIsCatalogModalOpen(false);
                    }}
                  >
                    <div className="card-top-row">
                      <span className="card-emoji">{c.emoji}</span>
                      <div className="card-name-group">
                        <strong className="card-name">{c.name}</strong>
                        <small className="card-eng">{c.englishName}</small>
                      </div>
                      {monthLabel ? (
                        <span className="card-badge birth">🎂 {monthLabel}</span>
                      ) : (
                        <span className="card-badge season">{c.season.split(' ')[0]}</span>
                      )}
                    </div>

                    <p className="card-desc">{c.overview}</p>

                    <div className="card-footer">
                      <div className="card-stars-preview">
                        <span className="stars-count">별 {c.stars.length}개</span>
                        <div className="stars-dots">
                          {c.stars.slice(0, 5).map((s) => (
                            <span
                              key={s.id}
                              className="star-dot-sm"
                              style={{ backgroundColor: s.color }}
                              title={`${s.name} (${s.distanceLy}광년)`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="card-pick-btn">{isSelected ? '선택됨 ✓' : '선택하기 →'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
