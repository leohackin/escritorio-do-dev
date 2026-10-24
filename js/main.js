import { gerarAgenda, mesclarAgendas, fmtHM, hm, DIAS } from './agenda.js';
import { lerParametros, criarRelogio } from './relogio.js';
import { carregarCena } from './cena.js';
import * as E from './enfeites.js';

const BANCO_MS = 30 * 60e3, VERSAO_MS = 10 * 60e3, RELOAD_MAX_MS = 3 * 3600e3;
const par = lerParametros(location.search);
const relogio = criarRelogio(par);
const canvas = document.getElementById('tela'), ctx = canvas.getContext('2d');
const svg = document.getElementById('baloes');
const hudHora = document.getElementById('hud-hora'), hudAcao = document.getElementById('hud-acao');
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, pai) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (pai) pai.appendChild(e); return e; };

let cen, cena, banco, elenco, agenda = null, agendaKey = '', assinaturaBanco = '';
const idx = {}, baloes = new Map(), rotas = new Map();
let versaoAtual = null, reloadPendenteDesde = 0, ultimoBanco = Date.now(), ultimaVersao = 0, ocupado = false;
let ultimoEstado = { pessoas: 0, tMin: 0, fds: false };
// sentado-costas: pra que lado o desenho original olha (a mesa fica à esquerda/acima da cadeira)
const SENTADO_OLHA_ESQ = new Set(['gerente', 'carla']);
const VOA = new Set(['pombo']);

async function buscarJSON(url) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

function obterAgenda(key) {
  if (key !== agendaKey) {
    agenda = gerarAgenda(key, banco, elenco, { sal: par.sal });
    agendaKey = key;
    separarSlots(agenda);
    for (const k in idx) delete idx[k];
    rotas.clear();
    painelAgenda();
  }
  return agenda;
}
// Duas ações diferentes no mesmo lugar ao mesmo tempo (ex.: dois grupos no sofá) não podem
// dividir o mesmo ponto: o grupo que chegou depois pega os slots seguintes.
const SEM_SLOT = /^(assento|lado|teclado):|^(fora|porta|banheiro)$/;
function separarSlots(ag) {
  const grupos = new Map();
  for (const lin of Object.values(ag.linhas)) for (const sg of lin) {
    if (SEM_SLOT.test(sg.local)) continue;
    const k = sg.inst + '|' + sg.local + '|' + sg.ini;
    let g = grupos.get(k);
    if (!g) grupos.set(k, (g = { local: sg.local, ini: sg.ini, fim: sg.fim, segs: [], max: 0 }));
    g.segs.push(sg); g.fim = Math.max(g.fim, sg.fim); g.max = Math.max(g.max, (sg.slot || 0) + 1);
  }
  const lista = [...grupos.values()].sort((a, b) => a.ini - b.ini), feitos = [];
  for (const g of lista) {
    let off = 0;
    for (const h of feitos) if (h.local === g.local && h.ini < g.fim && g.ini < h.fim) off = Math.max(off, h.off + h.max);
    g.off = off; feitos.push(g);
    if (off) for (const sg of g.segs) sg.slot = (sg.slot || 0) + off;
  }
}
const pessoa = (id) => elenco.personagens.find((p) => p.id === id);

