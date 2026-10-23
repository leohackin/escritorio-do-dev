// Desenho do escritório (estático) + referências aos elementos que mudam.
import { linha, poli, ret, circ, pontos, semente, rnd } from './traco.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, pai) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (pai) pai.appendChild(e);
  return e;
}
const P = (d, c = 't') => `<path class="${c}" d="${d}"/>`;
const T = (x, y, txt, size = 20, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${txt}</text>`;

export const AMARELO = '#f6d34a';
export const CANECA = '#9fb1c1';

export function postitSVG(x, y, s = 22) {
  return `<g class="postit"><path d="${poli([[x, y], [x + s, y - 1], [x + s + 1, y + s], [x, y + s + 1]], true, 0.5)}" fill="${AMARELO}" stroke="#161616" stroke-width="1.6"/>` +
    `<circle cx="${x + s * 0.35}" cy="${y + s * 0.4}" r="1.4" fill="#161616"/><circle cx="${x + s * 0.65}" cy="${y + s * 0.4}" r="1.4" fill="#161616"/>` +
    `<path d="M${x + s * 0.28} ${y + s * 0.62}Q${x + s * 0.5} ${y + s * 0.82} ${x + s * 0.72} ${y + s * 0.6}" class="tf" style="stroke-width:1.5"/></g>`;
}

function porta() {
  return P(ret(40, 368, 112, 232)) + P(ret(46, 374, 100, 226), 'tf') +
    // vão escuro (aparece com a porta aberta)
    [...Array(14)].map((_, i) => P(linha(50 + i * 7, 378, 50 + i * 7 - 4, 596, 0.6), 'tf')).join('') +
    `<g transform="translate(96 338)">${P(ret(-34, -16, 68, 26))}${T(0, 4, 'SAÍDA', 17, 'text-anchor="middle"')}</g>`;
}
function copa() {
  let s = '';
  s += P(ret(188, 500, 214, 10)) + P(ret(194, 510, 202, 90));
  s += P(linha(296, 514, 296, 596)) + P(circ(286, 556, 2.5), 'tf') + P(circ(306, 556, 2.5), 'tf');
  // cafeteira
  s += `<path class="b" d="${ret(212, 420, 54, 80)}"/>` + P(ret(220, 432, 38, 14), 'tf') + P(linha(239, 446, 239, 458), 'tf');
  s += `<path class="b" d="${poli([[222, 470], [256, 470], [252, 498], [226, 498]], true)}"/>` + P(linha(226, 480, 252, 480), 'tf');
  s += T(239, 416, 'CAFÉ', 15, 'text-anchor="middle"');
  // micro-ondas
  s += `<path class="b" d="${ret(316, 452, 74, 48)}"/>` + P(ret(322, 458, 46, 36), 'tf') + P(circ(380, 466, 3), 'tf') + P(circ(380, 480, 3), 'tf');
  // canecas abandonadas
  s += `<path class="b" d="${ret(276, 484, 14, 16)}"/>` + `<path class="b" d="${ret(294, 486, 12, 14)}"/>`;
  // quadro motivacional
  s += P(ret(206, 170, 168, 122)) + P(ret(214, 178, 152, 106), 'tf');
  s += P(poli([[226, 262], [262, 214], [284, 240], [306, 206], [354, 262]], false), 'tf');
  s += T(290, 200, 'FOCO. FORÇA.', 17, 'text-anchor="middle"') + T(290, 280, 'FÉ NO DEPLOY', 17, 'text-anchor="middle"');
  s += `<g transform="translate(295 330)">${P(ret(-34, -16, 68, 26))}${T(0, 4, 'COPA', 17, 'text-anchor="middle"')}</g>`;
  return s;
}
function kanban() {
  let s = P(ret(470, 140, 230, 160)) + P(linha(546, 146, 546, 296), 'tf') + P(linha(624, 146, 624, 296), 'tf');
  s += T(508, 162, 'A FAZER', 14, 'text-anchor="middle"') + T(585, 162, 'FAZENDO', 14, 'text-anchor="middle"') + T(662, 162, 'FEITO', 14, 'text-anchor="middle"');
  for (let i = 0; i < 9; i++) s += `<path class="b" style="stroke-width:1.4" d="${ret(478 + (i % 3) * 22, 172 + Math.floor(i / 3) * 30 + rnd() * 6, 18, 18, 0.5)}"/>`;
  s += `<path class="b" style="stroke-width:1.4" d="${ret(560, 180, 22, 20, 0.5)}"/><path class="b" style="stroke-width:1.4" d="${ret(588, 220, 22, 20, 0.5)}"/>`;
  s += T(662, 236, '?', 26, 'text-anchor="middle"');
  return s;
}
function relogio(cx, cy) {
  let s = `<path class="b" d="${circ(cx, cy, 44)}"/>` + P(circ(cx, cy, 39), 'tf');
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; s += P(linha(cx + Math.sin(a) * 31, cy - Math.cos(a) * 31, cx + Math.sin(a) * 36, cy - Math.cos(a) * 36, 0.3), 'tf'); }
  return s;
}
function janelaMoldura(x, y, w, h) {
  return P(ret(x, y, w, h)) + P(ret(x + 8, y + 8, w - 16, h - 16), 'tf') + P(linha(x + w / 2, y + 8, x + w / 2, y + h - 8)) + P(linha(x + 8, y + h * 0.55, x + w - 8, y + h * 0.55)) +
    P(ret(x - 10, y + h, w + 20, 10));
}
function cadeira(sx) {
  return P(`M${sx - 28} 524Q${sx - 36} 480 ${sx - 30} 436`) + P(`M${sx - 30} 436Q${sx - 22} 428 ${sx - 18} 440Q${sx - 20} 480 ${sx - 16} 520`) +
    P(linha(sx - 30, 524, sx + 22, 522)) + P(linha(sx - 4, 524, sx - 4, 572)) + P(linha(sx - 28, 586, sx + 22, 586)) + P(linha(sx - 4, 572, sx - 26, 586)) + P(linha(sx - 4, 572, sx + 18, 586)) +
    P(circ(sx - 28, 592, 4), 'tf') + P(circ(sx + 20, 592, 4), 'tf');
}
function planta(x) {
  let s = `<path class="b" d="${poli([[x - 24, 540], [x + 24, 540], [x + 18, 600], [x - 18, 600]], true)}"/>`;
  for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43; s += P(`M${x} 540Q${x + Math.sin(a) * 30} ${500 - rnd() * 10} ${x + Math.sin(a) * 52} ${470 + Math.abs(a) * 26}`); }
  return s;
}
function mesa(X, sala = false) {
  let s = '';
  s += `<path class="b" d="${ret(X - 88, 498, 176, 10)}"/>` + P(linha(X - 80, 508, X - 80, 600)) + P(linha(X + 80, 508, X + 80, 600));
  if (!sala) s += P(linha(X - 80, 560, X + 80, 560), 'tf');
  // teclado
  s += `<path class="b" d="${poli([[X - 40, 498], [X + 6, 498], [X + 2, 492], [X - 36, 492]], true, 0.4)}" style="stroke-width:1.8"/>`;
  // monitor
  s += P(linha(X + 40, 466, X + 40, 494)) + P(linha(X + 22, 497, X + 58, 497));
  s += `<path class="b" d="${poli([[X + 4, 392], [X + 76, 383], [X + 76, 463], [X + 4, 471]], true, 0.8)}"/>`;
  return s;
}
function salaReuniao() {
  let s = '';
  s += P(ret(1400, 284, 200, 110)) + T(1500, 306, 'SPRINT 47 → 48 → 49?', 17, 'text-anchor="middle"');
  s += P(poli([[1416, 324], [1450, 340], [1480, 336], [1520, 362], [1560, 384]], false), 'tf') + T(1500, 386, 'MORAL', 14, '') ;
  s += P(linha(1416, 322, 1416, 388, 0.5), 'tf') + P(linha(1416, 388, 1590, 388, 0.5), 'tf');
  s += `<g transform="translate(1620 254)">${P(ret(-90, -14, 180, 24))}${T(0, 5, 'SALA “INOVAÇÃO”', 16, 'text-anchor="middle"')}</g>`;
  // mesa do gerente: troféu
  s += P(ret(1790, 470, 14, 26), 'tf') + P(circ(1797, 462, 9), 'tf') + T(1797, 512, '#1 GESTOR', 11, 'text-anchor="middle"');
  return s;
}
function vidro() {
  let s = P(linha(1360, 232, 1884, 232)) + P(linha(1360, 232, 1360, 600)) + P(linha(1884, 232, 1884, 600)) + P(linha(1660, 232, 1660, 600), 'tf');
  for (const x of [1400, 1700]) s += `<path class="tf" style="stroke:#9a9a9a" d="${linha(x, 330, x + 40, 290, 0.5)} ${linha(x + 14, 350, x + 66, 296, 0.5)}"/>`;
  return s;
}
function mesaReuniao() {
  return `<path class="b" d="${ret(1426, 522, 230, 10)}"/>` + P(linha(1440, 532, 1440, 600)) + P(linha(1640, 532, 1640, 600)) + P(linha(1540, 532, 1540, 600), 'tf');
}
function luminaria(x) {
  return P(linha(x, 40, x, 92)) + `<path class="b" d="${poli([[x - 26, 112], [x - 12, 92], [x + 12, 92], [x + 26, 112]], true)}"/>`;
}

export function montarCenario(svg, cen) {
  semente(7);
  const W = cen.largura, H = cen.altura;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <filter id="tremido" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>
    <radialGradient id="gFuro"><stop offset="0" stop-color="#000"/><stop offset="0.55" stop-color="#000" stop-opacity="0.85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <clipPath id="clipJanela"><rect x="948" y="128" width="244" height="204"/></clipPath>
    <mask id="mLuz" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><g id="furos"></g></mask>`;
  el('rect', { width: W, height: H, fill: '#fff' }, svg);

  // céu (dentro da janela)
  const ceu = el('g', { 'clip-path': 'url(#clipJanela)' }, svg);
  const ceuFundo = el('rect', { x: 948, y: 128, width: 244, height: 204, fill: '#fff' }, ceu);
  const ceuHachura = el('g', {}, ceu);
  ceuHachura.innerHTML = [...Array(9)].map((_, i) => P(linha(950, 250 + i * 9, 1190, 248 + i * 9, 0.8), 'tf')).join('');
  const sol = el('g', {}, ceu);
  sol.innerHTML = `<path class="b" d="${circ(0, 0, 18)}"/>` + [...Array(8)].map((_, i) => { const a = i * Math.PI / 4; return P(linha(Math.cos(a) * 24, Math.sin(a) * 24, Math.cos(a) * 32, Math.sin(a) * 32, 0.3), 'tf'); }).join('');
  const lua = el('g', {}, ceu);
  lua.innerHTML = `<path d="M8 -16 A18 18 0 1 0 8 16 A13 13 0 1 1 8 -16Z" fill="#fff" stroke="#fff" stroke-width="1"/>`;
  const estrelas = el('g', {}, ceu);
  estrelas.innerHTML = [[980, 150], [1030, 190], [1100, 160], [1160, 200], [1010, 230], [1140, 140], [1070, 215]].map(([x, y]) => `<path d="M${x - 4} ${y}h8M${x} ${y - 4}v8" stroke="#fff" stroke-width="1.6"/>`).join('');
  const nuvens = el('g', {}, ceu);
  nuvens.innerHTML = `<path class="b" d="M0 0q8 -18 26 -10q12 -16 30 -2q18 -4 18 12z"/><path class="b" d="M150 40q8 -14 22 -8q10 -12 24 -1q14 -2 14 9z"/>`;
  const predios = el('g', {}, ceu);
  const ps = [[950, 270, 40], [994, 240, 34], [1032, 288, 44], [1080, 226, 30], [1114, 262, 46], [1164, 250, 30]];
  predios.innerHTML = ps.map(([x, y, w]) => `<path class="predio" d="${ret(x, y, w, 340 - y, 0.6)}"/>` +
    [...Array(Math.floor((330 - y) / 16))].map((_, i) => `<rect class="janelinha${rnd() < 0.3 ? ' acesa' : ''}" x="${x + 6}" y="${y + 8 + i * 16}" width="6" height="7"/><rect class="janelinha${rnd() < 0.25 ? ' acesa' : ''}" x="${x + w - 13}" y="${y + 8 + i * 16}" width="6" height="7"/>`).join('')).join('');

  const fundo = el('g', { filter: 'url(#tremido)' }, svg);
  let s = '';
  s += P(linha(0, 40, W, 40)) + P(linha(0, 600, W, 600)) + P(linha(0, 612, 1360, 612), 'tf');
  for (let i = 0; i < 22; i++) { const x = 20 + i * 88 + rnd() * 30, y = 628 + rnd() * 80; s += P(linha(x, y, x + 26 + rnd() * 20, y, 0.4), 'tf'); }
  s += porta() + copa() + kanban() + relogio(770, 220) + janelaMoldura(940, 120, 260, 220) + salaReuniao() + planta(1320);
  [300 , 840, 1240].forEach((x) => { s += luminaria(x); });
  cen.mesas.forEach((m, i) => { s += cadeira(m.x - 55); });
  s += T(1860, 706, '@VIDADODEV', 20, 'text-anchor="end"');
  fundo.innerHTML = s;

  // lâmpadas acesas (raios)
  const raios = el('g', {}, svg);
  raios.innerHTML = [300, 840, 1240].map((x) => [-0.5, 0, 0.5].map((a) => P(linha(x + Math.sin(a) * 30, 120, x + Math.sin(a) * 46, 132 + Math.cos(a) * 6, 0.3), 'tf')).join('')).join('');

  // ponteiros do relógio
  const pont = el('g', { transform: 'translate(770 220)' }, svg);
  const pH = el('line', { x1: 0, y1: 4, x2: 0, y2: -20, class: 't', style: 'stroke-width:4' }, pont);
  const pM = el('line', { x1: 0, y1: 5, x2: 0, y2: -30, class: 't', style: 'stroke-width:2.8' }, pont);
  const pS = el('line', { x1: 0, y1: 6, x2: 0, y2: -33, class: 'tf', style: 'stroke-width:1.2' }, pont);
  el('circle', { r: 3.5, fill: '#161616' }, pont);

  // porta (folha)
  const portaFechada = el('g', {}, svg);
  portaFechada.innerHTML = `<path class="b" d="${ret(47, 375, 98, 224)}"/>` + P(circ(130, 490, 5)) + P(ret(62, 395, 66, 70), 'tf');
  const portaAberta = el('g', {}, svg);
  portaAberta.innerHTML = `<path class="b" d="${poli([[47, 375], [74, 386], [74, 590], [47, 599]], true)}"/>`;

  const camadaSentados = el('g', { id: 'sentados' }, svg);

  const frente = el('g', { filter: 'url(#tremido)' }, svg);
  s = '';
  cen.mesas.forEach((m) => { s += mesa(m.x, m.sala); });
  s += mesaReuniao();
  frente.innerHTML = s;

  // telas dos monitores
  const telas = cen.mesas.map((m) => {
    const X = m.x;
    const g = el('g', {}, svg);
    const codigo = el('g', {}, g);
    let c = '';
    for (let i = 0; i < 7; i++) { const ind = [0, 8, 16, 8, 16, 8, 0][i]; const w = 14 + rnd() * 30; c += P(linha(X + 12 + ind, 398 + i * 9.6, X + 12 + ind + w, 397 + i * 9.6, 0.3), 'tf'); }
    codigo.innerHTML = c;
    const cursor = el('rect', { x: X + 12, y: 452, width: 6, height: 2.5, fill: '#161616' }, g);
    const texto = el('text', { x: X + 40, y: 432, 'font-size': 15, 'text-anchor': 'middle', class: 'tela-txt' }, g);
    const fumaca = [...Array(6)].map(() => el('path', { class: 'b', d: circ(0, 0, 9), style: 'display:none' }, svg));
    return { X, g, codigo, cursor, texto, fumaca, bilhete: null };
  });

  // caneca do Dev e post-it (o Prompt)
  const dev = cen.mesas[2].x;
  const caneca = el('g', {}, svg);
  caneca.innerHTML = `<path d="${poli([[dev + 10, 477], [dev + 30, 477], [dev + 29, 497], [dev + 11, 497]], true, 0.4)}" fill="${CANECA}" stroke="#161616" stroke-width="2.2"/><path class="t" style="stroke-width:2.2" d="M${dev + 30} 481q8 1 7 7q-1 5 -8 5"/>`;
  const postit = el('g', {}, svg);
  postit.innerHTML = postitSVG(dev + 8, 398, 24);

  // bilhete de fim de semana
  telas.forEach((t) => {
    const b = el('g', { style: 'display:none' }, svg);
    b.innerHTML = `<path class="b" style="stroke-width:1.6" d="${poli([[t.X + 30, 404], [t.X + 72, 401], [t.X + 73, 452], [t.X + 31, 455]], true, 0.6)}"/>`;
    const tx = el('text', { x: t.X + 52, y: 418, 'font-size': 9.5, 'text-anchor': 'middle' }, b);
    t.bilhete = b; t.bilheteTxt = tx;
  });

  const vidroG = el('g', { filter: 'url(#tremido)' }, svg);
  vidroG.innerHTML = vidro();

  const camadaAndando = el('g', { id: 'andando' }, svg);
  const escuro = el('rect', { width: W, height: H, fill: '#0e0e0e', mask: 'url(#mLuz)', class: 'escuro', opacity: 0 }, svg);
  const furosG = svg.querySelector('#furos');
  const furos = cen.mesas.map((m) => el('circle', { cx: m.x, cy: 440, r: 150, fill: 'url(#gFuro)', style: 'display:none' }, furosG));
  const postitNoite = el('g', { opacity: 0 }, svg);
  postitNoite.innerHTML = postitSVG(dev + 8, 398, 24);
  const baloes = el('g', { id: 'baloes' }, svg);

  return { ceu: { fundo: ceuFundo, hachura: ceuHachura, sol, lua, estrelas, nuvens, predios }, ponteiros: { pH, pM, pS }, portaFechada, portaAberta, raios,
    camadaSentados, camadaAndando, telas, caneca, postit, postitNoite, escuro, furos, baloes, devX: dev };
}
