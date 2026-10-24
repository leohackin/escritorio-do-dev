import { astar, avanco, celulaMaisPerto, comprimento, criarRoteador, livre } from '../js/caminho.js';

let erros = 0;
const falha = (m) => { erros++; console.log('FALHA', m); };

function grade(w, h, bloqueia) {
  const v = new Uint8Array(w * h).fill(1);
  for (let x = 0; x < w; x++) { v[x] = 0; v[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { v[y * w] = 0; v[y * w + w - 1] = 0; }
  for (const [x, y] of bloqueia) v[y * w + x] = 0;
  return { v, w, h };
}

function celulasDoCaminho(cam) {
  const sai = [];
  for (let i = 1; i < cam.length; i++) {
    const a = cam[i - 1], b = cam[i];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      sai.push([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)]);
    }
  }
  return sai;
}

// parede no meio: o caminho contorna, não atravessa
{
  const bloqueia = [];
  for (let y = 2; y <= 14; y++) bloqueia.push([10, y]);
  const g = grade(22, 16, bloqueia);
  const cam = astar(g, [2, 8], [18, 8]);
  if (!cam || cam.length < 3) falha('sem contorno da parede');
  else {
    for (const [x, y] of celulasDoCaminho(cam)) {
      if (!livre(g, x, y)) falha('passou por célula bloqueada ' + x + ',' + y);
    }
    if (cam[0][0] !== 2 || cam[cam.length - 1][0] !== 18) falha('não ligou as pontas');
  }
}

// sala fechada: não entra; para na célula alcançável mais próxima
{
  const bloqueia = [];
  for (let x = 8; x <= 14; x++) { bloqueia.push([x, 4]); bloqueia.push([x, 11]); }
  for (let y = 4; y <= 11; y++) { bloqueia.push([8, y]); bloqueia.push([14, y]); }
  const g = grade(22, 16, bloqueia);
  const cam = astar(g, [3, 8], [11, 8]);
  if (!cam) falha('caminho nulo na sala fechada');
  else {
    for (const [x, y] of celulasDoCaminho(cam)) {
      if (!livre(g, x, y)) falha('entrou na sala ' + x + ',' + y);
    }
    const fim = cam[cam.length - 1];
    if (fim[0] > 8 && fim[0] < 14 && fim[1] > 4 && fim[1] < 11) falha('terminou dentro da sala');
  }
}

// diagonal não corta canto sólido
{
  const g = grade(12, 12, [[5, 5]]);
  const cam = astar(g, [4, 5], [6, 5]);
  if (!cam) falha('sem caminho no canto');
  else for (const [x, y] of celulasDoCaminho(cam)) if (x === 5 && y === 5) falha('pisou no canto');
}

// roteador em px não risca parede (parede de células na coluna 10)
{
  const bloqueia = [];
  for (let y = 1; y <= 18; y++) if (y < 16) bloqueia.push([10, y]);
  const g = grade(24, 20, bloqueia);
  const r = criarRoteador(g);
  const pts = r.rota([[24, 80], [160, 80]]);
  if (pts.length < 2) falha('rota vazia');
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const cx = Math.floor(x / 8), cy = Math.floor(y / 8);
      if (!livre(g, cx, cy)) falha('rota em px atravessou ' + cx + ',' + cy);
    }
  }
}

// avanço suave começa devagar, termina no comprimento, é monotônico
{
  let ant = 0;
  for (let t = 0; t <= 40; t++) {
    const d = avanco(t / 10, 4, 200);
    if (d < ant - 1e-6) falha('avanço voltou');
    ant = d;
  }
  if (Math.abs(avanco(0, 4, 200)) > 1e-6) falha('avanço não começa em 0');
  if (Math.abs(avanco(4, 4, 200) - 200) > 1e-4) falha('avanço não termina em L');
  if (avanco(0.15, 4, 200) > avanco(2, 4, 200) * 0.2) falha('arranque não é mais lento que o meio');
}

if (celulaMaisPerto(grade(8, 8, []), 20, 20) == null) falha('não achou célula livre');
if (comprimento([[0, 0], [3, 4]]) !== 5) falha('comprimento');

console.log(erros ? erros + ' erros no caminho' : 'caminho ok');
process.exit(erros ? 1 : 0);
