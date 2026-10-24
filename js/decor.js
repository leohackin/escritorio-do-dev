// Relógio, janela, post-it, caneca, monitor, pong, fumaça e portas.
// Cada um é um canvas pequeno no mundo (não redesenha o andar inteiro).

import * as E from './enfeites.js';

function bbox(pts, pad = 4) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) - pad), y0 = Math.floor(Math.min(...ys) - pad);
  const w = Math.ceil(Math.max(...xs) + pad - x0), h = Math.ceil(Math.max(...ys) + pad - y0);
  return { x0, y0, w: Math.max(2, w), h: Math.max(2, h) };
}

function camada(scene, nome, x, y, w, h, depth) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = scene.textures.addCanvas(nome, canvas);
  const img = scene.add.image(x, y, nome).setOrigin(0, 0).setDepth(depth);
  return { canvas, ctx: canvas.getContext('2d'), tex, img, x, y, w, h, depth };
}

function limpar(c) {
  c.ctx.setTransform(1, 0, 0, 1, 0, 0);
  c.ctx.clearRect(0, 0, c.w, c.h);
  c.ctx.setTransform(1, 0, 0, 1, -c.x, -c.y);
}

function publicar(c) {
  c.ctx.setTransform(1, 0, 0, 1, 0, 0);
  c.tex.refresh();
}

export function criarDecor(scene, cen, depthEm) {
  const janelaB = bbox(cen.janela, 2);
  const telaQ = cen.mesas[(cen._mesaDev ?? 2)].tela;
  const postQ = cen.mesas[(cen._mesaDev ?? 2)].postit;
  const canecaP = cen.mesas[(cen._mesaDev ?? 2)].caneca;
  const rel = cen.relogio;
  const peças = {
    janela: camada(scene, 'dec-janela', janelaB.x0, janelaB.y0, janelaB.w, janelaB.h, depthEm(cen.janela[0][0], cen.janela[0][1]) + 2),
    relogio: camada(scene, 'dec-relogio', rel.x - rel.rx - 8, rel.y - rel.ry - 8, (rel.rx + 8) * 2, (rel.ry + 8) * 2, depthEm(rel.x, rel.y) + 3),
  };
  if (telaQ) {
    const b = bbox(telaQ, 2);
    peças.tela = camada(scene, 'dec-tela', b.x0, b.y0, b.w, b.h, depthEm(telaQ[0][0], telaQ[0][1]) + 4);
    peças.fumaca = camada(scene, 'dec-fumaca', b.x0 - 30, b.y0 - 120, b.w + 60, b.h + 130, depthEm(telaQ[0][0], telaQ[0][1]) + 6);
  }
  if (postQ) {
    const b = bbox(postQ, 70);
    peças.postit = camada(scene, 'dec-postit', b.x0, b.y0, b.w, b.h, depthEm(postQ[0][0], postQ[0][1]) + 8);
    peças.postit.depthBase = peças.postit.depth;
  }
  if (canecaP) {
    peças.caneca = camada(scene, 'dec-caneca', canecaP[0] - 22, canecaP[1] - 28, 48, 52, depthEm(canecaP[0], canecaP[1]) + 5);
  }
  if (cen.tv) {
    const b = bbox(cen.tv, 3);
    peças.tv = camada(scene, 'dec-tv', b.x0, b.y0, b.w, b.h, depthEm(cen.tv[0][0], cen.tv[0][1]) + 4);
  }
  peças.portas = {};
  for (const [nome, q] of Object.entries(cen.portas || {})) {
    const b = bbox(q, 2);
    peças.portas[nome] = camada(scene, 'dec-porta-' + nome, b.x0, b.y0, b.w, b.h, depthEm(q[0][0], q[0][1]) + 3);
    peças.portas[nome].q = q;
  }

  let ultimoPeriodo = '', ultimoModo = '', ultimoTexto = '', canecaVisivel = null, tvOn = false, relSeg = -1, noite = null;

  function atualizar(s) {
    if (peças.janela && s.periodo !== ultimoPeriodo) {
      ultimoPeriodo = s.periodo;
      const c = peças.janela;
      limpar(c);
      if (s.periodo !== 'dia') E.janela(c.ctx, cen.janela, s.periodo, s.tMin);
      publicar(c);
    }
    if (peças.relogio) {
      const seg = Math.floor(s.tSeg);
      if (seg !== relSeg) {
        relSeg = seg;
        const c = peças.relogio;
        limpar(c);
        E.relogio(c.ctx, cen.relogio, s.tMin, s.tSeg);
        publicar(c);
      }
    }
    if (peças.tela) {
      const modo = s.modoTela || '';
      const texto = s.textoTela || '';
      if (modo !== ultimoModo || texto !== ultimoTexto || modo === 'codigo' || modo === 'texto' || modo === 'bilhete') {
        ultimoModo = modo; ultimoTexto = texto;
        const c = peças.tela;
        limpar(c);
        if (modo) E.tela(c.ctx, telaQ, modo, texto, s.tSeg);
        publicar(c);
      }
    }
    if (peças.fumaca) {
      const c = peças.fumaca;
      limpar(c);
      if (s.fumaca) {
        const x = (telaQ[0][0] + telaQ[1][0]) / 2, y = telaQ[1][1];
        E.fumaca(c.ctx, [x, y], s.tSeg);
      }
      publicar(c);
      c.img.setVisible(!!s.fumaca);
    }
    if (peças.caneca) {
      const mostrar = !s.canecaNaMao;
      if (mostrar !== canecaVisivel) {
        canecaVisivel = mostrar;
        const c = peças.caneca;
        limpar(c);
        if (mostrar) E.caneca(c.ctx, canecaP);
        publicar(c);
        c.img.setVisible(mostrar);
      }
    }
    if (peças.postit) {
      const agoraNoite = s.escuro >= 0.4;
      if (agoraNoite !== noite) {
        noite = agoraNoite;
        const c = peças.postit;
        limpar(c);
        E.postit(c.ctx, postQ, agoraNoite ? 1 : 0);
        publicar(c);
        c.img.setDepth(agoraNoite ? 30100 : c.depthBase);
      }
    }
    if (peças.tv) {
      const c = peças.tv;
      if (s.jogando || tvOn) {
        limpar(c);
        if (s.jogando) E.tvJogo(c.ctx, cen.tv, s.tSeg);
        publicar(c);
      }
      tvOn = s.jogando;
      c.img.setVisible(!!s.jogando);
    }
    for (const [nome, c] of Object.entries(peças.portas)) {
      const aberta = !!(s.portas && s.portas[nome]);
      if (aberta !== c.aberta) {
        c.aberta = aberta;
        limpar(c);
        if (aberta) E.portaAberta(c.ctx, c.q);
        publicar(c);
        c.img.setVisible(aberta);
      }
    }
  }

  return { atualizar, postit: peças.postit };
}
