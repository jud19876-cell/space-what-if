import { useEffect, useRef, useState } from 'react';
import { assessSudden, spinReport } from './earthSpinPhysics.ts';
import { createEarthSpinScene, LOCATIONS, type EarthSpinScene, type LocationKey, type SpinMode, type SpinSimState } from './earthSpinScene.ts';

interface EarthSpinSimProps {
  onBackToSolar: () => void;
}

interface SpinScenario {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  location: LocationKey;
  target: number;
  mode: SpinMode;
}

const SCENARIOS: SpinScenario[] = [
  {
    id: 'sudden-stop',
    emoji: '🛑',
    title: '지구가 갑자기 멈춘다면?',
    summary: '땅은 멈췄는데 공기·바다·사람은 원래 속도(서울 시속 약 1,330km)로 계속 동쪽으로 달려요. 소리보다 빠른 충격에 모든 것이 휩쓸려요.',
    location: 'seoul',
    target: 0,
    mode: 'sudden',
  },
  {
    id: 'slow-stop',
    emoji: '🐢',
    title: '지구가 서서히 멈춘다면?',
    summary: '아주 천천히 멈추면 사람은 무사해요. 대신 하루가 끝없이 길어지고, 바다가 극지방으로 몰려 적도에 거대한 대륙이 드러나요.',
    location: 'seoul',
    target: 0,
    mode: 'gradual',
  },
  {
    id: 'fast-2h',
    emoji: '⚡',
    title: '하루가 2시간이 된다면?',
    summary: '지구가 12배 빨리 돌면 적도 쪽으로 바다가 몰려 적도의 땅이 잠기고, 지구가 눈에 띄게 납작해져요. 몸무게도 줄어요.',
    location: 'equator',
    target: 12,
    mode: 'gradual',
  },
  {
    id: 'float',
    emoji: '🎈',
    title: '적도에서 몸이 둥둥 뜨려면?',
    summary: '지구가 약 17배 빨리 돌면(하루 1시간 25분) 적도에서는 원심력이 중력과 같아져 사람·차가 떠올라 우주로 날아가요.',
    location: 'equator',
    target: 17.6,
    mode: 'gradual',
  },
  {
    id: 'sudden-double',
    emoji: '💥',
    title: '갑자기 2배 빨라진다면?',
    summary: '땅이 갑자기 동쪽으로 더 빨리 움직이니, 그 위의 것들은 상대적으로 서쪽으로 내던져져요. 멈출 때와 방향만 반대예요.',
    location: 'seoul',
    target: 2,
    mode: 'sudden',
  },
  {
    id: 'arctic-stop',
    emoji: '❄️',
    title: '북극 근처에서 멈추면?',
    summary: '극에 가까울수록 땅이 도는 속도가 느려요. 스발바르는 시속 약 350km — 적도보다 덜하지만 여전히 초강력 태풍보다 세요.',
    location: 'arctic',
    target: 0,
    mode: 'sudden',
  },
];

// 슬라이더 0~1000 → 자전 배율 0~25 (앞 40% 는 0~1배, 나머지는 1~25배 로그 눈금)
function sliderToRatio(v: number): number {
  if (v <= 400) return v / 400;
  return Math.pow(25, (v - 400) / 600);
}
function ratioToSlider(r: number): number {
  if (r <= 1) return r * 400;
  return 400 + (Math.log(r) / Math.log(25)) * 600;
}

function formatDay(h: number): string {
  if (!isFinite(h)) return '끝없이 (멈춤)';
  if (h >= 48) return `${(h / 24).toFixed(1)}일`;
  if (h >= 1) return `${h.toFixed(1)}시간`;
  return `${Math.round(h * 60)}분`;
}

