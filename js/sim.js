// Estado do escritório como função da hora: onde cada pessoa está, se anda,
// que pose usa. Sem DOM. O cache de rotas é esvaziado na virada do dia.

import { amostra, avanco, comprimento, criarRoteador } from './caminho.js';

const VOA = new Set(['pombo']);
const SENTADO_OLHA_ESQ = new Set(['gerente', 'carla']);
const SEM_SLOT = /^(assento|lado|teclado):|^(fora|porta|banheiro)$/;

const POSE_PE = {
  falando: ['falando', 'em-pe'],
  cafe: ['cafe', 'em-pe'],
  brindando: ['brinde', 'em-pe'],
  varrendo: ['varrendo', 'em-pe'],
  extintor: ['extintor', 'em-pe'],
  preocupada: ['preocupada', 'em-pe'],
  prancheta: ['sentado-prancheta', 'sentado-costas', 'em-pe'],
  ofegante: ['em-pe'],
  olhando: ['em-pe'],
  digitando: ['em-pe'],
  comendo: ['comendo', 'em-pe'],
};

export function prepararAgenda(ag) {
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
  return ag;
}

function localDe(cen, nome) {
  let L = cen.locais[nome] || cen.locais.centro;
  if (L.alias) L = cen.locais[L.alias];
  return L;
}

export function pontoDe(cen, s, id) {
  const nome = s.local, slot = s.slot || 0;
  const m = /^(assento|lado|teclado):(\d+)$/.exec(nome);
  if (m) {
    const mesa = cen.mesas[+m[2]] || cen.mesas[2], [cx, cy] = mesa.cadeira;
    if (m[1] === 'assento') return { x: cx, y: cy, tipo: 'cadeira', trilho: [], olhar: 'esq' };
    if (m[1] === 'lado') {
      const [lx, ly] = mesa.lado || [cx + 78, cy - 4];
      return { x: lx + (slot % 3) * 36, y: ly + (slot % 3) * 16, olhar: slot % 2 ? 'dir' : 'esq', tipo: 'em-pe', trilho: [] };
    }
    const [tx, ty] = mesa.teclado || [cx - 25, cy - 100];
    return { x: tx + (slot % 3) * 14, y: ty, tipo: 'em-pe', olhar: 'dir', trilho: [] };
  }
  const L = localDe(cen, nome);
  let p;
  if (L.palestrante && id === 'gerente') p = L.palestrante;
  else {
    const n = L.pontos.length, base = L.pontos[slot % n], extra = Math.floor(slot / n);
    p = extra ? { ...base, x: base.x + (extra % 4) * 28, y: base.y + (extra % 4) * 14 } : base;
  }
  const idx = L.pontos.indexOf(p);
  const acesso = L.acesso ? L.acesso[idx >= 0 ? idx : 0] : null;
  return {
    tipo: p.tipo || 'em-pe', olhar: p.olhar, costas: !!p.costas, prof: p.prof,
    x: p.x, y: p.y, local: nome,
    trilho: acesso ? [acesso] : (L.trilho || []),
    sumir: !!L.sumir || nome === 'fora' || nome === 'porta' || nome === 'banheiro',
  };
}

function waypoints(origem, destino) {
  const pts = [[origem.x, origem.y]];
  for (const p of [...(origem.trilho || [])].reverse()) pts.push(p);
  for (const p of destino.trilho || []) pts.push(p);
  if (!destino.sumir) pts.push([destino.x, destino.y]);
  return pts;
}

function velCruise(s, id) {
  if (id === 'pato') return 64;
  if (id === 'pombo') return 150;
  if (s.andar === 'correndo') return 156;
  let v = 102;
  if (s.vel && s.vel !== 1) v *= Math.min(1.15, Math.max(0.75, s.vel));
  return v;
}

function fase(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296 * Math.PI * 2;
}

