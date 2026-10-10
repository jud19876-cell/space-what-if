/**
 * procedural Earth and Sun textures using HTML5 Canvas
 * 외부 이미지 로딩 없이 즉시 렌더링 가능한 고품질 텍스처 생성기
 */

/** 1024x512 정거원통도법(Equirectangular) 지구 표면 텍스처 생성 */
export function generateEarthCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. 깊은 사파이어 블루 해양 배경
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
  oceanGrad.addColorStop(0, '#0f2b5c');
  oceanGrad.addColorStop(0.3, '#1e40af');
  oceanGrad.addColorStop(0.5, '#1d4ed8');
  oceanGrad.addColorStop(0.7, '#1e40af');
  oceanGrad.addColorStop(1, '#0f2b5c');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // 2. 대륙붕 에메랄드 해안선 글로우
  ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
  // 해안선 브러시

  // 3. 주요 대륙 그리기 (단순화된 대륙 형태)
  ctx.save();
  ctx.fillStyle = '#15803d'; // 푸른 초원/삼림

  // 유라시아 & 아프리카 (X: 420 ~ 820)
  // 유럽 & 아시아
  ctx.beginPath();
  ctx.ellipse(620, 170, 190, 85, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // 한반도 & 동아시아 하이라이트
  ctx.beginPath();
  ctx.ellipse(750, 180, 45, 30, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  // 아프리카 대륙
  ctx.beginPath();
  ctx.moveTo(520, 200);
  ctx.bezierCurveTo(580, 220, 600, 320, 540, 380);
  ctx.bezierCurveTo(490, 350, 470, 260, 520, 200);
  ctx.fillStyle = '#ca8a04'; // 사하라 & 사바나
  ctx.fill();

  // 아메리카 대륙 (X: 150 ~ 360)
  // 북아메리카
  ctx.beginPath();
  ctx.ellipse(250, 160, 100, 70, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#16a34a';
  ctx.fill();

  // 남아메리카
  ctx.beginPath();
  ctx.moveTo(290, 260);
  ctx.bezierCurveTo(360, 300, 340, 410, 290, 430);
  ctx.bezierCurveTo(260, 380, 270, 300, 290, 260);
  ctx.fillStyle = '#15803d';
  ctx.fill();

  // 오스트레일리아
  ctx.beginPath();
  ctx.ellipse(820, 350, 55, 35, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#d97706';
  ctx.fill();

  // 극지방 만년설 (남극 & 북극)
  ctx.fillStyle = '#f8fafc';
  // 북극
  ctx.beginPath();
  ctx.rect(0, 0, 1024, 38);
  ctx.fill();
  // 남극
  ctx.beginPath();
  ctx.rect(0, 474, 1024, 38);
  ctx.fill();

  // 4. 지구 구름 레이어
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  const cloudBands = [
    { y: 120, h: 28, seed: 12 },
    { y: 220, h: 36, seed: 44 },
    { y: 320, h: 30, seed: 78 },
  ];
  cloudBands.forEach((b) => {
    ctx.beginPath();
    for (let x = 0; x < 1024; x += 40) {
      const cy = b.y + Math.sin((x + b.seed) * 0.02) * 15;
      ctx.ellipse(x, cy, 50, b.h * 0.5, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  });

  ctx.restore();

  return canvas;
}

/** 512x512 태양 코로나 & 플레어 텍스처 */
export function generateSunCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const cx = 256;
  const cy = 256;

  // 태양 중심 활활 타오르는 화염 그라데이션
  const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 250);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.2, '#fef08a');
  grad.addColorStop(0.4, '#f59e0b');
  grad.addColorStop(0.7, '#ea580c');
  grad.addColorStop(0.9, '#dc2626');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 250, 0, Math.PI * 2);
  ctx.fill();

  // 태양 플레어 광선 살
  ctx.save();
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.25)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const len = 180 + Math.random() * 65;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 70, cy + Math.sin(angle) * 70);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  return canvas;
}
