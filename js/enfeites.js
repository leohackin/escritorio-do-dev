// Detalhes desenhados por código por cima do fundo: relógio, janela por hora, post-it, caneca,
// telas do Dev, fumaça, TV, portas abertas. Tudo P&B, exceto o post-it e a caneca.
export const TINTA = '#161616';
const POSTIT = '#f6d34a', CANECA = '#8fa0b2';

// transforma o quadrado unitário no quadrilátero (usa 3 cantos: afim)
function noQuad(ctx, q, fn) {
  const [a, b, , d] = q;
  ctx.save();
  ctx.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], a[0], a[1]);
  fn();
  ctx.restore();
}
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }

export function relogio(ctx, r, tMin, tSeg) {
  const ang = (frac) => frac * Math.PI * 2 - Math.PI / 2;
  const mao = (frac, L, w) => {
    const a = ang(frac);
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + Math.cos(a) * L * r.rx, r.y + Math.sin(a) * L * r.ry); ctx.stroke();
  };
  ctx.strokeStyle = TINTA; ctx.lineCap = 'round';
  mao(((tMin / 60) % 12) / 12, 0.55, 3.2);
  mao((tMin % 60) / 60, 0.85, 2.2);
  mao(Math.floor(tSeg % 60) / 60, 0.9, 0.9);
  ctx.fillStyle = TINTA; ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, 7); ctx.fill();
}

export function janela(ctx, pol, periodo, tMin) {
  if (periodo === 'dia') return;
  ctx.save(); poly(ctx, pol); ctx.clip();
  if (periodo === 'noite') {
    ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(1000, 140, 400, 220); // inverte: prédios em traço branco no preto
    ctx.globalCompositeOperation = 'source-over';
    const k = ((tMin + 300) % 1440) / 660; // lua atravessa a janela
    const x = 1330 - Math.min(1, k) * 260, y = 205 + (x - 1050) * -0.19 + 10;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + 5, y - 3, 9, 0, 7); ctx.fill();
  } else { // entardecer / amanhecer: hachura fina de céu
    ctx.strokeStyle = 'rgba(22,22,22,.55)'; ctx.lineWidth = 1;
    for (let x = 980; x < 1420; x += 7) { ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x + 60, 360); ctx.stroke(); }
  }
  ctx.restore();
}

export function postit(ctx, q, brilho = 0) {
  if (brilho > 0) {
    const [cx, cy] = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60);
    g.addColorStop(0, `rgba(246,211,74,${0.55 * brilho})`); g.addColorStop(1, 'rgba(246,211,74,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 60, cy - 60, 120, 120);
  }
  ctx.fillStyle = POSTIT; ctx.strokeStyle = TINTA; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
  poly(ctx, q); ctx.fill(); ctx.stroke();
  noQuad(ctx, q, () => {
    ctx.fillStyle = TINTA;
    ctx.beginPath(); ctx.ellipse(0.33, 0.38, 0.07, 0.09, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.67, 0.38, 0.07, 0.09, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 0.09; ctx.strokeStyle = TINTA; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.25, 0.6); ctx.quadraticCurveTo(0.5, 0.86, 0.75, 0.6); ctx.stroke();
  });
}

export function caneca(ctx, [x, y]) {
  ctx.lineWidth = 1.8; ctx.strokeStyle = TINTA; ctx.fillStyle = CANECA;
  ctx.beginPath(); ctx.moveTo(x - 7, y - 10); ctx.lineTo(x - 7, y + 6); ctx.quadraticCurveTo(x, y + 10, x + 7, y + 6); ctx.lineTo(x + 7, y - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y - 10, 7, 3, 0, 0, 7); ctx.fillStyle = '#5b6878'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + 9, y - 2, 4, 5, 0, -1.3, 1.3); ctx.stroke();
}

// tela do Dev: código rolando, mensagem de efeito ou bilhete colado
export function tela(ctx, q, modo, texto, tSeg) {
  if (modo === 'codigo') {
    noQuad(ctx, q, () => {
      ctx.fillStyle = TINTA;
      const off = Math.floor(tSeg * 1.5) % 3;
      for (let i = 0; i < 6; i++) {
        const L = [0.55, 0.35, 0.7, 0.42, 0.6, 0.3][(i + off) % 6], ind = [0, 0.08, 0.08, 0.16, 0.08, 0][(i + off) % 6];
        ctx.fillRect(0.12 + ind, 0.14 + i * 0.12, L * 0.7, 0.045);
      }
      if (Math.floor(tSeg * 2) % 2) ctx.fillRect(0.12, 0.14 + 6 * 0.12, 0.06, 0.05);
    });
  } else if (modo === 'texto' || modo === 'bilhete') {
    noQuad(ctx, q, () => {
      if (modo === 'bilhete') { ctx.fillStyle = '#fff'; ctx.strokeStyle = TINTA; ctx.lineWidth = 0.025; ctx.fillRect(0.1, 0.1, 0.8, 0.8); ctx.strokeRect(0.1, 0.1, 0.8, 0.8); }
      ctx.scale(0.01, 0.01); ctx.fillStyle = TINTA; ctx.font = '17px "Patrick Hand"'; ctx.textAlign = 'center';
      const pal = String(texto).split(/\s+/), linhas = []; let cur = '';
      for (const w of pal) { if ((cur + ' ' + w).trim().length > 10 && cur) { linhas.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
      if (cur) linhas.push(cur);
      linhas.slice(0, 4).forEach((l, i) => ctx.fillText(l, 50, 36 + i * 18 - (Math.min(4, linhas.length) - 1) * 6));
    });
  }
}

export function fumaca(ctx, [x, y], tSeg) {
  ctx.strokeStyle = TINTA; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 6; k++) {
    const ph = (tSeg * 0.35 + k / 6) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath(); ctx.arc(x + Math.sin(ph * 7 + k) * 10, y - ph * 110, 5 + ph * 14, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function tvJogo(ctx, q, tSeg) {
  // Pong em tinta preta. O miolo da TV é claro: branco em cima de branco sumia.
  noQuad(ctx, q, () => {
    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(0, 0, 1, 1);
    ctx.strokeStyle = TINTA; ctx.lineWidth = 0.03;
    ctx.strokeRect(0.02, 0.02, 0.96, 0.96);
    ctx.fillStyle = TINTA;
    const bx = 0.5 + 0.32 * Math.sin(tSeg * 2.2), by = 0.5 + 0.28 * Math.sin(tSeg * 3.1);
    const py = (fase) => 0.5 + 0.22 * Math.sin(tSeg * 3.1 + fase) - 0.14;
    ctx.fillRect(0.06, py(-0.45), 0.07, 0.28);
    ctx.fillRect(0.87, py(0.55), 0.07, 0.28);
    ctx.beginPath(); ctx.arc(bx, by, 0.075, 0, Math.PI * 2); ctx.fill();
    for (let y = 0.1; y < 0.9; y += 0.16) ctx.fillRect(0.485, y, 0.03, 0.08);
  });
}

export function portaAberta(ctx, q) { ctx.fillStyle = TINTA; poly(ctx, q); ctx.fill(); }
