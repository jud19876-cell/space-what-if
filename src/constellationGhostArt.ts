import * as THREE from 'three';

/** 2D 하늘 좌표 [-6, 6]를 캔버스 [0, 1024] 픽셀 좌표로 변환 */
function toCanvas(skyX: number, skyY: number, size = 1024): [number, number] {
  const x = size * 0.5 + (skyX / 12) * size;
  const y = size * 0.5 - (skyY / 12) * size; // Y축 반전
  return [x, y];
}

/** 캔버스에 반투명 신비로운 네온 고스트 별자리 일러스트를 그립니다 */
export function generateGhostCanvas(constellationId: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 1024, 1024);

  // 성운 같은 신비로운 우주 안개 배경 글로우
  ctx.save();
  const bgGrad = ctx.createRadialGradient(512, 512, 50, 512, 512, 450);
  bgGrad.addColorStop(0, 'rgba(30, 80, 160, 0.18)');
  bgGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.12)');
  bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.restore();

  if (constellationId === 'scorpius') {
    drawScorpionGhost(ctx);
  } else if (constellationId === 'orion') {
    drawOrionGhost(ctx);
  } else if (constellationId === 'ursa_major') {
    drawBearGhost(ctx);
  } else if (constellationId === 'cassiopeia') {
    drawCrownGhost(ctx);
  } else if (constellationId === 'cygnus') {
    drawSwanGhost(ctx);
  } else if (constellationId === 'leo') {
    drawLionGhost(ctx);
  }

  // 주변에 반짝이는 마법 우주 가루 파티클 추가
  drawMagicDust(ctx, constellationId);

  return canvas;
}

