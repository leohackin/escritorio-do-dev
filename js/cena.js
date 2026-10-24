// Renderizador v2: fundo em canvas + bonecos-sprite com oclusão por mapa de profundidade
// e caminhos por A* sobre a grade andável. Sem estado de agenda aqui: só desenha o que mandam.
const C = 8; // tamanho da célula da grade andável (px da arte)

function carregarImg(src) {
  return new Promise((ok, falha) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => falha(new Error('imagem ' + src)); i.src = src; });
}
function pixels(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, out = new Uint8Array(c.width * c.height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = d[j];
  return { w: c.width, h: c.height, v: out };
}

export async function carregarCena(cen, base = 'assets/') {
  const v = cen.assetsVersao ? '?v=' + cen.assetsVersao : '';
  const [fundo, profImg, andImg, indice] = await Promise.all([
    carregarImg(base + 'cenario.webp' + v), carregarImg(base + 'profundidade.png' + v), carregarImg(base + 'andavel.png' + v),
    fetch(base + 'sprites/indice.json' + v).then((r) => r.json())]);
  const prof = pixels(profImg), grade = pixels(andImg);
  const sprites = {};
  await Promise.all(Object.entries(indice).flatMap(([id, poses]) => Object.entries(poses).map(async ([pose, m]) => {
    const img = await carregarImg(`${base}sprites/${id}/${pose}.png${v}`);
    (sprites[id] ||= {})[pose] = { ...m, img };
  })));
  return new Cena(cen, fundo, prof, grade, sprites);
}

class Cena {
  constructor(cen, fundo, prof, grade, sprites) {
    Object.assign(this, { cen, fundo, prof, grade, sprites });
    this.W = cen.largura; this.H = cen.altura;
    this.patch = document.createElement('canvas');
    this.pctx = this.patch.getContext('2d', { willReadFrequently: true });
    this.cacheRotas = new Map();
  }

  // ---------- caminhos ----------
  livre(cx, cy) { const g = this.grade; return cx >= 0 && cy >= 0 && cx < g.w && cy < g.h && g.v[cy * g.w + cx] > 127; }
  celulaLivreMaisPerto(x, y) {
    const cx = Math.floor(x / C), cy = Math.floor(y / C);
    if (this.livre(cx, cy)) return [cx, cy];
    for (let r = 1; r < 40; r++) {
      let melhor = null, md = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.livre(cx + dx, cy + dy)) continue;
        const d = dx * dx + dy * dy; if (d < md) { md = d; melhor = [cx + dx, cy + dy]; }
      }
      if (melhor) return melhor;
    }
    return [cx, cy];
  }
  visivel(a, b) { // linha reta livre na grade (amostrada a cada meia célula)
    const [x0, y0] = a, [x1, y1] = b, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; if (!this.livre(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t))) return false; }
    return true;
  }
  astar(a, b) {
    const g = this.grade, W = g.w, N = W * g.h, ini = a[1] * W + a[0], fim = b[1] * W + b[0];
    if (ini === fim) return [a];
    const custo = new Float32Array(N).fill(Infinity), veio = new Int32Array(N).fill(-1), fechado = new Uint8Array(N);
    const heap = [[0, ini]]; custo[ini] = 0;
    const h = (i) => Math.hypot((i % W) - b[0], Math.floor(i / W) - b[1]);
    const push = (it) => { heap.push(it); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= it[0]) break; heap[k] = heap[p]; heap[p] = it; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[k], heap[m]] = [heap[m], heap[k]]; k = m; } } return top; };
    const viz = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [, i] = pop(); if (fechado[i]) continue; fechado[i] = 1;
      if (i === fim) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy, c] of viz) {
        const nx = x + dx, ny = y + dy; if (!this.livre(nx, ny)) continue;
        if (dx && dy && (!this.livre(x + dx, y) || !this.livre(x, y + dy))) continue;
        const j = ny * W + nx, nc = custo[i] + c;
        if (nc < custo[j]) { custo[j] = nc; veio[j] = i; push([nc + h(j), j]); }
      }
    }
    if (veio[fim] < 0) return [a, b]; // sem caminho: vai reto (não deveria acontecer)
    const cam = []; for (let i = fim; i !== -1; i = veio[i]) cam.push([i % W, (i / W) | 0]);
    cam.reverse();
    const liso = [cam[0]]; let k = 0; // "puxa o barbante"
    while (k < cam.length - 1) { let j = cam.length - 1; while (j > k + 1 && !this.visivel(cam[k], cam[j])) j--; liso.push(cam[j]); k = j; }
    return liso;
  }
  // caminho no chão entre dois pontos da arte
  caminho(p, q) {
    const a = this.celulaLivreMaisPerto(p[0], p[1]), b = this.celulaLivreMaisPerto(q[0], q[1]);
    const chave = a.join(',') + '>' + b.join(',');
    let r = this.cacheRotas.get(chave);
    if (!r) {
      r = this.astar(a, b).map(([x, y]) => [x * C + C / 2, y * C + C / 2]);
      if (this.cacheRotas.size > 600) this.cacheRotas.clear();
      this.cacheRotas.set(chave, r);
    }
    return [p, ...r.slice(1, -1), q];
  }

  // ---------- sprites ----------
  sprite(id, nomes) {
    const s = this.sprites[id]; if (!s) return null;
    for (const n of nomes) if (n && s[n]) return s[n];
    return s['em-pe'] || s[Object.keys(s)[0]];
  }

  // ---------- desenho ----------
  // b: { id, x, y, prof, nomes:[pose preferida, alternativas], espelho, alt (px acima do chão), escala }
  desenharBoneco(ctx, b, k) {
    const sp = this.sprite(b.id, b.nomes); if (!sp) return null;
    const esc = (this.cen.escalaBoneco || 0.8) * (b.escala || 1);
    const w = sp.w * esc, h = sp.h * esc;
    const ax = (b.espelho ? sp.w - sp.ax : sp.ax) * esc;
    const x0 = b.x - ax, y0 = b.y - sp.ay * esc - (b.alt || 0);
    const dx0 = Math.floor(x0 * k), dy0 = Math.floor(y0 * k), dw = Math.ceil(w * k) + 2, dh = Math.ceil(h * k) + 2;
    if (dw <= 2 || dh <= 2) return null;
    const P = this.patch, p = this.pctx;
    if (P.width < dw || P.height < dh) { P.width = Math.max(P.width, dw + 32); P.height = Math.max(P.height, dh + 32); }
    p.setTransform(1, 0, 0, 1, 0, 0); p.clearRect(0, 0, dw, dh);
    p.imageSmoothingEnabled = true; p.imageSmoothingQuality = 'high';
    const ox = x0 * k - dx0, oy = y0 * k - dy0;
    if (b.espelho) { p.setTransform(-1, 0, 0, 1, ox + w * k, oy); } else p.setTransform(1, 0, 0, 1, ox, oy);
    p.drawImage(sp.img, 0, 0, w * k, h * k);
    p.setTransform(1, 0, 0, 1, 0, 0);
    // oclusão: apaga onde a arte está à frente do pé do boneco
    const lim = (b.prof ?? b.y) / 6, PR = this.prof, PW = PR.w, PH = PR.h;
    const img = p.getImageData(0, 0, dw, dh), d = img.data;
    const cols = new Int32Array(dw);
    for (let i = 0; i < dw; i++) cols[i] = Math.min(PW - 1, Math.max(0, Math.floor((dx0 + i + 0.5) / k)));
    let tocou = false;
    for (let j = 0; j < dh; j++) {
      const sy = Math.floor((dy0 + j + 0.5) / k); if (sy < 0 || sy >= PH) continue;
      const base = sy * PW, linha = j * dw * 4;
      for (let i = 0; i < dw; i++) {
        const v = PR.v[base + cols[i]];
        if (v && v > lim) { const a = linha + i * 4 + 3; if (d[a]) { d[a] = 0; tocou = true; } }
      }
    }
    if (tocou) p.putImageData(img, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(P, 0, 0, dw, dh, dx0, dy0, dw, dh); ctx.restore();
    return { cabeca: [b.x + (b.espelho ? -1 : 1) * 0.08 * w, y0 + h * 0.06], topo: y0 };
  }
}
