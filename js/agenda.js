// Gerador determinístico da agenda do dia (sem DOM: roda no navegador e no Node).
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const UTEIS = ['seg', 'ter', 'qua', 'qui', 'sex'];

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hm(s) { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); }
const pad = (n) => String(n).padStart(2, '0');
export function fmtHM(min) { min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(Math.floor(min % 60)); }
export function diaDaSemana(dataKey) { return DIAS[new Date(dataKey + 'T12:00:00Z').getUTCDay()]; }

// Converte o formato "atalho" (local/pose/duracao/envolvidos) em etapas.
function normalizar(a) {
  const base = { local: a.local || 'mesa', pose: a.pose || 'em-pe' };
  let etapas;
  if (Array.isArray(a.etapas) && a.etapas.length) {
    etapas = a.etapas.map((e) => ({ ...e }));
  } else {
    const papeis = {};
    if (a.quem !== 'cenario') papeis.eu = { ...base };
    for (const env of a.envolvidos || []) {
      const q = typeof env === 'string' ? env : env.quem;
      papeis[q] = { local: (env && env.local) || base.local, pose: (env && env.pose) || 'em-pe' };
    }
    etapas = [{ dur: a.duracao ?? 5, papeis, falas: a.falas, efeitos: a.efeitos, status: a.status,
      andar: a.andar, vel: a.vel, props: a.props, cicloFalas: a.cicloFalas }];
  }
  for (const e of etapas) {
    if (e.dur == null) e.dur = 5;
    if (!e.papeis) e.papeis = a.quem === 'cenario' ? {} : { eu: { ...base } };
  }
  return etapas;
}

function combina(a, p) {
  if (Array.isArray(a.quem)) return a.quem.includes(p.id);
  return a.quem === p.id || a.quem === p.tipo;
}

