// Liga o relógio, a agenda e a cena Phaser. Um timer só para o que é lento
// (banco de ações, version.json, reload). O quadro é o loop do Phaser.

import { fmtHM, gerarAgenda, mesclarAgendas } from './agenda.js';
import { criarCena } from './jogo.js';
import { lerParametros, criarRelogio } from './relogio.js';
import { prepararAgenda } from './sim.js';

const BANCO_MS = 30 * 60e3, VERSAO_MS = 10 * 60e3, RELOAD_MAX_MS = 3 * 3600e3;
const par = lerParametros(location.search);
const relogio = criarRelogio(par);

let banco, elenco, indice, agenda = null, agendaKey = '', assinaturaBanco = '';
let versaoAtual = null, reloadPendenteDesde = 0, ultimoBanco = Date.now(), ultimaVersao = 0, ocupado = false;

const deps = {
  cen: null, indice: null, relogio, par, versao: '',
  agendaRef: { atual: null }, elencoRef: { atual: null },
  revisao: 0, sim: null, cena: null, ultimoEstado: { pessoas: 0, tMin: 0, fds: false },
  garantirDia: () => {
    const key = new Date(relogio.agora()).toISOString().slice(0, 10);
    if (key !== agendaKey) obterAgenda(key);
  },
  onPronto: () => document.body.classList.add('pronto'),
};

async function buscarJSON(url) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

function publicarAgenda(ag) {
  agenda = prepararAgenda(ag);
  deps.agendaRef.atual = agenda;
  deps.revisao++;
  if (deps.sim) deps.sim.limpar();
  painelAgenda();
}

function obterAgenda(key) {
  if (key !== agendaKey) {
    agendaKey = key;
    publicarAgenda(gerarAgenda(key, banco, elenco, { sal: par.sal }));
  }
  return agenda;
}

function painelAgenda() {
  if (!par.agenda || !agenda) return;
  let p = document.getElementById('agenda');
  if (!p) { p = document.createElement('div'); p.id = 'agenda'; document.body.appendChild(p); }
  const linhas = agenda.instancias.filter((i) => i.quem === 'dev' || i.participantes.includes('dev') || i.quem === 'faxineiro')
    .map((i) => `<div>${fmtHM(i.ini)}–${fmtHM(i.fim)} · ${i.nome || i.id}</div>`).join('');
  p.innerHTML = `<b>Agenda do Dev · ${agenda.dia} ${agenda.data}</b>${linhas || '<div>(ninguém hoje)</div>'}`;
}

function hashTxt(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

async function atualizarBanco() {
  ultimoBanco = Date.now();
  try {
    const [a, p] = await Promise.all([buscarJSON('data/acoes.json'), buscarJSON('data/personagens.json')]);
    if (!a || !Array.isArray(a.acoes) || !p || !Array.isArray(p.personagens)) throw new Error('JSON inválido');
    const ass = hashTxt(JSON.stringify(a) + JSON.stringify(p));
    if (ass === assinaturaBanco) return;
    const nova = gerarAgenda(agendaKey, a, p, { sal: par.sal });
    banco = a; elenco = p; assinaturaBanco = ass;
    deps.elencoRef.atual = elenco;
    const t = (relogio.agora() % 86400000) / 60000;
    publicarAgenda(mesclarAgendas(agenda, nova, t + 10));
    if (deps.cena) deps.cena.syncAtores(elenco);
    console.info('[escritorio] banco de ações atualizado:', a.acoes.length, 'ações');
  } catch (e) { console.warn('[escritorio] não deu pra atualizar o banco:', e.message); }
}

async function checarVersao() {
  ultimaVersao = Date.now();
  try {
    const v = await buscarJSON('version.json');
    if (!v || !v.versao) return;
    if (versaoAtual === null) versaoAtual = v.versao;
    else if (v.versao !== versaoAtual && !reloadPendenteDesde) {
      reloadPendenteDesde = Date.now();
      console.info('[escritorio] versão nova', v.versao, '— recarrego num momento tranquilo');
    }
  } catch (e) { /* offline: tenta depois */ }
}

function talvezRecarregar() {
  if (!reloadPendenteDesde) return;
  const { pessoas, tMin, fds } = deps.ultimoEstado;
  const tranquilo = pessoas === 0 && (fds || tMin < 7 * 60 || tMin >= 21 * 60);
  if (document.hidden || tranquilo || Date.now() - reloadPendenteDesde > RELOAD_MAX_MS) location.reload();
}

async function tarefas() {
  if (ocupado) return;
  ocupado = true;
  try {
    const parede = relogio.agora();
    const key = new Date(parede).toISOString().slice(0, 10);
    if (key !== agendaKey) obterAgenda(key);
    if (Date.now() - ultimoBanco >= BANCO_MS) await atualizarBanco();
    if (Date.now() - ultimaVersao >= VERSAO_MS) await checarVersao();
    talvezRecarregar();
  } finally { ocupado = false; }
}

function painelSeAgenda() { if (par.agenda) painelAgenda(); }

async function iniciar() {
  const [cen, b, el, ind] = await Promise.all([
    buscarJSON('data/cenario.json'), buscarJSON('data/acoes.json'), buscarJSON('data/personagens.json'),
    fetch('assets/sprites/indice.json').then((r) => r.json()),
  ]);
  banco = b; elenco = el; indice = ind;
  deps.cen = cen; deps.indice = indice; deps.elencoRef.atual = elenco;
  assinaturaBanco = hashTxt(JSON.stringify(banco) + JSON.stringify(elenco));
  try {
    const v = await buscarJSON('version.json');
    versaoAtual = v && v.versao; ultimaVersao = Date.now(); deps.versao = versaoAtual || '';
  } catch (e) { /* segue sem versão */ }
  try { await document.fonts.load('22px "Patrick Hand"'); } catch (e) { /* segue */ }
  const key = new Date(relogio.agora()).toISOString().slice(0, 10);
  agendaKey = key;
  publicarAgenda(gerarAgenda(key, banco, elenco, { sal: par.sal }));
  painelSeAgenda();
  const jogo = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'palco',
    backgroundColor: '#ffffff',
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60, smoothStep: true },
    input: { activePointers: 3 },
    scene: criarCena(deps),
  });
  setInterval(tarefas, 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tarefas(); });
  window.escritorio = {
    agenda: () => agenda,
    agora: () => relogio.agora(),
    atualizarBanco, checarVersao,
    estados: () => deps.estados,
    gerarAgenda: (k) => gerarAgenda(k, banco, elenco, { sal: par.sal }),
    jogo: () => jogo,
    planta: (v) => deps.cena && deps.cena.togglePlanta(v == null ? undefined : !!v),
  };
}

iniciar().catch((e) => {
  console.error(e);
  const h = document.getElementById('hud-acao');
  if (h) h.textContent = 'o escritório não abriu (erro ao carregar)';
});
