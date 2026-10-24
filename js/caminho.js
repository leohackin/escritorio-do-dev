// Caminho em grade, síncrono.
// A posição de cada pessoa é função da hora de Brasília: uma aba que volta do
// segundo plano precisa do caminho na hora, sem esperar callback. Por isso o
// A* roda aqui em vez do EasyStar.js (o calculate() dele é assíncrono).
// O algoritmo é o mesmo tipo: 8 direções, heurística octile, sem cortar canto,
// e um "puxar o barbante" no final. Nunca devolve reta atravessando parede.

export const CELULA = 8;

export function livre(g, cx, cy) {
  return cx >= 0 && cy >= 0 && cx < g.w && cy < g.h && g.v[cy * g.w + cx] > 0;
}

export function celulaMaisPerto(g, x, y, raio = 16) {
  const cx = Math.floor(x / CELULA), cy = Math.floor(y / CELULA);
  if (livre(g, cx, cy)) return [cx, cy];
  let melhor = null, md = 1e9;
  for (let r = 1; r <= raio; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !livre(g, cx + dx, cy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < md) { md = d; melhor = [cx + dx, cy + dy]; }
      }
    }
    if (melhor) return melhor;
  }
  return null;
}

function visivel(g, a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!livre(g, Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t))) return false;
  }
  return true;
}

const VIZ = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

function simplificar(g, cam) {
  if (cam.length <= 2) return cam;
  const liso = [cam[0]];
  let k = 0;
  while (k < cam.length - 1) {
    let j = cam.length - 1;
    while (j > k + 1 && !visivel(g, cam[k], cam[j])) j--;
    liso.push(cam[j]);
    k = j;
  }
  return liso;
}

/** Células do início ao fim, ou até a célula alcançável mais próxima. Null se não sai do lugar. */
export function astar(g, a, b) {
  if (!livre(g, a[0], a[1]) || !livre(g, b[0], b[1])) return null;
  if (a[0] === b[0] && a[1] === b[1]) return [[a[0], a[1]]];
  const W = g.w, N = W * g.h;
  const ini = a[1] * W + a[0], fim = b[1] * W + b[0];
  const custo = new Float32Array(N);
  custo.fill(Infinity);
  const veio = new Int32Array(N);
  veio.fill(-1);
  const fechado = new Uint8Array(N);
  const heap = [[0, ini]];
  custo[ini] = 0;
  const h = (i) => {
    const dx = Math.abs((i % W) - b[0]), dy = Math.abs(((i / W) | 0) - b[1]);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };
  const push = (it) => {
    heap.push(it);
    let k = heap.length - 1;
    while (k) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= it[0]) break;
      heap[k] = heap[p]; heap[p] = it; k = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        const tmp = heap[k]; heap[k] = heap[m]; heap[m] = tmp;
        k = m;
      }
    }
    return top;
  };
  let guard = 0;
  while (heap.length && guard++ < N * 8) {
    const [, i] = pop();
    if (fechado[i]) continue;
    fechado[i] = 1;
    if (i === fim) break;
    const x = i % W, y = (i / W) | 0;
    for (let vi = 0; vi < 8; vi++) {
      const dx = VIZ[vi][0], dy = VIZ[vi][1], c = VIZ[vi][2];
      const nx = x + dx, ny = y + dy;
      if (!livre(g, nx, ny)) continue;
      if (dx && dy && (!livre(g, x + dx, y) || !livre(g, x, y + dy))) continue;
      const j = ny * W + nx, nc = custo[i] + c;
      if (nc < custo[j]) { custo[j] = nc; veio[j] = i; push([nc + h(j), j]); }
    }
  }
  let fimReal = fim;
  if (veio[fim] < 0 && ini !== fim) {
    let melhor = -1, md = Infinity;
    for (let i = 0; i < N; i++) {
      if (custo[i] === Infinity) continue;
      const dx = (i % W) - b[0], dy = ((i / W) | 0) - b[1];
      const d = dx * dx + dy * dy;
      if (d < md) { md = d; melhor = i; }
    }
    if (melhor < 0 || melhor === ini) return [[a[0], a[1]]];
    fimReal = melhor;
  }
  const cam = [];
  for (let i = fimReal; i !== -1; i = veio[i]) cam.push([i % W, (i / W) | 0]);
  cam.reverse();
  return simplificar(g, cam);
}