// ---- onde fica cada "local" do banco de ações ----
function local(nome) { let L = cen.locais[nome] || cen.locais.centro; if (L.alias) L = cen.locais[L.alias]; return L; }
function ponto(s, id) {
  const nome = s.local, slot = s.slot || 0;
  const m = /^(assento|lado|teclado):(\d+)$/.exec(nome);
  if (m) {
    const mesa = cen.mesas[+m[2]] || cen.mesas[2], [cx, cy] = mesa.cadeira;
    if (m[1] === 'assento') return { x: cx, y: cy, prof: cy + (mesa.folga ?? 80), tipo: 'cadeira', trilho: [] };
    if (m[1] === 'lado') { const [lx, ly] = mesa.lado || [cx + 78, cy - 4]; return { x: lx + slot * 42, y: ly + slot * 20, olhar: 'esq', tipo: 'em-pe', trilho: [] }; }
    const [tx, ty] = mesa.teclado || [cx - 25, cy - 100];
    return { x: tx + slot * 16, y: ty, prof: cy - 2, tipo: 'em-pe', olhar: 'dir', trilho: [], naMesa: true };
  }
  const L = local(nome);
  let p;
  if (L.palestrante && id === 'gerente') p = L.palestrante;
  else {
    const n = L.pontos.length, base = L.pontos[slot % n], extra = Math.floor(slot / n);
    p = extra ? { ...base, x: base.x + extra * 34, y: base.y + extra * 18 } : base;
  }
  const acesso = L.acesso ? L.acesso[L.pontos.indexOf(p) >= 0 ? L.pontos.indexOf(p) : 0] : null;
  return { tipo: 'em-pe', ...p, trilho: acesso ? [acesso] : (L.trilho || []), sumir: !!L.sumir || nome === 'fora' };
}
function montarRota(a, b, voa) {
  if (voa) return [[a.x, a.y], [b.x, b.y]];
  const pa = [a.x, a.y], pb = [b.x, b.y];
  const ta = [...a.trilho].reverse(), tb = b.trilho;
  const ini = ta.length ? ta[ta.length - 1] : pa, fim = tb.length ? tb[0] : pb;
  const pts = [pa, ...ta, ...cena.caminho(ini, fim), ...tb, pb];
  return pts.filter((p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
}
function aoLongo(pts, d) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= L || i === pts.length - 2) { const k = L ? Math.min(1, d / L) : 1; return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: b[0] - a[0], dy: b[1] - a[1] }; }
    d -= L;
  }
}
const comp = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

function segmento(id, t) {
  const lin = agenda.linhas[id];
  if (!lin || !lin.length) return -1;
  let i = idx[id] ?? 0;
  if (i >= lin.length || lin[i].ini > t) i = 0;
  while (i < lin.length - 1 && lin[i].fim <= t) i++;
  idx[id] = i;
  return i;
}

function estado(id, t) {
  const i = segmento(id, t);
  if (i < 0) return null;
  const lin = agenda.linhas[id], s = lin[i], ant = lin[i - 1];
  const destino = ponto(s, id), origem = ant ? ponto(ant, id) : destino;
  const chave = id + '|' + i + '|' + s.ini;
  let r = rotas.get(chave);
  if (!r) {
    const pts = ant ? montarRota(origem, destino, VOA.has(id)) : [[destino.x, destino.y]];
    r = { pts, L: comp(pts) };
    if (rotas.size > 400) rotas.clear();
    rotas.set(chave, r);
  }
  const vel = (cen.velocidade || 120) * (s.vel || 1) * (id === 'pato' ? 0.45 : id === 'pombo' ? 1.4 : 1);
  const passado = (t - s.ini) * 60;
  let e;
  if (ant && r.L > 2 && passado < r.L / vel) {
    const p = aoLongo(r.pts, passado * vel);
    e = { x: p.x, y: p.y, dx: p.dx, dy: p.dy, andando: true, correndo: s.andar === 'correndo', dist: passado * vel, prog: passado * vel / r.L, visivel: true };
  } else {
    e = { x: destino.x, y: destino.y, andando: false, ponto: destino, visivel: !destino.sumir };
  }
  e.id = id; e.pose = s.pose; e.props = s.props; e.seg = s;
  return e;
}

const POSES = { falando: ['falando', 'em-pe'], cafe: ['cafe', 'em-pe'], brindando: ['brinde', 'em-pe'], varrendo: ['varrendo', 'em-pe'],
  extintor: ['extintor', 'em-pe'], preocupada: ['preocupada', 'em-pe'], prancheta: ['sentado-prancheta', 'sentado-costas'] };
