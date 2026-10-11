import React, { useState } from 'react';
import { type SimCommand } from './simulation.ts';

export interface PlacementConfig {
  typeId: string;
  name: string;
  visualRadius: number;
  massMultiplier: number;
  hasRings: boolean;
}

interface SpawnPlanetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCommands: (cmds: SimCommand[]) => void;
  onSpawnSuccess: (name: string) => void;
  onStartMousePlacement: (config: PlacementConfig) => void;
}

interface PlanetPreset {
  label: string;
  emoji: string;
  name: string;
  typeId: string;
  distAU: number;
  radius: number;
  massMultiplier: number;
  hasRings: boolean;
  desc: string;
}

const PRESETS: PlanetPreset[] = [
  {
    label: '암석 행성',
    emoji: '🪨',
    name: '케플러-암석 B',
    typeId: 'mercury',
    distAU: 1.8,
    radius: 0.6,
    massMultiplier: 0.8,
    hasRings: false,
    desc: '수성/화성 같은 단단한 규산염 암석과 크레이터 표면을 가진 행성입니다.',
  },
  {
    label: '가스 고리 행성',
    emoji: '🪐',
    name: '크로노스 가스 거인',
    typeId: 'saturn',
    distAU: 7.2,
    radius: 1.5,
    massMultiplier: 120.0,
    hasRings: true,
    desc: '토성처럼 카시니 간극을 가진 웅장한 얼음 고리와 수소/헬륨 대기를 가집니다.',
  },
  {
    label: '얼음 거인',
    emoji: '❄️',
    name: '글리제 쿨 아이스',
    typeId: 'uranus',
    distAU: 14.5,
    radius: 1.1,
    massMultiplier: 18.0,
    hasRings: true,
    desc: '천왕성/해왕성처럼 메탄 얼음 대기와 푸른 에메랄드빛을 띱니다.',
  },
  {
    label: '슈퍼 지구',
    emoji: '💎',
    name: '프록시마 슈퍼지구',
    typeId: 'earth',
    distAU: 2.3,
    radius: 0.95,
    massMultiplier: 4.5,
    hasRings: false,
    desc: '지구보다 크고 질량이 크며, 푸른 바다와 풍부한 산소 대기를 가집니다.',
  },
  {
    label: '미니 쌍둥이 항성',
    emoji: '🔥',
    name: '적색왜성 네메시스',
    typeId: 'sun',
    distAU: 22.0,
    radius: 1.35,
    massMultiplier: 500.0,
    hasRings: false,
    desc: '태양계 외곽을 함께 공전하는 작은 미니 쌍둥이 항성입니다.',
  },
];

// 태양계 주요 궤도 구역 프리셋
const ORBIT_ZONES = [
  { label: '수성 안쪽', au: 0.25, emoji: '☀️', desc: '초근접 고온 궤도' },
  { label: '수성 궤도', au: 0.39, emoji: '🪨', desc: '공전 88일' },
  { label: '금성 궤도', au: 0.72, emoji: '🟡', desc: '두꺼운 온실층' },
  { label: '지구 골디락스', au: 1.0, emoji: '🌍', desc: '생명체 거주존 (1년)' },
  { label: '화성 궤도', au: 1.52, emoji: '🔴', desc: '붉은 사막 영역' },
  { label: '소행성대', au: 2.77, emoji: '☄️', desc: '소행성 벨트' },
  { label: '목성 궤도', au: 5.2, emoji: '🟠', desc: '가스 거인 궤도' },
  { label: '토성 궤도', au: 9.58, emoji: '🪐', desc: '고리 영역' },
  { label: '천왕성 궤도', au: 19.2, emoji: '🔵', desc: '극저온 얼음권' },
  { label: '해왕성/카이퍼', au: 30.1, emoji: '❄️', desc: '태양계 외곽' },
];

