// Bonecos articulados (cartum, vistos de lado/3-4, virados pra direita no espaço local).
import { el, CANECA } from './cenario.js';
import { linha, poli, ret, circ, pontos, semente } from './traco.js';
import { hashStr } from './agenda.js';

const P = (d, c = 't') => `<path class="${c}" d="${d}"/>`;
const SENTADO = new Set(['digitando', 'digitando-rapido', 'olhando', 'comendo', 'dormindo']);
const HEAD = [4, -180], HR = 23;

function ik(S, H, L1, L2, sinal) {
  const dx = H[0] - S[0], dy = H[1] - S[1];
  let d = Math.hypot(dx, dy);
  const max = L1 + L2 - 0.01;
  if (d > max) { H = [S[0] + dx / d * max, S[1] + dy / d * max]; d = max; }
  d = Math.max(d, Math.abs(L1 - L2) + 0.01);
  const a = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const th = Math.atan2(dy, dx) + sinal * a;
  return [[S[0] + Math.cos(th) * L1, S[1] + Math.sin(th) * L1], H];
}
const f1 = (n) => Math.round(n * 10) / 10;
const membro = (a, b, c) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}L${f1(c[0])} ${f1(c[1])}`;

function cabeca(v) {
  const [cx, cy] = HEAD;
  let s = '';
  const dentroCab = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < (HR - 2) ** 2;
  if (v.cabelo === 'rabo') s += `<path class="b" d="M-16 -194Q-44 -186 -40 -160Q-36 -146 -30 -150Q-34 -170 -14 -178Z"/>`;
  if (v.cabelo === 'capacete') s += '';
  s += `<path class="b" d="${circ(cx, cy, HR, HR + 1)}"/>`;
  s += `<path class="b" d="${circ(-12, -178, 5.5, 7)}"/>`;
  switch (v.cabelo) {
    case 'raspado':
      s += `<path class="pt" d="${pontos(cx, cy, HR - 2, HR - 2, 55, (x, y) => (y < -193 || x < -10) && !(x > 2 && y < -194) && !(x > -18 && x < -6 && y > -186))}"/>`;
      s += `<path class="pt cinza" d="${pontos(-8, -184, 12, 8, 22, (x, y) => dentroCab(x, y) && x < -4)}"/>`;
      break;
    case 'topete':
      s += `<path class="b" d="M-19 -186Q-24 -206 -8 -208Q-4 -222 12 -214Q24 -222 30 -204Q24 -198 18 -204Q12 -196 4 -202Q-4 -194 -10 -198Q-14 -192 -13 -182Z"/>`;
      s += P('M-2 -210q6 4 10 -1', 'tf') + P('M10 -214q6 5 12 0', 'tf');
      break;
    case 'cacheado':
      for (let i = 0; i < 11; i++) { const a = Math.PI * (0.9 + i * 0.12); s += `<path class="b" style="stroke-width:2" d="${circ(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 7.5)}"/>`; }
      for (let i = 0; i < 4; i++) s += `<path class="b" style="stroke-width:2" d="${circ(cx - 10 + i * 8, cy - 26, 6.5)}"/>`;
      break;
    case 'rabo':
      s += `<path class="b" d="M28 -192Q20 -210 2 -206Q-20 -204 -22 -184Q-22 -174 -18 -166Q-14 -180 -8 -186Q8 -196 28 -192Z"/>` + P('M-4 -200q-10 6 -12 18', 'tf') + P('M8 -202q-8 4 -10 10', 'tf');
      break;
    case 'bone':
      s += `<path class="b" d="M-22 -186Q-22 -212 4 -212Q26 -212 27 -190Z"/>` + `<path class="b" d="M20 -192L46 -189L44 -184L22 -187Z"/>` + P('M-2 -212v4', 'tf');
      break;
    case 'careca':
      s += P('M-10 -196q6 -6 12 -6', 'tf') + P('M-18 -186q-2 4 0 8M-16 -190q-2 4 0 8', 'tf');
      break;
    case 'curto':
      s += `<path d="M-22 -178Q-24 -208 4 -208Q24 -206 27 -192Q12 -198 -4 -195Q-14 -190 -16 -176Z" fill="#161616"/>`;
      break;
    case 'capacete':
      s += `<path class="b" d="${circ(cx, cy - 4, 29, 27)}"/>` + `<path class="b" d="M12 -204Q36 -196 33 -172L14 -172Z"/>` + P('M-24 -170q14 8 30 8', 'tf');
      break;
  }
  if (v.barba === 'pontilhada') s += `<path class="pt" d="${pontos(cx + 6, cy + 13, 16, 9, 34, (x, y) => dentroCab(x, y) && y > -175 && x > -4 && !(x > 6 && x < 22 && y > -171 && y < -164))}"/>`;
  return s;
}
function rosto(v) {
  let s = '';
  s += `<g class="olhos-abertos"><circle cx="9" cy="-184" r="2" fill="#161616"/><circle cx="20" cy="-184" r="2" fill="#161616"/></g>`;
  s += `<g class="olhos-fechados" style="display:none">${P('M6 -184q3 3 6 0', 'tf')}${P('M17 -184q3 3 6 0', 'tf')}</g>`;
  if (v.oculos === 'redondo') s += P(circ(9, -184, 6.2, 6.2, 0.2)) + P(circ(21, -184, 5.4, 6, 0.2)) + P('M2.8 -185L-9 -182', 'tf');
  s += P('M24 -180q5 4 -1 7', 'tf');
  if (v.sorriso === 'dentes') {
    s += `<g class="boca-fechada"><path class="b" d="M5 -172Q15 -158 26 -173Z" style="stroke-width:2"/>${P('M6 -171L25 -172', 'tf')}</g>`;
    s += `<g class="boca-aberta" style="display:none"><path class="b" d="M5 -172Q15 -153 26 -174Z" style="stroke-width:2"/>${P('M6 -171L25 -172', 'tf')}</g>`;
  } else {
    s += `<g class="boca-fechada">${P('M11 -168q5 2 9 -1', 'tf')}</g>`;
    s += `<g class="boca-aberta" style="display:none"><ellipse cx="15" cy="-168" rx="3.6" ry="3.2" fill="#161616"/></g>`;
  }
  if (v.barba === 'bigode') s += `<path d="M11 -173q7 -5 13 1q-6 3 -13 -1Z" fill="#161616" stroke="#161616" stroke-width="1.5"/>`;
  if (v.acessorio === 'headset') s += P('M-14 -186Q-2 -214 22 -202', 't') + `<path class="b" d="${circ(-12, -178, 7, 8)}"/>` + P('M-10 -170Q0 -160 16 -164', 'tf');
  return s;
}
function tronco(v) {
  const corpo = 'M-19 -152Q-23 -120 -19 -84L19 -84Q23 -120 19 -152Q0 -159 -19 -152Z';
  let s = '';
  const preto = v.roupa === 'camiseta-preta' || v.roupa === 'terno';
  s += `<path d="${corpo}" fill="${preto ? '#161616' : '#fff'}" stroke="#161616" stroke-width="2.6" stroke-linejoin="round"/>`;
  switch (v.roupa) {
    case 'camiseta-preta': s += `<path class="pt branco" d="${pontos(0, -118, 17, 30, 25)}"/>`; break;
    case 'listrada': for (let y = -142; y < -88; y += 9) s += P(linha(-19, y, 19, y + 1, 0.6), 'tf'); break;
    case 'moletom': s += P('M-15 -151Q0 -136 15 -151', 'tf') + P(ret(-11, -108, 22, 12, 0.4), 'tf'); break;
    case 'polo': s += `<path class="b" style="stroke-width:1.8" d="M-9 -154L-1 -144L-12 -146Z"/><path class="b" style="stroke-width:1.8" d="M9 -154L1 -144L12 -146Z"/>`; break;
    case 'colete':
      s += P('M-15 -151L0 -122L15 -151', 't') + P('M-17 -88L0 -100L17 -88', 'tf') + `<path d="M-2 -150L2 -150L3 -126L0 -122L-3 -126Z" fill="#161616"/>` + '<circle cx="0" cy="-112" r="1.4" fill="#161616"/><circle cx="0" cy="-102" r="1.4" fill="#161616"/>';
      break;
    case 'terno': s += `<path d="M-9 -154L0 -126L9 -154Z" fill="#fff" stroke="#161616" stroke-width="1.5"/><path d="M-1.6 -150L1.6 -150L2 -132L0 -128L-2 -132Z" fill="#161616"/>`; break;
    case 'uniforme': s += P(ret(4, -140, 10, 10, 0.3), 'tf') + `<text x="0" y="-100" font-size="7.5" text-anchor="middle">LIMPEZA</text>`; break;
  }
  return s;
}

export function criarBoneco(p) {
  const v = p.visual || {};
  semente(hashStr(p.id));
  const raiz = el('g', { class: 'boneco', 'data-id': p.id });
  const ref = { id: p.id, p, v, raiz, forma: v.forma || 'humano' };
  if (ref.forma === 'pato' || ref.forma === 'pombo') return criarBicho(ref);

  const calcaPreta = v.roupa === 'terno';
  const mk = (pai, preto) => {
    const o = el('path', { class: 'membro-o' }, pai);
    const i = el('path', { class: 'membro-i', style: preto ? 'stroke:#161616' : '' }, pai);
    return { o, i, set(d) { o.setAttribute('d', d); i.setAttribute('d', d); } };
  };
  const gPernas = el('g', {}, raiz);
  ref.pernaB = mk(gPernas, calcaPreta);
  ref.pernaF = mk(gPernas, calcaPreta);
  ref.peB = el('ellipse', { rx: 8, ry: 4, fill: '#161616' }, gPernas);
  ref.peF = el('ellipse', { rx: 8, ry: 4, fill: '#161616' }, gPernas);
  const gT = el('g', {}, raiz);
  ref.tronco = gT;
  ref.bracoB = mk(gT, v.roupa === 'terno');
  ref.maoB = el('circle', { r: 4.6, class: 'b', style: 'stroke-width:2' }, gT);
  ref.propCostas = el('g', {}, gT);
  if (v.acessorio === 'bag') ref.propCostas.innerHTML = `<path class="b" d="${ret(-50, -168, 34, 40, 0.8)}"/>` + P('M-46 -156h26', 'tf');
  ref.mochila = el('g', { style: 'display:none' }, gT);
  ref.mochila.innerHTML = `<path class="b" d="M-18 -148Q-38 -146 -36 -118Q-36 -98 -18 -100Z"/>` + P('M-32 -126h12', 'tf');
  const torso = el('g', {}, gT);
  torso.innerHTML = tronco(v);
  ref.texto = null;
  if (v.texto) {
    ref.texto = el('text', { x: 0, y: -116, 'font-size': v.texto.length > 4 ? 10 : 12, 'text-anchor': 'middle', fill: v.roupa === 'camiseta-preta' ? '#fff' : '#161616' }, torso);
    ref.texto.textContent = v.texto;
  }
  ref.cabeca = el('g', { transform: 'translate(4 -156) scale(1.2) translate(-4 156)' }, gT);
  ref.cabeca.innerHTML = cabeca(v) + rosto(v);
  ref.olhosA = ref.cabeca.querySelector('.olhos-abertos');
  ref.olhosF = ref.cabeca.querySelector('.olhos-fechados');
  ref.bocaF = ref.cabeca.querySelector('.boca-fechada');
  ref.bocaA = ref.cabeca.querySelector('.boca-aberta');
  ref.zzz = el('text', { x: 30, y: -214, 'font-size': 20, style: 'display:none' }, gT);
  ref.zzz.textContent = 'Z z z';
  ref.marmita = el('g', { style: 'display:none' }, raiz);
  ref.marmita.innerHTML = `<path class="b" d="${poli([[44, -112], [80, -112], [76, -100], [48, -100]], true, 0.5)}"/>` + P('M46 -112q16 -6 32 0', 'tf');
  ref.bracoF = mk(gT, v.roupa === 'terno');
  ref.maoF = el('g', {}, gT);
  el('circle', { r: 4.6, class: 'b', style: 'stroke-width:2' }, ref.maoF);
  ref.props = {};
  const prop = (nome, svg) => { const g = el('g', { style: 'display:none' }, ref.maoF); g.innerHTML = svg; ref.props[nome] = g; };
  prop('caneca', `<path d="${poli([[-2, -14], [14, -14], [13, 4], [-1, 4]], true, 0.3)}" fill="${p.id === 'dev' ? CANECA : '#fff'}" stroke="#161616" stroke-width="2"/><path class="tf" d="M14 -10q6 1 5 6q-1 4 -6 4"/>`);
  prop('copo', `<path class="b" style="stroke-width:2" d="${poli([[-2, -22], [13, -22], [11, 4], [0, 4]], true, 0.3)}"/><path class="tf" d="M-2 -16h15"/><path class="b" style="stroke-width:1.6" d="M-3 -22q3 -7 8 -3q4 -5 9 1z"/>`);
  prop('garfo', `<path class="t" d="M0 0L12 -18M10 -20l4 3M8 -21l5 4"/>`);
  prop('vassoura', `<path class="t" style="stroke-width:3" d="M0 0L18 90"/><path class="b" d="M6 88L32 86L36 100L4 102Z"/>`);
  prop('prancheta', `<path class="b" d="${ret(-6, -26, 22, 28, 0.4)}"/><path class="tf" d="M-1 -18h12M-1 -11h12M-1 -4h8"/>`);
  if (v.acessorio === 'prancheta') ref.fixo = 'prancheta';
  if (v.acessorio === 'vassoura') ref.fixo = 'vassoura';
  if (v.acessorio === 'caneta') { prop('caneta', `<path class="t" d="M-2 4L10 -14"/>`); ref.fixo = 'caneta'; }
  ref.atual = {};
  return ref;
}

function criarBicho(ref) {
  const g = el('g', {}, ref.raiz);
  ref.corpo = g;
  if (ref.forma === 'pato') {
    g.innerHTML = `<path class="b" d="M-20 -4Q-24 -26 -4 -24Q-2 -40 10 -40Q22 -40 22 -28Q20 -22 14 -20Q24 -18 22 -6Q18 2 -14 2Q-20 2 -20 -4Z"/>` +
      `<path class="b" style="stroke-width:2" d="M21 -31L33 -29L22 -25Z"/><circle cx="14" cy="-32" r="2" fill="#161616"/>` + P('M-6 -12q8 6 16 -2', 'tf');
  } else {
    g.innerHTML = `<path class="b" d="M-22 -14Q-12 -30 6 -26Q12 -42 22 -38Q28 -34 26 -28L32 -26L25 -23Q24 -14 16 -8Q4 0 -16 -6L-30 -4Z"/>` +
      `<circle cx="20" cy="-33" r="1.8" fill="#161616"/>` + P('M-8 -18q10 -6 18 2', 'tf');
    ref.pernas = el('path', { class: 't', d: 'M2 -6L0 2M10 -8L10 2' }, ref.raiz);
  }
  ref.atual = {};
  return ref;
}

// Atualiza a pose. est: {x,y,dir,escala,pose,andar(bool),correndo,fase,t,falando,props:[]}
export function posar(ref, est) {
  const { x, y, dir, escala = 1, t } = est;
  const tr = `translate(${f1(x)} ${f1(y)}) scale(${f1(dir * escala * 100) / 100} ${f1(escala * 100) / 100})`;
  if (ref.atual.tr !== tr) { ref.raiz.setAttribute('transform', tr); ref.atual.tr = tr; }
  if (ref.forma !== 'humano') {
    const pulo = est.andar ? -Math.abs(Math.sin(est.fase * 2)) * 8 : 0;
    const bob = ref.forma === 'pombo' ? Math.sin(t * 6) * 2 : Math.sin(t * 2) * 1;
    ref.corpo.setAttribute('transform', `translate(${f1(bob)} ${f1(pulo)})`);
    return;
  }
  const pose = est.andar ? (est.correndo ? 'correndo' : 'andando') : est.pose;
  const sentado = !est.andar && est.sentado && SENTADO.has(pose);
  const fase = est.fase || 0;
  let hipY = -86, lean = 0, pernas, maoF, maoB, prop = null, olhosFechados = false, bocaAberta = false, zzz = false, marmita = false;
  const ciclo = (per, frac) => (t % per) / per < frac;
  if (sentado) {
    hipY = -80;
    pernas = [[[-3, -80], [36, -82], [38, -2]], [[3, -80], [44, -82], [46, -2]]];
  } else if (pose === 'andando' || pose === 'correndo') {
    const amp = pose === 'correndo' ? 30 : 20, lift = pose === 'correndo' ? 20 : 9;
    hipY = -86 - Math.abs(Math.sin(fase)) * (pose === 'correndo' ? 5 : 2.5);
    lean = pose === 'correndo' ? 14 : 2;
    pernas = [0, Math.PI].map((o, i) => { const sw = Math.sin(fase + o); return [[(i ? 4 : -4), hipY], null, [sw * amp, -Math.max(0, Math.cos(fase + o)) * lift]]; });
  } else {
    if (pose === 'ofegante') { lean = 20; hipY = -82; }
    if (pose === 'varrendo') lean = 8;
    pernas = [[[-4, hipY], null, [-8, 0]], [[4, hipY], null, [8, 0]]];
  }
  // transformação do tronco
  const ty = hipY + 86;
  if (pose === 'dormindo' && sentado) { lean = 62; olhosFechados = true; zzz = true; }
  else if (sentado && (pose === 'digitando' || pose === 'digitando-rapido')) lean = 6;
  const trT = `translate(0 ${f1(ty)}) rotate(${f1(lean)} 0 -86)`;
  if (ref.atual.trT !== trT) { ref.tronco.setAttribute('transform', trT); ref.atual.trT = trT; }
  const rad = lean * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  // char -> tronco (inverso)
  const paraT = ([px, py]) => { const qx = px, qy = py - ty + 86; return [qx * c + qy * s, -qx * s + qy * c - 86]; };
  const doT = ([px, py]) => { const qy = py + 86; return [px * c - qy * s, px * s + qy * c - 86 + ty]; };
  const ombroF = [4, -146], ombroB = [-4, -146];
  const relF = (dx, dy) => [ombroF[0] + dx, ombroF[1] + dy];
  const relB = (dx, dy) => [ombroB[0] + dx, ombroB[1] + dy];
  const abs = (pt) => paraT(pt);
  const boca = paraT(doT([20, -168]));
  switch (pose) {
    case 'andando': { const sw = Math.sin(fase); maoF = relF(-16 * sw + 3, 54); maoB = relB(16 * sw - 3, 54); break; }
    case 'correndo': { const sw = Math.sin(fase); maoF = relF(-22 * sw + 12, 36); maoB = relB(22 * sw + 12, 36); break; }
    case 'digitando': case 'digitando-rapido': {
      if (!sentado) { maoF = relF(4, 54); maoB = relB(-4, 54); break; }
      const k = pose === 'digitando-rapido' ? 30 : 16, a = pose === 'digitando-rapido' ? 3.2 : 2.2;
      maoF = abs([46 + Math.sin(t * k) * a, -100 - Math.max(0, Math.sin(t * k)) * 3]);
      maoB = abs([38 + Math.sin(t * k + 2) * a, -99 - Math.max(0, Math.sin(t * k + 2)) * 3]);
      break; }
    case 'olhando':
      if (sentado) { maoF = abs([44, -100]); maoB = abs([36, -99]); }
      else { maoF = relF(4, 54); maoB = relB(-4, 54); }
      break;
    case 'comendo':
      marmita = sentado;
      maoF = ciclo(3.4, 0.35) ? [boca[0] + 2, boca[1] + 6] : (sentado ? abs([58, -104]) : relF(22, 30));
      maoB = sentado ? abs([40, -100]) : relB(18, 34); prop = 'garfo';
      bocaAberta = ciclo(3.4, 0.35);
      break;
    case 'dormindo':
      if (sentado) { maoF = abs([62, -102]); maoB = abs([54, -101]); } else { maoF = relF(4, 54); maoB = relB(-4, 54); }
      break;
    case 'cafe':
      maoF = ciclo(5, 0.25) ? [boca[0] - 2, boca[1] + 10] : relF(20, 34); maoB = relB(-4, 54); prop = 'caneca';
      break;
    case 'brindando':
      maoF = ciclo(7, 0.2) ? relF(26, -28) : (ciclo(7, 0.4) ? [boca[0] - 2, boca[1] + 12] : relF(22, 32)); maoB = relB(-4, 54); prop = 'copo';
      break;
    case 'falando':
      maoF = relF(32 + Math.sin(t * 2.2) * 4, -8 + Math.sin(t * 3.1) * 9); maoB = relB(-2, 54);
      break;
    case 'ofegante': maoF = abs([14, -46]); maoB = abs([6, -46]); bocaAberta = true; break;
    case 'varrendo': { const sw = Math.sin(t * 2.4) * 10; maoF = relF(26 + sw, 46); maoB = relB(18 + sw, 30); prop = 'vassoura'; break; }
    case 'celebrando': maoF = relF(14, -54); maoB = relB(-10, -54); break;
    default: maoF = relF(4, 54); maoB = relB(-4, 54);
  }
  if (est.falando) bocaAberta = (t * 6 | 0) % 2 === 0;
  if (!prop && ref.fixo) prop = ref.fixo;
  if (est.props && est.props.includes('caneca') && pose !== 'andando' && pose !== 'correndo') prop = 'caneca';
  if (est.props && est.props.includes('caneca') && (pose === 'andando' || pose === 'correndo')) { prop = 'caneca'; }

  // pernas (IK, joelho pra frente)
  const pr = pernas.map(([h, k, p]) => (k ? [h, k, p] : [h, ...ik(h, p, 44, 44, -1)]));
  ref.pernaB.set(membro(...pr[0]));
  ref.pernaF.set(membro(...pr[1]));
  ref.peB.setAttribute('cx', f1(pr[0][2][0] + 5)); ref.peB.setAttribute('cy', f1(pr[0][2][1]));
  ref.peF.setAttribute('cx', f1(pr[1][2][0] + 5)); ref.peF.setAttribute('cy', f1(pr[1][2][1]));
  const bF = ik(ombroF, maoF, 30, 30, 1), bB = ik(ombroB, maoB, 30, 30, 1);
  ref.bracoF.set(membro(ombroF, bF[0], bF[1]));
  ref.bracoB.set(membro(ombroB, bB[0], bB[1]));
  ref.maoF.setAttribute('transform', `translate(${f1(bF[1][0])} ${f1(bF[1][1])})`);
  ref.maoB.setAttribute('cx', f1(bB[1][0])); ref.maoB.setAttribute('cy', f1(bB[1][1]));

  // estado discreto (só mexe no DOM quando muda)
  const chave = `${prop}|${olhosFechados}|${bocaAberta}|${zzz}|${marmita}|${est.props && est.props.includes('mochila')}|${dir}`;
  if (ref.atual.chave !== chave) {
    ref.atual.chave = chave;
    for (const [n, g] of Object.entries(ref.props)) g.style.display = n === prop ? '' : 'none';
    ref.olhosA.style.display = olhosFechados ? 'none' : '';
    ref.olhosF.style.display = olhosFechados ? '' : 'none';
    if (ref.bocaA) { ref.bocaA.style.display = bocaAberta ? '' : 'none'; ref.bocaF.style.display = bocaAberta ? 'none' : ''; }
    ref.zzz.style.display = zzz ? '' : 'none';
    ref.marmita.style.display = marmita ? '' : 'none';
    ref.mochila.style.display = est.props && est.props.includes('mochila') ? '' : 'none';
    if (ref.texto) ref.texto.setAttribute('transform', dir < 0 ? 'scale(-1 1)' : '');
    ref.zzz.setAttribute('transform', dir < 0 ? 'translate(60 0) scale(-1 1)' : '');
  }
}

// ponto da cabeça (pra balão), em coordenadas do mundo
export function pontoCabeca(ref, est) {
  if (ref.forma !== 'humano') return [est.x, est.y - 44 * (est.escala || 1)];
  const sentado = !est.andar && est.sentado && SENTADO.has(est.pose);
  const dy = sentado ? (est.pose === 'dormindo' ? -130 : -212) : -222;
  return [est.x + est.dir * 6, est.y + dy * (est.escala || 1)];
}