/** 1. 전갈자리 신비로운 고스트 실루엣 일러스트 */
function drawScorpionGhost(ctx: CanvasRenderingContext2D) {
  // 별 좌표 픽셀
  const [acrabX, acrabY] = toCanvas(-2.4, 3.8); // 오른쪽 집게발 끝
  const [piX, piY] = toCanvas(-0.5, 4.4); // 왼쪽 집게발 끝
  const [dschubbaX, dschubbaY] = toCanvas(-1.4, 2.7); // 이마 & 눈
  const [alniyatX, alniyatY] = toCanvas(-0.8, 0.8); // 상체 흉갑
  const [antaresX, antaresY] = toCanvas(0.2, 0.4); // 쿵쾅쿵쾅 심장!
  const [weiX, weiY] = toCanvas(1.2, -1.2); // 복부 마디
  const [etaX, etaY] = toCanvas(2.1, -2.6); // 꼬리 시작
  const [sargasX, sargasY] = toCanvas(2.8, -4.2); // 꼬리 바닥 루프
  const [shaulaX, shaulaY] = toCanvas(3.9, -3.2); // 독침 구체
  const [lesathX, lesathY] = toCanvas(3.5, -2.4); // 독침 바늘

  const cyanGhost = 'rgba(79, 227, 193, 0.32)';
  const cyanStroke = 'rgba(110, 231, 183, 0.95)';
  const cyanSoft = 'rgba(56, 189, 248, 0.38)';

  ctx.save();
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 20;

  // (1) 두 집게발 (Pincers) - 날카롭고 웅장한 가위 발톱
  // 왼쪽 집게발 팔 (Acrab 방향)
  ctx.beginPath();
  ctx.moveTo(dschubbaX - 15, dschubbaY + 5);
  ctx.quadraticCurveTo(acrabX - 50, acrabY + 60, acrabX - 10, acrabY + 15);
  ctx.lineWidth = 12;
  ctx.strokeStyle = cyanGhost;
  ctx.stroke();

  // Acrab 집게발 - 바깥 집게와 안쪽 집게로 벌어진 거대한 집게발 실루엣!
  ctx.beginPath();
  ctx.moveTo(acrabX - 15, acrabY + 15);
  // 바깥쪽 큰 집게
  ctx.bezierCurveTo(acrabX - 55, acrabY - 10, acrabX - 45, acrabY - 55, acrabX - 15, acrabY - 65);
  ctx.bezierCurveTo(acrabX - 25, acrabY - 40, acrabX - 5, acrabY - 20, acrabX, acrabY);
  // 안쪽 집게
  ctx.bezierCurveTo(acrabX + 15, acrabY - 25, acrabX + 35, acrabY - 45, acrabX + 25, acrabY - 60);
  ctx.bezierCurveTo(acrabX + 10, acrabY - 35, acrabX - 5, acrabY - 10, acrabX - 15, acrabY + 15);
  ctx.fillStyle = cyanGhost;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = cyanStroke;
  ctx.stroke();

  // 오른쪽 집게발 팔 (Pi Sco 방향)
  ctx.beginPath();
  ctx.moveTo(dschubbaX + 15, dschubbaY + 5);
  ctx.quadraticCurveTo(piX - 10, piY + 70, piX - 5, piY + 15);
  ctx.lineWidth = 12;
  ctx.strokeStyle = cyanGhost;
  ctx.stroke();

  // Pi Sco 집게발 - 벌어진 큰 집게발
  ctx.beginPath();
  ctx.moveTo(piX - 10, piY + 15);
  // 바깥 집게
  ctx.bezierCurveTo(piX - 35, piY - 15, piX - 30, piY - 55, piX - 10, piY - 65);
  ctx.bezierCurveTo(piX - 18, piY - 35, piX, piY - 15, piX + 5, piY);
  // 안쪽 집게
  ctx.bezierCurveTo(piX + 25, piY - 20, piX + 40, piY - 45, piX + 35, piY - 60);
  ctx.bezierCurveTo(piX + 20, piY - 35, piX + 5, piY - 10, piX - 10, piY + 15);
  ctx.fillStyle = cyanGhost;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = cyanStroke;
  ctx.stroke();

  // (2) 머리와 흉갑 (Carapace / Cephalothorax)
  ctx.beginPath();
  ctx.moveTo(dschubbaX - 35, dschubbaY - 25);
  ctx.bezierCurveTo(dschubbaX + 45, dschubbaY - 40, alniyatX + 60, alniyatY - 20, antaresX + 55, antaresY);
  ctx.bezierCurveTo(antaresX + 35, antaresY + 60, antaresX - 60, antaresY + 50, alniyatX - 55, alniyatY);
  ctx.closePath();

  const bodyGrad = ctx.createRadialGradient(antaresX, antaresY, 20, antaresX, antaresY, 150);
  bodyGrad.addColorStop(0, 'rgba(56, 189, 248, 0.48)');
  bodyGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.32)');
  bodyGrad.addColorStop(1, 'rgba(6, 78, 59, 0.16)');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = cyanStroke;
  ctx.stroke();

  // 전갈의 빛나는 두 눈 (Dschubba 이마 위)
  ctx.save();
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(dschubbaX - 12, dschubbaY - 12, 4.5, 0, Math.PI * 2);
  ctx.arc(dschubbaX + 12, dschubbaY - 12, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08a';
  ctx.fill();
  ctx.restore();

  // (3) 전갈의 다리 4쌍 (8 Legs)
  const legPairs = [
    { start: [dschubbaX - 25, dschubbaY + 10], bendL: [-100, 30], tipL: [-140, 100], bendR: [80, 20], tipR: [120, 80] },
    { start: [alniyatX - 30, alniyatY - 10], bendL: [-110, 50], tipL: [-150, 130], bendR: [90, 40], tipR: [130, 120] },
    { start: [alniyatX - 25, alniyatY + 30], bendL: [-100, 70], tipL: [-130, 160], bendR: [80, 60], tipR: [120, 150] },
    { start: [antaresX - 30, antaresY + 20], bendL: [-80, 90], tipL: [-100, 180], bendR: [70, 80], tipR: [100, 170] },
  ];

  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(110, 231, 183, 0.7)';
  legPairs.forEach(({ start, bendL, tipL, bendR, tipR }) => {
    // 왼쪽 다리
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(start[0] + bendL[0], start[1] + bendL[1]);
    ctx.lineTo(start[0] + tipL[0], start[1] + tipL[1]);
    ctx.stroke();

    // 오른쪽 다리
    ctx.beginPath();
    ctx.moveTo(start[0] + 50, start[1]);
    ctx.lineTo(start[0] + 50 + bendR[0], start[1] + bendR[1]);
    ctx.lineTo(start[0] + 50 + tipR[0], start[1] + tipR[1]);
    ctx.stroke();
  });

  // (4) 복부 마디들 (Abdomen plates)
  const segments = [
    { x: (antaresX + weiX) / 2, y: (antaresY + weiY) / 2, r: 44 },
    { x: weiX, y: weiY, r: 40 },
    { x: (weiX + etaX) / 2, y: (weiY + etaY) / 2, r: 35 },
    { x: etaX, y: etaY, r: 31 },
  ];
  segments.forEach((seg) => {
    ctx.beginPath();
    ctx.ellipse(seg.x, seg.y, seg.r, seg.r * 0.75, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = cyanGhost;
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = cyanStroke;
    ctx.stroke();
  });

  // (5) 우아하게 말려 올라가는 꼬리 마디들 (Curved Tail)
  const tailJoints = [
    { x: (etaX + sargasX) / 2 - 15, y: (etaY + sargasY) / 2, r: 28 },
    { x: sargasX, y: sargasY, r: 25 },
    { x: (sargasX + shaulaX) / 2 + 10, y: (sargasY + shaulaY) / 2 - 15, r: 23 },
    { x: shaulaX - 15, y: shaulaY + 10, r: 25 },
  ];
  tailJoints.forEach((j) => {
    ctx.beginPath();
    ctx.arc(j.x, j.y, j.r, 0, Math.PI * 2);
    ctx.fillStyle = cyanSoft;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = cyanStroke;
    ctx.stroke();
  });

  // (6) 독침 구체 (Stinger Bulb at Shaula) & 날카로운 침 (Aculeus at Lesath)
  ctx.beginPath();
  ctx.arc(shaulaX, shaulaY, 28, 0, Math.PI * 2);
  const stingerGrad = ctx.createRadialGradient(shaulaX, shaulaY, 5, shaulaX, shaulaY, 28);
  stingerGrad.addColorStop(0, 'rgba(251, 191, 36, 0.95)'); // 황금빛 독침
  stingerGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.8)');
  stingerGrad.addColorStop(1, 'rgba(239, 68, 68, 0.5)');
  ctx.fillStyle = stingerGrad;
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#fef08a';
  ctx.stroke();

  // 치켜든 독침 바늘 (레사트를 향해 뾰족하게 휜 황금 바늘)
  ctx.beginPath();
  ctx.moveTo(shaulaX - 10, shaulaY - 20);
  ctx.quadraticCurveTo(lesathX + 18, lesathY + 22, lesathX, lesathY);
  ctx.quadraticCurveTo(lesathX - 14, lesathY + 28, shaulaX - 16, shaulaY);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.95)';
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // 독침 끝에서 반짝이는 금빛 이슬 방울
  ctx.save();
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(lesathX - 2, lesathY - 4, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // (7) [핵심] 안타레스 위치: 쿵쾅쿵쾅 뛰는 루비빛 심장 오라!
  ctx.save();
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 36;
  const heartGrad = ctx.createRadialGradient(antaresX, antaresY, 2, antaresX, antaresY, 52);
  heartGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  heartGrad.addColorStop(0.25, 'rgba(239, 68, 68, 0.9)');
  heartGrad.addColorStop(0.65, 'rgba(185, 28, 28, 0.45)');
  heartGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = heartGrad;
  ctx.beginPath();
  ctx.arc(antaresX, antaresY, 52, 0, Math.PI * 2);
  ctx.fill();

  // 심장 박동 펄스 링 2겹
  ctx.beginPath();
  ctx.arc(antaresX, antaresY, 34, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(254, 202, 202, 0.9)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(antaresX, antaresY, 48, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/** 2. 오리온자리 고스트 일러스트 */
function drawOrionGhost(ctx: CanvasRenderingContext2D) {
  const [betX, betY] = toCanvas(-2.2, 2.5); // 어깨 (붉은별)
  const [belX, belY] = toCanvas(2.2, 2.8); // 왼쪽 어깨
  const [midX, midY] = toCanvas(0, 0); // 허리띠
  const [saiphX, saiphY] = toCanvas(-1.8, -2.8); // 무릎
  const [rigelX, rigelY] = toCanvas(2.0, -2.6); // 발 (푸른별)

  ctx.save();
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 18;

  const ghostFill = 'rgba(59, 130, 246, 0.22)';
  const ghostStroke = 'rgba(147, 197, 253, 0.8)';

  // 머리 헬멧
  const headX = (betX + belX) / 2;
  const headY = (betY + belY) / 2 - 50;
  ctx.beginPath();
  ctx.arc(headX, headY, 28, 0, Math.PI * 2);
  ctx.fillStyle = ghostFill;
  ctx.fill();
  ctx.strokeStyle = ghostStroke;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 갑옷 몸통
  ctx.beginPath();
  ctx.moveTo(betX, betY);
  ctx.lineTo(belX, belY);
  ctx.lineTo(midX + 45, midY);
  ctx.lineTo(midX - 45, midY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
  ctx.fill();
  ctx.strokeStyle = ghostStroke;
  ctx.stroke();

  // 사냥꾼의 황금 벨트 (삼태성)
  ctx.beginPath();
  ctx.ellipse(midX, midY, 65, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 두 다리
  ctx.beginPath();
  ctx.moveTo(midX - 30, midY);
  ctx.lineTo(saiphX, saiphY);
  ctx.lineTo(saiphX - 15, saiphY + 30);
  ctx.moveTo(midX + 30, midY);
  ctx.lineTo(rigelX, rigelY);
  ctx.lineTo(rigelX + 15, rigelY + 30);
  ctx.strokeStyle = ghostStroke;
  ctx.lineWidth = 5;
  ctx.stroke();

  // 치켜든 방패/활 곡선
  ctx.beginPath();
  ctx.arc(belX + 70, belY - 10, 110, -0.4 * Math.PI, 0.4 * Math.PI, false);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

/** 3. 큰곰자리 (북두칠성) 고스트 일러스트 */
function drawBearGhost(ctx: CanvasRenderingContext2D) {
  const [dubheX, dubheY] = toCanvas(1.8, 2.4);
  const [merakX, merakY] = toCanvas(1.6, 0.4);
  const [mizarX, mizarY] = toCanvas(-3.4, 1.8);
  const [alkaidX, alkaidY] = toCanvas(-4.6, 0.4);

  ctx.save();
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 18;

  // 큰 곰의 몸통 곡선
  ctx.beginPath();
  ctx.moveTo(dubheX + 60, dubheY + 40); // 곰 머리 주둥이
  ctx.quadraticCurveTo(dubheX, dubheY - 40, merakX, merakY - 40); // 등
  ctx.quadraticCurveTo(mizarX + 40, mizarY - 20, alkaidX, alkaidY); // 긴 꼬리
  ctx.quadraticCurveTo(mizarX, mizarY + 60, merakX - 20, merakY + 50); // 배
  ctx.closePath();

  ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(103, 232, 249, 0.75)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 곰 귀
  ctx.beginPath();
  ctx.arc(dubheX + 40, dubheY + 15, 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/** 4. 카시오페이아자리 (왕관) 고스트 일러스트 */
function drawCrownGhost(ctx: CanvasRenderingContext2D) {
  const [caphX, caphY] = toCanvas(3.2, 1.2);
  const [gammaX, gammaY] = toCanvas(0.0, 1.8);
  const [seginX, seginY] = toCanvas(-3.4, 1.0);

  ctx.save();
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 20;

  // W 모양을 감싸는 빛나는 황금 왕관 실루엣
  ctx.beginPath();
  ctx.moveTo(caphX + 30, caphY + 30);
  ctx.lineTo(caphX, caphY - 40);
  ctx.lineTo((caphX + gammaX) / 2, caphY + 15);
  ctx.lineTo(gammaX, gammaY - 50);
  ctx.lineTo((gammaX + seginX) / 2, seginY + 15);
  ctx.lineTo(seginX, seginY - 40);
  ctx.lineTo(seginX - 30, seginY + 30);
  ctx.closePath();

  ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.restore();
}

/** 5. 백조자리 고스트 일러스트 */
function drawSwanGhost(ctx: CanvasRenderingContext2D) {
  const [denebX, denebY] = toCanvas(0.0, 3.2); // 꼬리
  const [sadrX, sadrY] = toCanvas(0.0, 0.4); // 가슴
  const [albX, albY] = toCanvas(0.0, -3.2); // 부리
  const [gieX, gieY] = toCanvas(2.6, 0.2); // 오른쪽 날개
  const [fawX, fawY] = toCanvas(-2.4, 0.6); // 왼쪽 날개

  ctx.save();
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 20;

  // 우아한 백조 날개 펼침 실루엣
  ctx.beginPath();
  ctx.moveTo(albX, albY); // 머리 부리
  ctx.quadraticCurveTo(sadrX - 10, sadrY - 60, fawX - 50, fawY - 20); // 왼쪽 날개 끝
  ctx.quadraticCurveTo(fawX, fawY + 50, sadrX - 25, sadrY);
  ctx.quadraticCurveTo(denebX - 40, denebY, denebX, denebY + 30); // 꼬리 깃털
  ctx.quadraticCurveTo(denebX + 40, denebY, sadrX + 25, sadrY);
  ctx.quadraticCurveTo(gieX, gieY + 50, gieX + 50, gieY - 20); // 오른쪽 날개 끝
  ctx.quadraticCurveTo(sadrX + 10, sadrY - 60, albX, albY);
  ctx.closePath();

  ctx.fillStyle = 'rgba(147, 197, 253, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(191, 219, 254, 0.85)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.restore();
}

/** 6. 사자자리 고스트 일러스트 */
function drawLionGhost(ctx: CanvasRenderingContext2D) {
  const [regX, regY] = toCanvas(-2.0, -1.8); // 심장
  const [algX, algY] = toCanvas(-1.2, 0.8); // 갈기
  const [denebX, denebY] = toCanvas(3.4, 0.4); // 꼬리

  ctx.save();
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 20;

  // 사자 갈기와 늠름한 몸체
  ctx.beginPath();
  ctx.arc(algX - 20, algY + 20, 60, 0, Math.PI * 2); // 풍성한 황금 갈기
  ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.fill();
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 사자 몸통 & 꼬리
  ctx.beginPath();
  ctx.moveTo(algX, algY);
  ctx.quadraticCurveTo((algX + denebX) / 2, algY + 30, denebX, denebY);
  ctx.lineTo(denebX + 30, denebY - 20); // 꼬리 술
  ctx.quadraticCurveTo((regX + denebX) / 2, regY - 30, regX, regY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#fcd34d';
  ctx.stroke();

  ctx.restore();
}

/** 주변 반짝이는 마법 우주 가루 */
function drawMagicDust(ctx: CanvasRenderingContext2D, seedStr: string) {
  ctx.save();
  let seed = 42;
  for (let i = 0; i < seedStr.length; i++) seed += seedStr.charCodeAt(i);

  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < 45; i++) {
    const x = rnd() * 1024;
    const y = rnd() * 1024;
    const rad = 1.5 + rnd() * 2.5;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + rnd() * 0.5})`;
    ctx.shadowColor = '#a7f3d0';
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.restore();
}