const DE_COSTAS_OK = new Set(['em-pe', 'olhando', 'ofegante', 'comendo']);
function boneco(e, tSeg) {
  const b = { id: e.id, x: e.x, y: e.y, prof: e.y, ordem: e.y, alt: 0, espelho: false, nomes: ['em-pe'] };
  if (e.andando) {
    const f = (Math.floor(e.dist / (e.correndo ? 34 : 26)) % 2) + 1;
    const frente = e.dy >= 0;
    if (VOA.has(e.id)) { b.nomes = ['voando']; b.alt = 18 + Math.sin(Math.PI * Math.min(1, e.prog)) * 70; }
    else if (e.correndo && frente) b.nomes = ['correndo-' + f, 'andar-frente-' + f];
    else b.nomes = frente ? ['andar-frente-' + f, 'andar-frente-1'] : ['andar-costas-' + f, 'andar-costas-1', 'andar-frente-' + f];
    if (e.id === 'pato') b.nomes = ['em-pe'];
    b.espelho = e.dx > 0;
    b.alt += Math.abs(Math.sin((e.dist / 26) * Math.PI)) * (e.id === 'pato' ? 3 : 2);
    return b;
  }
  const p = e.ponto;
  b.prof = p.prof ?? p.y; b.ordem = p.ordem ?? Math.min(b.prof, p.y + 20);
  if (p.tipo === 'cadeira') {
    b.nomes = e.pose === 'dormindo' ? ['dormindo', 'sentado-costas'] : e.pose === 'digitando-rapido' ? ['digitando-rapido', 'sentado-costas'] : ['sentado-costas'];
    const sp = cena.sprite(e.id, b.nomes), nome = sp === cena.sprite(e.id, ['sentado-costas']) ? 'sentado-costas' : b.nomes[0];
    b.espelho = nome === 'sentado-costas' ? !SENTADO_OLHA_ESQ.has(e.id) : false;
  } else if (p.tipo === 'costas') { b.nomes = ['sofa']; b.espelho = p.olhar === 'dir'; }
  else if (p.tipo === 'frente') { b.nomes = ['comendo', 'sentado-costas']; b.espelho = p.olhar === 'dir'; }
  else {
    b.nomes = POSES[e.pose] || ['em-pe'];
    if (p.costas && DE_COSTAS_OK.has(e.pose || 'em-pe')) b.nomes = ['andar-costas-1', 'em-pe'];
    b.espelho = p.olhar === 'dir';
    if (VOA.has(e.id)) b.nomes = ['em-pe'];
  }
  if (e.falando) b.alt += Math.abs(Math.sin(tSeg * 7)) * 1.2;
  return b;
}

function periodo(t) {
  if (t < 330 || t >= 1130) return 'noite';
  if (t < 420) return 'aurora';
  if (t < 1035) return 'dia';
  return 'tarde';
}

// ---- balões (SVG por cima do canvas, mesmo viewBox da arte) ----
const FONTE = 30, LINHA = 32;
function quebrar(txt, max = 22) {
  const linhas = []; let cur = '';
  for (const w of txt.split(/\s+/)) { if ((cur + ' ' + w).trim().length > max && cur) { linhas.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) linhas.push(cur);
  return linhas;
}
function balao(id) {
  let b = baloes.get(id);
  if (!b) {
    const g = el('g', { class: 'balao', style: 'display:none' }, svg);
    b = { g, fundo: el('rect', { class: 'balao-fundo', rx: 11 }, g), rabo: el('path', { class: 'balao-rabo' }, g), txt: el('text', { 'text-anchor': 'middle' }, g), texto: '', vis: false, n: 1, w: 0 };
    baloes.set(id, b);
  }
  return b;
}
function mostrarBalao(id, texto, [hx, hy]) {
  const b = balao(id);
  if (b.texto !== texto) {
    b.texto = texto;
    const ls = quebrar(texto);
    b.txt.textContent = '';
    ls.forEach((l, i) => { const ts = el('tspan', { x: 0, dy: i ? LINHA : 0 }, b.txt); ts.textContent = l; });
    b.n = ls.length; b.w = Math.max(...ls.map((l) => l.length)) * FONTE * 0.48 + 30;
  }
  const W = cen.largura, h = b.n * LINHA + 14;
  const fundo = Math.max(16 + h, hy - 34);
  const cx = Math.min(W - b.w / 2 - 10, Math.max(b.w / 2 + 10, hx + (hx > W - 400 ? -54 : 54)));
  const topo = fundo - h;
  b.g.setAttribute('transform', `translate(${Math.round(cx)} ${Math.round(topo)})`);
  b.fundo.setAttribute('x', -b.w / 2); b.fundo.setAttribute('y', 0); b.fundo.setAttribute('width', b.w); b.fundo.setAttribute('height', h);
  b.txt.setAttribute('y', 30);
  const rx = hx - cx, ry = hy - topo;
  b.rabo.setAttribute('d', `M${Math.max(-b.w / 2 + 14, Math.min(b.w / 2 - 14, rx * 0.4))} ${h + 1}Q${rx * 0.7 + 8} ${(h + ry) / 2} ${rx} ${ry - 8}`);
  if (!b.vis) { b.g.style.display = ''; b.vis = true; }
}

// ---- tamanho do canvas ----
let K = 1;
function redimensionar() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(320, Math.min(cen.largura, Math.round(r.width * dpr)));
  if (canvas.width !== w) { canvas.width = w; canvas.height = Math.round(w * cen.altura / cen.largura); }
  K = canvas.width / cen.largura;
  ultimoQuadro = 0;
}