export function gerarAgenda(dataKey, banco, elenco, opts = {}) {
  const rng = mulberry32(hashStr('vidadodev|' + dataKey + '|' + (opts.sal || '')));
  const range = (v) => (Array.isArray(v) ? v[0] + rng() * (v[1] - v[0]) : Number(v));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const pesado = (lista, pesoDe) => {
    const tot = lista.reduce((s, x) => s + Math.max(0, pesoDe(x)), 0);
    let r = rng() * tot;
    for (const x of lista) { r -= Math.max(0, pesoDe(x)); if (r <= 0) return x; }
    return lista[lista.length - 1];
  };
  const horaNaJanela = (a) => {
    const j = a.janela || ['09:00', '18:00'];
    const i0 = hm(j[0]); let i1 = hm(j[1]); if (i1 < i0) i1 = i0;
    return Math.round((i0 + rng() * (i1 - i0)) * 4) / 4; // múltiplos de 15s
  };

  const dia = diaDaSemana(dataKey);
  const padrao = banco.padrao || {};
  const todos = elenco.personagens;
  const porId = Object.fromEntries(todos.map((p) => [p.id, p]));
  const atores = todos.filter((p) => p.tipo !== 'fixo');
  const presente = {};
  for (const p of atores) presente[p.id] = p.tipo !== 'visitante' && (p.dias || UTEIS).includes(dia) && rng() < (p.presenca ?? 1);

  const ocup = {}, segs = {}, pres = {};
  atores.forEach((p) => { ocup[p.id] = []; segs[p.id] = []; });
  const falas = [], efeitos = [], houve = {}, instancias = [];
  const acoes = (banco.acoes || []).filter((a) => a && a.id && (!a.dias || a.dias.includes(dia)));
  const colegasPresentes = () => atores.filter((p) => p.tipo === 'colega' && presente[p.id]).map((p) => p.id);
  const livre = (id, i, f) => ocup[id].every(([a, b]) => f <= a + 1e-6 || i >= b - 1e-6);
  const disponivel = (id, i, f, forca) => {
    const p = porId[id]; if (!p || !ocup[id]) return false;
    if (!livre(id, i, f)) return false;
    if (p.tipo === 'visitante' || forca) return true;
    const j = pres[id];
    return presente[id] && j && i >= j.ini - 1e-6 && f <= j.fim + 1e-6;
  };
  const ultimoOcupado = (id) => ocup[id].reduce((m, [, b]) => Math.max(m, b), 0);
  const localReal = (local, id) => {
    const p = porId[id];
    if (local === 'mesa') return p && p.mesa != null ? 'assento:' + p.mesa : 'centro';
    const m = /^(mesa|teclado):(.+)$/.exec(local);
    if (m) { const dono = porId[m[2]]; const idx = dono ? dono.mesa : 2; return (m[1] === 'mesa' ? 'lado:' : 'teclado:') + idx; }
    return local;
  };

  function tentar(acao, euId, ini, forca = false) {
    const etapasN = normalizar(acao);
    let t = ini;
    const etapas = etapasN.map((e) => { const d = Math.max(0.25, range(e.dur)); const r = { e, ini: t, fim: t + d }; t += d; return r; });
    const fimTotal = Math.min(t, 1440);
    if (t > 1440 + 1e-6 && !(acao.categoria === 'ambiente')) return null;
    if (etapas.length) etapas[etapas.length - 1].fim = fimTotal;
    const mapa = { eu: euId };
    const papeis = new Set();
    etapas.forEach((r) => Object.keys(r.e.papeis).forEach((k) => papeis.add(k)));
    (acao.requer || []).forEach((k) => papeis.add(k));
    papeis.delete('eu');
    const span = (k) => {
      const rs = etapas.filter((r) => k in r.e.papeis);
      return rs.length ? [rs[0].ini, rs[rs.length - 1].fim] : [ini, fimTotal];
    };
    const ordem = [...papeis].sort((a, b) => (a === 'colegas') - (b === 'colegas') || (a.startsWith('colega')) - (b.startsWith('colega')));
    const usados = () => new Set([euId, ...Object.values(mapa).flat()]);
    for (const k of ordem) {
      const [a, b] = span(k);
      if (k === 'colegas') {
        const u = usados();
        mapa.colegas = colegasPresentes().filter((c) => !u.has(c) && disponivel(c, a, b));
        if ((acao.requer || []).includes('colegas') && !mapa.colegas.length) return null;
      } else if (k === 'colega' || k === 'colega2') {
        const u = usados();
        const c = colegasPresentes().filter((x) => !u.has(x) && disponivel(x, a, b));
        if (!c.length) return null;
        mapa[k] = pick(c);
      } else if (porId[k] && ocup[k]) {
        if (!disponivel(k, a, b)) return null;
        mapa[k] = k;
      } else if (k === 'prompt') {
        mapa[k] = 'prompt';
      } else return null;
    }
    if (euId !== 'cenario' && !disponivel(euId, ini, fimTotal, forca)) return null;

    // confirmou: grava segmentos, falas e efeitos
    houve[acao.id] = (houve[acao.id] || 0) + 1;
    const n = houve[acao.id];
    const variante = acao.variantes && acao.variantes.length ? pick(acao.variantes) : null;
    const participantes = new Set();
    etapas.forEach((r, k) => {
      const e = r.e;
      const slots = {};
      for (const [papel, cfg0] of Object.entries(e.papeis)) {
        const cfg = cfg0 || {};
        const ids = papel === 'colegas' ? mapa.colegas || [] : [mapa[papel]];
        for (const id of ids) {
          if (!id || !segs[id]) continue;
          const local = localReal(cfg.local || 'mesa', id);
          const slot = cfg.slot ?? (slots[local] = (slots[local] ?? -1) + 1);
          segs[id].push({ ini: r.ini, fim: r.fim, local, slot, pose: cfg.pose || 'em-pe',
            status: String(e.status || acao.status || acao.nome || acao.id).replace('{n}', n), modelo: String(e.status || acao.status || '').includes('{n}') ? String(e.status || acao.status) : undefined, inst: acao.id + '#' + n,
            acao: acao.id, andar: e.andar || acao.andar, vel: e.vel || acao.vel, props: cfg.props || e.props || acao.props || null });
          ocup[id].push([r.ini, r.fim]);
          participantes.add(id);
        }
      }
      let lista = (k === 0 && variante) || e.falas;
      if (lista && acao.chanceFalas != null && rng() > acao.chanceFalas) lista = null;
      if (lista && lista.length) {
        let cursor = e.inicioFalas ?? 16;
        const itens = [];
        for (const f of lista) {
          let quem = f.quem === 'eu' ? mapa.eu : f.quem;
          if (quem === 'colega' && !mapa.colega) quem = (mapa.colegas || [])[0];
          else if (quem === 'colega') quem = mapa.colega;
          if (quem !== 'prompt' && !(participantes.has(quem) || Object.values(mapa).flat().includes(quem))) continue;
          if (!quem || quem === 'cenario') continue;
          const dur = f.dur ?? Math.min(9, Math.max(3, 2.2 + String(f.texto).length / 10));
          const em = f.em ?? cursor;
          cursor = em + dur + 0.9;
          itens.push({ quem, texto: String(f.texto).toUpperCase(), em, dur });
        }
        if (itens.length) falas.push({ ini: r.ini, fim: r.fim, ciclo: e.cicloFalas ?? acao.cicloFalas ?? Math.max(45, cursor + 25), itens, acao: acao.id });
      }
      for (const ef of e.efeitos || []) efeitos.push({ ...ef, ini: r.ini, fim: r.fim, acao: acao.id });
    });
    instancias.push({ id: acao.id, nome: acao.nome, quem: euId, ini, fim: fimTotal, participantes: [...participantes] });
    return { fim: fimTotal, mapa, participantes };
  }

  const ordemAtores = [...atores].sort((a, b) => (b.tipo === 'dev') - (a.tipo === 'dev') || (b.tipo === 'gerente') - (a.tipo === 'gerente'));

  // 0. ambiente (cenário, bilhetes, falas do Prompt sozinho)
  for (const a of acoes.filter((a) => a.categoria === 'ambiente')) {
    if (rng() < (a.chance ?? 1)) tentar(a, 'cenario', horaNaJanela(a));
  }

  // 1. chegada
  for (const p of ordemAtores) {
    if (!presente[p.id]) continue;
    const cands = acoes.filter((a) => a.categoria === 'chegada' && combina(a, p));
    const ini = cands.length ? null : hm('09:00');
    if (!cands.length) { pres[p.id] = { ini, fim: 1440 }; continue; }
    const a = pesado(cands, (x) => x.peso ?? 1);
    const h = horaNaJanela(a);
    pres[p.id] = { ini: h, fim: 1440 };
    tentar(a, p.id, h);
  }

  const encaixar = (a, p, tentativas = 8) => {
    for (let k = 0; k < tentativas; k++) {
      const h = horaNaJanela(a);
      const iv = a.intervaloMin ?? ((a.maxPorDia ?? 1) > 1 ? 60 : 0);
      if (iv && (segs[p.id] || []).some((sg) => sg.acao === a.id && Math.abs(sg.ini - h) < iv)) continue;
      const r = tentar(a, p.id, h, a.forcaPresenca); if (r) return r;
    }
    return null;
  };
  const filler = (lista) => {
    for (const a of lista) {
      for (const p of ordemAtores) {
        if (!combina(a, p)) continue;
        if (!presente[p.id] && p.tipo !== 'visitante' && !a.forcaPresenca) continue;
        const max = a.maxPorDia ?? 1;
        for (let k = 0; k < max; k++) { if (rng() >= (a.chance ?? 1)) break; encaixar(a, p); }
      }
    }
  };
  const isFiller = (a) => ['rotina', 'evento', 'raro', 'fds'].includes(a.categoria);

  // 2. eventos de alta prioridade (daily, deploy de sexta...)
  filler(acoes.filter((a) => isFiller(a) && (a.prioridade ?? 0) >= 5).sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0)));

  // 3. saída (dev primeiro: happy hour arrasta os colegas)
  const jaSaiu = new Set();
  for (const p of ordemAtores) {
    if (!presente[p.id] || jaSaiu.has(p.id)) continue;
    let cands = acoes.filter((a) => a.categoria === 'saida' && combina(a, p));
    const pesoDe = (x) => (x.peso ?? 1) + (x.bonus || []).reduce((s, b) => s + (houve[b.seHouve] ? b.peso : 0), 0);
    let ok = null;
    for (let k = 0; k < 12 && cands.length && !ok; k++) {
      const a = pesado(cands, pesoDe);
      for (let z = 0; z < 3 && !ok; z++) {
        const ini = Math.max(horaNaJanela(a), ultimoOcupado(p.id));
        if (ini > hm(a.janela ? a.janela[1] : '23:00') + 30) break;
        ok = tentar(a, p.id, ini);
      }
      if (!ok) cands = cands.filter((x) => x !== a);
    }
    if (ok) {
      for (const id of ok.participantes) {
        if (!pres[id]) continue;
        const fim = Math.max(...segs[id].filter((s) => s.ini >= ok.fim - 600).map((s) => s.fim), ok.fim);
        pres[id].fim = Math.min(fim, ok.fim); jaSaiu.add(id);
      }
    } else {
      const fim = Math.min(1439, Math.max(ultimoOcupado(p.id), hm('18:00')) + 1);
      pres[p.id].fim = fim; jaSaiu.add(p.id);
    }
  }

  // 4. almoço
  for (const p of ordemAtores) {
    if (!presente[p.id]) continue;
    const cands = acoes.filter((a) => a.categoria === 'almoco' && combina(a, p));
    if (!cands.length || !livre(p.id, hm('12:00'), hm('12:20'))) continue;
    let restantes = cands;
    for (let k = 0; k < 6 && restantes.length; k++) {
      const a = pesado(restantes, (x) => x.peso ?? 1);
      if (encaixar(a, p, 4)) break;
      restantes = restantes.filter((x) => x !== a);
    }
  }

  // 5. rotina / eventos / raros / fim de semana
  const resto = acoes.filter((a) => isFiller(a) && (a.prioridade ?? 0) < 5);
  for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
  resto.sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0));
  filler(resto);

  // 6. preenche os buracos: fora / trabalhando
  const st = padrao.status || {};
  const trab = padrao.trabalhando || {};
  const poses = padrao.posesTrabalho || ['digitando'];
  const bloco = padrao.blocoMin || [15, 40];
  const ocas = padrao.falasOcasionais || {};
  const linhas = {};
  for (const p of atores) {
    const lista = segs[p.id].sort((a, b) => a.ini - b.ini);
    // renumera {n} em ordem cronológica (o 1º café vem antes do 2º)
    const cont = {}, vistos = {};
    for (const sg of lista) {
      if (!sg.modelo) continue;
      if (!(sg.inst in vistos)) vistos[sg.inst] = cont[sg.acao] = (cont[sg.acao] || 0) + 1;
      sg.status = sg.modelo.replace('{n}', vistos[sg.inst]);
    }
    const out = [];
    const j = presente[p.id] ? pres[p.id] : null;
    const fora = (a, b, status) => { if (b - a > 1e-6) out.push({ ini: a, fim: b, local: 'fora', slot: 0, pose: 'em-pe', status, acao: 'fora' }); };
    const trabalhar = (a, b) => {
      let t = a;
      while (b - t > 1e-6) {
        let d = range(bloco); if (b - (t + d) < 6) d = b - t;
        const fim = Math.min(b, t + d);
        const frases = trab[p.id] || trab[p.tipo] || trab.colega || ['trabalhando'];
        out.push({ ini: t, fim, local: p.mesa != null ? 'assento:' + p.mesa : 'centro', slot: 0, pose: pick(poses), status: pick(frases), acao: 'trabalho' });
        const quemFala = p.tipo === 'dev' ? (rng() < 0.5 ? 'prompt' : 'dev') : p.id;
        const opcoes = ocas[quemFala];
        if (opcoes && opcoes.length && rng() < (padrao.chanceFalaOcasional ?? 0.3) && fim - t > 2) {
          const texto = String(pick(opcoes)).toUpperCase();
          falas.push({ ini: t, fim, ciclo: 240 + rng() * 300, itens: [{ quem: quemFala, texto, em: 30, dur: Math.min(8, Math.max(3, 2.2 + texto.length / 10)) }], acao: 'ocasional' });
        }
        t = fim;
      }
    };
    const vazio = (a, b) => {
      if (!j) return fora(a, b, p.tipo === 'dev' ? (['sab', 'dom'].includes(dia) ? st.fds : st.ausente) : 'fora');
      if (a < j.ini) { fora(a, Math.min(b, j.ini), st.antes); a = Math.min(b, j.ini); }
      const meio = Math.min(b, j.fim);
      if (meio > a) trabalhar(a, meio);
      if (b > Math.max(a, j.fim)) fora(Math.max(a, j.fim), b, st.depois);
    };
    let cur = 0;
    for (const s of lista) {
      if (s.ini > cur + 1e-6) vazio(cur, s.ini);
      out.push(s); cur = Math.max(cur, s.fim);
    }
    if (cur < 1440) vazio(cur, 1440);
    linhas[p.id] = out;
  }
  falas.sort((a, b) => a.ini - b.ini);
  return { data: dataKey, dia, linhas, falas, efeitos, presenca: pres, presentes: presente, houve, instancias: instancias.sort((a, b) => a.ini - b.ini) };
}