export const SpawnPlanetModal: React.FC<SpawnPlanetModalProps> = ({
  isOpen,
  onClose,
  onRunCommands,
  onSpawnSuccess,
  onStartMousePlacement,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [name, setName] = useState(PRESETS[0].name);
  const [typeId, setTypeId] = useState(PRESETS[0].typeId);
  const [distanceAU, setDistanceAU] = useState(PRESETS[0].distAU);
  const [visualRadius, setVisualRadius] = useState(PRESETS[0].radius);
  const [massMultiplier, setMassMultiplier] = useState(PRESETS[0].massMultiplier);
  const [hasRings, setHasRings] = useState(PRESETS[0].hasRings);

  if (!isOpen) return null;

  const applyPreset = (index: number) => {
    const p = PRESETS[index];
    setSelectedPresetIndex(index);
    setName(p.name);
    setTypeId(p.typeId);
    setDistanceAU(p.distAU);
    setVisualRadius(p.radius);
    setMassMultiplier(p.massMultiplier);
    setHasRings(p.hasRings);
  };

  const handleSpawnDirect = () => {
    onRunCommands([
      {
        action: 'spawn_custom_planet',
        name,
        typeId,
        distanceAU,
        visualRadius,
        massMultiplier,
        hasRings,
      },
    ]);
    onSpawnSuccess(name);
    onClose();
  };

  const handleStartMousePlacementClick = () => {
    onStartMousePlacement({
      name,
      typeId,
      visualRadius,
      massMultiplier,
      hasRings,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="spawn-planet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">➕🪐</span>
            <div>
              <h3>새로운 행성 궤도 배치 (Spawn Planet)</h3>
              <p className="modal-subtitle">거리별 궤도 선택 또는 3D 마우스 직접 찍기 배치 중 원하는 방식을 선택하세요.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 5대 천체 프리셋 선택 */}
        <div className="preset-selector-row">
          <label className="input-section-label">천체 프리셋 선택:</label>
          <div className="preset-chips">
            {PRESETS.map((p, idx) => (
              <button
                key={p.label}
                className={`preset-chip ${selectedPresetIndex === idx ? 'active' : ''}`}
                onClick={() => applyPreset(idx)}
              >
                <span>{p.emoji}</span> {p.label}
              </button>
            ))}
          </div>
          <p className="preset-desc-text">{PRESETS[selectedPresetIndex].desc}</p>
        </div>

        {/* 태양계 주요 궤도 구역 선택 */}
        <div className="orbit-zones-section">
          <label className="input-section-label">📍 태양과의 거리에 따른 궤도 선택:</label>
          <div className="orbit-zones-chips">
            {ORBIT_ZONES.map((zone) => {
              const isSelected = Math.abs(distanceAU - zone.au) < 0.15;
              return (
                <button
                  key={zone.label}
                  className={`orbit-zone-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => setDistanceAU(zone.au)}
                  title={`${zone.label} (${zone.au} AU) - ${zone.desc}`}
                >
                  <span className="zone-emoji">{zone.emoji}</span>
                  <span className="zone-label">{zone.label}</span>
                  <span className="zone-au">{zone.au}AU</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 세부 설정 필드 */}
        <div className="modal-form-grid">
          <div className="form-group">
            <label>천체 이름</label>
            <input
              type="text"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="행성 이름 입력"
            />
          </div>

          <div className="form-group">
            <label>
              태양과의 거리: <strong>{distanceAU.toFixed(2)} AU</strong>
              <small> ({(distanceAU * 149.6).toFixed(1)} 백만 km)</small>
            </label>
            <div className="slider-row-with-num">
              <input
                type="range"
                min="0.2"
                max="35.0"
                step="0.05"
                value={distanceAU}
                onChange={(e) => setDistanceAU(Number(e.target.value))}
                className="modal-slider"
              />
              <input
                type="number"
                min="0.1"
                max="50.0"
                step="0.1"
                value={distanceAU}
                onChange={(e) => setDistanceAU(Math.max(0.1, Number(e.target.value)))}
                className="modal-num-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              시각 크기 (반경): <strong>{visualRadius.toFixed(2)}x</strong>
            </label>
            <div className="slider-row-with-num">
              <input
                type="range"
                min="0.2"
                max="15.0"
                step="0.05"
                value={visualRadius}
                onChange={(e) => setVisualRadius(Number(e.target.value))}
                className="modal-slider"
              />
              <input
                type="number"
                min="0.1"
                max="50.0"
                step="0.1"
                value={visualRadius}
                onChange={(e) => setVisualRadius(Math.max(0.1, Number(e.target.value)))}
                className="modal-num-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              질량 배수 (지구 질량 대비): <strong>{massMultiplier >= 10 ? Math.round(massMultiplier) : massMultiplier.toFixed(1)}배</strong>
            </label>
            <div className="slider-row-with-num">
              <input
                type="range"
                min="0.05"
                max="1000.0"
                step="0.5"
                value={massMultiplier}
                onChange={(e) => setMassMultiplier(Number(e.target.value))}
                className="modal-slider"
              />
              <input
                type="number"
                min="0.01"
                max="10000.0"
                step="any"
                value={massMultiplier}
                onChange={(e) => setMassMultiplier(Math.max(0.01, Number(e.target.value)))}
                className="modal-num-input"
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hasRings}
                onChange={(e) => setHasRings(e.target.checked)}
              />
              <span>🪐 절차적 얼음 고리(Ring) 장착하기</span>
            </label>
          </div>
        </div>

        <div className="modal-footer-dual">
          <button className="btn modal-mouse-place-btn" onClick={handleStartMousePlacementClick}>
            <span>🖱️</span> 3D 화면에 마우스로 직접 찍어서 배치
          </button>
          <button className="btn modal-submit-btn" onClick={handleSpawnDirect}>
            <span>📍</span> 선택한 궤도({distanceAU.toFixed(1)}AU)에 즉시 안착 배치
          </button>
        </div>
      </div>
    </div>
  );
};
