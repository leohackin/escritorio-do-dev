import { gerarAgenda, mesclarAgendas, fmtHM, hm, DIAS } from './agenda.js';
import { montarCenario, el } from './cenario.js';
import { criarBoneco, posar, pontoCabeca } from './boneco.js';
import { lerParametros, criarRelogio } from './relogio.js';

const BANCO_MS = 30 * 60e3, VERSAO_MS = 10 * 60e3, RELOAD_MAX_MS = 3 * 3600e3;
const par = lerParametros(location.search);
const relogio = criarRelogio(par);
const svg = document.getElementById('cena');
const hudHora = document.getElementById('hud-hora'), hudAcao = document.getElementById('hud-acao');

let cen, banco, elenco, refs, agenda = null, agendaKey = '', assinaturaBanco = '';
const bonecos = new Map(); const idx = {}; const baloes = new Map();
let versaoAtual = null, reloadPendenteDesde = 0, ultimoBanco = Date.now(), ultimaVersao = 0, ocupado = false;
let ultimoEstado = { pessoas: 0, tMin: 0, fds: false };

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
    for (const k in idx) delete idx[k];
    painelAgenda();
  }
  return agenda;
}

function sincronizarBonecos() {
  const ids = new Set();
  for (const p of elenco.personagens) {
    if (p.tipo === 'fixo') continue;
    ids.add(p.id);
    if (!bonecos.has(p.id)) { const b = criarBoneco(p); b.raiz.style.display = 'none'; refs.camadaAndando.appendChild(b.raiz); bonecos.set(p.id, b); }
  }
  for (const [id, b] of bonecos) if (!ids.has(id)) { b.raiz.remove(); bonecos.delete(id); }
}

function ponto(local, slot) {
  if (local.startsWith('assento:')) { const m = cen.mesas[+local.slice(8)] || cen.mesas[0]; return { x: m.x - 55, y: cen.chao, dir: 1, sentado: true }; }
  if (local.startsWith('lado:')) { const m = cen.mesas[+local.slice(5)] || cen.mesas[0]; return { x: m.x + 112 + slot * 46, y: cen.corredor, dir: -1 }; }
  if (local.startsWith('teclado:')) { const m = cen.mesas[+local.slice(8)] || cen.mesas[0]; return { x: m.x - 14 + slot * 26, y: 492, dir: -1, mesa: true }; }
  const L = cen.locais[local] || cen.locais.centro;
  let dir = L.olhar || 1;
  if (local === 'copa' && slot % 2 === 1) dir = -dir;
  return { x: L.x + (L.dx || 0) * slot, y: L.y, dir };
}
function rota(a, b) {
  if (Math.abs(a.y - b.y) < 1) return [a, b];
  return [a, { x: a.x, y: cen.corredor }, { x: b.x, y: cen.corredor }, b];
}
function aoLongo(pts, d) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= L || i === pts.length - 2) { const k = L ? Math.min(1, d / L) : 1; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: b.x - a.x }; }
    d -= L;
  }
}
const comp = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

function segmento(id, t) {
  const lin = agenda.linhas[id];
  if (!lin || !lin.length) return -1;
  let i = idx[id] ?? 0;
  if (i >= lin.length || lin[i].ini > t) i = 0;
  while (i < lin.length - 1 && lin[i].fim <= t) i++;
  idx[id] = i;
  return i;
}

function estado(id, t, tSeg) {
  const i = segmento(id, t);
  if (i < 0) return null;
  const lin = agenda.linhas[id], s = lin[i], ant = lin[i - 1];
  const b = bonecos.get(id);
  const destino = ponto(s.local, s.slot || 0);
  const origem = ant ? (ant.local === 'fora' ? ponto('porta', 0) : ponto(ant.local, ant.slot || 0)) : destino;
  const pts = s.local === 'fora' ? rota(origem, ponto('porta', 0)) : rota(origem, destino);
  const L = comp(pts);
  const base = b && b.forma === 'pato' ? 45 : b && b.forma === 'pombo' ? 60 : 80;
  const vel = base * (s.vel || 1);
  const passado = (t - s.ini) * 60;
  let e;
  if (ant && L > 2 && passado < L / vel) {
    const p = aoLongo(pts, passado * vel);
    e = { x: p.x, y: p.y, dir: p.dx < 0 ? -1 : p.dx > 0 ? 1 : destino.dir, andar: true, correndo: s.andar === 'correndo', fase: passado * vel / 11, visivel: true };
  } else {
    e = { x: destino.x, y: destino.y, dir: destino.dir, andar: false, sentado: destino.sentado, visivel: s.local !== 'fora' };
  }
  e.pose = s.pose; e.props = s.props; e.t = tSeg; e.seg = s;
  e.escala = b && b.forma !== 'humano' ? 1 : 1 + (e.y - cen.chao) * 0.0022;
  e.fundo = !e.andar && (destino.sentado || s.local === 'reuniao');
  return e;
}

