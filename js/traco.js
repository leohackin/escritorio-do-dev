// Helpers de "traço de caneta": linhas levemente tremidas, geradas uma vez (determinísticas).
import { mulberry32 } from './agenda.js';
let r = mulberry32(42);
export function semente(s) { r = mulberry32(s); }
const j = (a) => (r() - 0.5) * 2 * a;
const f = (n) => Math.round(n * 10) / 10;
export function linha(x1, y1, x2, y2, a = 1.4) {
  const mx = (x1 + x2) / 2 + j(a), my = (y1 + y2) / 2 + j(a);
  return `M${f(x1 + j(a * 0.3))} ${f(y1 + j(a * 0.3))}Q${f(mx)} ${f(my)} ${f(x2 + j(a * 0.3))} ${f(y2 + j(a * 0.3))}`;
}
export function poli(pts, fechar = false, a = 1.2) {
  let d = '';
  for (let i = 0; i < pts.length - (fechar ? 0 : 1); i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const seg = linha(p[0], p[1], q[0], q[1], a);
    d += i === 0 ? seg : seg.slice(seg.indexOf('Q'));
  }
  return d + (fechar ? 'Z' : '');
}
export function ret(x, y, w, h, a = 1.2) { return poli([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, a); }
export function circ(cx, cy, rx, ry = rx, a = 0.9) {
  const n = 14; const pts = [];
  const o = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) { const t = o + (i / n) * Math.PI * 2; const k = 1 + j(a / Math.max(rx, 6) * 1.2); pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); }
  let d = `M${f((pts[0][0] + pts[n - 1][0]) / 2)} ${f((pts[0][1] + pts[n - 1][1]) / 2)}`;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; d += `Q${f(p[0])} ${f(p[1])} ${f((p[0] + q[0]) / 2)} ${f((p[1] + q[1]) / 2)}`; }
  return d + 'Z';
}
export function pontos(cx, cy, rx, ry, n, filtro = () => true, raio = 0.9) {
  let d = '';
  for (let i = 0; i < n * 4 && n > 0; i++) {
    const x = cx + (r() * 2 - 1) * rx, y = cy + (r() * 2 - 1) * ry;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 || !filtro(x, y)) continue;
    d += `M${f(x)} ${f(y)}h0.1`; n--;
  }
  return d;
}
export const rnd = () => r();
