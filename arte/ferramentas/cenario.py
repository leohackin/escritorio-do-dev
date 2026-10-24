# Gera, a partir da arte do cenário:
#   assets/cenario.webp       fundo P&B (2560x1440)
#   assets/profundidade.png   8 bits, valor = y_do_chão_à_frente/6 (0 = nunca cobre ninguém)
#   assets/andavel.png        grade 320x180 (célula de 8px): branco = dá pra andar
# Uso: python arte/ferramentas/cenario.py   (com o venv da arte; lê data/cenario.json)
import os, json, numpy as np, cv2
from scipy import ndimage as ndi
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
cen = json.load(open(os.path.join(RAIZ, 'data', 'cenario.json')))
A = cen['arte']
src = os.path.join(RAIZ, 'arte', 'bruto', A['fonte'])
# 1) tinta pura
import subprocess, sys
tmp = '/tmp/_cen_bw.png'
subprocess.check_call([sys.executable, os.path.join(os.path.dirname(__file__), '..', 'tratar_cenario.py'), src, tmp, '2'])
g = cv2.imread(tmp, 0)
for pol in A.get('apagar', []):  # some com objetos (ex.: garrafa na mesa do Dev, vira a caneca do código)
    cv2.fillPoly(g, [np.array(pol, np.int32)], 255)
H, W = g.shape
cv2.imwrite(os.path.join(RAIZ, 'assets', 'cenario.webp'), g, [cv2.IMWRITE_WEBP_QUALITY, 92])
# 2) chão = componentes brancas que contêm as sementes
ink = g < 128
inkc = cv2.dilate(ink.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
lab, n = ndi.label(~inkc)
chao = np.zeros_like(ink)
for sx, sy in A['sementesChao']:
    if lab[sy, sx]: chao |= lab == lab[sy, sx]
plano = chao.copy()  # superfícies planas que não cobrem ninguém (tapete)
for sx, sy in A.get('sementesPlano', []):
    if lab[sy, sx]: plano |= lab == lab[sy, sx]
# fecha o chão sobre a própria tinta fina (rejunte) pra não virar "objeto"
chao_d = cv2.dilate(plano.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
fundo = lab == lab[0, 0]
objeto = ~(plano | fundo)
# 3) profundidade: pra cada pixel de objeto, desce na coluna até achar chão: esse y é a frente do objeto
ys = np.arange(H)[:, None].repeat(W, 1)
idx = np.where(plano, ys, 10 ** 6)
prox = np.flip(np.minimum.accumulate(np.flip(idx, 0), 0), 0)
prox = np.where(prox >= 10 ** 6, ys, prox).astype(np.float32)
prof = np.where(objeto, prox, 0).astype(np.float32)
# paredes: tudo o que está na faixa vertical de uma parede (janela, quadro, relógio) fica na base dela
for sx, sy in A.get('sementesParede', []):
    if not lab[sy, sx]: continue
    m = lab == lab[sy, sx]
    tem = m.any(0)
    topo = np.where(tem, m.argmax(0), H)
    base = np.where(tem, H - 1 - np.flip(m, 0).argmax(0), -1)
    faixa = (ys >= topo[None, :]) & (ys <= base[None, :]) & objeto
    prof = np.where(faixa, np.minimum(prof, base[None, :] + 4), prof)
for item in A.get('profundidadeFixa', []):  # polígono -> profundidade forçada (0 = nunca cobre)
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(item['pol'], np.int32)], 1)
    prof[m > 0] = item['y']
p8 = np.clip(np.round(prof / 6), 0, 255).astype(np.uint8)
cv2.imwrite(os.path.join(RAIZ, 'assets', 'profundidade.png'), p8)
# 4) andável: chão + extras, menos margem do corpo
anda = chao.copy()
for sx, sy in A.get('sementesAndavel', []):
    if lab[sy, sx]: anda |= lab == lab[sy, sx]
anda = cv2.morphologyEx(anda.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
for pol in A.get('andavelExtra', []): cv2.fillPoly(anda, [np.array(pol, np.int32)], 1)
for pol in A.get('bloqueio', []): cv2.fillPoly(anda, [np.array(pol, np.int32)], 0)
anda = cv2.erode(anda, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * A.get('margem', 10) + 1,) * 2))
C = 8
grade = cv2.resize(anda.astype(np.float32), (W // C, H // C), interpolation=cv2.INTER_AREA) > 0.75
cv2.imwrite(os.path.join(RAIZ, 'assets', 'andavel.png'), grade.astype(np.uint8) * 255)
# prévia de depuração
vis = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
cor = cv2.applyColorMap(p8, cv2.COLORMAP_JET)
vis = np.where((p8 > 0)[..., None], (0.5 * vis + 0.5 * cor).astype(np.uint8), vis)
gr = cv2.resize(grade.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST) > 0
vis[gr] = (0.6 * vis[gr] + 0.4 * np.array([0, 255, 0])).astype(np.uint8)
cv2.imwrite('/tmp/cenario-debug.png', cv2.resize(vis, (1600, 900)))
print('ok', W, H, 'andável:', grade.sum(), 'células')