function mundo(c) { return [c[0] * CELULA + CELULA / 2, c[1] * CELULA + CELULA / 2]; }

function arredondar(g, pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const abx = b[0] - a[0], aby = b[1] - a[1], cbx = c[0] - b[0], cby = c[1] - b[1];
    const lab = Math.hypot(abx, aby), lcb = Math.hypot(cbx, cby);
    const r = Math.min(26, lab * 0.32, lcb * 0.32);
    if (r < 8) { out.push(b); continue; }
    const p1x = b[0] - (abx / lab) * r, p1y = b[1] - (aby / lab) * r;
    const p2x = b[0] + (cbx / lcb) * r, p2y = b[1] + (cby / lcb) * r;
    const arco = [];
    let ok = true;
    for (let s = 0; s <= 4; s++) {
      const t = s / 4, u = 1 - t;
      const x = u * u * p1x + 2 * u * t * b[0] + t * t * p2x;
      const y = u * u * p1y + 2 * u * t * b[1] + t * t * p2y;
      if (!livre(g, Math.floor(x / CELULA), Math.floor(y / CELULA))) { ok = false; break; }
      arco.push([x, y]);
    }
    if (ok) out.push(...arco);
    else out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const PASSO_CURTO = 72;

export function criarRoteador(g) {
  const cache = new Map();
  function meio(ax, ay, bx, by) {
    const ca = celulaMaisPerto(g, ax, ay);
    const cb = celulaMaisPerto(g, bx, by);
    if (!ca || !cb) return null;
    const key = ca[0] + ',' + ca[1] + '>' + cb[0] + ',' + cb[1];
    let pts = cache.get(key);
    if (!pts) {
      const cam = astar(g, ca, cb);
      pts = cam ? arredondar(g, cam.map(mundo)) : [mundo(ca)];
      if (cache.size > 700) cache.clear();
      cache.set(key, pts);
    }
    return pts;
  }
  /** Waypoints em px da arte. Liga com A*. Só encosta no ponto exato se ele estiver a até 72px do chão andável (sentar, porta). */
  function rota(pontos) {
    const out = [];
    const push = (p) => {
      const u = out[out.length - 1];
      if (!u || Math.hypot(p[0] - u[0], p[1] - u[1]) > 0.75) out.push(p);
    };
    if (!pontos.length) return out;
    for (let i = 0; i < pontos.length - 1; i++) {
      const a = pontos[i], b = pontos[i + 1];
      const trilha = meio(a[0], a[1], b[0], b[1]);
      if (!trilha || !trilha.length) continue;
      const dA = Math.hypot(a[0] - trilha[0][0], a[1] - trilha[0][1]);
      const ult = trilha[trilha.length - 1];
      const dB = Math.hypot(b[0] - ult[0], b[1] - ult[1]);
      if (dA <= PASSO_CURTO) push(a);
      for (const p of trilha) push(p);
      if (dB <= PASSO_CURTO) push(b);
    }
    if (!out.length) push(pontos[0]);
    return out;
  }
  return { rota, limpar() { cache.clear(); } };
}

export function comprimento(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

export function amostra(pts, d) {
  const a0 = pts[0] || [0, 0];
  if (pts.length < 2 || d <= 0) {
    const b = pts[1] || a0;
    return { x: a0[0], y: a0[1], dx: b[0] - a0[0], dy: b[1] - a0[1] };
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= L || i === pts.length - 1) {
      const k = L ? Math.min(1, d / L) : 1;
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: b[0] - a[0], dy: b[1] - a[1] };
    }
    d -= L;
  }
  const z = pts[pts.length - 1];
  return { x: z[0], y: z[1], dx: 0, dy: 0 };
}

/** Distância percorrida no instante t (0..T), com arranque e parada suaves, terminando exatamente em L. */
export function avanco(t, T, L) {
  if (L <= 0 || T <= 0) return 0;
  if (t <= 0) return 0;
  if (t >= T) return L;
  const ta = Math.min(0.42, T * 0.28);
  const td = Math.min(0.55, T * 0.32);
  const tc = Math.max(0, T - ta - td);
  const v = L / (0.5 * ta + tc + 0.5 * td);
  if (t < ta) return 0.5 * (v / ta) * t * t;
  if (t < ta + tc) return 0.5 * v * ta + v * (t - ta);
  const u = t - ta - tc;
  return 0.5 * v * ta + v * tc + (v * u - 0.5 * (v / td) * u * u);
}