let ultimoQuadro = 0, ultimoHud = '', ultimoErro = 0, animando = true;
function quadro(agoraMs) {
  requestAnimationFrame(quadro);
  if (agoraMs - ultimoQuadro < (animando ? 33 : 250)) return;
  ultimoQuadro = agoraMs;
  try { desenhar(); } catch (e) { if (Date.now() - ultimoErro > 60000) { ultimoErro = Date.now(); console.error('[escritorio] erro no quadro', e); } }
}

const perto = (e, x, y, r) => Math.hypot(e.x - x, e.y - y) < r;
function desenhar() {
  const parede = relogio.agora();
  const d = new Date(parede);
  const key = d.toISOString().slice(0, 10);
  const tSeg = (parede % 86400000) / 1000;
  const t = tSeg / 60;
  const ag = obterAgenda(key);
  const dia = DIAS[d.getUTCDay()];

  // estados
  const estados = {};
  let pessoas = 0, andando = false;
  for (const p of elenco.personagens) {
    if (p.tipo === 'fixo') continue;
    const e = estado(p.id, t);
    if (!e) continue;
    if (e.visivel) estados[p.id] = e;
    if (e.andando) andando = true;
    if (p.tipo !== 'visitante' && e.seg.local !== 'fora') pessoas++;
  }
  // falas ativas
  const falando = {};
  for (const f of ag.falas) {
    if (f.ini > t) break;
    if (t >= f.fim) continue;
    const loc = ((t - f.ini) * 60) % f.ciclo;
    for (const it of f.itens) if (loc >= it.em && loc < it.em + it.dur) falando[it.quem] = it.texto;
  }
  for (const [id, e] of Object.entries(estados)) e.falando = !!falando[id] && !e.andando;

  const per = periodo(t);
  const luz = cen.luz || {};
  const acesa = pessoas > 0 && (t < hm(luz.acesaAte || '19:00') || pessoas >= (luz.minimoPessoasDepois || 2));
  const escuro = acesa ? 0 : per === 'noite' ? 0.74 : per === 'tarde' || per === 'aurora' ? 0.42 : 0.12;
  document.body.classList.toggle('noturno', escuro >= 0.4);

  // --- fundo ---
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cena.fundo, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  E.janela(ctx, cen.janela, per, t);
  E.relogio(ctx, cen.relogio, t, tSeg);
  const vivos = Object.values(estados);
  for (const [nome, q] of Object.entries(cen.portas || {})) {
    const [bx, by] = [(q[2][0] + q[3][0]) / 2, (q[2][1] + q[3][1]) / 2];
    const usando = elenco.personagens.some((p) => { const e = estados[p.id] || null; return e && e.andando && perto(e, bx, by, 70); });
    if (usando) E.portaAberta(ctx, q);
  }
  // mesa do Dev: tela, post-it, caneca
  const md = cen.mesas[(pessoa('dev') || {}).mesa ?? 2];
  const ativos = ag.efeitos.filter((ef) => ef.ini <= t && t < ef.fim && (ef.mesa === 'dev' || ef.mesa == null));
  const dev = estados.dev;
  const efTela = ativos.find((ef) => ef.tipo === 'tela'), efBilhete = ativos.find((ef) => ef.tipo === 'bilhete'), efFumaca = ativos.find((ef) => ef.tipo === 'fumaca');
  if (md.tela) {
    if (efBilhete) E.tela(ctx, md.tela, 'bilhete', efBilhete.texto, tSeg);
    else if (efTela) E.tela(ctx, md.tela, 'texto', efTela.texto, tSeg);
    else if (dev && !dev.andando && dev.ponto && dev.ponto.tipo === 'cadeira' && dev.pose !== 'dormindo') E.tela(ctx, md.tela, 'codigo', '', tSeg);
  }
  const segurandoCaneca = dev && (dev.pose === 'cafe' || (dev.props || []).includes('caneca'));
  if (md.caneca && !segurandoCaneca) E.caneca(ctx, md.caneca);
  if (md.postit) E.postit(ctx, md.postit, 0);
  // TV: videogame
  const jogando = vivos.some((e) => !e.andando && /videogame/.test(e.seg.acao || ''));
  if (jogando && cen.tv) E.tvJogo(ctx, cen.tv, tSeg);

  // --- bonecos, de trás pra frente ---
  const bs = vivos.map((e) => ({ e, b: boneco(e, tSeg) })).sort((a, b) => a.b.ordem - b.b.ordem);
  const cabecas = {};
  for (const { e, b } of bs) { const r = cena.desenharBoneco(ctx, b, K); if (r) cabecas[e.id] = r.cabeca; }
  ctx.setTransform(K, 0, 0, K, 0, 0);
  if (efFumaca && md.tela) E.fumaca(ctx, [(md.tela[0][0] + md.tela[1][0]) / 2, md.tela[1][1]], tSeg);

  // --- noite ---
  if (escuro > 0) {
    ctx.fillStyle = `rgba(12,12,18,${escuro})`; ctx.fillRect(0, 0, cen.largura, cen.altura);
    if (escuro >= 0.4 && md.postit) E.postit(ctx, md.postit, 1);
  }

  // --- balões ---
  const vistos = new Set();
  for (const [id, texto] of Object.entries(falando)) {
    let ponta;
    if (id === 'prompt') { const q = md.postit || [[1260, 712]]; ponta = [q[0][0] + 8, q[0][1] - 4]; }
    else { const e = estados[id]; if (!e || e.andando || !cabecas[id]) continue; ponta = cabecas[id]; }
    mostrarBalao(id, texto, ponta); vistos.add(id);
  }
  for (const [id, b] of baloes) if (!vistos.has(id) && b.vis) { b.g.style.display = 'none'; b.vis = false; }
  animando = andando || jogando || !!efFumaca || vistos.size > 0;

  // HUD
  const s = agenda.linhas.dev && agenda.linhas.dev[idx.dev ?? 0];
  let status = s ? s.status : '';
  if (s && s.local === 'fora' && ['sab', 'dom'].includes(dia) && !agenda.presentes.dev) status = (banco.padrao.status || {}).fds || status;
  const hud = `${dia.toUpperCase()} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} · ${fmtHM(t)}|${status}`;
  if (hud !== ultimoHud) { ultimoHud = hud; const [a, b] = hud.split('|'); hudHora.textContent = a; hudAcao.textContent = b; }
  ultimoEstado = { pessoas, tMin: t, fds: dia === 'sab' || dia === 'dom' };
  window.__estados = estados;
}

