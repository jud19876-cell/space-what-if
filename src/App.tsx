import { useCallback, useEffect, useRef, useState } from 'react';
import { AU_PER_DAY_TO_KM_S, length } from './physics.ts';
import { createSpaceScene, type SpaceScene } from './scene.ts';
import { SCENARIOS, type Scenario, type ScenarioCategory } from './scenarios.ts';
import { createInitialState, executeCommand, findBody, type SimCommand, type SimState, type Speed } from './simulation.ts';
import { BODY_INFO, EARTH_MASS, type BodyId } from './solarSystem.ts';

const SPEEDS: { speed: Speed; icon: string }[] = [
  { speed: 1, icon: '🐢' },
  { speed: 10, icon: '🐇' },
  { speed: 100, icon: '🚀' },
];

export default function App() {
  const stateRef = useRef<SimState>(createInitialState());
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SpaceScene | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; emoji: string; text: string } | null>(null);
  const [hinted, setHinted] = useState(false);
  const [category, setCategory] = useState<ScenarioCategory>('all');
  const [, setTick] = useState(0);

  useEffect(() => {
    const sc = createSpaceScene(
      containerRef.current!,
      () => stateRef.current,
      (id) => {
        setSelected(id);
        if (id) setHinted(true);
      },
      (ev) => {
        setToast({
          key: Date.now(),
          emoji: '🕳️💥',
          text: `앗! ${ev.swallowedName}이(가) ${ev.blackHoleName}에 빨려 들어가 삼켜졌어!`,
        });
        setSelected((cur) => (cur === ev.swallowedId ? null : cur));
        setTick((t) => t + 1);
      },
    );
    sceneRef.current = sc;
    const iv = setInterval(() => setTick((t) => t + 1), 250); // 정보 카드/시간 갱신
    return () => {
      clearInterval(iv);
      sc.dispose();
    };
  }, []);

  useEffect(() => sceneRef.current?.setSelected(selected), [selected]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /** 모든 상태 변경은 여기서 Simulation Command 로만 한다. (나중에 AI 도 이 함수를 쓴다) */
  const runCommands = useCallback((commands: SimCommand[]) => {
    const s = stateRef.current;
    for (const c of commands) {
      executeCommand(s, c);
      if (c.action === 'reset') sceneRef.current?.clearTrails();
    }
    setSelected((id) => (id && findBody(s, id) ? id : null));
    setTick((t) => t + 1);
  }, []);

  const runScenario = (sc: Scenario) => {
    runCommands(sc.commands);
    setToast({ key: Date.now(), emoji: sc.emoji, text: sc.message });
  };

  const state = stateRef.current;
  const years = state.time / 365.25;

  const visibleScenarios = SCENARIOS.filter((sc) => {
    if (category === 'all') return true;
    if (sc.id === 'reset') return true;
    return sc.category === category;
  });

  return (
    <div className="app">
      <div className="space" ref={containerRef} />

      <header className="topbar">
        <h1 className="title">
          <span className="title-icon">🚀</span> 우주 실험실
        </h1>
        <div className="clock" title="지구 시간">
          📅 {years < 1 ? `${Math.floor(state.time)}일` : `${years.toFixed(1)}년`}
        </div>
        <div className="controls">
          <button
            id="btn-pause"
            className={`btn round ${state.paused ? 'play' : ''}`}
            onClick={() => runCommands([{ action: state.paused ? 'resume' : 'pause' }])}
            aria-label={state.paused ? '다시 움직이기' : '멈추기'}
          >
            {state.paused ? '▶️' : '⏸️'}
          </button>
          <div className="speed" role="group" aria-label="시간 빠르기">
            {SPEEDS.map((s) => (
              <button
                key={s.speed}
                id={`btn-speed-${s.speed}`}
                className={`btn speed-btn ${state.speed === s.speed ? 'on' : ''}`}
                onClick={() => runCommands([{ action: 'set_speed', speed: s.speed }])}
              >
                <span>{s.icon}</span>
                <small>{s.speed}x</small>
              </button>
            ))}
          </div>
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

      {selected && <InfoCard state={state} id={selected} onClose={() => setSelected(null)} />}

      {!hinted && !selected && <div className="hint">👆 행성이나 블랙홀을 눌러 봐!</div>}

      {toast && (
        <div className="toast" key={toast.key}>
          <span className="toast-emoji">{toast.emoji}</span>
          {toast.text}
        </div>
      )}

      <footer className="experiments">
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
          </div>
        </div>

        <div className="experiments-row">
          {visibleScenarios.map((sc) => (
            <button
              key={sc.id}
              id={`exp-${sc.id}`}
              className={`btn exp ${sc.id === 'reset' ? 'exp-reset' : ''} ${sc.category === 'blackhole' ? 'exp-blackhole' : ''}`}
              onClick={() => runScenario(sc)}
            >
              <span className="exp-emoji">{sc.emoji}</span>
              <span className="exp-label">{sc.label}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

function InfoCard({ state, id, onClose }: { state: SimState; id: string; onClose: () => void }) {
  const body = findBody(state, id);
  if (!body) return null;
  const isBlackHole = id.includes('black_hole');
  const info = BODY_INFO[id as BodyId] ?? (isBlackHole ? BODY_INFO['black_hole'] : { emoji: '🪐', color: '#999999', lines: ['우주의 천체야!'] });
  const centerBody = findBody(state, 'sun') ?? findBody(state, 'black_hole') ?? findBody(state, 'giant_black_hole');
  const rv = centerBody && centerBody !== body ? centerBody.velocity : [0, 0, 0];
  const speed = length([body.velocity[0] - rv[0], body.velocity[1] - rv[1], body.velocity[2] - rv[2]]) * AU_PER_DAY_TO_KM_S;
  const ratio = body.mass / EARTH_MASS;
  const ratioText = ratio >= 10 ? Math.round(ratio).toLocaleString('ko-KR') : ratio >= 1 ? String(+ratio.toFixed(1)) : ratio.toFixed(2);

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
