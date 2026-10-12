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
  } else if (constellationId === 'canis_major') {
    drawDogGhost(ctx);
  } else if (constellationId === 'gemini') {
    drawTwinsGhost(ctx);
  } else if (constellationId === 'taurus') {
    drawBullGhost(ctx);
  } else if (constellationId === 'pegasus') {
    drawPegasusGhost(ctx);
  } else if (constellationId === 'sagittarius') {
    drawArcherGhost(ctx);
  } else if (constellationId === 'aries') {
    drawRamGhost(ctx);
  } else if (constellationId === 'cancer') {
    drawCrabGhost(ctx);
  } else if (constellationId === 'virgo') {
    drawMaidenGhost(ctx);
  } else if (constellationId === 'libra') {
    drawScalesGhost(ctx);
  } else if (constellationId === 'capricorn') {
    drawSeaGoatGhost(ctx);
  } else if (constellationId === 'aquarius') {
    drawWaterBearerGhost(ctx);
  } else if (constellationId === 'pisces') {
    drawFishesGhost(ctx);
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

/** 7. 큰개자리 신비로운 고스트 실루엣 일러스트 */
function drawDogGhost(ctx: CanvasRenderingContext2D) {
  const [siriusX, siriusY] = toCanvas(0.0, 1.8);
  const [murzX, murzY] = toCanvas(-1.8, 2.2);
  const [muliX, muliY] = toCanvas(0.8, 3.2);
  const [wezX, wezY] = toCanvas(0.6, -1.8);
  const [adhaX, adhaY] = toCanvas(-1.0, -2.8);
  const [furX, furY] = toCanvas(-2.0, -3.8);
  const [aludX, aludY] = toCanvas(1.8, -3.0);

  ctx.save();
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 18;

  // 강아지 머리 & 귀
  ctx.beginPath();
  ctx.moveTo(siriusX, siriusY);
  ctx.quadraticCurveTo(muliX + 25, muliY + 15, muliX, muliY); // 쫑긋 귀
  ctx.quadraticCurveTo(siriusX + 35, siriusY + 20, siriusX + 15, siriusY);
  ctx.quadraticCurveTo(murzX + 20, murzY + 10, murzX, murzY); // 주둥이 코
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 강아지 목걸이 & 빛나는 시리우스 펜던트 링
  ctx.beginPath();
  ctx.arc(siriusX, siriusY, 26, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 강아지 몸통과 등줄기
  ctx.beginPath();
  ctx.moveTo(siriusX, siriusY);
  ctx.quadraticCurveTo((siriusX + wezX) / 2 + 35, (siriusY + wezY) / 2, wezX, wezY); // 등
  ctx.quadraticCurveTo((wezX + aludX) / 2, (wezY + aludY) / 2, aludX, aludY); // 꼬리 시작
  ctx.lineTo(aludX + 25, aludY - 35); // 살랑살랑 꼬리 끝
  ctx.quadraticCurveTo(aludX + 5, aludY - 15, wezX, wezY);
  ctx.lineTo(adhaX, adhaY); // 허벅지
  ctx.lineTo(furX, furY); // 뒷발
  ctx.quadraticCurveTo((furX + murzX) / 2 - 20, (furY + murzY) / 2, murzX, murzY); // 배 & 앞발
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

/** 8. 쌍둥이자리 신비로운 고스트 실루엣 일러스트 */
function drawTwinsGhost(ctx: CanvasRenderingContext2D) {
  const [polX, polY] = toCanvas(1.6, 3.6);
  const [casX, casY] = toCanvas(-0.6, 4.0);
  const [wasX, wasY] = toCanvas(1.4, 0.4);
  const [mebX, mebY] = toCanvas(-1.2, 0.8);
  const [alhX, alhY] = toCanvas(2.8, -3.2);
  const [propX, propY] = toCanvas(-2.6, -2.4);

  ctx.save();
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 18;

  // 카스토르 (형) 실루엣
  ctx.beginPath();
  ctx.arc(casX, casY, 28, 0, Math.PI * 2); // 머리
  ctx.fillStyle = 'rgba(244, 114, 182, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(casX - 20, casY + 25);
  ctx.lineTo(mebX - 25, mebY);
  ctx.lineTo(propX, propY);
  ctx.lineTo(mebX, mebY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(244, 114, 182, 0.16)';
  ctx.fill();
  ctx.strokeStyle = '#f472b6';
  ctx.stroke();

  // 폴룩스 (동생) 실루엣
  ctx.beginPath();
  ctx.arc(polX, polY, 28, 0, Math.PI * 2); // 머리
  ctx.fillStyle = 'rgba(192, 132, 252, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(polX + 20, polY + 25);
  ctx.lineTo(wasX + 25, wasY);
  ctx.lineTo(alhX, alhY);
  ctx.lineTo(wasX, wasY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(192, 132, 252, 0.16)';
  ctx.fill();
  ctx.strokeStyle = '#c084fc';
  ctx.stroke();

  // 형제가 마주잡은 두 손 & 하트 연결선
  ctx.beginPath();
  ctx.moveTo(mebX, mebY);
  ctx.quadraticCurveTo((mebX + wasX) / 2, (mebY + wasY) / 2 - 25, wasX, wasY);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.stroke();

  ctx.restore();
}

/** 9. 황소자리 신비로운 고스트 실루엣 일러스트 */
function drawBullGhost(ctx: CanvasRenderingContext2D) {
  const [aldX, aldY] = toCanvas(-0.4, 0.2);
  const [ainX, ainY] = toCanvas(-0.6, 1.4);
  const [elnX, elnY] = toCanvas(2.2, 4.2);
  const [tianX, tianY] = toCanvas(3.4, 1.8);
  const [alcyX, alcyY] = toCanvas(-4.2, 2.8);
  const [lamX, lamY] = toCanvas(-1.4, -2.4);

  ctx.save();
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 20;

  // 웅장하고 날카로운 두 뿔
  ctx.beginPath();
  // 북쪽 뿔 (Elnath)
  ctx.moveTo(ainX, ainY);
  ctx.quadraticCurveTo((ainX + elnX) / 2 - 20, (ainY + elnY) / 2 + 20, elnX, elnY);
  ctx.quadraticCurveTo((ainX + elnX) / 2 + 10, (ainY + elnY) / 2, ainX + 15, ainY);
  // 남쪽 뿔 (Tianguan)
  ctx.moveTo(aldX, aldY);
  ctx.quadraticCurveTo((aldX + tianX) / 2, (aldY + tianY) / 2 - 25, tianX, tianY);
  ctx.quadraticCurveTo((aldX + tianX) / 2 + 15, (aldY + tianY) / 2, aldX + 15, aldY);
  ctx.fillStyle = 'rgba(249, 115, 22, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#fdba74';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 황소의 V자 머리 & 어깨
  ctx.beginPath();
  ctx.moveTo(ainX, ainY);
  ctx.lineTo(aldX, aldY);
  ctx.lineTo(lamX, lamY); // 앞가슴
  ctx.quadraticCurveTo((lamX + alcyX) / 2, (lamY + alcyY) / 2, alcyX, alcyY); // 등 어깨
  ctx.lineTo(ainX, ainY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(249, 115, 22, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#f97316';
  ctx.stroke();

  // 붉게 타오르는 알데바란 눈빛 링
  ctx.beginPath();
  ctx.arc(aldX, aldY, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

/** 10. 페가수스자리 신비로운 고스트 실루엣 일러스트 */
function drawPegasusGhost(ctx: CanvasRenderingContext2D) {
  const [marX, marY] = toCanvas(-1.8, -1.2);
  const [schX, schY] = toCanvas(-1.6, 2.2);
  const [algX, algY] = toCanvas(2.2, -1.8);
  const [alpX, alpY] = toCanvas(2.4, 2.4);
  const [enifX, enifY] = toCanvas(-5.2, -0.6);
  const [homX, homY] = toCanvas(-3.2, -1.0);
  const [matX, matY] = toCanvas(-1.2, 4.4);

  ctx.save();
  ctx.shadowColor = '#a78bfa';
  ctx.shadowBlur = 20;

  // 가을철 대사각형 (페가수스 몸통)
  ctx.beginPath();
  ctx.moveTo(schX, schY);
  ctx.lineTo(alpX, alpY);
  ctx.lineTo(algX, algY);
  ctx.lineTo(marX, marY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(167, 139, 250, 0.16)';
  ctx.fill();
  ctx.strokeStyle = '#c4b5fd';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 하늘로 솟아오르는 은빛 날개 깃털
  ctx.beginPath();
  ctx.moveTo(schX, schY);
  ctx.quadraticCurveTo((schX + alpX) / 2 + 60, (schY + alpY) / 2 + 120, alpX + 80, alpY + 90);
  ctx.quadraticCurveTo(alpX + 30, alpY + 50, alpX, alpY);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 목과 주둥이 (에니프 코끝)
  ctx.beginPath();
  ctx.moveTo(marX, marY);
  ctx.lineTo(homX, homY);
  ctx.lineTo(enifX, enifY);
  ctx.quadraticCurveTo(homX, homY + 30, schX, schY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(167, 139, 250, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#c4b5fd';
  ctx.stroke();

  // 도약하는 앞다리 (Matar)
  ctx.beginPath();
  ctx.moveTo(schX, schY);
  ctx.lineTo(matX, matY);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#a78bfa';
  ctx.stroke();

  ctx.restore();
}

/** 11. 궁수자리 신비로운 고스트 실루엣 일러스트 */
function drawArcherGhost(ctx: CanvasRenderingContext2D) {
  const [kausAusX, kausAusY] = toCanvas(-0.4, -2.6);
  const [nunX, nunY] = toCanvas(2.2, 0.4);
  const [ascX, ascY] = toCanvas(1.8, -1.8);
  const [kausMedX, kausMedY] = toCanvas(-1.2, -0.8);
  const [kausBorX, kausBorY] = toCanvas(0.2, 1.2);
  const [alnaslX, alnaslY] = toCanvas(-3.2, -1.4);

  ctx.save();
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 18;

  // 우주 찻주전자 (The Teapot) 몸통 & 뚜껑
  ctx.beginPath();
  ctx.moveTo(kausMedX, kausMedY);
  ctx.lineTo(kausBorX, kausBorY); // 뚜껑 꼭지
  ctx.lineTo(nunX - 25, nunY);
  ctx.lineTo(ascX, ascY);
  ctx.lineTo(kausAusX, kausAusY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 찻주전자 손잡이
  ctx.beginPath();
  ctx.moveTo(nunX - 25, nunY);
  ctx.quadraticCurveTo(nunX + 35, (nunY + ascX) / 2, ascX, ascY);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#34d399';
  ctx.stroke();

  // 찻주전자 주둥이
  ctx.beginPath();
  ctx.moveTo(kausMedX, kausMedY);
  ctx.lineTo(alnaslX, alnaslY);
  ctx.lineTo(kausAusX, kausAusY);
  ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.stroke();

  // 주둥이에서 피어오르는 은하수 증기 구름 & 황금 활시위
  ctx.beginPath();
  ctx.moveTo(alnaslX, alnaslY);
  ctx.bezierCurveTo(alnaslX - 60, alnaslY + 50, alnaslX - 30, alnaslY + 110, alnaslX - 80, alnaslY + 160);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.restore();
}

/** 12. 양자리 황금 뿔과 씩씩한 양 고스트 */
function drawRamGhost(ctx: CanvasRenderingContext2D) {
  const [hamalX, hamalY] = toCanvas(1.2, 0.8);
  const [sheratanX, sheratanY] = toCanvas(-0.6, 0.2);
  const [mesarX, mesarY] = toCanvas(-1.4, -0.4);
  const [boteinX, boteinY] = toCanvas(3.2, 1.4);

  ctx.save();
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 18;

  // 웅장하게 말려 올라간 황금 양뿔 (Spiral Horn)
  ctx.beginPath();
  ctx.moveTo(hamalX, hamalY);
  ctx.bezierCurveTo(hamalX + 45, hamalY - 80, hamalX - 35, hamalY - 110, hamalX - 60, hamalY - 45);
  ctx.bezierCurveTo(hamalX - 75, hamalY, hamalX - 25, hamalY + 25, hamalX, hamalY);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
  ctx.fill();
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 반대편 작은 양뿔
  ctx.beginPath();
  ctx.moveTo(sheratanX, sheratanY);
  ctx.bezierCurveTo(sheratanX - 40, sheratanY - 60, sheratanX - 70, sheratanY - 30, sheratanX - 45, sheratanY + 15);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 양 머리와 코 (Hamal -> Mesarthim)
  ctx.beginPath();
  ctx.moveTo(hamalX, hamalY);
  ctx.lineTo(sheratanX, sheratanY);
  ctx.lineTo(mesarX, mesarY);
  ctx.bezierCurveTo(mesarX + 30, mesarY + 40, hamalX - 10, hamalY + 50, hamalX, hamalY);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
  ctx.fill();

  // 폭신폭신한 황금빛 양털 몸통 (Botein으로 뻗는 등줄기)
  ctx.beginPath();
  ctx.moveTo(hamalX, hamalY);
  ctx.bezierCurveTo(hamalX + 60, hamalY + 40, boteinX - 40, boteinY - 30, boteinX, boteinY);
  ctx.bezierCurveTo(boteinX + 30, boteinY + 60, hamalX + 30, hamalY + 90, mesarX + 20, mesarY + 40);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/** 13. 게자리 둥근 등껍질과 반짝이는 집게발 고스트 */
function drawCrabGhost(ctx: CanvasRenderingContext2D) {
  const [acubensX, acubensY] = toCanvas(1.5, -1.8);
  const [altarfX, altarfY] = toCanvas(3.4, -3.2);
  const [asellusBorX, asellusBorY] = toCanvas(-1.2, 1.6);
  const [asellusAusX, asellusAusY] = toCanvas(-0.8, -0.4);
  const [tegmineX, tegmineY] = toCanvas(-2.8, 3.6);
  const [praesepeX, praesepeY] = toCanvas(-1.0, 0.6); // 심장 벌집성단

  ctx.save();
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 20;

  // 게 등껍질 (Carapace)
  ctx.beginPath();
  ctx.ellipse(praesepeX, praesepeY, 80, 60, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 북쪽 큰 집게발 (Tegmine 방향)
  ctx.beginPath();
  ctx.moveTo(asellusBorX, asellusBorY);
  ctx.quadraticCurveTo(tegmineX + 40, tegmineY + 30, tegmineX, tegmineY);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.stroke();

  // 벌어진 위쪽 집게
  ctx.beginPath();
  ctx.moveTo(tegmineX, tegmineY);
  ctx.bezierCurveTo(tegmineX - 35, tegmineY - 20, tegmineX - 45, tegmineY + 20, tegmineX - 10, tegmineY + 35);
  ctx.bezierCurveTo(tegmineX + 15, tegmineY + 25, tegmineX + 5, tegmineY - 10, tegmineX, tegmineY);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.fill();

  // 남쪽 집게발 (Acubens 방향)
  ctx.beginPath();
  ctx.moveTo(asellusAusX, asellusAusY);
  ctx.quadraticCurveTo(acubensX - 30, acubensY + 40, acubensX, acubensY);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(acubensX, acubensY);
  ctx.bezierCurveTo(acubensX + 35, acubensY - 25, acubensX + 45, acubensY + 15, acubensX + 10, acubensY + 30);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.fill();

  // 게 다리들 (Altarf 등)
  ctx.beginPath();
  ctx.moveTo(praesepeX + 40, praesepeY + 30);
  ctx.lineTo(altarfX, altarfY);
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

/** 14. 처녀자리 순백의 날개와 황금 보리 이삭 고스트 */
function drawMaidenGhost(ctx: CanvasRenderingContext2D) {
  const [spicaX, spicaY] = toCanvas(0.0, -3.5); // 보리 이삭 (청백색 1등성)
  const [zavX, zavY] = toCanvas(-3.8, 2.2);
  const [zanX, zanY] = toCanvas(-2.2, 1.4);
  const [porrX, porrY] = toCanvas(-0.8, 0.6); // 허리/날개 연결부
  const [vindX, vindY] = toCanvas(2.0, 2.8); // 왼쪽 날개 끝
  const [hezeX, hezeY] = toCanvas(0.6, -1.2);
  const [syrmaX, syrmaY] = toCanvas(2.8, -2.4);

  ctx.save();
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 22;

  // 천사의 날개 (Vindemiatrix 방향)
  ctx.beginPath();
  ctx.moveTo(porrX, porrY);
  ctx.bezierCurveTo(porrX + 40, porrY - 60, vindX - 30, vindY - 50, vindX, vindY);
  ctx.bezierCurveTo(vindX + 30, vindY + 40, porrX + 80, porrY + 50, porrX, porrY + 30);
  ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 반대편 날개 (Zavijava 방향)
  ctx.beginPath();
  ctx.moveTo(zanX, zanY);
  ctx.bezierCurveTo(zanX - 50, zanY - 40, zavX + 20, zavY - 40, zavX, zavY);
  ctx.bezierCurveTo(zavX - 20, zavY + 50, zanX - 60, zanY + 50, zanX, zanY + 20);
  ctx.fillStyle = 'rgba(192, 132, 252, 0.18)';
  ctx.fill();

  // 우아하게 흘러내리는 드레스 실루엣 (허리 Porrima -> Heze -> Syrma)
  ctx.beginPath();
  ctx.moveTo(porrX, porrY);
  ctx.lineTo(hezeX, hezeY);
  ctx.lineTo(syrmaX, syrmaY);
  ctx.bezierCurveTo(syrmaX - 30, syrmaY + 50, hezeX - 40, hezeY + 60, porrX - 30, porrY + 40);
  ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#d8b4fe';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 스피카 손에 쥔 황금빛 보리 이삭 (Spica)
  ctx.beginPath();
  ctx.moveTo(hezeX, hezeY);
  ctx.lineTo(spicaX, spicaY);
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 보리알 이삭 낱알들
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(spicaX + i * 8, spicaY + i * 10, 10, 4, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
    ctx.fill();
  }

  ctx.restore();
}

/** 15. 천칭자리 균형 잡힌 정의의 황금 저울 고스트 */
function drawScalesGhost(ctx: CanvasRenderingContext2D) {
  const [zubNorthX, zubNorthY] = toCanvas(0.5, 2.5); // 북쪽 저울접시 (에메랄드별)
  const [zubSouthX, zubSouthY] = toCanvas(-1.8, 0.2); // 남쪽 저울접시
  const [zubEastX, zubEastY] = toCanvas(2.2, 0.6); // 동쪽 축
  const [brachX, brachY] = toCanvas(-0.2, -2.2); // 저울 바닥 받침대

  ctx.save();
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 20;

  // 저울 중앙 기둥 받침대
  const pivotX = (zubNorthX + zubSouthX + zubEastX) / 3;
  const pivotY = (zubNorthY + zubSouthY + zubEastY) / 3;

  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(brachX, brachY);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 5;
  ctx.stroke();

  // 저울 바닥 지지판
  ctx.beginPath();
  ctx.ellipse(brachX, brachY, 50, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 가로 지렛대 (Beam)
  ctx.beginPath();
  ctx.moveTo(zubSouthX, zubSouthY);
  ctx.lineTo(zubEastX, zubEastY);
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 왼쪽 매달린 접시
  ctx.beginPath();
  ctx.moveTo(zubSouthX, zubSouthY);
  ctx.lineTo(zubSouthX - 25, zubSouthY + 50);
  ctx.moveTo(zubSouthX, zubSouthY);
  ctx.lineTo(zubSouthX + 25, zubSouthY + 50);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(zubSouthX, zubSouthY + 50, 30, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.fill();

  // 오른쪽(북쪽) 매달린 접시 (주벤에샤마리 - 에메랄드 접시)
  ctx.beginPath();
  ctx.moveTo(zubNorthX, zubNorthY);
  ctx.lineTo(zubNorthX - 25, zubNorthY + 50);
  ctx.moveTo(zubNorthX, zubNorthY);
  ctx.lineTo(zubNorthX + 25, zubNorthY + 50);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(zubNorthX, zubNorthY + 50, 32, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/** 16. 염소자리 바다 염소 (염소 상체 + 물고기 지느러미) 고스트 */
function drawSeaGoatGhost(ctx: CanvasRenderingContext2D) {
  const [algiX, algiY] = toCanvas(-3.5, 2.8); // 뿔
  const [dabX, dabY] = toCanvas(-3.2, 1.8); // 머리
  const [nashX, nashY] = toCanvas(2.8, -0.6); // 꼬리 시작
  const [denebX, denebY] = toCanvas(3.8, -0.2); // 꼬리 지느러미
  const [omgX, omgY] = toCanvas(-0.5, -2.2); // 배 바닥

  ctx.save();
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 20;

  // 뾰족하게 휜 염소 뿔 (Algedi)
  ctx.beginPath();
  ctx.moveTo(dabX, dabY);
  ctx.quadraticCurveTo(algiX - 30, algiY + 20, algiX, algiY);
  ctx.bezierCurveTo(algiX - 40, algiY - 30, algiX - 10, algiY - 50, algiX + 15, algiY - 30);
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 염소 가슴과 앞발 실루엣
  ctx.beginPath();
  ctx.moveTo(dabX, dabY);
  ctx.lineTo(omgX, omgY);
  ctx.bezierCurveTo(omgX + 40, omgY + 30, nashX - 40, nashY + 20, nashX, nashY);
  ctx.lineTo(denebX, denebY);
  ctx.bezierCurveTo(nashX + 20, nashY - 40, omgX - 20, omgY - 40, dabX, dabY);
  ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 꼬리 지느러미 (Deneb Algedi 바다 인어 꼬리)
  ctx.beginPath();
  ctx.moveTo(denebX, denebY);
  ctx.bezierCurveTo(denebX + 45, denebY - 40, denebX + 55, denebY - 10, denebX + 30, denebY);
  ctx.bezierCurveTo(denebX + 55, denebY + 20, denebX + 40, denebY + 45, denebX, denebY);
  ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#a5f3fc';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/** 17. 물병자리 푸른 생명의 물줄기를 쏟는 물병 고스트 */
function drawWaterBearerGhost(ctx: CanvasRenderingContext2D) {
  const [suudX, suudY] = toCanvas(-1.8, 1.8); // 왼쪽 어깨
  const [melikX, melikY] = toCanvas(0.5, 2.2); // 오른쪽 어깨 & 물병
  const [skatX, skatY] = toCanvas(3.2, -3.0); // 물줄기 바닥
  const [sadachX, sadachY] = toCanvas(1.8, 1.2); // 물병 입구
  const [anchaX, anchaY] = toCanvas(-0.6, -0.8); // 몸통

  ctx.save();
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 24;

  // 신비한 황금빛 물병 (Sadalmelik -> Sadachbia)
  ctx.beginPath();
  ctx.ellipse(melikX + 15, melikY - 10, 35, 25, Math.PI / 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(96, 165, 250, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 물병 주둥이
  ctx.beginPath();
  ctx.moveTo(melikX + 25, melikY);
  ctx.lineTo(sadachX, sadachY);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 5;
  ctx.stroke();

  // 쏟아져 내리는 굽이치는 생명의 푸른 물줄기 (Flowing Stream to Skat)
  ctx.beginPath();
  ctx.moveTo(sadachX, sadachY);
  ctx.bezierCurveTo(sadachX + 30, sadachY + 60, skatX - 60, skatY - 80, skatX, skatY);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // 물줄기 파동 리본
  ctx.beginPath();
  ctx.moveTo(sadachX + 10, sadachY + 15);
  ctx.bezierCurveTo(sadachX + 50, sadachY + 80, skatX - 30, skatY - 60, skatX + 25, skatY);
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 물병 소년의 실루엣 (어깨와 몸통)
  ctx.beginPath();
  ctx.moveTo(suudX, suudY);
  ctx.lineTo(melikX, melikY);
  ctx.lineTo(anchaX, anchaY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
  ctx.fill();

  ctx.restore();
}

/** 18. 물고기자리 황금 리본으로 연결된 두 물고기 고스트 */
function drawFishesGhost(ctx: CanvasRenderingContext2D) {
  const [alreschaX, alreschaY] = toCanvas(0.0, -2.8); // 황금 리본 매듭
  const [fumalX, fumalY] = toCanvas(-3.4, 2.4); // 북쪽 물고기
  const [torcX, torcY] = toCanvas(-1.8, 0.2); // 북쪽 끈
  const [lambdaX, lambdaY] = toCanvas(3.2, 1.8); // 서쪽 물고기
  const [gammaX, gammaY] = toCanvas(1.8, 0.4); // 서쪽 끈

  ctx.save();
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 20;

  // 1) 황금 리본 매듭 (Alrescha)
  ctx.beginPath();
  ctx.arc(alreschaX, alreschaY, 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.fill();
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 2) 북쪽으로 뻗는 리본 끈
  ctx.beginPath();
  ctx.moveTo(alreschaX, alreschaY);
  ctx.quadraticCurveTo(torcX + 20, torcY + 40, torcX, torcY);
  ctx.lineTo(fumalX, fumalY);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 3) 북쪽 물고기 실루엣 (Fumalsamakah)
  ctx.beginPath();
  ctx.ellipse(fumalX, fumalY, 40, 22, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // 꼬리 지느러미
  ctx.beginPath();
  ctx.moveTo(fumalX - 25, fumalY + 20);
  ctx.lineTo(fumalX - 45, fumalY + 35);
  ctx.lineTo(fumalX - 35, fumalY + 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.fill();

  // 4) 서쪽으로 뻗는 리본 끈
  ctx.beginPath();
  ctx.moveTo(alreschaX, alreschaY);
  ctx.quadraticCurveTo(gammaX - 20, gammaY + 40, gammaX, gammaY);
  ctx.lineTo(lambdaX, lambdaY);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 5) 서쪽 물고기 실루엣 (Lambda Piscium 고리)
  ctx.beginPath();
  ctx.ellipse(lambdaX, lambdaY, 42, 24, Math.PI / 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // 꼬리 지느러미
  ctx.beginPath();
  ctx.moveTo(lambdaX + 28, lambdaY + 15);
  ctx.lineTo(lambdaX + 50, lambdaY + 30);
  ctx.lineTo(lambdaX + 40, lambdaY + 5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.fill();

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