function painelAgenda() {
  if (!par.agenda) return;
  let p = document.getElementById('agenda');
  if (!p) { p = document.createElement('div'); p.id = 'agenda'; document.body.appendChild(p); }
  const linhas = agenda.instancias.filter((i) => i.quem === 'dev' || i.participantes.includes('dev') || i.quem === 'faxineiro')
    .map((i) => `<div>${fmtHM(i.ini)}–${fmtHM(i.fim)} · ${i.nome || i.id}</div>`).join('');
  p.innerHTML = `<b>Agenda do Dev · ${agenda.dia} ${agenda.data}</b>${linhas || '<div>(ninguém hoje)</div>'}`;
}

// ---- tarefas de longa duração ----
function hashTxt(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }
async function atualizarBanco() {
  ultimoBanco = Date.now();
  try {
    const [a, p] = await Promise.all([buscarJSON('data/acoes.json'), buscarJSON('data/personagens.json')]);
    if (!a || !Array.isArray(a.acoes) || !p || !Array.isArray(p.personagens)) throw new Error('JSON inválido');
    const ass = hashTxt(JSON.stringify(a) + JSON.stringify(p));
    if (ass === assinaturaBanco) return;
    const nova = gerarAgenda(agendaKey, a, p, { sal: par.sal }); // valida antes de trocar
    banco = a; elenco = p; assinaturaBanco = ass;
    const t = (relogio.agora() % 86400000) / 60000;
    agenda = mesclarAgendas(agenda, nova, t + 10);
    for (const k in idx) delete idx[k];
    rotas.clear();
    painelAgenda();
    console.info('[escritorio] banco de ações atualizado:', a.acoes.length, 'ações');
  } catch (e) { console.warn('[escritorio] não deu pra atualizar o banco:', e.message); }
}
async function checarVersao() {
  ultimaVersao = Date.now();
  try {
    const v = await buscarJSON('version.json');
    if (!v || !v.versao) return;
    if (versaoAtual === null) versaoAtual = v.versao;
    else if (v.versao !== versaoAtual && !reloadPendenteDesde) { reloadPendenteDesde = Date.now(); console.info('[escritorio] versão nova', v.versao, '— recarrego num momento tranquilo'); }
  } catch (e) { /* offline: tenta depois */ }
}
function talvezRecarregar() {
  if (!reloadPendenteDesde) return;
  const { pessoas, tMin, fds } = ultimoEstado;
  const tranquilo = pessoas === 0 && (fds || tMin < 7 * 60 || tMin >= 21 * 60);
  if (document.hidden || tranquilo || Date.now() - reloadPendenteDesde > RELOAD_MAX_MS) location.reload();
}
async function tarefas() {
  if (ocupado) return;
  ocupado = true;
  try {
    if (Date.now() - ultimoBanco >= BANCO_MS) await atualizarBanco();
    if (Date.now() - ultimaVersao >= VERSAO_MS) await checarVersao();
    talvezRecarregar();
  } finally { ocupado = false; }
}

