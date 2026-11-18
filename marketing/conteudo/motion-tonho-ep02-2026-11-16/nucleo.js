// Núcleo do motor (three.js): renderizador, câmera de grua, luz que acompanha a escala, letras com volume (Inter),
// lajes, texturas de canvas e o acúmulo que faz o desfoque de movimento e a profundidade de campo de verdade
// (lente fina: a câmera anda dentro da abertura e o plano de foco fica parado).
// Nada aqui guarda estado de um quadro para o outro: tudo sai do tempo, dentro de seek(t).
import * as THREE from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

export { THREE };
export const W = 1080, H = 1920, FOV = 32;

// Paleta: tudo dos tokens do BARBOS (identidade/tokens.css). Três cores: grafite, âmbar e o azul do caderno.
export const COR = {
  g950: '#0D0F12', g900: '#14171C', g800: '#1C2027', g700: '#2A2F38', g500: '#5B6472', g400: '#7C8595',
  g300: '#A8B0BC', g200: '#C9CFD8', g100: '#E4E7EC', g50: '#F4F6F8', branco: '#FFFFFF',
  ambar: '#F0A93B', ambar300: '#F7CE8A', ambar700: '#A9660F', ambar800: '#8A5309',   // ambar800: âmbar como texto no claro (6,32:1)
  azul: '#1B4FBF',            // --azul-700: a capa do caderno e a tinta da caneta
};

// ---------------------------------------------------------------- tempo e easing (só funções do tempo)
export const cl = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, u) => a + (b - a) * u;
export const P = (t, t0, d) => cl((t - t0) / d);
export const eo = u => (u >= 1 ? 1 : u <= 0 ? 0 : 1 - Math.pow(2, -10 * u));
export const ei = u => (u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(2, 10 * (u - 1)));
export const eio = u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2);
export const ss = u => { u = cl(u); return u * u * (3 - 2 * u); };
const K9 = 1 - 10 * Math.exp(-9);
export const sp = u => { u = cl(u); return u >= 1 ? 1 : (1 - (1 + 9 * u) * Math.exp(-9 * u)) / K9; };   // mola sem quique
export const hop = u => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
export const rad = d => d * Math.PI / 180;

// ---------------------------------------------------------------- palavras da fala (narracao/palavras.json)
export const PAL = [];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
// T('f04', 'Currais') = segundo em que a palavra começa; procura só dentro da frase (sem colisão entre frases)
export function T(id, w, occ = 1) {
  const n = norm(w); let k = 0;
  for (const p of PAL) if (p.id === id && norm(p.p) === n && ++k === occ) return p.t;
  throw new Error(`palavra não achada: ${id} ${w} #${occ}`);
}

// ---------------------------------------------------------------- renderizador, cena, câmera, luz
export const R = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
R.setPixelRatio(1); R.setSize(W, H);
R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NoToneMapping;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.localClippingEnabled = true;
document.body.appendChild(R.domElement);

export const S = new THREE.Scene();
S.background = new THREE.Color(COR.g950);
S.fog = new THREE.Fog(COR.g950, 10, 40);
export const C = new THREE.PerspectiveCamera(FOV, W / H, 0.01, 200000);

// luz de cima, vinda da frente-esquerda: as faces de cima saem perto da cor do token, as de frente um pouco mais
// escuras (volume), e a sombra cai para trás e para a direita
export const DIRV = new THREE.Vector3(-0.42, 1.0, 0.55).normalize();
const AMB = 0.50 * Math.PI, DIR = (0.50 * Math.PI) / DIRV.y;
export const LUZ = new THREE.DirectionalLight('#ffffff', DIR);
LUZ.castShadow = true; LUZ.shadow.mapSize.set(4096, 4096);
LUZ.shadow.radius = 4; LUZ.shadow.intensity = 0.62;
S.add(LUZ, LUZ.target, new THREE.AmbientLight('#ffffff', AMB));

