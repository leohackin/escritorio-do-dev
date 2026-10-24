import fs from 'node:fs';
import { gerarAgenda, fmtHM } from '../js/agenda.js';
const banco = JSON.parse(fs.readFileSync(new URL('../data/acoes.json', import.meta.url)));
const elenco = JSON.parse(fs.readFileSync(new URL('../data/personagens.json', import.meta.url)));
const datas = process.argv.slice(2).length ? process.argv.slice(2) : ['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25'];
let erros = 0;
const usadas = new Set();
for (const d of datas) {
  const ag = gerarAgenda(d, banco, elenco);
  for (const [id, segs] of Object.entries(ag.linhas)) {
    let cur = 0;
    for (const s of segs) { if (Math.abs(s.ini - cur) > 1e-6) { erros++; console.log('BURACO', d, id, fmtHM(cur), fmtHM(s.ini)); } cur = s.fim; }
    if (Math.abs(cur - 1440) > 1e-6) { erros++; console.log('FIM', d, id, cur); }
  }
  ag.instancias.forEach((i) => usadas.add(i.id));
  console.log(`\n=== ${d} (${ag.dia}) presentes: ${Object.entries(ag.presentes).filter(([,v])=>v).map(([k])=>k).join(', ')}`);
  for (const i of ag.instancias.filter((i) => i.quem === 'dev' || i.participantes.includes('dev') || i.quem==='faxineiro'))
    console.log(`  ${fmtHM(i.ini)}-${fmtHM(i.fim)} ${i.id} [${i.participantes.join(',')}]`);
}
// determinismo
const a = JSON.stringify(gerarAgenda('2026-10-23', banco, elenco));
const b = JSON.stringify(gerarAgenda('2026-10-23', banco, elenco));
if (a !== b) { erros++; console.log('NÃO DETERMINÍSTICO'); }
const c = JSON.stringify(gerarAgenda('2026-10-22', banco, elenco).instancias);
if (JSON.stringify(JSON.parse(a).instancias) === c) { erros++; console.log('DIAS IGUAIS'); }
console.log('\nações usadas na amostra:', usadas.size, '/', banco.acoes.length, '| erros:', erros);
process.exit(erros ? 1 : 0);
