# Uso: python recortar.py folha.jpg saida_dir  -> recortes numerados + contato.png
import sys, os, json, numpy as np, cv2
from scipy import ndimage as ndi
from comum import mascara_figuras
src, out = sys.argv[1], sys.argv[2]
DIL = int(sys.argv[3]) if len(sys.argv) > 3 else 25
os.makedirs(out, exist_ok=True)
im = cv2.imread(src); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
m = mascara_figuras(g)
# junta pedaços próximos (linhas de movimento, cadarço) pra formar figuras
jun = cv2.dilate(m.astype(np.uint8), np.ones((DIL, DIL), np.uint8)) > 0
lab, n = ndi.label(jun)
caixas = []
for i, sl in enumerate(ndi.find_objects(lab), 1):
    ys, xs = sl
    area = (m[sl] & (lab[sl] == i)).sum()
    if area < 1500: continue
    caixas.append([xs.start, ys.start, xs.stop, ys.stop])
# ordena por linha (centro y em faixas) e x
caixas.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / 180), b[0]))
info = []
cont = im.copy()
for k, (x0, y0, x1, y1) in enumerate(caixas):
    info.append({"i": k, "caixa": [int(x0), int(y0), int(x1), int(y1)]})
    cv2.rectangle(cont, (x0, y0), (x1, y1), (0, 0, 255), 2)
    cv2.putText(cont, str(k), (x0 + 3, y0 + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
cv2.imwrite(os.path.join(out, os.path.basename(src).rsplit('.', 1)[0] + '-contato.png'), cont)
print(json.dumps(info))
