import React, { useState } from 'react';
import { type SimCommand } from './simulation.ts';

interface SpawnPlanetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCommands: (cmds: SimCommand[]) => void;
  onSpawnSuccess: (name: string) => void;
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

export const SpawnPlanetModal: React.FC<SpawnPlanetModalProps> = ({
  isOpen,
  onClose,
  onRunCommands,
  onSpawnSuccess,
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

  const handleSpawn = () => {
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="spawn-planet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">➕🪐</span>
            <div>
              <h3>새로운 행성 궤도 배치 (Spawn Planet)</h3>
              <p className="modal-subtitle">케플러 원궤도 공전 속도를 자동 계산하여 즉시 태양계에 배치합니다.</p>
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
            <input
              type="range"
              min="0.4"
              max="25.0"
              step="0.1"
              value={distanceAU}
              onChange={(e) => setDistanceAU(Number(e.target.value))}
              className="modal-slider"
            />
          </div>

          <div className="form-group">
            <label>
              시각 크기 (반경): <strong>{visualRadius.toFixed(2)}x</strong>
            </label>
            <input
              type="range"
              min="0.3"
              max="2.5"
              step="0.05"
              value={visualRadius}
              onChange={(e) => setVisualRadius(Number(e.target.value))}
              className="modal-slider"
            />
          </div>

          <div className="form-group">
            <label>
              질량 배수 (지구 질량 대비): <strong>{massMultiplier >= 10 ? Math.round(massMultiplier) : massMultiplier.toFixed(1)}배</strong>
            </label>
            <input
              type="range"
              min="0.1"
              max="600.0"
              step="0.5"
              value={massMultiplier}
              onChange={(e) => setMassMultiplier(Number(e.target.value))}
              className="modal-slider"
            />
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

        <div className="modal-footer-row">
          <button className="btn modal-cancel-btn" onClick={onClose}>
            취소
          </button>
          <button className="btn modal-submit-btn" onClick={handleSpawn}>
            ✨ 이 설정으로 궤도에 배치하기!
          </button>
        </div>
      </div>
    </div>
  );
};