export function mat(cor, extra = {}) { return new THREE.MeshLambertMaterial({ color: cor, ...extra }); }
export function sombra(o, lanca = true, recebe = true) {
  o.traverse(m => { if (m.isMesh) { m.castShadow = lanca; m.receiveShadow = recebe; } });
  return o;
}

// ---------------------------------------------------------------- câmera de grua: alvo, distância, elevação, azimute
// RIG.ap = raio da abertura (fração da distância): 0 = tudo em foco
// RIG.fr = distância do foco em relação a d (1 = foco no alvo; >1 = foco atrás do alvo, para a troca de foco)
export const RIG = { alvo: new THREE.Vector3(), d: 8, el: rad(88), az: 0, ap: 0.006, fr: 1 };
export function posicionarCamera() {
  const { alvo, d, el, az } = RIG;
  C.position.set(alvo.x + d * Math.cos(el) * Math.sin(az), alvo.y + d * Math.sin(el), alvo.z + d * Math.cos(el) * Math.cos(az));
  C.up.set(0, 1, 0);
  C.lookAt(alvo);
  // luz e sombra seguem a escala do enquadramento
  const s = Math.max(1.2, d * 0.62);
  LUZ.position.copy(alvo).addScaledVector(DIRV, d * 3 + 10);
  LUZ.target.position.copy(alvo);
  Object.assign(LUZ.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.1, far: d * 6 + 30 });
  LUZ.shadow.camera.updateProjectionMatrix();
  LUZ.shadow.bias = -0.00005 * s; LUZ.shadow.normalBias = 0.0035 * s;
  const k = Math.min(1, Math.max(0, (Math.log10(d) - 1) / 1.5));   // longe (mapa): neblina bem mais longe
  S.fog.near = d * (2.6 + 2.4 * k); S.fog.far = d * (9 + 9 * k);
}

