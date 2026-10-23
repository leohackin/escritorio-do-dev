// Relógio de Brasília (real ou simulado via URL).
import { DIAS } from './agenda.js';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
let cacheOff = null, cacheEm = -Infinity;
// "hora de parede" de Brasília codificada como ms UTC (getUTC* devolve a hora local de Brasília)
export function paredeBrasilia(ms) {
  if (Math.abs(ms - cacheEm) > 30000 || cacheOff === null) {
    const p = {};
    for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    cacheOff = wall - (ms - (ms % 1000));
    cacheEm = ms;
  }
  return ms + cacheOff;
}
const semAcento = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function lerParametros(search) {
  const q = new URLSearchParams(search);
  const vel = parseFloat(q.get('vel'));
  return { hora: q.get('hora'), dia: q.get('dia'), data: q.get('data'), vel: vel > 0 ? Math.min(vel, 3600) : 1,
    parar: q.has('parar'), agenda: q.has('agenda'), sal: q.get('sal') || '' };
}

export function criarRelogio(par) {
  const real = () => paredeBrasilia(Date.now());
  const simulado = !!(par.hora || par.dia || par.data || par.vel !== 1 || par.parar);
  if (!simulado) return { simulado, agora: real };
  const d = new Date(real());
  let y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate();
  if (par.data && /^\d{4}-\d{2}-\d{2}$/.test(par.data)) { [y, mo, da] = par.data.split('-').map(Number); mo -= 1; }
  else if (par.dia) {
    const alvo = DIAS.indexOf(semAcento(par.dia).slice(0, 3));
    if (alvo >= 0) da += ((alvo + 6) % 7) - ((d.getUTCDay() + 6) % 7); // mesma semana (seg..dom)
  }
  let h = d.getUTCHours(), mi = d.getUTCMinutes(), s = d.getUTCSeconds();
  if (par.hora && /^\d{1,2}(:\d{2}){0,2}$/.test(par.hora)) { const pp = par.hora.split(':').map(Number); h = pp[0]; mi = pp[1] || 0; s = pp[2] || 0; }
  const base = Date.UTC(y, mo, da, h, mi, s);
  const t0 = Date.now();
  return { simulado, agora: () => (par.parar ? base : base + (Date.now() - t0) * par.vel) };
}
