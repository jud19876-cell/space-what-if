import { useEffect, useRef, useState } from 'react';
import { BH_PRESETS, schwarzschildRadius, SUN_KG, type SubjectKind } from './blackholePhysics.ts';
import {
  createBlackHoleSimScene,
  MAX_X,
  MIN_X,
  type BhCameraView,
  type BhSimState,
  type BlackHoleSimScene,
  type Observer,
} from './blackholeSimScene.ts';

interface BlackHoleSimProps {
  onBackToSolar: () => void;
}

interface ScenarioDef {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  apply: { preset: string; subject: SubjectKind; x: number; observer: Observer; view: BhCameraView; rays: boolean; markers: boolean; play: boolean };
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: 'stellar',
    emoji: '🌟',
    title: '작은 블랙홀에 다가가면?',
    summary: '태양 10배 블랙홀(지름 약 59km). 지평선 수천 km 밖에서부터 발끝이 머리보다 훨씬 세게 당겨져 몸이 국수처럼 늘어나요.',
    apply: { preset: 'stellar', subject: 'astronaut', x: 300, observer: 'far', view: 'follow', rays: false, markers: true, play: true },
  },
  {
    id: 'sgrA',
    emoji: '🌌',
    title: '거대한 블랙홀은 오히려 안전?',
    summary: '우리은하 중심의 궁수자리 A*(태양 430만 배). 너무 커서 머리와 발의 당김 차이가 거의 없어요. 우주인은 멀쩡히 지평선을 넘지만… 다시는 나올 수 없어요.',
    apply: { preset: 'sgrA', subject: 'astronaut', x: 30, observer: 'self', view: 'follow', rays: false, markers: true, play: true },
  },
  {
    id: 'tde',
    emoji: '💫',
    title: '별이 찢겨요 (조석 파괴)',
    summary: '태양 같은 별이 궁수자리 A*에 약 9rₛ까지 다가가면 갈가리 찢겨요. 찢긴 가스는 블랙홀을 돌며 밝게 빛나서, 망원경으로 실제 관측돼요!',
    apply: { preset: 'sgrA', subject: 'star', x: 45, observer: 'far', view: 'follow', rays: false, markers: true, play: true },
  },
  {
    id: 'light',
    emoji: '🔦',
    title: '빛도 휘어져요',
    summary: '블랙홀 옆을 지나는 빛의 길이에요. 2.6rₛ보다 가까이 오는 빛(주황)은 삼켜지고, 그 경계 근처의 빛(노랑)은 블랙홀을 한 바퀴 돌기도 해요.',
    apply: { preset: 'stellar', subject: 'astronaut', x: 260, observer: 'far', view: 'overview', rays: true, markers: false, play: false },
  },
  {
    id: 'time',
    emoji: '⏱️',
    title: '친구 눈에는 멈춰 보여요',
    summary: '멀리 있는 친구가 보면 우주인은 지평선 바로 앞에서 점점 느려지다 멈춘 것처럼 보여요. 우주인 본인에게는 시간이 평소대로 흘러서 그냥 지나가요. 아래 "관찰자"를 바꿔 보세요!',
    apply: { preset: 'sgrA', subject: 'astronaut', x: 8, observer: 'far', view: 'follow', rays: false, markers: true, play: true },
  },
  {
    id: 'noodle',
    emoji: '🍝',
    title: '진짜 스파게티 실험',
    summary: '스파게티화라는 이름처럼 진짜 스파게티를 던져 보면? 면발이 블랙홀 쪽으로 쭈욱 늘어나고 소스와 미트볼까지 실처럼 풀려요.',
    apply: { preset: 'stellar', subject: 'noodle', x: 300, observer: 'far', view: 'follow', rays: false, markers: false, play: true },
  },
];