// interpolação monótona (Fritsch–Carlson): passa por todas as chaves, sem ultrapassar, com velocidade contínua
export function curva(ts, vs) {
  const n = ts.length, m = new Array(n).fill(0), dl = [];
  for (let i = 0; i < n - 1; i++) dl.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : (dl[i - 1] + dl[i]) / 2;
  m[0] = dl[0]; m[n - 1] = dl[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (dl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / dl[i], b = m[i + 1] / dl[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * dl[i]; m[i + 1] = k * b * dl[i]; }
  }
  return t => {
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0; while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

// ---------------------------------------------------------------- tudo o que existe é registrado; seek esconde tudo e
// cada cena mostra o que é dela
const OBJ = [];
export function reg(o, pai = S) { OBJ.push(o); pai.add(o); o.visible = false; return o; }
export function esconderTudo() { for (const o of OBJ) o.visible = false; }

// ---------------------------------------------------------------- fonte (contornos da Inter) e canvas (Inter variável)
export let F8 = null, F6 = null;
const cacheTexto = new Map();
export function largura(s, size, f = F8) {
  let w = 0; const g = f.data.glyphs, r = f.data.resolution;
  for (const ch of s) w += ((g[ch] || g['?']).ha / r) * size;
  return w;
}
// geometria de uma palavra: face de trás em z=0, frente em z=depth; x=0 na esquerda, y=0 na linha de base
export function geoTexto(s, size, depth, f = F8, inclina = 0) {
  const k = `${s}|${size.toFixed(4)}|${depth.toFixed(4)}|${f === F8 ? 8 : 6}|${inclina}`;
  if (cacheTexto.has(k)) return cacheTexto.get(k);
  const bt = Math.min(0.012, depth * 0.15);
  const g = new TextGeometry(s, { font: f, size, depth: Math.max(0.0005, depth - 2 * bt), curveSegments: 6,
    bevelEnabled: true, bevelThickness: bt, bevelSize: Math.min(0.006, size * 0.012), bevelOffset: 0, bevelSegments: 2 });
  g.translate(0, 0, bt);
  if (inclina) g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, inclina, 0, 0, 0));   // itálico: x += inclina·y
  g.userData.w = largura(s, size, f);
  cacheTexto.set(k, g);
  return g;
}
export function palavra(s, size, depth, cor, f = F8, inclina = 0) {
  const m = new THREE.Mesh(geoTexto(s, size, depth, f, inclina), mat(cor));
  m.castShadow = true; m.receiveShadow = true;
  m.userData = { w: largura(s, size, f), s, size, depth };
  return m;
}
// uma palavra deitada numa superfície (lendo de frente para quem olha de cima, com o norte para cima na tela),
// dentro de um grupo cujo pivô é o canto da linha de base: rotation.x do grupo levanta a palavra (0 = deitada)
export function palavraDeitada(s, size, depth, cor, f = F8, alinha = 'center') {
  const g = new THREE.Group(), m = palavra(s, size, depth, cor, f);
  m.position.x = alinha === 'center' ? -m.userData.w / 2 : alinha === 'right' ? -m.userData.w : 0;
  g.add(m); g.userData = { m, w: m.userData.w };
  return g;
}

// ---------------------------------------------------------------- laje: retângulo arredondado com espessura
// Face de trás em z=0, frente em z=d. UV das faces normalizada 0..1.
const cacheLaje = new Map();
export function geoLaje(w, h, r, d) {
  w = Math.max(0.005, w); h = Math.max(0.005, h); d = Math.max(0.002, d);
  const k = `${w.toFixed(4)}|${h.toFixed(4)}|${r.toFixed(4)}|${d.toFixed(4)}`;
  if (cacheLaje.has(k)) return cacheLaje.get(k);
  const bv = Math.min(0.006, d * 0.25, w * 0.2, h * 0.2);
  const sw = w - 2 * bv, sh = h - 2 * bv, sr = Math.max(0.0002, Math.min(r - bv, sw / 2, sh / 2));
  const s = new THREE.Shape();
  const x0 = -sw / 2, y0 = -sh / 2;
  s.moveTo(x0 + sr, y0); s.lineTo(x0 + sw - sr, y0); s.absarc(x0 + sw - sr, y0 + sr, sr, -Math.PI / 2, 0);
  s.lineTo(x0 + sw, y0 + sh - sr); s.absarc(x0 + sw - sr, y0 + sh - sr, sr, 0, Math.PI / 2);
  s.lineTo(x0 + sr, y0 + sh); s.absarc(x0 + sr, y0 + sh - sr, sr, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + sr); s.absarc(x0 + sr, y0 + sr, sr, Math.PI, Math.PI * 1.5);
  const uv = {
    generateTopUV(g, v, a, b, c) { return [a, b, c].map(i => new THREE.Vector2((v[i * 3] + w / 2) / w, (v[i * 3 + 1] + h / 2) / h)); },
    generateSideWallUV() { return [0, 0, 0, 0].map(() => new THREE.Vector2(0, 0)); },
  };
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, d - 2 * bv), bevelEnabled: true, bevelThickness: bv,
    bevelSize: bv, bevelSegments: 2, curveSegments: 10, UVGenerator: uv });
  g.translate(0, 0, bv);
  cacheLaje.set(k, g);
  return g;
}
// laje deitada (face de cima para +y), centro em x/z = 0, base em y = 0
export function lajeDeitada(w, l, r, d, frente, lado = frente) {
  const m = new THREE.Mesh(geoLaje(w, l, r, d), [frente, lado]);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m);
  return g;
}

