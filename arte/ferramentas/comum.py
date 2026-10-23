import numpy as np, cv2
from scipy import ndimage as ndi

def tinta(gray, esc=1.0, abs_lim=110, rel_lim=22):
    """Converte cinzas em tinta: preto absoluto + traço relativo (bordas sobre cinza)."""
    g = gray.astype(np.float32)
    fundo = cv2.GaussianBlur(g, (0, 0), 6 * esc)
    t_abs = np.clip((abs_lim + 15 - g) / 30, 0, 1)
    t_rel = np.clip((fundo - g - rel_lim) / 30, 0, 1)
    return np.maximum(t_abs, t_rel)  # 0 = branco, 1 = tinta

def mascara_figuras(gray, fecha=3):
    """Máscara do que NÃO é fundo: tudo que não é alcançável da borda passando por branco."""
    escuro = gray < 200
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * fecha + 1, 2 * fecha + 1))
    fechado = cv2.morphologyEx(escuro.astype(np.uint8), cv2.MORPH_CLOSE, k) > 0
    livre = ~fechado
    lab, n = ndi.label(livre)
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fundo = np.isin(lab, list(borda))
    return ~fundo