const STAGE_TEXT: Record<SubjectKind, Record<1 | 2 | 3 | 4 | 5, [string, string]>> = {
  astronaut: {
    1: ['편안한 우주 유영', '중력은 세지만, 머리와 발에 걸리는 힘의 차이(조석력)가 아직 작아서 몸은 멀쩡해요.'],
    2: ['발끝이 당겨져요', '발이 머리보다 블랙홀에 조금 더 가까워서 더 세게 당겨져요. 몸이 살짝 늘어나기 시작해요.'],
    3: ['스파게티화!', '머리–발 당김 차이가 몸이 버티는 한계(약 50g)를 넘었어요. 몸이 블랙홀 쪽으로 길어지고 옆으로는 가늘어져요.'],
    4: ['원자 흐름으로 풀려요', '더는 버틸 수 없을 만큼 찢겨, 몸을 이루던 원자들이 실처럼 흘러나와 블랙홀 주위를 돌며 빨려 들어가요.'],
    5: ['사건의 지평선 안쪽', '빛조차 빠져나올 수 없는 영역이에요. 밖에서는 더 이상 볼 수 없고, 모든 길이 중심(특이점)으로만 향해요.'],
  },
  star: {
    1: ['평범하게 빛나는 별', '별은 자기 중력으로 동그랗게 뭉쳐 있어요. 아직 블랙홀의 조석력보다 별의 중력이 훨씬 세요.'],
    2: ['별이 찌그러져요', '블랙홀 쪽과 반대쪽이 다르게 당겨져서 별이 럭비공처럼 길쭉해져요.'],
    3: ['조석 파괴 시작!', '블랙홀의 조석력이 별의 중력을 이겼어요. 별 표면의 가스가 블랙홀 쪽으로 뜯겨 나가요.'],
    4: ['별이 갈가리 찢겨요 (TDE)', '별 전체가 긴 가스 줄기로 풀려요. 그중 절반은 블랙홀을 돌며 원반을 만들고 몇 달 동안 밝게 빛나요.'],
    5: ['지평선 안으로', '남은 가스가 사건의 지평선을 넘어 사라졌어요.'],
  },
  noodle: {
    1: ['둥둥 떠 있는 스파게티', '아직은 맛있어 보이는 평범한 스파게티 한 접시예요. 🍝'],
    2: ['면발이 늘어나요', '블랙홀 쪽 면발 끝이 먼저 당겨지면서 쭈욱 늘어나기 시작해요.'],
    3: ['진짜 스파게티화!', '면발이 실처럼 가늘고 길어져요. 미트볼도 길쭉해졌어요!'],
    4: ['소스까지 풀려요', '면·소스·미트볼이 모두 원자 흐름이 되어 블랙홀로 빨려 들어가요.'],
    5: ['사라진 저녁 식사', '스파게티가 사건의 지평선을 넘었어요. 다시는 먹을 수 없어요… 😢'],
  },
};

function sliderToX(v: number): number {
  return MIN_X * Math.pow(MAX_X / MIN_X, v / 1000);
}
function xToSlider(x: number): number {
  return (Math.log(Math.max(MIN_X, x) / MIN_X) / Math.log(MAX_X / MIN_X)) * 1000;
}

function formatKm(km: number): string {
  if (km >= 1.496e7) return `${(km / 1.496e8).toFixed(km >= 1.496e8 ? 1 : 2)} AU`;
  if (km >= 1e4) return `${Math.round(km / 1e4).toLocaleString('ko-KR')}만 km`;
  if (km >= 1) return `${Math.round(km).toLocaleString('ko-KR')} km`;
  return `${Math.round(km * 1000)} m`;
}

function formatG(g: number): string {
  if (g < 0.001) return `${g.toExponential(1)} g`;
  if (g < 10) return `${g.toFixed(g < 1 ? 3 : 1)} g`;
  if (g < 1e6) return `${Math.round(g).toLocaleString('ko-KR')} g`;
  return `${g.toExponential(1)} g`;
}