// ---------------------------------------------------------------- texturas de canvas (Inter variável)
export function canvasTex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  return { c, g, tex };
}
export function textoC(g, s, x, y, sz, wt, cor, align = 'left', ls = 0) {
  g.font = `${wt} ${sz}px Inter`; g.letterSpacing = ls + 'px'; g.textAlign = align; g.textBaseline = 'alphabetic';
  g.fillStyle = cor; g.fillText(s, x, y); g.letterSpacing = '0px';
}
export function larguraC(g, s, sz, wt, ls = 0) { g.font = `${wt} ${sz}px Inter`; g.letterSpacing = ls + 'px'; const w = g.measureText(s).width; g.letterSpacing = '0px'; return w; }
export function rgba(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
// "letra de mão" com a própria Inter: inclinada, cada letra com um pequeno giro e altura próprios (semente fixa)
export function maoC(g, s, x, y, sz, cor, semente = 1, wt = 500) {
  let r = semente * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280) - 0.5;
  g.save(); g.fillStyle = cor; g.font = `${wt} ${sz}px Inter`; g.textBaseline = 'alphabetic';
  let cx = x;
  for (const ch of s) {
    const w = g.measureText(ch).width;
    g.save(); g.translate(cx, y + rnd() * sz * 0.06); g.transform(1, 0, -0.22, 1, 0, 0); g.rotate(rnd() * 0.07);
    g.fillText(ch, 0, 0); g.restore();
    cx += w * 0.97;
  }
  g.restore();
  return cx - x;
}

// ---------------------------------------------------------------- carregar fonte e palavras
export let MAPA = null;
export async function carregarBase() {
  const [pal, f8, f6, mapa] = await Promise.all([
    fetch('narracao/palavras.json').then(r => r.json()),
    fetch('assets/inter_800.typeface.json').then(r => r.json()),
    fetch('assets/inter_600.typeface.json').then(r => r.json()),
    fetch('assets/mapa.json').then(r => r.json()),
  ]);
  PAL.push(...pal); F8 = new Font(f8); F6 = new Font(f6); MAPA = mapa;
  const ff = new FontFace('Inter', 'url(assets/Inter-VF.ttf)', { weight: '100 900' });
  await ff.load(); document.fonts.add(ff);
}

// ---------------------------------------------------------------- acúmulo: desfoque de movimento + profundidade de campo
const rtCena = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtAcum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const camQ = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadSoma = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rtCena.texture, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
const quadFim = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rtAcum.texture, depthTest: false, depthWrite: false }));
const cenaSoma = new THREE.Scene(); cenaSoma.add(quadSoma);
const cenaFim = new THREE.Scene(); cenaFim.add(quadFim);
const _dir = new THREE.Vector3(), _dx = new THREE.Vector3(), _dy = new THREE.Vector3();
// lente fina: anda a câmera (ox, oy) no plano da abertura e cisalha o frustum para o plano de foco não mexer
function lente(ox, oy) {
  const f = RIG.d * RIG.fr;
  C.updateMatrixWorld(true);
  _dx.setFromMatrixColumn(C.matrixWorld, 0); _dy.setFromMatrixColumn(C.matrixWorld, 1);
  C.position.addScaledVector(_dx, ox).addScaledVector(_dy, oy);
  C.updateMatrixWorld(true);
  C.updateProjectionMatrix();
  const e = C.projectionMatrix.elements;
  e[8] -= e[0] * ox / f; e[9] -= e[5] * oy / f;
  C.projectionMatrixInverse.copy(C.projectionMatrix).invert();
}
// aplicar(t) põe a cena (e o RIG) no tempo t. n amostras: o tempo se espalha pelo obturador e a câmera pela abertura.
export function desenhar(t, aplicar, n = 1, obturador = 1 / 120) {
  if (n <= 1) { aplicar(t); posicionarCamera(); C.updateProjectionMatrix(); R.setRenderTarget(null); R.render(S, C); return; }
  R.setRenderTarget(rtAcum); R.setClearColor(0x000000, 0); R.clear();
  quadSoma.material.opacity = 1 / n;
  const ouro = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    const tk = t + ((k + 0.5) / n - 0.5) * obturador;
    aplicar(tk); posicionarCamera();
    const r = RIG.ap * RIG.d * Math.sqrt((k + 0.5) / n), a = k * ouro;   // espiral de Vogel: amostras bem espalhadas no disco
    lente(r * Math.cos(a), r * Math.sin(a));
    R.setRenderTarget(rtCena); R.render(S, C);
    R.setRenderTarget(rtAcum); R.autoClear = false; R.render(cenaSoma, camQ); R.autoClear = true;
  }
  R.setRenderTarget(null); R.render(cenaFim, camQ);
}
