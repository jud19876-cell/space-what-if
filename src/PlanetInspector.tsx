import React, { useState } from 'react';
import { AU_PER_DAY_TO_KM_S, isBlackHoleBody, length } from './physics.ts';
import { findBody, type SimCommand, type SimState } from './simulation.ts';
import { BODY_INFO, EARTH_MASS, type BodyId } from './solarSystem.ts';

interface PlanetInspectorProps {
  state: SimState;
  bodyId: string;
  onClose: () => void;
  onRunCommands: (cmds: SimCommand[]) => void;
  onFocusBody: (id: string) => void;
  onResetCamera: () => void;
}

export const PlanetInspector: React.FC<PlanetInspectorProps> = ({
  state,
  bodyId,
  onClose,
  onRunCommands,
  onFocusBody,
  onResetCamera,
}) => {
  const body = findBody(state, bodyId);
  const [customMassInput, setCustomMassInput] = useState('');
  const [customRadiusInput, setCustomRadiusInput] = useState('');

  if (!body) return null;

  const isSun = body.id === 'sun';
  const isBlackHole = isBlackHoleBody(body);
  const baseType = body.typeId || (body.id.startsWith('custom_') ? body.id.split('_')[1] : null);
  const baseInfo = baseType ? BODY_INFO[baseType as BodyId] : undefined;
  const info = BODY_INFO[body.id as BodyId] ?? baseInfo ?? (
    isBlackHole
      ? BODY_INFO['black_hole']
      : { emoji: '🪐', color: '#38bdf8', lines: ['우주의 신비로운 천체입니다.'] }
  );

  const sun = findBody(state, 'sun');
  const distFromSunAU = sun ? length([body.position[0] - sun.position[0], body.position[1] - sun.position[1], body.position[2] - sun.position[2]]) : length(body.position);
  const distMillionKm = distFromSunAU * 149.6;

  const speedAuDay = length(body.velocity);
  const speedKmS = speedAuDay * AU_PER_DAY_TO_KM_S;

  const massRatio = body.mass / EARTH_MASS;
  const massRatioText = massRatio >= 10 ? Math.round(massRatio).toLocaleString('ko-KR') : massRatio >= 0.01 ? String(+massRatio.toFixed(2)) : massRatio.toExponential(2);

  // 질량 직접 적용 핸들러
  const handleApplyCustomMass = (ratioNum: number) => {
    if (isNaN(ratioNum) || ratioNum <= 0) return;
    onRunCommands([{ action: 'set_mass_earth_ratio', target: body.id, ratio: ratioNum }]);
  };

  // 시각 반경 직접 적용 핸들러
  const handleApplyCustomRadius = (radiusNum: number) => {
    if (isNaN(radiusNum) || radiusNum <= 0) return;
    onRunCommands([{ action: 'set_visual_radius', target: body.id, radius: radiusNum }]);
  };

  return (
    <aside className="planet-inspector-panel" style={{ ['--accent' as string]: info.color }}>
      <div className="inspector-header">
        <div className="inspector-title-row">
          <span className="inspector-emoji">{info.emoji}</span>
          <div className="inspector-names">
            <h2>{body.name}</h2>
            <span className="inspector-id">ID: {body.id}</span>
          </div>
        </div>
        <div className="inspector-header-actions">
          <button className="inspector-btn-action focus-btn" onClick={() => onFocusBody(body.id)} title="이 천체 시점 락온 추적">
            🔭 시점 추적
          </button>
          <button className="inspector-btn-action reset-cam-btn" onClick={onResetCamera} title="카메라 전체 조망 복귀">
            🎯 전체 조망
          </button>
          <button className="inspector-close-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
      </div>

      <div className="inspector-desc-box">
        {info.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>

      {/* 실시간 천체 물리 데이터 모니터링 */}
      <div className="inspector-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">☀️ 태양과의 거리</span>
          <strong className="metric-value">{distFromSunAU.toFixed(2)} AU</strong>
          <small className="metric-sub">{distMillionKm.toFixed(1)} 백만 km</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">💨 현재 공전 속도</span>
          <strong className="metric-value">{Math.round(speedKmS)} km/s</strong>
          <small className="metric-sub">{speedAuDay.toFixed(4)} AU/day</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">⚖️ 천체 질량 (무게)</span>
          <strong className="metric-value">지구의 {massRatioText}배</strong>
          <small className="metric-sub">{body.mass.toExponential(2)} kg</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">📐 시각 크기 배율</span>
          <strong className="metric-value">{body.visualRadius.toFixed(2)}x</strong>
          <small className="metric-sub">반경 {body.physicalRadius.toLocaleString('ko-KR')} km</small>
        </div>
      </div>

      {/* 실시간 파라미터 조작 컨트롤 섹션 */}
      <div className="inspector-controls-section">
        <h4 className="controls-section-title">⚡ 실시간 공전 속도 조작</h4>
        <div className="btn-group-row">
          <button
            className="ctrl-chip-btn"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 0.8 }])}
            title="속도를 20% 줄입니다 (궤도가 안쪽으로 수축)"
          >
            -20% 감속
          </button>
          <button
            className="ctrl-chip-btn"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 1.2 }])}
            title="속도를 20% 올립니다 (타원 궤도로 확장)"
          >
            +20% 가속
          </button>
          <button
            className="ctrl-chip-btn"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 1.5 }])}
            title="속도를 1.5배로 올립니다"
          >
            1.5x
          </button>
          <button
            className="ctrl-chip-btn danger"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 2.0 }])}
            title="속도를 2배로 올려 탈출 속도 돌파!"
          >
            🚀 2배 탈출
          </button>
          <button
            className="ctrl-chip-btn stop"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 0.0 }])}
            title="공전 속도를 0으로 멈춰 태양으로 정면 추락"
          >
            🛑 정지 (0)
          </button>
        </div>

        {/* 💥🕳️ 초신성 중력 붕괴 & 블랙홀 각성 이벤트 */}
        <div className={`blackhole-event-card ${isBlackHole ? 'active-bh' : ''}`}>
          <div className="bh-card-header">
            <span className="bh-card-icon">🕳️</span>
            <div className="bh-card-info">
              <strong className="bh-card-title">
                {isBlackHole ? '사건의 지평선 활성화 (블랙홀 각성)' : '초신성 중력 붕괴 & 블랙홀 각성 이벤트'}
              </strong>
              <small className="bh-card-desc">
                {isBlackHole
                  ? '강력한 시공간 왜곡으로 접근하는 모든 천체를 소용돌이치며 빨아들여 삼킵니다!'
                  : '질량이 초거대 임계치에 도달하거나 붕괴를 일으키면 모든 것을 빨아들이는 블랙홀로 변신합니다'}
              </small>
            </div>
          </div>
          {isBlackHole ? (
            <div className="bh-status-panel">
              <div className="bh-swallowed-stat">
                🍽️ 삼킨 천체:{' '}
                <strong>
                  {state.swallowedList.filter((s) => s.by === body.id || s.by === body.name).length}개
                </strong>
              </div>
              <button
                className="btn-restore-planet"
                onClick={() => onRunCommands([{ action: 'restore_from_black_hole', target: body.id }])}
                title="블랙홀 상태를 해제하고 일반 행성 물리 상태로 복원합니다"
              >
                🔄 일반 행성 상태로 복원하기
              </button>
            </div>
          ) : (
            <button
              className="btn-trigger-blackhole"
              onClick={() => onRunCommands([{ action: 'collapse_to_black_hole', target: body.id }])}
              title="이 천체를 즉시 초신성 중력 붕괴시켜 사건의 지평선과 강착원반을 가진 블랙홀로 변신시킵니다"
            >
              💥🕳️ [초신성 중력 붕괴] 즉시 블랙홀로 변신 & 흡수 가동!
            </button>
          )}
        </div>

        {/* 📐 시각 크기(반경) 자유 배수 조절 */}
        <div className="inspector-slider-block">
          <div className="slider-label-row">
            <span className="controls-section-title">📐 시각 크기(반경) 조절</span>
            <span className="slider-current-val">{body.visualRadius.toFixed(2)}x</span>
          </div>

          <div className="multiplier-row">
            <span className="multiplier-sublabel">🚀 누를 때마다 크기 배수 계속 증폭 (누적 곱셈):</span>
            <div className="btn-group-row">
              {[1.2, 1.5, 2.0, 5.0, 10.0, 50.0].map((m) => (
                <button
                  key={m}
                  className="ctrl-chip-btn multiply-btn"
                  onClick={() => onRunCommands([{ action: 'change_visual_radius', target: body.id, multiplier: m }])}
                  title={`현재 크기에 ${m}배를 누적 곱합니다 (계속 커짐)`}
                >
                  ×{m}배
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min="0.1"
            max="40.0"
            step="0.1"
            value={Math.min(40.0, body.visualRadius)}
            onChange={(e) => handleApplyCustomRadius(Number(e.target.value))}
            className="inspector-range-slider"
            aria-label="시각 크기 슬라이더"
          />
          <div className="slider-input-row">
            <input
              type="number"
              min="0.05"
              max="1000.0"
              step="any"
              placeholder="직접 크기 배수 입력 (예: 15.5)"
              value={customRadiusInput}
              onChange={(e) => setCustomRadiusInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApplyCustomRadius(Number(customRadiusInput));
                  setCustomRadiusInput('');
                }
              }}
              className="inspector-num-input"
            />
            <button
              className="ctrl-apply-btn"
              onClick={() => {
                handleApplyCustomRadius(Number(customRadiusInput));
                setCustomRadiusInput('');
              }}
            >
              절대값 적용
            </button>
            <button
              className="ctrl-apply-btn multiply-action-btn"
              onClick={() => {
                const val = Number(customRadiusInput);
                if (!isNaN(val) && val > 0) {
                  onRunCommands([{ action: 'change_visual_radius', target: body.id, multiplier: val }]);
                  setCustomRadiusInput('');
                }
              }}
              title="입력한 배수만큼 현재 크기에 곱합니다"
            >
              ×배수 곱하기
            </button>
          </div>
        </div>

        {/* ⚖️ 질량(무게) 자유 배수 조절 */}
        <div className="inspector-slider-block">
          <div className="slider-label-row">
            <span className="controls-section-title">⚖️ 질량(무게) 조절</span>
            <span className="slider-current-val">지구의 {massRatioText}배 ({body.mass.toExponential(2)} kg)</span>
          </div>

          <div className="multiplier-row">
            <span className="multiplier-sublabel">🚀 누를 때마다 질량 배수 계속 증폭 (누적 곱셈):</span>
            <div className="btn-group-row">
              {[2, 5, 10, 50, 500, 5000].map((m) => (
                <button
                  key={m}
                  className={`ctrl-chip-btn multiply-btn ${m >= 500 ? 'danger-glow' : ''}`}
                  onClick={() => onRunCommands([{ action: 'change_mass', target: body.id, multiplier: m }])}
                  title={`현재 질량에 ${m}배를 누적 곱합니다 (중력이 기하급수적으로 폭증)`}
                >
                  ×{m.toLocaleString()}배
                </button>
              ))}
            </div>
          </div>

          {/* 초광범위 로그 슬라이더: 0.01x ~ 10,000,000x (30배 태양 질량) */}
          <input
            type="range"
            min="-2"
            max="7.0"
            step="0.05"
            value={Math.log10(Math.max(0.01, massRatio))}
            onChange={(e) => handleApplyCustomMass(Math.pow(10, Number(e.target.value)))}
            className="inspector-range-slider"
            aria-label="질량 로그 슬라이더"
          />
          <div className="slider-input-row">
            <input
              type="number"
              min="0.001"
              max="100000000"
              step="any"
              placeholder="지구 대비 배수 입력 (예: 50000)"
              value={customMassInput}
              onChange={(e) => setCustomMassInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApplyCustomMass(Number(customMassInput));
                  setCustomMassInput('');
                }
              }}
              className="inspector-num-input"
            />
            <button
              className="ctrl-apply-btn"
              onClick={() => {
                handleApplyCustomMass(Number(customMassInput));
                setCustomMassInput('');
              }}
            >
              절대값 적용
            </button>
            <button
              className="ctrl-apply-btn multiply-action-btn"
              onClick={() => {
                const val = Number(customMassInput);
                if (!isNaN(val) && val > 0) {
                  onRunCommands([{ action: 'change_mass', target: body.id, multiplier: val }]);
                  setCustomMassInput('');
                }
              }}
              title="입력한 숫자만큼 현재 질량에 곱합니다"
            >
              ×배수 곱하기
            </button>
          </div>
          <div className="btn-group-row">
            {[
              { val: 0.01, label: '0.01x(왜소)' },
              { val: 1.0, label: '1x(지구)' },
              { val: 318.0, label: '318x(목성)' },
              { val: 333000.0, label: '33만x(태양급)' },
              { val: 1000000.0, label: '100만x(초중력)' },
              { val: 10000000.0, label: '1천만x(괴물별)' },
            ].map(({ val, label }) => (
              <button
                key={val}
                className="ctrl-chip-btn"
                onClick={() => handleApplyCustomMass(val)}
                title={`질량을 지구의 ${val}배로 설정`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!isSun && (
          <>
            <h4 className="controls-section-title">🛸 궤도 반경 (태양과의 거리 AU)</h4>
            <div className="btn-group-row">
              <button
                className="ctrl-chip-btn"
                onClick={() => onRunCommands([{ action: 'change_orbit_distance', target: body.id, deltaAU: -0.2 }])}
                title="태양 쪽으로 0.2 AU 가까이 이동"
              >
                안쪽으로 (-0.2AU)
              </button>
              <button
                className="ctrl-chip-btn"
                onClick={() => onRunCommands([{ action: 'change_orbit_distance', target: body.id, deltaAU: +0.3 }])}
                title="바깥쪽으로 0.3 AU 멀리 이동"
              >
                바깥쪽으로 (+0.3AU)
              </button>
              <button
                className="ctrl-chip-btn highlight"
                onClick={() => onRunCommands([{ action: 'change_orbit_distance', target: body.id, circularizeSpeed: true }])}
                title="현재 거리에서 안정적인 원궤도 공전 속도로 자동 동기화"
              >
                ✨ 원궤도 속도 맞춤
              </button>
            </div>

            <h4 className="controls-section-title">📍 위치 미세 이동 (좌표 섭동)</h4>
            <div className="btn-group-row coords-row">
              <button className="ctrl-chip-btn" onClick={() => onRunCommands([{ action: 'offset_position', target: body.id, delta: [-0.15, 0, 0] }])}>
                ← X -0.15
              </button>
              <button className="ctrl-chip-btn" onClick={() => onRunCommands([{ action: 'offset_position', target: body.id, delta: [0.15, 0, 0] }])}>
                → X +0.15
              </button>
              <button className="ctrl-chip-btn" onClick={() => onRunCommands([{ action: 'offset_position', target: body.id, delta: [0, 0.15, 0] }])}>
                ↑ Y +0.15
              </button>
              <button className="ctrl-chip-btn" onClick={() => onRunCommands([{ action: 'offset_position', target: body.id, delta: [0, -0.15, 0] }])}>
                ↓ Y -0.15
              </button>
            </div>
          </>
        )}

        <div className="inspector-footer-action">
          <button
            className="delete-body-btn"
            onClick={() => {
              onRunCommands([{ action: 'remove_body', target: body.id }]);
              onClose();
            }}
          >
            🗑️ 이 행성 제거하기
          </button>
        </div>
      </div>
    </aside>
  );
};