function phenomenon(s: SpinSimState): { title: string; detail: string; tone: 'calm' | 'warn' | 'danger' } {
  const r = s.report;
  if (s.impactActive && Math.abs(s.impactSpeed) >= 1) {
    const a = assessSudden(s.impactSpeed);
    const dir = s.impactSpeed > 0 ? '동쪽' : '서쪽';
    return { title: `${a.title} (${dir}으로)`, detail: `${a.detail} 🐢 슬로모션 0.04배로 보여요.`, tone: a.level >= 3 ? 'danger' : 'warn' };
  }
  if (s.ratio < 0.002) {
    return {
      title: '자전이 멈췄어요',
      detail: '해가 한 번 뜨고 지는 데 1년이 걸려요(낮과 밤이 각각 약 반년). 바다는 극지방으로 몰려 적도에 거대한 띠 모양 대륙이 드러나요. 낮쪽은 타는 듯 뜨겁고 밤쪽은 얼어붙어요.',
      tone: 'warn',
    };
  }
  if (r.weightRatio <= 0) {
    return {
      title: '둥둥 떠올라요!',
      detail: '원심력이 중력보다 커져서 땅에 묶여 있지 않은 사람과 차가 하늘로 떠올라 우주로 날아가요. 더 빨라지면 나무가 뽑히고 건물도 기초째 뜯겨요.',
      tone: 'danger',
    };
  }
  if (s.ratio < 0.95) {
    return {
      title: '자전이 느려졌어요',
      detail: `하루가 ${formatDay(r.dayHours)}로 길어져요. 바다가 조금씩 극지방으로 이동하고, 태풍을 돌게 하는 힘(전향력)이 약해져요.`,
      tone: 'calm',
    };
  }
  if (s.ratio <= 1.05) {
    return {
      title: '지금의 지구',
      detail: `여기 땅은 지금도 시속 ${Math.round(r.surfaceSpeed * 3.6).toLocaleString('ko-KR')}km로 동쪽으로 돌고 있어요. 함께 돌기 때문에 느끼지 못할 뿐이에요.`,
      tone: 'calm',
    };
  }
  if (r.weightRatio > 0.6) {
    return {
      title: '자전이 빨라졌어요',
      detail: `하루가 ${formatDay(r.dayHours)}. 바다가 적도로 몰려 적도의 땅이 잠기고, 지구가 납작해져요. 낮과 밤이 휙휙 바뀌고 태풍이 더 거세져요.`,
      tone: 'warn',
    };
  }
  return {
    title: '몸이 가벼워져요',
    detail: `원심력 때문에 몸무게가 원래의 ${Math.round(r.weightRatio * 100)}%예요. 한 번 뛰면 높이 오래 떠 있어요. 조금만 더 빨라지면 떠올라요!`,
    tone: 'warn',
  };
}

