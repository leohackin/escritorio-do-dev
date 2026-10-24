// Cena Phaser: câmera, sprites, oclusão e balões. A agenda vem de fora;
// cada quadro só lê o relógio e desenha o estado daquela hora.

import { criarDecor } from './decor.js';
import { criarSim } from './sim.js';
import { DIAS, fmtHM } from './agenda.js';

const INTERESSE = /videogame|reuniao|daily|almoco|happy|deploy|banheiro|extintor|recrutador|anivers/;

function pixelsDe(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, c.width, c.height);
}

function gradeDe(img) {
  const data = pixelsDe(img);
  const v = new Uint8Array(img.width * img.height);
  for (let i = 0; i < v.length; i++) v[i] = data.data[i * 4] > 127 ? 1 : 0;
  return { v, w: img.width, h: img.height };
}

const FRAG_OCLUSAO = `#define SHADER_NAME OCLUSAO_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform sampler2D uDepth;
uniform float uLim;
uniform vec4 uWorld;
uniform vec2 uMap;
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
void main () {
  vec4 texture = texture2D(uMainSampler, outTexCoord);
  vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
  vec4 color = texture * texel;
  if (outTintEffect == 1.0) color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
  else if (outTintEffect == 2.0) color = texel;
  vec2 world = uWorld.xy + outTexCoord * uWorld.zw;
  float d = texture2D(uDepth, world / uMap).r * 255.0;
  if (d > uLim + 0.5) discard;
  gl_FragColor = color;
}`;

function criarPipeline(scene) {
  const Pipe = Phaser.Renderer.WebGL.Pipelines.SinglePipeline;
  const pipe = new Pipe({ game: scene.game, fragShader: FRAG_OCLUSAO });
  const rect = new Phaser.Geom.Rectangle();
  pipe.batchSprite = function (go, camera, parent) {
    if (this.vertexCount > 0) this.flush();
    go.getBounds(rect);
    this.set1f('uLim', go.getData('lim') ?? 9999);
    this.set4f('uWorld', rect.x, rect.y, Math.max(1, rect.width), Math.max(1, rect.height));
    this.set2f('uMap', scene.cen.largura, scene.cen.altura);
    const src = scene.textures.get('prof').source[0];
    if (src && src.glTexture) this.bindTexture(src.glTexture, 1);
    this.set1i('uDepth', 1);
    Pipe.prototype.batchSprite.call(this, go, camera, parent);
  };
  scene.renderer.pipelines.add('oclusao', pipe);
  return pipe;
}

function periodo(t) {
  if (t < 330 || t >= 1130) return 'noite';
  if (t < 420) return 'aurora';
  if (t < 1035) return 'dia';
  return 'tarde';
}

function suavizarBase(scene, key) {
  if (!scene.textures.exists(key)) return;
  const src = scene.textures.get(key).getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const ini = Math.floor(c.height * 0.72);
  x.globalCompositeOperation = 'destination-in';
  const g = x.createLinearGradient(0, ini, 0, c.height);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, ini, c.width, c.height - ini);
  scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function mapaProf(img) {
  const data = pixelsDe(img);
  const v = new Uint8Array(img.width * img.height);
  for (let i = 0; i < v.length; i++) v[i] = data.data[i * 4];
  return { v, w: img.width, h: img.height };
}

function topoMovel(map, x, y) {
  x = Math.round(x); y = Math.round(y);
  const { v, w, h } = map;
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : v[yy * w + xx];
  const d = at(x, y);
  if (!d) return y;
  let top = y;
  for (let yy = y; yy > 1; yy--) {
    const p = at(x, yy);
    if (!p || Math.abs(p - d) > 14) break;
    top = yy;
  }
  return top;
}

