# Gera assets/sprites/<id>/<pose>.png (fundo transparente, P&B) + assets/sprites/indice.json
# Uso: python arte/ferramentas/montar.py   (rodar da raiz do projeto, com o venv da arte)
import os, json, numpy as np, cv2
from scipy import ndimage as ndi
from comum import mascara_figuras, tinta
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
cfg = json.load(open(os.path.join(RAIZ, 'arte', 'sprites.json')))
OUT = os.path.join(RAIZ, 'assets', 'sprites'); os.makedirs(OUT, exist_ok=True)
H0 = cfg['alturaEmPe']
indice, alturas = {}, {}

def recortes(g, dil):
    m = mascara_figuras(g)
    jun = cv2.dilate(m.astype(np.uint8), np.ones((dil, dil), np.uint8)) > 0
    lab, n = ndi.label(jun)
    cs = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if (m[sl] & (lab[sl] == i)).sum() < 1500: continue
        cs.append((sl, i))
    cs.sort(key=lambda c: (round(((c[0][0].start + c[0][0].stop) / 2) / 180), c[0][1].start))
    return m, lab, cs

def ordem(item):  # folhas com 'alvo' textual dependem de outras
    nome, f = item
    return 1 if isinstance(f.get('alvo'), str) else 0

for nome, f in sorted(cfg['folhas'].items(), key=ordem):
    im = cv2.imread(os.path.join(RAIZ, 'arte', 'bruto', nome + '.jpg'))
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    m, lab, cs = recortes(g, f.get('dil', 25))
    alvo = f.get('alvo', H0)
    alvo = alturas[alvo] if isinstance(alvo, str) else alvo
    refsl = cs[f['ref']][0]
    escala = alvo / (refsl[0].stop - refsl[0].start)
    for chave, p in f['poses'].items():
        p = p if isinstance(p, dict) else {'idx': p}
        sl, li = cs[p['idx']]
        ys, xs = sl
        pad = 3
        y0, y1 = max(0, ys.start - pad), min(g.shape[0], ys.stop + pad)
        x0, x1 = max(0, xs.start - pad), min(g.shape[1], xs.stop + pad)
        rgb = im[y0:y1, x0:x1].copy()
        msk = (m[y0:y1, x0:x1] & (lab[y0:y1, x0:x1] == li)).astype(np.float32)
        gg = rgb.max(axis=2)  # cor vira claro: só o traço conta
        t = tinta(gg, 0.5)
        eng = f.get('engrossar', cfg.get('engrossar', 0))  # engrossa o traço (px da folha) pra bater com o cenário
        if eng:
            ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (eng, eng))
            t = cv2.dilate(t.astype(np.float32), ker)
            msk = (cv2.dilate(msk, ker) > 0).astype(np.float32)
        cor = np.dstack([255 * (1 - np.clip(t * 1.15, 0, 1))] * 3).astype(np.uint8)
        if 'tingir' in p:
            (tx, ty), (r, gc, b) = p['tingir']
            tx, ty = tx - x0, ty - y0
            cheio = (t < 0.35).astype(np.uint8)
            ok, _, mm, _ = cv2.floodFill(cheio.copy(), None, (tx, ty), 2)
            area = (_ := None)
            reg = np.zeros((cheio.shape[0] + 2, cheio.shape[1] + 2), np.uint8)
            cv2.floodFill(cheio.copy(), reg, (tx, ty), 2)
            reg = reg[1:-1, 1:-1] > 0
            reg = cv2.dilate(reg.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            k = np.clip(1 - t, 0, 1)[..., None]
            tint = np.array([b, gc, r], np.float32)  # BGR
            cor = np.where(reg[..., None], (tint * k).astype(np.uint8), cor)
        if 'corteTopo' in p:
            h = int(msk.shape[0] * p['corteTopo'])
            cor, msk = cor[:h], msk[:h]
        e = escala * (p['altura'] / alvo if 'altura' in p else 1)
        W, H = max(1, round(cor.shape[1] * e)), max(1, round(cor.shape[0] * e))
        cor = cv2.resize(cor, (W, H), interpolation=cv2.INTER_AREA)
        a = cv2.resize(cv2.GaussianBlur(msk, (0, 0), 0.8), (W, H), interpolation=cv2.INTER_AREA)
        a = np.clip((a - 0.25) / 0.5, 0, 1)
        rgba = np.dstack([cor, (a * 255).astype(np.uint8)])
        pid, pose = chave.split('/')
        os.makedirs(os.path.join(OUT, pid), exist_ok=True)
        cv2.imwrite(os.path.join(OUT, pid, pose + '.png'), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        # âncora: pé = centro da linha mais baixa com alfa
        linhas = np.where(a.max(1) > 0.5)[0]
        base = int(linhas.max()) if len(linhas) else H - 1
        cols = np.where(a[max(0, base - 6):base + 1].max(0) > 0.5)[0]
        ax = int((cols.min() + cols.max()) / 2) if len(cols) else W // 2
        indice.setdefault(pid, {})[pose] = {'w': W, 'h': H, 'ax': ax, 'ay': base}
        alturas[chave] = H
json.dump(indice, open(os.path.join(OUT, 'indice.json'), 'w'), ensure_ascii=False, indent=0)
print(sum(len(v) for v in indice.values()), 'sprites;', {k: len(v) for k, v in indice.items()})