function periodo(t) {
  if (t < 330 || t >= 1130) return 'noite';
  if (t < 420) return 'aurora';
  if (t < 1035) return 'dia';
  return 'tarde';
}

function quebrar(txt, max = 22) {
  const linhas = []; let cur = '';
  for (const w of txt.split(/\s+/)) { if ((cur + ' ' + w).trim().length > max && cur) { linhas.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) linhas.push(cur);
  return linhas;
}
function balao(id) {
  let b = baloes.get(id);
  if (!b) {
    const g = el('g', { class: 'balao', style: 'display:none' }, refs.baloes);
    b = { g, fundo: el('rect', { class: 'balao-fundo', rx: 8 }, g), rabo: el('path', { class: 'tf' }, g), txt: el('text', { 'text-anchor': 'middle' }, g), texto: '', vis: false, n: 1, w: 0 };
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
    ls.forEach((l, i) => { const ts = el('tspan', { x: 0, dy: i ? 24 : 0 }, b.txt); ts.textContent = l; });
    b.n = ls.length; b.w = Math.max(...ls.map((l) => l.length)) * 10.6 + 22;
  }
  const W = cen.largura, h = b.n * 24 + 10;
  const fundo = Math.max(60 + h, hy - 26);
  const cx = Math.min(W - b.w / 2 - 8, Math.max(b.w / 2 + 8, hx + (hx > W - 300 ? -40 : 40)));
  const topo = fundo - h;
  b.g.setAttribute('transform', `translate(${Math.round(cx)} ${Math.round(topo)})`);
  b.fundo.setAttribute('x', -b.w / 2); b.fundo.setAttribute('y', 0); b.fundo.setAttribute('width', b.w); b.fundo.setAttribute('height', h);
  b.txt.setAttribute('y', 22);
  const rx = hx - cx, ry = hy - topo;
  b.rabo.setAttribute('d', `M${Math.max(-b.w / 2 + 10, Math.min(b.w / 2 - 10, rx * 0.4))} ${h + 1}Q${rx * 0.7 + 6} ${(h + ry) / 2} ${rx} ${ry - 6}`);
  if (!b.vis) { b.g.style.display = ''; b.vis = true; }
}

let ultimoQuadro = 0, ultimoHud = '', classeCeu = '', ultimoErro = 0;
function quadro(agoraMs) {
  requestAnimationFrame(quadro);
  if (agoraMs - ultimoQuadro < 33) return;
  ultimoQuadro = agoraMs;
  try { desenhar(); } catch (e) { if (Date.now() - ultimoErro > 60000) { ultimoErro = Date.now(); console.error('[escritorio] erro no quadro', e); } }
}

function desenhar() {
  const parede = relogio.agora();
  const d = new Date(parede);
  const key = d.toISOString().slice(0, 10);
  const tSeg = (parede % 86400000) / 1000;
  const t = tSeg / 60;
  const ag = obterAgenda(key);
  const dia = DIAS[d.getUTCDay()];

  // personagens
  const estados = {};
  let pessoas = 0, portaAberta = false;
  for (const [id, b] of bonecos) {
    const e = estado(id, t, tSeg);
    if (!e || !e.visivel) { if (b.raiz.style.display !== 'none') b.raiz.style.display = 'none'; continue; }
    estados[id] = e;
    if (b.raiz.style.display === 'none') b.raiz.style.display = '';
    const camada = e.fundo ? refs.camadaSentados : refs.camadaAndando;
    if (b.raiz.parentNode !== camada) camada.appendChild(b.raiz);
    if (b.forma === 'humano' && e.seg.local !== 'fora') pessoas++;
    if (e.andar && e.x < 200 && e.y > 620) portaAberta = true;
  }

  // falas ativas
  const falando = {};
  for (const f of ag.falas) {
    if (f.ini > t) break;
    if (t >= f.fim) continue;
    const loc = ((t - f.ini) * 60) % f.ciclo;
    for (const it of f.itens) if (loc >= it.em && loc < it.em + it.dur) falando[it.quem] = it.texto;
  }
  for (const [id, e] of Object.entries(estados)) { e.falando = !!falando[id] && !e.andar; posar(bonecos.get(id), e); }

  // balões
  const vistos = new Set();
  for (const [id, texto] of Object.entries(falando)) {
    let ponta;
    if (id === 'prompt') ponta = [refs.devX + 20, 392];
    else { const e = estados[id]; if (!e || e.andar) continue; ponta = pontoCabeca(bonecos.get(id), e); }
    mostrarBalao(id, texto, ponta); vistos.add(id);
  }
  for (const [id, b] of baloes) if (!vistos.has(id) && b.vis) { b.g.style.display = 'none'; b.vis = false; }

  // luz, céu, relógio, porta
  const per = periodo(t);
  const luz = cen.luz || {};
  const acesa = pessoas > 0 && (t < hm(luz.acesaAte || '19:00') || pessoas >= (luz.minimoPessoasDepois || 2));
  const escuro = acesa ? 0 : per === 'noite' ? 0.8 : per === 'tarde' || per === 'aurora' ? 0.5 : 0.16;
  if (refs.escuro._op !== escuro) { refs.escuro.setAttribute('opacity', escuro); refs.escuro._op = escuro; document.body.classList.toggle('noturno', escuro >= 0.5); }
  refs.postitNoite.setAttribute('opacity', escuro > 0.5 ? 1 : 0);
  refs.raios.style.display = acesa ? '' : 'none';
  if (classeCeu !== per) {
    classeCeu = per;
    refs.ceu.fundo.setAttribute('fill', per === 'noite' ? '#1c1c1c' : '#fff');
    refs.ceu.fundo.parentNode.setAttribute('class', per);
    refs.ceu.hachura.style.display = per === 'tarde' || per === 'aurora' ? '' : 'none';
    refs.ceu.lua.style.display = refs.ceu.estrelas.style.display = per === 'noite' ? '' : 'none';
    refs.ceu.sol.style.display = per === 'noite' ? 'none' : '';
    refs.ceu.nuvens.style.display = per === 'noite' ? 'none' : '';
  }
  if (per !== 'noite') { const k = Math.min(1, Math.max(0, (t - 330) / 800)); refs.ceu.sol.setAttribute('transform', `translate(${(962 + k * 216).toFixed(1)} ${(300 - Math.sin(Math.PI * k) * 150).toFixed(1)})`); }
  else { const k = ((t + 310) % 1440) / 640; refs.ceu.lua.setAttribute('transform', `translate(${(1170 - Math.min(1, k) * 200).toFixed(1)} 176)`); }
  refs.ceu.nuvens.setAttribute('transform', `translate(${(900 + ((tSeg * 1.5) % 420)).toFixed(1)} 175)`);
  const { pH, pM, pS } = refs.ponteiros;
  pH.setAttribute('transform', `rotate(${(((t / 60) % 12) * 30).toFixed(2)})`);
  pM.setAttribute('transform', `rotate(${((t % 60) * 6).toFixed(2)})`);
  pS.setAttribute('transform', `rotate(${(Math.floor(tSeg % 60) * 6)})`);
  refs.portaAberta.style.display = portaAberta ? '' : 'none';
  refs.portaFechada.style.display = portaAberta ? 'none' : '';

  // telas, efeitos
  const ativos = ag.efeitos.filter((ef) => ef.ini <= t && t < ef.fim);
  const devEst = estados.dev;
  const segurandoCaneca = devEst && (devEst.props && devEst.props.includes('caneca') || devEst.pose === 'cafe') && devEst.seg.acao !== 'trabalho';
  refs.caneca.style.display = segurandoCaneca ? 'none' : '';
  cen.mesas.forEach((m, i) => {
    const tela = refs.telas[i];
    const dono = elenco.personagens.find((p) => p.mesa === i && p.tipo !== 'fixo');
    const e = dono && estados[dono.id];
    const ligada = !!e;
    const efTela = ativos.find((ef) => ef.tipo === 'tela' && mesaDe(ef.mesa) === i);
    const efFumaca = ativos.find((ef) => ef.tipo === 'fumaca' && mesaDe(ef.mesa) === i);
    const efBilhete = ativos.find((ef) => ef.tipo === 'bilhete' && mesaDe(ef.mesa) === i);
    const chave = `${ligada}|${efTela ? efTela.texto : ''}|${efBilhete ? efBilhete.texto : ''}`;
    if (tela._chave !== chave) {
      tela._chave = chave;
      tela.codigo.style.display = ligada && !efTela ? '' : 'none';
      tela.texto.textContent = efTela ? efTela.texto : '';
      tela.bilhete.style.display = efBilhete ? '' : 'none';
      if (efBilhete) { tela.bilheteTxt.textContent = ''; quebrar(efBilhete.texto, 11).slice(0, 4).forEach((l, k) => { const ts = el('tspan', { x: tela.X + 52, dy: k ? 11 : 0 }, tela.bilheteTxt); ts.textContent = l; }); }
    }
    tela.cursor.style.display = ligada && !efTela && Math.floor(tSeg * 2) % 2 ? '' : 'none';
    if (ligada && e.pose && e.pose.startsWith('digitando') && !efTela) tela.codigo.setAttribute('transform', `translate(0 ${-(Math.floor(tSeg * 1.5) % 3)})`);
    tela.fumaca.forEach((c, k) => {
      if (!efFumaca) { if (c.style.display !== 'none') c.style.display = 'none'; return; }
      const ph = (tSeg * 0.35 + k / 6) % 1;
      c.style.display = '';
      c.setAttribute('transform', `translate(${(tela.X + 40 + Math.sin(ph * 7 + k) * 12).toFixed(1)} ${(380 - ph * 120).toFixed(1)}) scale(${(0.6 + ph * 1.6).toFixed(2)})`);
      c.setAttribute('opacity', (1 - ph).toFixed(2));
    });
    const furo = refs.furos[i];
    const mostrarFuro = escuro > 0 && e && e.sentado && !e.andar;
    furo.style.display = mostrarFuro ? '' : 'none';
  });

  // HUD
  const s = agenda.linhas.dev && agenda.linhas.dev[idx.dev ?? 0];
  let status = s ? s.status : '';
  if (s && s.local === 'fora' && ['sab', 'dom'].includes(dia) && !agenda.presentes.dev) status = (banco.padrao.status || {}).fds || status;
  const hud = `${dia.toUpperCase()} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} · ${fmtHM(t)}|${status}`;
  if (hud !== ultimoHud) { ultimoHud = hud; const [a, b] = hud.split('|'); hudHora.textContent = a; hudAcao.textContent = b; }
  ultimoEstado = { pessoas, tMin: t, fds: dia === 'sab' || dia === 'dom' };
}
function mesaDe(id) { const p = elenco.personagens.find((x) => x.id === id); return p ? p.mesa : -1; }

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
    sincronizarBonecos();
    const t = (relogio.agora() % 86400000) / 60000;
    agenda = mesclarAgendas(agenda, nova, t + 10);
    for (const k in idx) delete idx[k];
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
  refs = montarCenario(svg, cen);
  sincronizarBonecos();
  checarVersao();
  try { await document.fonts.load('20px "Patrick Hand"'); } catch (e) { /* segue */ }
  desenhar();
  document.body.classList.add('pronto');
  const palco = document.getElementById('palco');
  if (palco.scrollWidth > palco.clientWidth) palco.scrollLeft = (refs.devX / cen.largura) * svg.clientWidth - palco.clientWidth / 2;
  requestAnimationFrame(quadro);
  setInterval(tarefas, 60e3); // um único timer pra tudo que é periódico
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { ultimoQuadro = 0; tarefas(); } });
  window.escritorio = { agenda: () => agenda, agora: () => relogio.agora(), atualizarBanco, checarVersao, gerarAgenda: (k) => gerarAgenda(k, banco, elenco, { sal: par.sal }) };
}
iniciar().catch((e) => { console.error(e); document.getElementById('hud-acao').textContent = 'o escritório não abriu (erro ao carregar)'; });