export function criarCena(deps) {
  return class Escritorio extends Phaser.Scene {
    constructor() { super('escritorio'); }

    preload() {
      const q = deps.versao ? '?v=' + encodeURIComponent(deps.versao) : '';
      this.load.image('cenario', 'assets/cenario.webp' + q);
      this.load.image('prof', 'assets/profundidade.png' + q);
      this.load.image('anda', 'assets/andavel.png' + q);
      for (const [id, poses] of Object.entries(deps.indice)) {
        for (const pose of Object.keys(poses)) this.load.image(id + '/' + pose, `assets/sprites/${id}/${pose}.png${q}`);
      }
    }

    create() {
      const cen = deps.cen;
      this.cen = cen;
      this.indice = deps.indice;
      this.add.image(0, 0, 'cenario').setOrigin(0, 0).setDepth(0);
      const pixel = document.createElement('canvas');
      pixel.width = 1; pixel.height = 1;
      this.textures.addCanvas('pixel', pixel);
      const andaImg = this.textures.get('anda').getSourceImage();
      this.profMap = mapaProf(this.textures.get('prof').getSourceImage());
      for (const id of Object.keys(deps.indice)) suavizarBase(this, id + '/sofa');
      if (this.textures.exists('prof')) this.textures.get('prof').setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.pipeline = this.renderer && this.renderer.gl ? criarPipeline(this) : null;
      this.sim = criarSim(cen, gradeDe(andaImg));
      deps.sim = this.sim;
      const depthEm = (x, y) => y;
      cen._mesaDev = (deps.elencoRef.atual.personagens.find((p) => p.id === 'dev') || {}).mesa ?? 2;
      this.decor = criarDecor(this, cen, depthEm);
      this.atores = {};
      this.syncAtores(deps.elencoRef.atual);
      this.noite = this.add.rectangle(cen.largura / 2, cen.altura / 2, cen.largura, cen.altura, 0x0c0c12, 1).setDepth(30000).setAlpha(0);
      this.baloes = Array.from({ length: 14 }, () => this.criarBalao());
      this.planta = !!deps.par.planta;
      this.multZoom = 1;
      this._snap = true;
      this._pan = false;
      const devMesa = cen.mesas[cen._mesaDev];
      this.cx = devMesa.cadeira[0]; this.cy = devMesa.cadeira[1] - 40; this.cz = 1.2;
      this.cameras.main.setBackgroundColor('#ffffff');
      this.input.addPointer(2);
      this._tecla = (ev) => {
        if (ev.key === 'v' || ev.key === 'V') { this.togglePlanta(); ev.preventDefault(); }
      };
      window.addEventListener('keydown', this._tecla);
      const btn = document.getElementById('vista');
      if (btn) btn.addEventListener('click', () => this.togglePlanta());
      this.togglePlanta(this.planta);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this._snap = true; });
      this._ultimoHud = '';
      this._ultimoErro = 0;
      this._revisao = deps.revisao;
      deps.cena = this;
      if (deps.onPronto) deps.onPronto();
    }

    resolver(id, nomes) {
      for (const n of nomes) if (n && this.textures.exists(id + '/' + n)) return n;
      if (this.textures.exists(id + '/em-pe')) return 'em-pe';
      const poses = this.indice[id];
      return poses ? Object.keys(poses)[0] : null;
    }

    criarAtor(id) {
      const nome = this.resolver(id, ['em-pe']);
      const img = this.add.image(0, 0, id + '/' + nome).setVisible(false);
      const m = this.indice[id][nome];
      img.setOrigin(m.ax / m.w, m.ay / m.h);
      if (this.pipeline) img.setPipeline(this.pipeline);
      return { id, img, pose: nome, esc: this.cen.escalaBoneco || 0.72 };
    }

    syncAtores(elenco) {
      const ids = new Set(elenco.personagens.filter((p) => p.tipo !== 'fixo').map((p) => p.id));
      for (const id of ids) if (!this.atores[id] && this.indice[id]) this.atores[id] = this.criarAtor(id);
      for (const id of Object.keys(this.atores)) if (!ids.has(id)) { this.atores[id].img.destroy(); delete this.atores[id]; }
    }

    criarBalao() {
      const g = this.add.graphics().setDepth(31000).setVisible(false);
      const t = this.add.text(0, 0, '', {
        fontFamily: '"Patrick Hand", "Comic Sans MS", cursive',
        fontSize: '22px', color: '#161616', align: 'center',
        wordWrap: { width: 260 },
      }).setOrigin(0.5, 0).setDepth(31001).setVisible(false);
      if (t.setResolution) t.setResolution(Math.min(2, window.devicePixelRatio || 1));
      return { g, t, texto: '', on: false };
    }

    togglePlanta(forcar) {
      this.planta = typeof forcar === 'boolean' ? forcar : !this.planta;
      this._pan = false;
      if (!this.planta) this.multZoom = 1;
      const btn = document.getElementById('vista');
      if (btn) {
        btn.textContent = this.planta ? 'seguir o Dev' : 'ver o andar';
        btn.setAttribute('aria-pressed', this.planta ? 'true' : 'false');
      }
    }

    zoomPerto() {
      const cam = this.cameras.main;
      const charH = 200 * (this.cen.escalaBoneco || 0.72);
      const zChar = (Math.min(cam.width, cam.height) * 0.25) / charH;
      const zW = cam.width / 680;
      const zH = cam.height / 740;
      return Phaser.Math.Clamp(Math.min(zChar * 1.15, Math.max(zW, zH)), 0.72, 2.05);
    }

    zoomPlanta() {
      const cam = this.cameras.main;
      return Math.min(cam.width / this.cen.largura, cam.height / this.cen.altura) * 0.995;
    }

    depthDe(e) {
      if (e.visual && e.visual.voando) return 28000;
      // Sentado: o pé fica um pouco atrás da frente do móvel, então o encosto
      // (que o mapa marca com o y da frente) cobre o tronco e a cabeça fica de fora.
      if (e.visual && e.visual.sentado) return e.y - 8;
      return e.y;
    }

    escolherAlvo(estados) {
      if (this.planta && !this._pan) return { x: this.cen.largura / 2, y: this.cen.altura / 2, zoom: this.zoomPlanta(), id: 'planta' };
      if (this.planta && this._pan) return { x: this.cx, y: this.cy, zoom: this.zoomPlanta(), id: 'pan' };
      const vivos = Object.values(estados).filter((e) => e.visivel);
      const dev = estados.dev;
      const grupos = new Map();
      for (const e of vivos) {
        const ac = e.seg && e.seg.acao;
        if (!ac || ac === 'trabalho' || ac === 'fora') continue;
        const k = e.seg.inst || ac;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(e);
      }
      let melhor = null, score = 0, chave = '';
      for (const [k, gs] of grupos) {
        let s = gs.length * 2;
        if (gs.some((p) => p.id === 'dev')) s += 6;
        if (INTERESSE.test(k)) s += 4;
        if (gs.some((p) => p.falando)) s += 2;
        if (s > score) { score = s; melhor = gs; chave = k; }
      }
      const devNoGrupo = melhor && melhor.some((p) => p.id === 'dev');
      let grupo = null, id = 'dev';
      if (dev && dev.visivel && (dev.andando || !melhor || devNoGrupo || score < 8)) {
        grupo = devNoGrupo ? melhor : [dev];
        id = 'dev:' + ((dev.seg && (dev.seg.inst || dev.seg.acao)) || '');
      } else if (melhor && score >= 4) { grupo = melhor; id = 'cena:' + chave; }
      else if (dev && dev.visivel) grupo = [dev];
      if (!grupo || !grupo.length) {
        const u = ((this._tMin || 0) % 50) / 50;
        return { x: 700 + u * 1000, y: 640, zoom: Math.max(this.zoomPlanta() * 1.4, 0.65), id: 'vazio' };
      }
      let x = 0, y = 0;
      for (const e of grupo) { x += e.x; y += e.y; }
      x /= grupo.length; y /= grupo.length;
      let span = 0;
      for (const e of grupo) span = Math.max(span, Math.hypot(e.x - x, e.y - y));
      const cam = this.cameras.main;
      let zoom = this.zoomPerto();
      if (span > 80) zoom = Math.min(zoom, cam.height / (span * 2.4 + 480));
      if (grupo.length === 1 && grupo[0].andando) {
        const d = Math.hypot(grupo[0].dx, grupo[0].dy) || 1;
        x += (grupo[0].dx / d) * 64;
        y += (grupo[0].dy / d) * 28;
      }
      y -= 52;
      if (/videogame/.test(chave) && devNoGrupo) zoom *= 0.9;
      return { x, y, zoom: Math.max(this.zoomPlanta(), zoom), id };
    }

    aplicarCamera(alvo, dt) {
      const cam = this.cameras.main;
      const k = this._snap ? 1 : 1 - Math.exp(-2.4 * dt);
      const kz = this._snap ? 1 : 1 - Math.exp(-2.0 * dt);
      if (!(this.planta && this._pan)) {
        this.cx += (alvo.x - this.cx) * k;
        this.cy += (alvo.y - this.cy) * k;
      }
      this.cz += (alvo.zoom * this.multZoom - this.cz) * kz;
      cam.setZoom(Math.max(0.15, this.cz));
      const visW = cam.width / cam.zoom, visH = cam.height / cam.zoom;
      if (visW >= this.cen.largura) this.cx = this.cen.largura / 2;
      else this.cx = Phaser.Math.Clamp(this.cx, visW / 2, this.cen.largura - visW / 2);
      if (visH >= this.cen.altura) this.cy = this.cen.altura / 2;
      else this.cy = Phaser.Math.Clamp(this.cy, visH / 2, this.cen.altura - visH / 2);
      cam.scrollX = this.cx - visW / 2;
      cam.scrollY = this.cy - visH / 2;
      this._snap = false;
    }

    mostrarBalao(b, texto, hx, hy) {
      if (b.texto !== texto) { b.texto = texto; b.t.setText(texto); }
      const w = Math.max(78, b.t.width + 26), h = b.t.height + 16;
      const cam = this.cameras.main, z = cam.zoom || 1;
      const left = cam.scrollX + 10, right = cam.scrollX + cam.width / z - 10, top = cam.scrollY + 8;
      let cx = hx + (hx > cam.scrollX + (cam.width / z) * 0.62 ? -40 : 40);
      cx = Math.min(right - w / 2, Math.max(left + w / 2, cx));
      let y = hy - h - 16;
      if (y < top) y = Math.min(hy + 20, cam.scrollY + cam.height / z - h - 8);
      b.g.clear();
      b.g.fillStyle(0xffffff, 1);
      b.g.lineStyle(3.2, 0x161616, 1);
      b.g.fillRoundedRect(cx - w / 2, y, w, h, 11);
      b.g.strokeRoundedRect(cx - w / 2, y, w, h, 11);
      b.g.lineStyle(2.5, 0x161616, 1);
      b.g.beginPath();
      b.g.moveTo(cx - 10, y + h - 1);
      b.g.lineTo(hx, hy);
      b.g.lineTo(cx + 12, y + h - 1);
      b.g.strokePath();
      b.t.setPosition(cx, y + 7);
      b.g.setVisible(true); b.t.setVisible(true); b.on = true;
    }

    update(time, delta) {
      try { this.quadro(delta); }
      catch (e) {
        if (Date.now() - this._ultimoErro > 60000) { this._ultimoErro = Date.now(); console.error('[escritorio] erro no quadro', e); }
      }
    }

    quadro(delta) {
      const dt = Math.min(0.05, (delta || 16) / 1000);
      if (delta > 450) this._snap = true;
      if (deps.garantirDia) deps.garantirDia();
      if (deps.revisao !== this._revisao) { this._revisao = deps.revisao; this.syncAtores(deps.elencoRef.atual); }
      const agenda = deps.agendaRef.atual;
      if (!agenda) return;
      const parede = deps.relogio.agora();
      const d = new Date(parede);
      const tSeg = (parede % 86400000) / 1000;
      const t = tSeg / 60;
      this._tMin = t;
      const elenco = deps.elencoRef.atual;
      const estados = {};
      let andando = false;
      for (const p of elenco.personagens) {
        if (p.tipo === 'fixo') continue;
        const e = this.sim.estado(p.id, agenda, t);
        if (e && e.visivel) estados[p.id] = e;
        if (e && e.andando) andando = true;
      }
      const falando = {};
      for (const f of agenda.falas) {
        if (f.ini > t) break;
        if (t >= f.fim) continue;
        const loc = ((t - f.ini) * 60) % f.ciclo;
        for (const it of f.itens) if (loc >= it.em && loc < it.em + it.dur) falando[it.quem] = it.texto;
      }
      for (const e of Object.values(estados)) e.falando = !!falando[e.id] && !e.andando;

      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1 && p2 && p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (!this._pinch) this._pinch = { d: Math.max(8, dist), m: this.multZoom };
        else this.multZoom = Phaser.Math.Clamp(this._pinch.m * (dist / this._pinch.d), 0.55, 2.3);
      } else this._pinch = null;
      const ptr = this.input.activePointer;
      if (this.planta && ptr && ptr.isDown && !this._pinch) {
        if (this._drag) {
          const z = this.cameras.main.zoom || 1;
          this.cx -= (ptr.x - this._drag.x) / z;
          this.cy -= (ptr.y - this._drag.y) / z;
        }
        this._drag = { x: ptr.x, y: ptr.y };
        this._pan = true;
      } else this._drag = null;

      const cabecas = {};
      const vistos = new Set(Object.keys(estados));
      for (const [id, ator] of Object.entries(this.atores)) {
        const e = estados[id];
        if (!e) { ator.img.setVisible(false); continue; }
        cabecas[id] = this.porAtor(ator, e, tSeg);
      }
      for (const id of Object.keys(this.atores)) if (!vistos.has(id)) this.atores[id].img.setVisible(false);

      const per = periodo(t);
      const vivos = Object.values(estados);
      const tipos = {};
      for (const p of elenco.personagens) tipos[p.id] = p.tipo;
      let pessoas = 0;
      for (const e of vivos) if (tipos[e.id] !== 'visitante') pessoas++;
      const luz = this.cen.luz || {};
      const hm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
      const acesa = pessoas > 0 && (t < hm(luz.acesaAte || '19:00') || pessoas >= (luz.minimoPessoasDepois || 2));
      const escuro = acesa ? 0 : per === 'noite' ? 0.74 : per === 'tarde' || per === 'aurora' ? 0.42 : 0.12;
      this.noite.setAlpha(escuro);
      const fundo = escuro >= 0.4 ? '#2a2a2e' : '#ffffff';
      this.cameras.main.setBackgroundColor(fundo);
      document.body.classList.toggle('noturno', escuro >= 0.4);
      document.body.style.background = fundo;

      const dev = estados.dev;
      const ativos = agenda.efeitos.filter((ef) => ef.ini <= t && t < ef.fim);
      const efTela = ativos.find((ef) => ef.tipo === 'tela');
      const efBilhete = ativos.find((ef) => ef.tipo === 'bilhete');
      let modoTela = '', textoTela = '';
      if (efBilhete) { modoTela = 'bilhete'; textoTela = efBilhete.texto || ''; }
      else if (efTela) { modoTela = 'texto'; textoTela = efTela.texto || ''; }
      else if (dev && !dev.andando && dev.ponto && dev.ponto.tipo === 'cadeira' && dev.pose !== 'dormindo') modoTela = 'codigo';
      const portas = {};
      for (const [nome, q] of Object.entries(this.cen.portas || {})) {
        const bx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, by = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
        portas[nome] = vivos.some((e) => e.andando && Math.hypot(e.x - bx, e.y - by) < 220);
      }
      const jogando = vivos.some((e) => !e.andando && /videogame/.test((e.seg && e.seg.acao) || ''));
      this.decor.atualizar({
        tMin: t, tSeg, periodo: per, escuro, modoTela, textoTela,
        fumaca: !!ativos.find((ef) => ef.tipo === 'fumaca'),
        canecaNaMao: !!(dev && (dev.pose === 'cafe' || ((dev.props || []).includes('caneca')))),
        jogando, portas,
      });

      let bi = 0;
      const usados = new Set();
      const porBalao = (id, texto, ponta) => {
        if (!ponta || bi >= this.baloes.length) return;
        this.mostrarBalao(this.baloes[bi], texto, ponta[0], ponta[1]);
        usados.add(bi); bi++;
      };
      for (const [id, texto] of Object.entries(falando)) {
        if (id === 'prompt') {
          const q = this.cen.mesas[this.cen._mesaDev].postit;
          if (q) porBalao(id, texto, [q[0][0] + 6, q[0][1] - 2]);
        } else if (cabecas[id]) porBalao(id, texto, [cabecas[id].x, cabecas[id].y]);
      }
      for (let i = 0; i < this.baloes.length; i++) if (!usados.has(i) && this.baloes[i].on) {
        this.baloes[i].g.setVisible(false); this.baloes[i].t.setVisible(false); this.baloes[i].on = false;
      }

      this.aplicarCamera(this.escolherAlvo(estados), dt);

      const dia = DIAS[d.getUTCDay()];
      const estDev = this.sim.estado('dev', agenda, t);
      const status = estDev && estDev.seg ? estDev.seg.status : '';
      const hud = `${dia.toUpperCase()} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} · ${fmtHM(t)}|${status}`;
      if (hud !== this._ultimoHud) {
        this._ultimoHud = hud;
        const [a, b] = hud.split('|');
        const h1 = document.getElementById('hud-hora'), h2 = document.getElementById('hud-acao');
        if (h1) h1.textContent = a;
        if (h2) h2.textContent = b;
      }
      deps.ultimoEstado = { pessoas, tMin: t, fds: dia === 'sab' || dia === 'dom', andando, jogando };
      deps.estados = estados;
    }

    porAtor(ator, e, tSeg) {
      const nome = this.resolver(e.id, e.visual.nomes);
      if (!nome) { ator.img.setVisible(false); return null; }
      const m = this.indice[e.id][nome];
      if (ator.pose !== nome) {
        ator.pose = nome;
        ator.img.setTexture(e.id + '/' + nome);
        ator.img.setOrigin(m.ax / m.w, m.ay / m.h);
        if (this.pipeline) ator.img.setPipeline(this.pipeline);
      }
      const resp = e.visual.respira ? Math.sin(tSeg * 1.65 + e.fase) : 0;
      const fala = e.falando ? Math.abs(Math.sin(tSeg * 7.2 + e.fase)) : 0;
      const esc = ator.esc;
      const bob = (e.visual.bob || 0) + (e.visual.respira ? resp * 1.7 : 0) + fala * 1.5 + (e.visual.alt || 0);
      const profY = this.depthDe(e);
      let levantar = e.visual.levantar || 0;
      if (e.visual.encaixar && this.profMap) levantar = Math.max(0, e.y - (topoMovel(this.profMap, e.x, e.y) + 18));
      const yPix = e.y - bob - levantar;
      ator.img.setFlipX(!!e.visual.espelho);
      ator.img.setScale(esc * (1 - resp * 0.01), esc * (1 + resp * 0.014 + fala * 0.018));
      ator.img.setPosition(e.x, yPix);
      ator.img.setDepth(e.visual.levantar ? yPix : profY);
      ator.img.setData('lim', e.visual.voando || e.visual.semOclusao ? 9999 : profY / 6);
      let alpha = 1;
      if (e.andando && e.ponto && e.ponto.sumir && e.prog > 0.84) alpha = Math.max(0, 1 - (e.prog - 0.84) / 0.16);
      ator.img.setAlpha(alpha);
      ator.img.setVisible(alpha > 0.03);
      const topo = yPix - m.ay * esc;
      return { x: e.x + (e.visual.espelho ? -1 : 1) * 6, y: topo + 8 };
    }
  };
}