// Mantém o passado da agenda antiga e usa a nova a partir de `corte` (minutos).
export function mesclarAgendas(velha, nova, corte) {
  if (!velha || velha.data !== nova.data) return nova;
  const linhas = {};
  for (const id of Object.keys(nova.linhas)) {
    const v = velha.linhas[id] || [];
    const kept = v.filter((s) => s.ini < corte).map((s) => ({ ...s }));
    // blocos "neutros" (fora / trabalho) que atravessam o corte são aparados: o resto do dia vem da agenda nova
    const ult = kept[kept.length - 1];
    if (ult && ult.fim > corte && (!ult.acao || ult.acao === 'fora' || ult.acao === 'trabalho')) ult.fim = corte;
    const fim = ult ? ult.fim : 0;
    const resto = nova.linhas[id].filter((s) => s.fim > fim + 1e-6).map((s) => (s.ini < fim ? { ...s, ini: fim } : s));
    linhas[id] = kept.concat(resto);
  }
  return { ...nova, linhas,
    falas: velha.falas.filter((f) => f.ini < corte).concat(nova.falas.filter((f) => f.ini >= corte)).sort((a, b) => a.ini - b.ini),
    efeitos: velha.efeitos.filter((f) => f.ini < corte).concat(nova.efeitos.filter((f) => f.ini >= corte)),
    instancias: velha.instancias.filter((f) => f.ini < corte).concat(nova.instancias.filter((f) => f.ini >= corte)) };
}