export function criarSim(cen, grade) {
  const rotas = criarRoteador(grade);
  const cache = new Map();
  const idx = {};

  function limpar() { cache.clear(); for (const k in idx) delete idx[k]; rotas.limpar(); }

  function segmento(lin, id, t) {
    if (!lin || !lin.length) return -1;
    let i = idx[id] ?? 0;
    if (i >= lin.length || lin[i].ini > t) i = 0;
    while (i < lin.length - 1 && lin[i].fim <= t) i++;
    idx[id] = i;
    return i;
  }

  function rotaDe(id, i, origem, destino) {
    const chave = id + '|' + i + '|' + destino.x + '|' + destino.y + '|' + (destino.sumir ? 1 : 0);
    let r = cache.get(chave);
    if (!r) {
      const voa = VOA.has(id);
      const pts = voa
        ? [[origem.x, origem.y], [destino.sumir ? (destino.trilho?.[0]?.[0] ?? destino.x) : destino.x, destino.sumir ? (destino.trilho?.[0]?.[1] ?? destino.y) : destino.y]]
        : rotas.rota(waypoints(origem, destino));
      if (!pts.length) pts.push([origem.x, origem.y]);
      r = { pts, L: comprimento(pts) };
      if (cache.size > 500) cache.clear();
      cache.set(chave, r);
    }
    return r;
  }

  function visual(e) {
    const p = e.ponto;
    const base = { nomes: ['em-pe'], espelho: false, bob: 0, alt: 0, respira: true };
    if (e.andando) {
      if (e.id === 'pombo') {
        return { ...base, nomes: ['voando', 'em-pe'], espelho: e.dx > 8, alt: 18 + Math.sin(Math.min(1, e.prog) * Math.PI) * 78, respira: false, voando: true };
      }
      if (e.id === 'pato') {
        return { ...base, nomes: ['em-pe'], espelho: e.dx > 6, bob: Math.abs(Math.sin(e.dist / 12)) * 5, respira: false };
      }
      const frente = e.dy >= -8;
      const passo = e.correndo ? 18 : 28;
      const f = (Math.floor(e.dist / passo) % 2) + 1;
      let nomes;
      if (e.correndo && frente) nomes = ['correndo-' + f, 'andar-frente-' + f, 'em-pe'];
      else if (frente) nomes = ['andar-frente-' + f, 'andar-frente-1', 'em-pe'];
      else nomes = ['andar-costas-' + f, 'andar-costas-1', 'andar-frente-' + f, 'em-pe'];
      return {
        ...base, nomes, espelho: e.dx > 8, respira: false,
        bob: Math.abs(Math.sin((e.dist / passo) * Math.PI)) * (e.correndo ? 5 : 3.4),
      };
    }
    if (!p) return base;
    if (p.tipo === 'cadeira') {
      let nomes = ['sentado-costas', 'em-pe'];
      if (e.pose === 'dormindo') nomes = ['dormindo', 'sentado-costas', 'em-pe'];
      else if (e.pose === 'digitando-rapido') nomes = ['digitando-rapido', 'sentado-costas', 'em-pe'];
      else if (e.pose === 'preocupada') nomes = ['preocupada', 'sentado-prancheta', 'sentado-costas'];
      else if (e.pose === 'prancheta') nomes = ['sentado-prancheta', 'sentado-costas'];
      const nome = nomes[0];
      const espelho = nome === 'sentado-costas' ? !SENTADO_OLHA_ESQ.has(e.id) : false;
      return { ...base, nomes, espelho, sentado: true };
    }
    if (p.tipo === 'costas' && (p.local === 'sofa' || p.local === 'mesa-cozinha')) {
      // Sprite de cabeça e ombros. No sofá sobe um tanto fixo; na cozinha
      // o jogo encaixa no topo do encosto. O shader esconde o resto.
      return {
        ...base, nomes: ['sofa', 'em-pe'], espelho: p.olhar === 'dir', sentado: true,
        levantar: p.local === 'sofa' ? 56 : 0, encaixar: p.local === 'mesa-cozinha',
      };
    }
    if (p.tipo === 'costas') {
      // Cadeira/mesa já vêm desenhadas no sprite. O mapa de profundidade
      // marca o móvel inteiro com o y da frente e apagaria a pessoa.
      const espelho = p.olhar === 'dir' ? SENTADO_OLHA_ESQ.has(e.id) : !SENTADO_OLHA_ESQ.has(e.id);
      return { ...base, nomes: ['sentado-costas', 'em-pe'], espelho, sentado: true, semOclusao: true };
    }
    if (p.tipo === 'frente') return { ...base, nomes: ['comendo', 'em-pe'], espelho: p.olhar === 'dir', sentado: true };
    // Em pé, inclusive de costas pra TV/pia/fila: a arte não tem "parado de costas".
    // Usar o quadro de caminhada deixava todo mundo no meio do passo.
    const nomes = POSE_PE[e.pose] || ['em-pe'];
    return { ...base, nomes, espelho: p.olhar === 'dir' };
  }

  function estado(id, agenda, tMin) {
    const lin = agenda.linhas[id];
    const i = segmento(lin, id, tMin);
    if (i < 0) return null;
    const s = lin[i], ant = lin[i - 1];
    const destino = pontoDe(cen, s, id);
    const origem = ant ? pontoDe(cen, ant, id) : destino;
    const r = rotaDe(id, i, origem, destino);
    const v = velCruise(s, id);
    const T = r.L > 3 ? r.L / v : 0;
    const passado = (tMin - s.ini) * 60;
    let e;
    if (ant && T > 0.05 && passado < T) {
      const d = avanco(passado, T, r.L);
      const p = amostra(r.pts, d);
      e = {
        x: p.x, y: p.y, dx: p.dx, dy: p.dy, andando: true,
        correndo: s.andar === 'correndo', dist: d, prog: r.L ? d / r.L : 1, visivel: true,
      };
      if (destino.sumir && e.prog > 0.9) e.visivel = false;
    } else {
      const fim = r.pts[r.pts.length - 1] || [destino.x, destino.y];
      const noLugar = !destino.sumir;
      e = {
        x: noLugar ? destino.x : fim[0], y: noLugar ? destino.y : fim[1],
        dx: 0, dy: 0, andando: false, visivel: noLugar, prog: 1, dist: r.L,
      };
    }
    e.id = id; e.pose = s.pose; e.props = s.props; e.seg = s; e.ponto = destino; e.fase = fase(id);
    e.visual = visual(e);
    return e;
  }

  return { estado, limpar, pontoDe: (s, id) => pontoDe(cen, s, id) };
}
