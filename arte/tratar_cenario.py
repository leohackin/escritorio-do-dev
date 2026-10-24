# Converte o cenário gerado em tinta preta pura sobre branco, 2x maior.
import sys, numpy as np, cv2
src, dst = sys.argv[1], sys.argv[2]
esc = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
im = cv2.imread(src)
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
g = cv2.resize(g, None, fx=esc, fy=esc, interpolation=cv2.INTER_CUBIC)
fundo = cv2.GaussianBlur(g, (0, 0), 6 * esc)
# tinta = escuro absoluto OU bem mais escuro que a vizinhança (traço sobre cinza)
tinta = np.clip((150 - g) / 60, 0, 1)            # preto absoluto
rel = np.clip((fundo - g - 18) / 30, 0, 1)        # traço relativo
t = np.maximum(tinta, rel)
t = cv2.GaussianBlur(t, (0, 0), 0.6)
out = (255 * (1 - np.clip(t * 1.15, 0, 1))).astype(np.uint8)
cv2.imwrite(dst, out)
