import { useCallback, useEffect, useRef, useState } from 'react';
import BlackHoleSpaghettiSim from './BlackHoleSpaghettiSim.tsx';
import ConstellationSim from './ConstellationSim.tsx';
import GalaxyCollisionSim from './GalaxyCollisionSim.tsx';
import type { GalaxyScenarioType } from './galaxyCollisionPhysics.ts';
import { AU_PER_DAY_TO_KM_S, length, type Vec3 } from './physics.ts';
import { PlanetInspector } from './PlanetInspector.tsx';
import { createSpaceScene, type AimInfo, type PlacementConfig, type PlacementInfo, type SpaceScene } from './scene.ts';
import { SCENARIOS, type Scenario, type ScenarioCategory } from './scenarios.ts';
import { createInitialState, executeCommand, findBody, type SimCommand, type SimState, type StackableConditions } from './simulation.ts';
import { BODY_INFO, EARTH_MASS, type BodyId } from './solarSystem.ts';
import { SpawnPlanetModal } from './SpawnPlanetModal.tsx';

const EXTREME_ANOMALIES: {
  key: 'antiGravity' | 'darkMatterHalo' | 'twinNemesis' | 'asteroidStorm' | 'retrogradeFlip' | 'solarWindRepulsion';
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { key: 'antiGravity', label: '반중력 우주 팽창', emoji: '🧲💥', desc: '만유인력이 척력으로 역전되어 모든 천체가 우주 밖으로 흩어집니다' },
  { key: 'darkMatterHalo', label: '암흑물질 헤일로', emoji: '🌪️✨', desc: '은하 회전 곡선 가속도로 외곽 행성들이 튕겨나가지 않고 광속 회전합니다' },
  { key: 'twinNemesis', label: '쌍둥이 항성 난입', emoji: '🌀⭐', desc: '1.3배 태양 질량의 청색 쌍성이 침입하여 삼체 문제 카오스가 펼쳐집니다' },
  { key: 'asteroidStorm', label: '소행성 대폭풍', emoji: '☄️⚡', desc: '우주 외곽에서 쏟아지는 소행성 유성우가 행성들을 맹폭합니다' },
  { key: 'retrogradeFlip', label: '전 행성 역행 공전', emoji: '💫🔄', desc: '모든 행성의 공전 방향이 순간적으로 180도 반전됩니다' },
  { key: 'solarWindRepulsion', label: '초신성 태양풍', emoji: '💥☀️', desc: '태양의 복사압 폭풍으로 행성들이 바깥으로 밀려납니다' },
];

