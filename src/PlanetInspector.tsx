import React from 'react';
import { AU_PER_DAY_TO_KM_S, length, type Vec3 } from './physics.ts';
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
  if (!body) return null;

  const isSun = body.id === 'sun';
  const isBlackHole = body.id.includes('black_hole');
  const info = BODY_INFO[body.id as BodyId] ?? (
    isBlackHole
      ? BODY_INFO['black_hole']
      : { emoji: '🪐', color: '#66a6ff', lines: ['우주의 신비로운 천체입니다.'] }
  );

  const sun = findBody(state, 'sun');
  const distFromSunAU = sun ? length([body.position[0] - sun.position[0], body.position[1] - sun.position[1], body.position[2] - sun.position[2]]) : length(body.position);
  const distMillionKm = distFromSunAU * 149.6;

  const speedAuDay = length(body.velocity);
  const speedKmS = speedAuDay * AU_PER_DAY_TO_KM_S;

  const massRatio = body.mass / EARTH_MASS;
  const massRatioText = massRatio >= 10 ? Math.round(massRatio).toLocaleString('ko-KR') : massRatio >= 0.01 ? String(+massRatio.toFixed(2)) : massRatio.toExponential(2);

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
        <h4 className="controls-section-title">⚡ 실시간 속도 조작</h4>
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
            className="ctrl-chip-btn danger"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 2.0 }])}
            title="속도를 2배로 올려 탈출 속도 돌파!"
          >
            🚀 2배 탈출속도
          </button>
          <button
            className="ctrl-chip-btn stop"
            onClick={() => onRunCommands([{ action: 'change_velocity', target: body.id, multiplier: 0.0 }])}
            title="공전 속도를 0으로 멈춰 태양으로 정면 추락"
          >
            🛑 정지 (0)
          </button>
        </div>

        <h4 className="controls-section-title">📐 시각 크기 (반경) 조절</h4>
        <div className="btn-group-row">
          {[0.5, 1.0, 1.5, 2.0, 3.0].map((scale) => (
            <button
              key={scale}
              className="ctrl-chip-btn"
              onClick={() => onRunCommands([{ action: 'change_visual_radius', target: body.id, multiplier: scale / body.visualRadius }])}
            >
              {scale}x
            </button>
          ))}
        </div>

        <h4 className="controls-section-title">⚖️ 질량(무게) 배율 조절</h4>
        <div className="btn-group-row">
          {[0.5, 1.0, 2.0, 5.0, 10.0].map((mult) => (
            <button
              key={mult}
              className="ctrl-chip-btn"
              onClick={() => onRunCommands([{ action: 'change_mass', target: body.id, multiplier: mult }])}
              title={`질량을 ${mult}배로 조절 (중력장 변화)`}
            >
              {mult}x
            </button>
          ))}
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