export default function BlackHoleSim({ onBackToSolar }: BlackHoleSimProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BlackHoleSimScene | null>(null);
  const [state, setState] = useState<BhSimState | null>(null);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<BhCameraView>('follow');
  const [rays, setRays] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [scenarioId, setScenarioId] = useState('stellar');
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const sc = createBlackHoleSimScene(containerRef.current, (s) => setState(s));
    sceneRef.current = sc;
    return () => {
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  const sc = () => sceneRef.current;

  const runScenario = (def: ScenarioDef) => {
    const a = def.apply;
    setScenarioId(def.id);
    sc()?.setPreset(a.preset);
    sc()?.setSubject(a.subject);
    sc()?.setObserver(a.observer);
    sc()?.reset(a.x);
    sc()?.setCameraView(a.view);
    sc()?.setShowLightRays(a.rays);
    sc()?.setShowMarkers(a.markers);
    sc()?.setPlaying(a.play);
    setView(a.view);
    setRays(a.rays);
    setMarkers(a.markers);
  };

  const preset = BH_PRESETS[state?.presetId ?? 'stellar'];
  const rsKm = schwarzschildRadius(preset.massSuns * SUN_KG) / 1000;
  const subject = state?.subject ?? 'astronaut';
  const stage = state?.stage ?? 1;
  let [stageTitle, stageDesc] = STAGE_TEXT[subject][stage];
  if (state?.frozenAtHorizon) {
    stageTitle = '지평선 앞에서 멈춘 것처럼 보여요';
    stageDesc = '멀리서 보면 빛이 점점 늦게, 점점 붉게 도착해서 영원히 떨어지는 중인 것처럼 보여요. 아래 관찰자를 "우주인 본인"으로 바꾸면 계속 떨어져요.';
  } else if (state?.reachedSingularity) {
    stageTitle = '특이점에 도달했어요';
    stageDesc = '지평선 안쪽에서는 모든 방향이 중심을 향해요. 지금의 물리학으로는 이 안에서 무슨 일이 일어나는지 아직 아무도 몰라요.';
  }
  const curScenario = SCENARIOS.find((s) => s.id === scenarioId);
  const tidalG = state?.tidalG ?? 0;
  const meter = Math.max(0, Math.min(100, ((Math.log10(Math.max(tidalG, 1e-6)) + 6) / 14) * 100));
  const xNow = state?.x ?? 300;

  return (
    <div className="bh-sim-root">
      <div ref={containerRef} className="bh-canvas" />

      <header className="bh-header">
        <button className="btn btn-back-solar" onClick={onBackToSolar}>
          <span>🌌</span>
          <strong>태양계로 돌아가기</strong>
        </button>
        <div className="bh-title">
          <span className="bh-title-icon">🕳️</span>
          <div>
            <h1>블랙홀 시뮬레이션</h1>
            <span>가까이 가면 무슨 일이 생길까? · 조석력 · 시간 지연 · 빛의 휨</span>
          </div>
        </div>
        <div className="bh-subject-switch" role="tablist" aria-label="실험체 선택">
          {(
            [
              ['astronaut', '🧑‍🚀 우주인'],
              ['star', '⭐ 별'],
              ['noodle', '🍝 스파게티'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={subject === k ? 'active' : ''}
              onClick={() => {
                sc()?.setSubject(k);
                sc()?.reset(xNow > 1.01 ? xNow : 300);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* 왼쪽: 블랙홀 정보 · 조석력 · 시계 */}
      <aside className="bh-hud">
        <div className="bh-card">
          <div className="bh-info-title">🕳️ {preset.name}</div>
          <div className="bh-row">
            <span>사건의 지평선 반지름 (rₛ)</span>
            <strong>{formatKm(rsKm)}</strong>
          </div>
          <div className="bh-row">
            <span>지금 거리</span>
            <strong>
              {xNow < 1 ? '지평선 안' : `${xNow.toFixed(xNow < 10 ? 2 : 0)} rₛ`} <small>({formatKm(Math.max(0, xNow) * rsKm)})</small>
            </strong>
          </div>
        </div>

        <div className="bh-card">
          <div className="bh-info-title">{subject === 'star' ? '↕️ 별 앞뒤 당김 차이 (조석력)' : '↕️ 머리–발 당김 차이 (조석력)'}</div>
          <div className="bh-big">{formatG(tidalG)}</div>
          <div className="bh-meter">
            <div className="bh-meter-fill" style={{ width: `${meter}%` }} />
            {subject !== 'star' && (
              <span className="bh-meter-mark" style={{ left: `${((Math.log10(50) + 6) / 14) * 100}%` }} title="우주인이 버티는 한계 (약 50g)" />
            )}
          </div>
          <div className="bh-meter-scale">
            <span>0.000001g</span>
            <span>{subject === 'star' ? `별 자체 중력 대비 ${(state?.q ?? 0) < 0.01 ? '1% 미만' : `${Math.round((state?.q ?? 0) * 100).toLocaleString('ko-KR')}%`}` : '│50g 한계'}</span>
            <span>1억 g</span>
          </div>
          <div className="bh-row">
            <span>몸 늘어남</span>
            <strong>{(state?.stretch ?? 1).toFixed(1)}배</strong>
          </div>
        </div>

        <div className="bh-card">
          <div className="bh-info-title">⏱️ 시간 지연 (일반 상대성 이론)</div>
          <div className="bh-row">
            <span>🌍 멀리 있는 친구 시계</span>
            <strong className="mono">{(state?.farClock ?? 0).toFixed(1)}초</strong>
          </div>
          <div className="bh-row">
            <span>{subject === 'star' ? '⭐ 별의 시계' : subject === 'noodle' ? '🍝 스파게티 시계' : '🧑‍🚀 우주인 시계'}</span>
            <strong className="mono">{(state?.subjectClock ?? 0).toFixed(1)}초</strong>
          </div>
          <div className="bh-row">
            <span>시간이 흐르는 빠르기 (밖에서 볼 때)</span>
            <strong>{((state?.timeFactor ?? 1) * 100).toFixed(1)}%</strong>
          </div>
        </div>
      </aside>

      {/* 가운데 위: 현재 단계 */}
      <div className={`bh-stage stage-${state?.frozenAtHorizon || state?.reachedSingularity ? 5 : stage}`}>
        <span className="bh-stage-tag">
          {state?.frozenAtHorizon ? '⏸️ 멀리서 본 모습' : state?.reachedSingularity ? '⚫ 특이점' : `${stage}단계`}
        </span>
        <h2>{stageTitle}</h2>
        <p>{stageDesc}</p>
      </div>

      {/* 오른쪽: 이해를 돕는 시나리오 */}
      <aside className={`bh-scenarios ${panelOpen ? 'open' : 'closed'}`}>
        <button className="bh-panel-toggle" onClick={() => setPanelOpen((v) => !v)}>
          {panelOpen ? '🧪 블랙홀 실험 목록 ▶' : '◀ 🧪 실험'}
        </button>
        {panelOpen && (
          <>
            <div className="bh-scenario-list">
              {SCENARIOS.map((s) => (
                <button key={s.id} className={`bh-scenario ${scenarioId === s.id ? 'active' : ''}`} onClick={() => runScenario(s)}>
                  <span className="bh-scenario-emoji">{s.emoji}</span>
                  <span className="bh-scenario-title">{s.title}</span>
                </button>
              ))}
            </div>
            {curScenario && (
              <div className="bh-scenario-explain">
                <strong>
                  {curScenario.emoji} {curScenario.title}
                </strong>
                <p>{curScenario.summary}</p>
              </div>
            )}
          </>
        )}
      </aside>

      {/* 아래: 조작 */}
      <footer className="bh-controls">
        <div className="bh-controls-row">
          <button className={`btn bh-play ${state?.playing ? 'playing' : ''}`} onClick={() => sc()?.setPlaying(!state?.playing)}>
            {state?.playing ? '⏸️ 멈추기' : '▶️ 블랙홀로 떨어지기'}
          </button>
          <button className="btn bh-reset" onClick={() => sc()?.reset(300)}>
            🔄 처음 위치
          </button>

          <div className="bh-slider">
            <div className="bh-slider-labels">
              <span>🕳️ 지평선 (1rₛ)</span>
              <span>거리 (로그 눈금)</span>
              <span>{MAX_X}rₛ 🚀</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={xToSlider(xNow)}
              onChange={(e) => sc()?.setDistance(sliderToX(Number(e.target.value)))}
              aria-label="블랙홀까지 거리"
            />
          </div>

          <div className="bh-chips" aria-label="재생 속도">
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                className={speed === s ? 'active' : ''}
                onClick={() => {
                  setSpeed(s);
                  sc()?.setSpeed(s);
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="bh-controls-row">
          <div className="bh-chips" aria-label="카메라">
            {(
              [
                ['follow', '🎥 따라가기'],
                ['pov', '👀 우주인 눈으로'],
                ['overview', '🔭 전체 보기'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={view === v ? 'active' : ''}
                onClick={() => {
                  setView(v);
                  sc()?.setCameraView(v);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bh-chips" aria-label="관찰자">
            <span className="bh-chip-label">관찰자</span>
            {(
              [
                ['far', '🌍 멀리 있는 친구'],
                ['self', '🧑‍🚀 우주인 본인'],
              ] as const
            ).map(([o, label]) => (
              <button key={o} className={state?.observer === o ? 'active' : ''} onClick={() => sc()?.setObserver(o)}>
                {label}
              </button>
            ))}
          </div>

          <div className="bh-chips" aria-label="보기 옵션">
            <button
              className={rays ? 'active' : ''}
              onClick={() => {
                setRays(!rays);
                sc()?.setShowLightRays(!rays);
              }}
            >
              🔦 빛의 길
            </button>
            <button
              className={markers ? 'active' : ''}
              onClick={() => {
                setMarkers(!markers);
                sc()?.setShowMarkers(!markers);
              }}
            >
              📏 거리 표지
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