export default function App() {
  const stateRef = useRef<SimState>(createInitialState());
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const [simMode, setSimMode] = useState<'solar' | 'spaghetti' | 'constellation' | 'galaxy'>('solar');
  const [galaxyScenario, setGalaxyScenario] = useState<GalaxyScenarioType>('local_group');
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; emoji: string; text: string; type?: 'normal' | 'impact' | 'explosion' } | null>(null);
  const [hinted, setHinted] = useState(false);
  const [category, setCategory] = useState<ScenarioCategory>('all');
  const [cannonMode, setCannonMode] = useState(false);
  const [cannonMassType, setCannonMassType] = useState<'normal' | 'giant'>('normal');
  const [aimInfo, setAimInfo] = useState<AimInfo | null>(null);
  const [spawnModalOpen, setSpawnModalOpen] = useState(false);
  const [placementConfig, setPlacementConfig] = useState<PlacementConfig | null>(null);
  const [placementHover, setPlacementHover] = useState<PlacementInfo | null>(null);
  const [, setTick] = useState(0);

  /** 모든 상태 변경은 여기서 Simulation Command 로만 한다. */
  const runCommands = useCallback((commands: SimCommand[]) => {
    const s = stateRef.current;
    for (const c of commands) {
      executeCommand(s, c);
      if (c.action === 'reset') sceneRef.current?.clearTrails();
      if (c.action === 'collapse_to_black_hole') {
        const body = findBody(s, c.target);
        setToast({
          key: Date.now(),
          emoji: '💥🕳️',
          text: `초신성 대폭발! [${body?.name ?? '천체'}]이(가) 엄청난 중력 붕괴를 일으키며 거대 블랙홀로 각성했습니다! 주변 모든 천체를 빨아들입니다!`,
          type: 'explosion',
        });
      }
      if (c.action === 'restore_from_black_hole') {
        const body = findBody(s, c.target);
        setToast({
          key: Date.now(),
          emoji: '🪐✨',
          text: `[${body?.name ?? '천체'}]이(가) 블랙홀 상태에서 안정적인 일반 행성으로 복원되었습니다.`,
          type: 'normal',
        });
      }
    }
    setSelected((id) => (id && findBody(s, id) ? id : null));
    setTick((t) => t + 1);
  }, []);

  const handleStartMousePlacement = useCallback((config: PlacementConfig) => {
    setPlacementConfig(config);
    sceneRef.current?.setPlacementMode(
      config,
      (hoverInfo) => setPlacementHover(hoverInfo),
      (posAU) => {
        runCommands([
          {
            action: 'spawn_custom_planet',
            name: config.name,
            typeId: config.typeId,
            position: posAU,
            visualRadius: config.visualRadius,
            massMultiplier: config.massMultiplier,
            hasRings: config.hasRings,
          },
        ]);
        const s = stateRef.current;
        const newBody = s.bodies[s.bodies.length - 1];
        if (newBody) {
          setSelected(newBody.id);
          sceneRef.current?.focusBody(newBody.id);
        }
        setToast({
          key: Date.now(),
          emoji: '🪐✨',
          text: `새 천체 [${config.name}]이(가) 클릭한 궤도 좌표에 안정적인 케플러 원궤도로 안착했습니다!`,
          type: 'normal',
        });
        setPlacementConfig(null);
        setPlacementHover(null);
        sceneRef.current?.setPlacementMode(null);
      },
    );
    setToast({
      key: Date.now(),
      emoji: '🖱️🪐',
      text: '화면의 원하는 궤도 평면을 마우스로 클릭하여 행성을 안착시키세요!',
      type: 'normal',
    });
  }, [runCommands]);

  const handleCancelMousePlacement = useCallback(() => {
    setPlacementConfig(null);
    setPlacementHover(null);
    sceneRef.current?.setPlacementMode(null);
  }, []);

  const handleToggleAnomaly = useCallback((anomalyKey: (typeof EXTREME_ANOMALIES)[number]['key']) => {
    const currentVal = !!stateRef.current.conditions?.[anomalyKey];
    const nextVal = !currentVal;
    runCommands([{ action: 'toggle_extreme_anomaly', anomaly: anomalyKey, enable: nextVal }]);
    const item = EXTREME_ANOMALIES.find((c) => c.key === anomalyKey);
    setToast({
      key: Date.now(),
      emoji: item?.emoji ?? '🌌',
      text: `[${item?.label ?? anomalyKey}] ${nextVal ? '극한 현상 발동 (ON)!' : '현상 종료 (OFF)'}`,
      type: 'normal',
    });
  }, [runCommands]);

  const handleConditionSlider = useCallback((param: 'gravity' | 'sunMass' | 'orbitSpeed', val: number) => {
    runCommands([{ action: 'set_condition_slider', param, value: val }]);
  }, [runCommands]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (placementConfig) handleCancelMousePlacement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [placementConfig, handleCancelMousePlacement]);

  const handleLaunchAsteroid = useCallback((pos: Vec3, vel: Vec3, massType: 'normal' | 'giant') => {
    runCommands([
      {
        action: 'launch_asteroid',
        position: pos,
        velocity: vel,
        massType,
      },
    ]);
    setToast({
      key: Date.now(),
      emoji: massType === 'giant' ? '💥☄️' : '☄️💨',
      text: `${massType === 'giant' ? '거대 파괴자 소행성' : '소행성'}이 발사되었습니다! 궤적을 확인하세요!`,
      type: 'normal',
    });
  }, [runCommands]);

  const handleFireAsteroid = useCallback((asteroidId: string, targetPos: Vec3) => {
    runCommands([
      {
        action: 'fire_body_towards',
        bodyId: asteroidId,
        targetPosition: targetPos,
        speedAuDay: 0.08, // 약 138 km/s 고속 돌진
      },
    ]);
    const body = findBody(stateRef.current, asteroidId);
    setToast({
      key: Date.now(),
      emoji: '🚀☄️',
      text: `슈우웅-! ${body?.name ?? '소행성'}이 클릭한 화면 방향으로 쏜살같이 날아갑니다!`,
      type: 'normal',
    });
    setTick((t) => t + 1);
  }, [runCommands]);

  const handleSpawnReadyAsteroid = useCallback((massType: 'normal' | 'giant' = 'normal') => {
    runCommands([{ action: 'spawn_asteroid_near', massType }]);
    const s = stateRef.current;
    const latest = s.bodies[s.bodies.length - 1];
    if (latest) {
      setSelected(latest.id);
      sceneRef.current?.setAimingAsteroid(latest.id);
      setToast({
        key: Date.now(),
        emoji: '🎯☄️',
        text: `소행성이 준비되었습니다! 날아가길 원하는 화면 위치나 행성을 클릭하세요!`,
        type: 'normal',
      });
    }
  }, [runCommands]);

  useEffect(() => {
    const sc = createSpaceScene(
      containerRef.current!,
      () => stateRef.current,
      (id) => {
        setSelected(id);
        if (id) {
          setHinted(true);
          if (id.includes('asteroid') || id.includes('fragment')) {
            sc.setAimingAsteroid(id);
          } else {
            sc.setAimingAsteroid(null);
          }
        }
      },
      (ev) => {
        setToast({
          key: Date.now(),
          emoji: '🕳️💥',
          text: `앗! ${ev.swallowedName}이(가) ${ev.blackHoleName}에 빨려 들어가 삼켜졌어!`,
          type: 'normal',
        });
        setSelected((cur) => (cur === ev.swallowedId ? null : cur));
        setTick((t) => t + 1);
      },
      (colEv) => {
        if (colEv.type === 'shatter') {
          setToast({
            key: Date.now(),
            emoji: '💥⚡',
            text: `대폭발! ${colEv.projectileName} 충돌로 ${colEv.targetName}이(가) 산산조각 나 우주 파편이 되었습니다!`,
            type: 'explosion',
          });
          setSelected((cur) => (cur === colEv.targetId ? null : cur));
        } else {
          setToast({
            key: Date.now(),
            emoji: '☄️💥',
            text: `쾅! ${colEv.projectileName}이(가) ${colEv.targetName}에 격돌! 궤도가 흔들리며 속도가 ${colEv.velocityChange.toFixed(1)} km/s 변했습니다!`,
            type: 'impact',
          });
        }
        setTick((t) => t + 1);
      },
      handleLaunchAsteroid,
      (info) => setAimInfo(info),
      handleFireAsteroid,
    );
    sceneRef.current = sc;
    const iv = setInterval(() => setTick((t) => t + 1), 250);
    return () => {
      clearInterval(iv);
      sc.dispose();
    };
  }, [handleLaunchAsteroid, handleFireAsteroid]);

  useEffect(() => {
    sceneRef.current?.setSelected(selected);
    if (selected && (selected.includes('asteroid') || selected.includes('fragment'))) {
      sceneRef.current?.setAimingAsteroid(selected);
    } else {
      sceneRef.current?.setAimingAsteroid(null);
    }
  }, [selected]);

  useEffect(() => {
    sceneRef.current?.setCannonMode(cannonMode, cannonMassType);
  }, [cannonMode, cannonMassType]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const runScenario = (sc: Scenario) => {
    if (sc.id === 'astronaut-spaghetti') {
      setSimMode('spaghetti');
      setToast({
        key: Date.now(),
        emoji: '🧑‍🚀🍝',
        text: '우주비행사 블랙홀 낙하 & 스파게티화 실험실로 이동합니다!',
        type: 'normal',
      });
      return;
    }
    if (sc.id.startsWith('constellation-')) {
      setSimMode('constellation');
      setToast({
        key: Date.now(),
        emoji: '✨🔭',
        text: `${sc.label} 실감형 3D 탐험실로 이동합니다!`,
        type: 'normal',
      });
      return;
    }
    if (sc.id === 'galaxy-collision') {
      setGalaxyScenario('head_on');
      setSimMode('galaxy');
      setToast({
        key: Date.now(),
        emoji: '💥🌌',
        text: '두 은하의 정면 대충돌 심우주 모드로 이동합니다!',
        type: 'normal',
      });
      return;
    }
    if (sc.id === 'spawn-nearby-galaxy') {
      setGalaxyScenario('grazing');
      setSimMode('galaxy');
      setToast({
        key: Date.now(),
        emoji: '🌌🌀',
        text: '나선은하 조석 꼬리 & 심우주 모드로 이동합니다!',
        type: 'normal',
      });
      return;
    }
    if (sc.id === 'supermassive-blackhole-feast') {
      setGalaxyScenario('supermassive');
      setSimMode('galaxy');
      setToast({
        key: Date.now(),
        emoji: '🕳️🌌',
        text: '초대질량 블랙홀 [가르간튀아]의 은하 쌍포식 심우주 모드로 이동합니다!',
        type: 'normal',
      });
      return;
    }
    runCommands(sc.commands);
    setToast({
      key: Date.now(),
      emoji: sc.emoji,
      text: sc.message,
      type: sc.category === 'asteroid' ? 'impact' : 'normal',
    });
  };

  const state = stateRef.current;
  const years = state.time / 365.25;

  const visibleScenarios = SCENARIOS.filter((sc) => {
    if (category === 'all') return true;
    if (sc.id === 'reset') return true;
    return sc.category === category;
  });

  // 마우스 휠 스크롤로 배속 조절 (10~100x)
  const handleSpeedWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 5;
    const delta = e.deltaY < 0 ? step : -step;
    const newSpeed = Math.max(1, Math.min(100, state.speed + delta));
    runCommands([{ action: 'set_speed', speed: newSpeed }]);
  };

  const selectedBody = selected ? findBody(state, selected) : null;
  const isAsteroidSelected = !!(selected && (selected.includes('asteroid') || selected.includes('fragment')));

  return (
    <div className="app">
      <div className="space" ref={containerRef} />

      <header className="topbar">
        <div className="brand-group">
          <h1 className="title">
            <span className="title-icon">🚀</span> 우주 실험실
          </h1>
          <div className="clock" title="지구 시간">
            📅 {years < 1 ? `${Math.floor(state.time)}일` : `${years.toFixed(1)}년`}
          </div>
        </div>

        <div className="speed-controller-panel" onWheel={handleSpeedWheel} title="마우스 휠 스크롤로 배속을 10~100x까지 조절할 수 있습니다">
          <div className="speed-info">
            <span className="speed-icon">{state.speed >= 80 ? '🚀' : state.speed >= 40 ? '🏎️' : state.speed >= 10 ? '🐇' : '🐢'}</span>
            <span className="speed-badge">{state.speed}x 배속</span>
            <span className="speed-scroll-hint">🖱️ 휠 스크롤 조절 (10~100)</span>
          </div>
          <input
            id="speed-range"
            type="range"
            min="1"
            max="100"
            step="1"
            value={state.speed}
            onChange={(e) => runCommands([{ action: 'set_speed', speed: Number(e.target.value) }])}
            className="speed-range-slider"
            aria-label="시뮬레이션 배속 조절"
          />
          <div className="speed-presets">
            {[1, 10, 30, 60, 100].map((s) => (
              <button
                key={s}
                className={`speed-preset-chip ${state.speed === s ? 'on' : ''}`}
                onClick={() => runCommands([{ action: 'set_speed', speed: s }])}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="controls">
          <button
            id="btn-constellation-sim"
            className="btn constellation-nav-btn"
            onClick={() => setSimMode('constellation')}
            title="3D 입체 별자리 탐험 (평면 vs 실제 3D 거리 비교)"
          >
            <span>✨🦂</span>
            <span className="btn-text">3D 별자리 탐험</span>
          </button>

          <button
            id="btn-galaxy-sim"
            className="btn galaxy-nav-btn"
            onClick={() => {
              setGalaxyScenario('local_group');
              setSimMode('galaxy');
            }}
            title="광활한 심우주 스케일에서 성운 가스 구름과 두 은하의 상호작용 및 대충돌 관찰"
          >
            <span>🌌🌀</span>
            <span className="btn-text">은하 대충돌 심우주</span>
          </button>

          <button
            id="btn-astronaut-spaghetti"
            className="btn astronaut-spaghetti-btn"
            onClick={() => setSimMode('spaghetti')}
            title="우주비행사가 블랙홀에 빠질 때 일어나는 스파게티 현상 관찰하기"
          >
            <span>🧑‍🚀🍝</span>
            <span className="btn-text">우주인 스파게티 실험</span>
          </button>

          <button
            id="btn-spawn-ready"
            className="btn spawn-asteroid-btn"
            onClick={() => handleSpawnReadyAsteroid('normal')}
            title="소행성을 클릭하고 화면을 클릭해 원하는 방향으로 날려보내기"
          >
            <span>☄️</span>
            <span className="btn-text">소행성 클릭 발사</span>
          </button>

          <button
            id="btn-cannon"
            className={`btn cannon-toggle-btn ${cannonMode ? 'cannon-on' : ''}`}
            onClick={() => setCannonMode((prev) => !prev)}
            title="소행성 대포 모드 (드래그 궤적 조준 발사)"
          >
            <span className="cannon-btn-icon">🎯</span>
            <span className="cannon-btn-label">{cannonMode ? '대포 모드 끄기' : '대포 조준 모드'}</span>
          </button>

          <button
            id="btn-spawn-planet-modal"
            className="btn spawn-planet-nav-btn"
            onClick={() => setSpawnModalOpen(true)}
            title="새로운 커스텀 행성을 태양계 궤도에 직접 배치하기"
          >
            <span>🪐➕</span>
            <span className="btn-text">새 행성 배치</span>
          </button>

          <button
            id="btn-pause"
            className={`btn round ${state.paused ? 'play' : ''}`}
            onClick={() => runCommands([{ action: state.paused ? 'resume' : 'pause' }])}
            aria-label={state.paused ? '다시 움직이기' : '멈추기'}
          >
            {state.paused ? '▶️' : '⏸️'}
          </button>

          <button
            id="btn-reset"
            className="btn round"
            onClick={() => runScenario(SCENARIOS.find((s) => s.id === 'reset')!)}
            aria-label="처음으로"
          >
            🔄
          </button>
        </div>
      </header>

      {/* 마우스 3D 궤도 직접 찍기 안내 HUD 배너 */}
      {placementConfig && (
        <div className="mouse-placement-banner">
          <div className="placement-banner-left">
            <span className="placement-pulse-icon">📍</span>
            <div className="placement-banner-info">
              <span className="placement-banner-title">
                <strong>[{placementConfig.name}]</strong> 마우스 궤도 직접 배치 모드
              </span>
              <span className="placement-banner-subtitle">
                3D 우주 평면 위 원하는 궤도에 마우스를 대고 클릭하세요! (원궤도 자동 계산)
              </span>
            </div>
          </div>
          {placementHover && (
            <div className="placement-live-stats">
              <span className="placement-stat-pill">
                📏 태양 거리: <strong>{placementHover.distanceAU.toFixed(2)} AU</strong>
              </span>
              <span className="placement-stat-pill">
                ⚡ 원궤도 속도: <strong>{placementHover.circularSpeedKmS.toFixed(1)} km/s</strong>
              </span>
            </div>
          )}
          <button
            className="btn placement-cancel-btn"
            onClick={handleCancelMousePlacement}
            title="ESC 키로도 취소할 수 있습니다"
          >
            ✕ 배치 취소 (ESC)
          </button>
        </div>
      )}

      {/* 사용자가 소행성을 클릭했을 때 뜨는 방향 지정 안내 배너 */}
      {isAsteroidSelected && (
        <div className="aim-guide-banner">
          <span className="banner-icon">🎯</span>
          <div className="banner-info">
            <strong>{selectedBody?.name}</strong> 선택됨!
            <span className="banner-desc">👉 날아갈 방향의 <strong>화면 공간</strong>이나 <strong>목표 행성</strong>을 클릭하세요!</span>
          </div>
          <button
            className="btn banner-cancel-btn"
            onClick={() => {
              setSelected(null);
              sceneRef.current?.setAimingAsteroid(null);
            }}
          >
            ✕ 취소
          </button>
        </div>
      )}

      {/* 대포 모드 드래그 조준 HUD 패널 */}
      {cannonMode && (
        <div className="cannon-hud">
          <div className="cannon-hud-title">
            <span>🎯</span>
            <strong>소행성 대포 조준기</strong>
            <span className="cannon-hud-close" onClick={() => setCannonMode(false)}>✕</span>
          </div>
          <p className="cannon-hud-desc">
            우주 공간을 <strong>클릭 & 드래그</strong>하여 발사 각도와 파워를 정하거나, 아래 <strong>소행성 생성</strong> 후 화면을 클릭해 보세요!
          </p>
          <div className="cannon-types">
            <button
              className={`btn cannon-type-btn ${cannonMassType === 'normal' ? 'active' : ''}`}
              onClick={() => setCannonMassType('normal')}
            >
              <span>☄️ 일반 소행성</span>
              <small>충돌 시 궤도 변경</small>
            </button>
            <button
              className={`btn cannon-type-btn giant ${cannonMassType === 'giant' ? 'active' : ''}`}
              onClick={() => setCannonMassType('giant')}
            >
              <span>💥 거대 파괴자 소행성</span>
              <small>충돌 시 행성 산산조각 폭발!</small>
            </button>
          </div>

          <div className="cannon-actions-row">
            <button
              className="btn btn-action-spawn"
              onClick={() => handleSpawnReadyAsteroid(cannonMassType)}
            >
              ☄️ 소행성 준비 (화면 클릭 발사)
            </button>
          </div>

          <div className="cannon-quick-targets">
            <span className="quick-title">원클릭 표적 돌진:</span>
            <button
              className="btn quick-target-btn"
              onClick={() => runCommands([{ action: 'target_launch', targetId: 'earth', massType: cannonMassType }])}
            >
              🌍 지구
            </button>
            <button
              className="btn quick-target-btn"
              onClick={() => runCommands([{ action: 'target_launch', targetId: 'mars', massType: cannonMassType }])}
            >
              🔴 화성
            </button>
            <button
              className="btn quick-target-btn"
              onClick={() => runCommands([{ action: 'target_launch', targetId: 'jupiter', massType: cannonMassType }])}
            >
              🟠 목성
            </button>
          </div>
          {aimInfo && (
            <div className="aim-gauge-bar">
              🚀 실시간 조준 속도: <strong>{aimInfo.speedKmS.toFixed(1)} km/s</strong> (놓으면 발사!)
            </div>
          )}
        </div>
      )}

      {selected && !isAsteroidSelected && (
        <PlanetInspector
          state={state}
          bodyId={selected}
          onClose={() => {
            setSelected(null);
            sceneRef.current?.setSelected(null);
          }}
          onRunCommands={runCommands}
          onFocusBody={(id) => sceneRef.current?.focusBody(id)}
          onResetCamera={() => sceneRef.current?.resetCamera()}
        />
      )}

      {!hinted && !selected && !cannonMode && <div className="hint">👆 소행성을 누르고 화면을 클릭하면 그 방향으로 날아가 부딪쳐요!</div>}

      {toast && (
        <div className={`toast toast-${toast.type ?? 'normal'}`} key={toast.key}>
          <span className="toast-emoji">{toast.emoji}</span>
          <span className="toast-content">{toast.text}</span>
        </div>
      )}

      <footer className="experiments">
        {/* 극한 우주 물리 실험실 (연속 슬라이더 & 6대 우주 변칙 현상) */}
        <div className="cosmic-extremes-lab">
          <div className="extremes-header">
            <div className="extremes-title-group">
              <span className="extremes-icon">🌌</span>
              <strong className="extremes-title-text">극한 우주 물리 실험실</strong>
              <span className="extremes-subtitle">우주의 물리 법칙을 실시간으로 비틀고 상상을 초월하는 천문 현상을 가동합니다</span>
            </div>
            {((state.conditions?.gravityMultiplier ?? 1.0) !== 1.0 ||
              (state.conditions?.sunMassMultiplier ?? 1.0) !== 1.0 ||
              (state.conditions?.orbitSpeedMultiplier ?? 1.0) !== 1.0 ||
              Object.entries(state.conditions || {}).some(([k, v]) => typeof v === 'boolean' && v)) && (
              <button
                className="extremes-reset-btn"
                onClick={() => runCommands([{ action: 'reset' }])}
                title="모든 극한 물리 변수를 표준 태양계 상태로 초기화"
              >
                🔄 표준 물리 복원
              </button>
            )}
          </div>

          <div className="extremes-body-grid">
            {/* 3대 핵심 연속 물리 슬라이더 */}
            <div className="extremes-sliders-rack">
              {/* 중력 상수 G 슬라이더 */}
              <div className="extreme-slider-card">
                <div className="slider-card-top">
                  <span className="slider-card-title">🧲 만유인력 상수 (G)</span>
                  <span className={`slider-card-badge ${(state.conditions?.gravityMultiplier ?? 1.0) < 0 ? 'badge-anti' : ''}`}>
                    {(state.conditions?.gravityMultiplier ?? 1.0) < 0
                      ? `반중력 (${(state.conditions?.gravityMultiplier ?? 1.0).toFixed(1)}x)`
                      : `${(state.conditions?.gravityMultiplier ?? 1.0).toFixed(1)}x`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="5.0"
                  step="0.1"
                  value={state.conditions?.gravityMultiplier ?? 1.0}
                  onChange={(e) => handleConditionSlider('gravity', Number(e.target.value))}
                  className="extreme-slider"
                  aria-label="만유인력 상수 G 배율"
                />
                <div className="slider-card-labels">
                  <span onClick={() => handleConditionSlider('gravity', -1.0)} className="preset-label">척력(-1x)</span>
                  <span onClick={() => handleConditionSlider('gravity', 0.0)} className="preset-label">무중력(0x)</span>
                  <span onClick={() => handleConditionSlider('gravity', 1.0)} className="preset-label reset-mark">표준(1x)</span>
                  <span onClick={() => handleConditionSlider('gravity', 5.0)} className="preset-label">초중력(5x)</span>
                </div>
              </div>

              {/* 태양 질량 M 슬라이더 */}
              <div className="extreme-slider-card">
                <div className="slider-card-top">
                  <span className="slider-card-title">☀️ 태양 질량 (M⊙)</span>
                  <span className="slider-card-badge">{(state.conditions?.sunMassMultiplier ?? 1.0).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="15.0"
                  step="0.5"
                  value={state.conditions?.sunMassMultiplier ?? 1.0}
                  onChange={(e) => handleConditionSlider('sunMass', Number(e.target.value))}
                  className="extreme-slider"
                  aria-label="태양 질량 배율"
                />
                <div className="slider-card-labels">
                  <span onClick={() => handleConditionSlider('sunMass', 0.0)} className="preset-label">소멸(0x)</span>
                  <span onClick={() => handleConditionSlider('sunMass', 1.0)} className="preset-label reset-mark">표준(1x)</span>
                  <span onClick={() => handleConditionSlider('sunMass', 5.0)} className="preset-label">거대(5x)</span>
                  <span onClick={() => handleConditionSlider('sunMass', 15.0)} className="preset-label">극대(15x)</span>
                </div>
              </div>

              {/* 공전 속도 v 슬라이더 */}
              <div className="extreme-slider-card">
                <div className="slider-card-top">
                  <span className="slider-card-title">🚀 공전 속도 (v)</span>
                  <span className="slider-card-badge">{(state.conditions?.orbitSpeedMultiplier ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.05"
                  value={state.conditions?.orbitSpeedMultiplier ?? 1.0}
                  onChange={(e) => handleConditionSlider('orbitSpeed', Number(e.target.value))}
                  className="extreme-slider"
                  aria-label="공전 속도 배율"
                />
                <div className="slider-card-labels">
                  <span onClick={() => handleConditionSlider('orbitSpeed', 0.0)} className="preset-label">정지(0x)</span>
                  <span onClick={() => handleConditionSlider('orbitSpeed', 1.0)} className="preset-label reset-mark">표준(1x)</span>
                  <span onClick={() => handleConditionSlider('orbitSpeed', 1.41)} className="preset-label">탈출(√2x)</span>
                  <span onClick={() => handleConditionSlider('orbitSpeed', 2.5)} className="preset-label">초광속(2.5x)</span>
                </div>
              </div>
            </div>

            {/* 6대 우주 극한 변칙 토글 버튼 */}
            <div className="anomalies-rack">
              {EXTREME_ANOMALIES.map((anom) => {
                const active = !!state.conditions?.[anom.key];
                return (
                  <button
                    key={anom.key}
                    className={`anomaly-btn ${active ? 'active' : ''}`}
                    onClick={() => handleToggleAnomaly(anom.key)}
                    title={anom.desc}
                  >
                    <span className="anomaly-emoji">{anom.emoji}</span>
                    <div className="anomaly-text-group">
                      <span className="anomaly-label">{anom.label}</span>
                      <span className="anomaly-subdesc">{anom.desc}</span>
                    </div>
                    <span className={`anomaly-indicator ${active ? 'on' : ''}`}>
                      {active ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="experiments-top">
          <span className="experiments-label">만약에…?</span>
          <div className="category-tabs" role="tablist" aria-label="실험 종류 선택">
            <button
              className={`category-tab ${category === 'all' ? 'on' : ''}`}
              onClick={() => setCategory('all')}
            >
              ✨ 전체
            </button>
            <button
              className={`category-tab ${category === 'solar' ? 'on' : ''}`}
              onClick={() => setCategory('solar')}
            >
              🪐 태양계 실험
            </button>
            <button
              className={`category-tab category-tab-bh ${category === 'blackhole' ? 'on' : ''}`}
              onClick={() => setCategory('blackhole')}
            >
              🕳️ 블랙홀 실험
            </button>
            <button
              className={`category-tab category-tab-galaxy ${category === 'galaxy' ? 'on' : ''}`}
              onClick={() => setCategory('galaxy')}
            >
              🌌 은하·천계 충돌
            </button>
            <button
              className={`category-tab category-tab-asteroid ${category === 'asteroid' ? 'on' : ''}`}
              onClick={() => setCategory('asteroid')}
            >
              ☄️ 소행성 충돌 실험
            </button>
            <button
              className={`category-tab category-tab-constellation ${category === 'constellation' ? 'on' : ''}`}
              onClick={() => setCategory('constellation')}
            >
              ✨ 3D 별자리
            </button>
          </div>
        </div>

        <div className="experiments-row">
          {visibleScenarios.map((sc) => (
            <button
              key={sc.id}
              id={`exp-${sc.id}`}
              className={`btn exp ${sc.id === 'reset' ? 'exp-reset' : ''} ${sc.category === 'blackhole' ? 'exp-blackhole' : ''} ${sc.category === 'galaxy' ? 'exp-galaxy' : ''} ${sc.category === 'asteroid' ? 'exp-asteroid' : ''} ${sc.category === 'constellation' ? 'exp-constellation' : ''}`}
              onClick={() => runScenario(sc)}
            >
              <span className="exp-emoji">{sc.emoji}</span>
              <span className="exp-label">{sc.label}</span>
            </button>
          ))}
        </div>
      </footer>

      <SpawnPlanetModal
        isOpen={spawnModalOpen}
        onClose={() => setSpawnModalOpen(false)}
        onRunCommands={runCommands}
        onStartMousePlacement={handleStartMousePlacement}
        onSpawnSuccess={(planetName) => {
          const s = stateRef.current;
          const newBody = s.bodies[s.bodies.length - 1];
          if (newBody) {
            setSelected(newBody.id);
            sceneRef.current?.focusBody(newBody.id);
          }
          setToast({
            key: Date.now(),
            emoji: '🪐✨',
            text: `신규 천체 [${planetName}]이(가) 안정적인 원궤도에 성공적으로 배치되었습니다!`,
            type: 'normal',
          });
        }}
      />

      {/* 우주비행사 블랙홀 낙하 & 스파게티화 전용 시뮬레이션 모드 */}
      {simMode === 'spaghetti' && (
        <BlackHoleSpaghettiSim onBackToSolar={() => setSimMode('solar')} />
      )}

      {/* 3D 입체 별자리 탐험 전용 시뮬레이션 모드 */}
      {simMode === 'constellation' && (
        <ConstellationSim onBackToSolar={() => setSimMode('solar')} />
      )}

      {/* 은하 대충돌 & 심우주 전용 시뮬레이션 모드 */}
      {simMode === 'galaxy' && (
        <GalaxyCollisionSim
          onBackToSolar={() => setSimMode('solar')}
          initialScenario={galaxyScenario}
        />
      )}
    </div>
  );
}

function InfoCard({ state, id, onClose }: { state: SimState; id: string; onClose: () => void }) {
  const body = findBody(state, id);
  if (!body) return null;
  const isBlackHole = id.includes('black_hole');
  const isAsteroid = id.includes('asteroid') || id.includes('fragment');
  const isGiant = id.includes('giant');
  const isFragment = id.includes('fragment');
  const info = BODY_INFO[id as BodyId] ?? (
    isBlackHole
      ? BODY_INFO['black_hole']
      : isFragment
      ? BODY_INFO['fragment']
      : isAsteroid
      ? (isGiant ? BODY_INFO['giant_asteroid'] : BODY_INFO['asteroid'])
      : { emoji: '🪐', color: '#999999', lines: ['우주의 천체야!'] }
  );

  const centerBody = findBody(state, 'sun') ?? findBody(state, 'black_hole') ?? findBody(state, 'giant_black_hole');
  const rv = centerBody && centerBody !== body ? centerBody.velocity : [0, 0, 0];
  const speed = length([body.velocity[0] - rv[0], body.velocity[1] - rv[1], body.velocity[2] - rv[2]]) * AU_PER_DAY_TO_KM_S;
  const ratio = body.mass / EARTH_MASS;
  const ratioText = ratio >= 10 ? Math.round(ratio).toLocaleString('ko-KR') : ratio >= 0.01 ? String(+ratio.toFixed(2)) : ratio.toExponential(2);

  return (
    <aside className="card" style={{ ['--accent' as string]: info.color }}>
      <button className="card-close" onClick={onClose} aria-label="닫기">
        ✕
      </button>
      <div className="card-head">
        <span className="card-emoji">{info.emoji}</span>
        <h2>{body.name}</h2>
      </div>
      {info.lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
      <div className="chips">
        <span className="chip">⚖️ 지구 무게의 {ratioText}배</span>
        {body.id !== 'sun' && !body.id.includes('black_hole') && <span className="chip">💨 1초에 {Math.round(speed)}km</span>}
        {isBlackHole && <span className="chip chip-bh">🕳️ 사건의 지평선</span>}
        {isAsteroid && <span className="chip chip-ast">☄️ 소행성 충돌체</span>}
        {isFragment && <span className="chip chip-frag">💥 행성 폭발 파편</span>}
      </div>

      {isBlackHole && (
        <div className="swallowed-panel">
          <div className="swallowed-title">
            🍽️ 삼킨 천체 <strong>{state.swallowedList.length}개</strong>
          </div>
          <div className="swallowed-tags">
            {state.swallowedList.length === 0 ? (
              <span className="swallowed-empty">아직 안전해! 아무것도 삼키지 않았어.</span>
            ) : (
              state.swallowedList.map((s, idx) => (
                <span key={idx} className="swallowed-tag">
                  {s.emoji} {s.name}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