export default function EarthSpinSim({ onBackToSolar }: EarthSpinSimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const insetRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EarthSpinScene | null>(null);
  const [state, setState] = useState<SpinSimState | null>(null);
  const [slider, setSlider] = useState(ratioToSlider(1));
  const [mode, setMode] = useState<Exclude<SpinMode, 'instant'>>('gradual');
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [bigGround, setBigGround] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = createEarthSpinScene(containerRef.current, (s) => setState(s));
    sc.setInsetElement(insetRef.current);
    sceneRef.current = sc;
    return () => {
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  const apply = (target: number, m: SpinMode) => {
    sceneRef.current?.setRatio(target, m);
    setSlider(ratioToSlider(target));
  };

  const runScenario = (sc: SpinScenario) => {
    setScenarioId(sc.id);
    // 지상 카메라 창을 가리지 않도록 목록은 접고, 설명은 위쪽 안내가 맡는다
    setPanelOpen(false);
    const s = sceneRef.current;
    if (!s) return;
    s.setLocation(sc.location);
    s.setRatio(1, 'instant');
    s.resetGround();
    // 준비 상태(지금의 지구)를 잠깐 보여준 뒤 실험 시작
    window.setTimeout(() => apply(sc.target, sc.mode), 900);
  };

  const r = state?.report ?? spinReport(1, 37.5);
  const loc = LOCATIONS[state?.location ?? 'seoul'];
  const ph = state ? phenomenon(state) : { title: '지금의 지구', detail: '', tone: 'calm' as const };
  const cur = SCENARIOS.find((x) => x.id === scenarioId);
  const isDay = (state?.sunAltitude ?? 1) > 0;
  const sliderRatio = sliderToRatio(slider);

  return (
    <div className="es-root">
      <div ref={containerRef} className="es-canvas" />

      <header className="es-header">
        <button className="btn btn-back-solar" onClick={onBackToSolar}>
          <span>🌌</span>
          <strong>태양계로 돌아가기</strong>
        </button>
        <div className="es-title">
          <span className="es-title-icon">🌍</span>
          <div>
            <h1>지구 자전 실험실</h1>
            <span>지구가 빨리 돌거나 멈추면 사람과 건물은 어떻게 될까?</span>
          </div>
        </div>
        <div className="es-loc" role="group" aria-label="지상 카메라 위치">
          {(Object.keys(LOCATIONS) as LocationKey[]).map((k) => (
            <button key={k} className={state?.location === k ? 'active' : ''} onClick={() => sceneRef.current?.setLocation(k)}>
              {k === 'seoul' ? '🏙️ 서울' : k === 'equator' ? '🌴 적도' : '🧊 북극 근처'}
            </button>
          ))}
        </div>
      </header>

      {/* 왼쪽 계기판 */}
      <aside className="es-hud">
        <div className="es-card">
          <div className="es-card-title">⏱️ 자전 속도</div>
          <div className="es-big">{(state?.ratio ?? 1).toFixed(state && state.ratio < 10 ? 2 : 1)}배</div>
          <div className="es-row">
            <span>하루 길이</span>
            <strong>{formatDay(r.dayHours)}</strong>
          </div>
        </div>
        <div className="es-card">
          <div className="es-card-title">📍 {loc.name} (위도 {loc.lat}°)</div>
          <div className="es-row">
            <span>땅이 도는 속도</span>
            <strong>시속 {Math.round(r.surfaceSpeed * 3.6).toLocaleString('ko-KR')}km</strong>
          </div>
          <div className="es-row">
            <span>몸무게</span>
            <strong className={r.weightRatio <= 0 ? 'danger' : r.weightRatio < 0.7 ? 'warn' : ''}>
              {r.weightRatio <= 0 ? '0 (둥둥!)' : `${Math.round(r.weightRatio * 100)}%`}
            </strong>
          </div>
          <div className="es-meter" aria-hidden="true">
            <div style={{ width: `${Math.max(0, Math.min(100, r.weightRatio * 100))}%` }} />
          </div>
          <div className="es-row">
            <span>둥둥 뜨는 속도</span>
            <strong>{isFinite(r.floatRatio) ? `${r.floatRatio.toFixed(1)}배` : '극에서는 안 떠요'}</strong>
          </div>
        </div>
        <div className="es-card">
          <div className="es-card-title">🌐 지구 모양과 바다</div>
          <div className="es-row">
            <span>납작한 정도</span>
            <strong>{(r.flattening * 100).toFixed(r.flattening < 0.01 ? 2 : 1)}%</strong>
          </div>
          <div className="es-row">
            <span>적도 바닷물 높이</span>
            <strong>{r.seaEquator >= 0 ? '+' : ''}{(r.seaEquator / 1000).toFixed(1)} km</strong>
          </div>
          <div className="es-row">
            <span>극지방 바닷물 높이</span>
            <strong>{r.seaPole >= 0 ? '+' : ''}{(r.seaPole / 1000).toFixed(1)} km</strong>
          </div>
        </div>
      </aside>

      {/* 가운데 위: 지금 일어나는 일 */}
      <div className={`es-banner tone-${ph.tone}`}>
        <h2>{ph.title}</h2>
        <p>{ph.detail}</p>
      </div>

      {/* 오른쪽: 실험 */}
      <aside className={`es-scenarios ${panelOpen ? 'open' : 'closed'}`}>
        <button className="es-panel-toggle" onClick={() => setPanelOpen((v) => !v)}>
          {panelOpen ? '🧪 자전 실험 목록 ▶' : '◀ 🧪 실험'}
        </button>
        {panelOpen && (
          <>
            {SCENARIOS.map((s) => (
              <button key={s.id} className={`es-scenario ${scenarioId === s.id ? 'active' : ''}`} onClick={() => runScenario(s)}>
                <span className="es-scenario-emoji">{s.emoji}</span>
                <span>{s.title}</span>
              </button>
            ))}
            {cur && (
              <div className="es-explain">
                <strong>
                  {cur.emoji} {cur.title}
                </strong>
                <p>{cur.summary}</p>
              </div>
            )}
          </>
        )}
      </aside>

      {/* 지상 카메라 창 (3D 는 캔버스에 이 영역만큼 따로 그려짐) */}
      <div ref={insetRef} className={`es-inset ${bigGround ? 'big' : ''}`}>
        <div className="es-inset-bar">
          <span>
            📹 지상 카메라 · {loc.name} · {isDay ? '☀️ 낮' : '🌙 밤'}
          </span>
          <span>
            {state && state.thrown > 0 ? `날아가거나 부서진 것 ${state.thrown}개 · ` : ''}
            {state?.impactActive ? '슬로모션' : '실시간'}
          </span>
          <button onClick={() => setBigGround((v) => !v)} aria-label={bigGround ? '지상 카메라 작게' : '지상 카메라 크게'}>
            {bigGround ? '작게' : '크게'}
          </button>
        </div>
      </div>

      {/* 아래: 조작 */}
      <footer className="es-controls">
        <div className="es-controls-row">
          <div className="es-chips" role="group" aria-label="바뀌는 방식">
            <button className={mode === 'gradual' ? 'active' : ''} onClick={() => setMode('gradual')}>
              🐢 서서히
            </button>
            <button className={mode === 'sudden' ? 'active' : ''} onClick={() => setMode('sudden')}>
              💥 갑자기
            </button>
          </div>
          <div className="es-slider">
            <div className="es-slider-labels">
              <span>멈춤</span>
              <span>지금(1배)</span>
              <span>25배</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              aria-label="목표 자전 속도"
            />
          </div>
          <button className="btn es-apply" onClick={() => apply(sliderRatio, mode)}>
            {mode === 'sudden' ? '💥' : '🐢'} {sliderRatio < 0.005 ? '멈추기' : `${sliderRatio.toFixed(sliderRatio < 10 ? 2 : 1)}배로 바꾸기`}
          </button>
        </div>
        <div className="es-controls-row">
          <div className="es-chips" role="group" aria-label="빠른 선택">
            {[
              [0, '멈춤'],
              [0.5, '0.5배'],
              [1, '지금'],
              [2, '2배'],
              [5, '5배'],
              [17, '17배'],
            ].map(([v, label]) => (
              <button key={label} onClick={() => apply(v as number, mode)}>
                {label}
              </button>
            ))}
          </div>
          <button
            className="btn es-reset"
            onClick={() => {
              setScenarioId(null);
              sceneRef.current?.setRatio(1, 'instant');
              sceneRef.current?.resetGround();
              setSlider(ratioToSlider(1));
            }}
          >
            ↺ 처음 상태로
          </button>
        </div>
      </footer>
    </div>
  );
}