async function iniciar() {
  [cen, banco, elenco] = await Promise.all([buscarJSON('data/cenario.json'), buscarJSON('data/acoes.json'), buscarJSON('data/personagens.json')]);
  assinaturaBanco = hashTxt(JSON.stringify(banco) + JSON.stringify(elenco));
  try { const v = await buscarJSON('version.json'); cen.assetsVersao = v && v.versao; versaoAtual = v && v.versao; ultimaVersao = Date.now(); } catch (e) { /* segue */ }
  cena = await carregarCena(cen);
  svg.setAttribute('viewBox', `0 0 ${cen.largura} ${cen.altura}`);
  try { await document.fonts.load('30px "Patrick Hand"'); } catch (e) { /* segue */ }
  redimensionar();
  window.addEventListener('resize', redimensionar);
  desenhar();
  document.body.classList.add('pronto');
  centralizarNoDev();
  requestAnimationFrame(quadro);
  setInterval(tarefas, 60e3); // um único timer pra tudo que é periódico
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { ultimoQuadro = 0; tarefas(); } });
  window.escritorio = { agenda: () => agenda, agora: () => relogio.agora(), atualizarBanco, checarVersao, estados: () => window.__estados, cena: () => cena,
    gerarAgenda: (k) => gerarAgenda(k, banco, elenco, { sal: par.sal }) };
}
// celular: o escritório fica mais largo que a tela; arrasta pros lados, começando pelo Dev
function centralizarNoDev() {
  const palco = document.getElementById('palco');
  if (palco.scrollWidth <= palco.clientWidth + 2) return;
  const md = cen.mesas[(pessoa('dev') || {}).mesa ?? 2];
  const w = document.getElementById('quadro').clientWidth;
  palco.scrollLeft = (md.cadeira[0] / cen.largura) * w - palco.clientWidth / 2;
}
iniciar().catch((e) => { console.error(e); document.getElementById('hud-acao').textContent = 'o escritório não abriu (erro ao carregar)'; });
