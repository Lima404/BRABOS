// "Na cadeira do Tonho" · Ep. 01 · Sábado, 9h. Dois clientes. Um horário.
// Conceito: o caderno vira tabuleiro, duas peças na mesma casa.
// Câmera: grua sobre a mesa. Sempre em plongée, sobe para dar contexto e desce para o detalhe, foco raso.
// Unidades: a página tem 2,0 × 2,8. O norte (−z) fica para cima na tela. O mapa do RN usa 5 unidades por km, com
// a cidade de Currais Novos na origem: o caderno está em Currais Novos.
import {
  THREE, COR, cl, mix, P, eo, ei, eio, ss, sp, hop, rad, T, S, C, RIG, reg, esconderTudo, sombra, mat,
  palavra, palavraDeitada, largura, geoTexto, geoLaje, lajeDeitada, canvasTex, textoC, larguraC, rgba, maoC,
  curva, desenhar, F8, F6, MAPA,
} from './nucleo.js';

export const DUR = 51.0;
const Y_PAG = 0.12, Y_CAPA = 0.142;            // topo das folhas / topo da capa fechada
const PX = 700;                                 // pixels da textura da página por unidade
const pz = py => py / PX - 1.4, pxw = px => px / PX - 1.0;
const Z9 = -0.20;                               // a linha das 9h, onde as peças ficam
const mostrar = (o, sim = true) => { o.visible = !!sim; return !!sim; };

// ======================================================================== chão e mapa
const uDist = { value: 10 };
function matChao(cor, corLinha, forca) {
  const m = mat(cor);
  m.onBeforeCompile = sh => {
    sh.uniforms.uDist = uDist; sh.uniforms.uLinha = { value: new THREE.Color(corLinha) }; sh.uniforms.uForca = { value: forca };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vMundo; uniform float uDist; uniform vec3 uLinha; uniform float uForca;
float grade(vec2 p, float s) { vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(1e-6)); return 1.0 - min(min(g.x, g.y), 1.0); }
float faixa(float s) { float r = s / uDist; return smoothstep(0.008, 0.035, r) * (1.0 - smoothstep(0.2, 0.45, r)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float L = 0.0;
  L = max(L, grade(vMundo.xz, 0.5) * faixa(0.5));
  L = max(L, grade(vMundo.xz, 5.0) * faixa(5.0));
  L = max(L, grade(vMundo.xz, 50.0) * faixa(50.0));
  L = max(L, grade(vMundo.xz, 500.0) * faixa(500.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, uLinha, L * uForca); }`);
  };
  return m;
}
function formaDe(anel) { const s = new THREE.Shape(); anel.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); return s; }
function laje2D(anel, prof) {
  const g = new THREE.ExtrudeGeometry(formaDe(anel), { depth: prof, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, -prof, 0);
  return g;
}
const MAP = {};
function criarMapa() {
  MAP.rn = reg(new THREE.Mesh(laje2D(MAPA.rn, 30), [matChao(COR.g900, COR.g700, 0.55), mat(COR.g800)]));
  MAP.fora = reg(new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), mat(COR.g950)));
  MAP.fora.rotation.x = -Math.PI / 2; MAP.fora.position.y = -30;
  for (const [n, cor, linha] of [['serido_oc', COR.g700, COR.g500], ['serido_or', COR.g700, COR.g500], ['currais', COR.ambar, COR.ambar700]]) {
    MAP[n] = reg(new THREE.Mesh(laje2D(MAPA[n], 90), [matChao(cor, linha, 0.3), mat(n === 'currais' ? COR.ambar700 : COR.g800)]));
  }
  for (const m of [MAP.rn, MAP.fora, MAP.serido_oc, MAP.serido_or, MAP.currais]) { m.receiveShadow = true; m.castShadow = m !== MAP.fora; }
  MAP.rotCurrais = reg(palavraDeitada('CURRAIS', 26, 2.2, COR.g900));
  MAP.rotNovos = reg(palavraDeitada('NOVOS', 26, 2.2, COR.g900));
  MAP.rotSerido = reg(palavraDeitada('SERIDÓ', 60, 4, COR.g100));
  MAP.rotRN = reg(palavraDeitada('RIO GRANDE DO NORTE', 40, 3, COR.g500));
  MAP.rotCurrais.rotation.x = MAP.rotNovos.rotation.x = MAP.rotSerido.rotation.x = MAP.rotRN.rotation.x = -Math.PI / 2;
}

// ======================================================================== peças: peão (cliente) e cadeira
function criarPeao(cor) {
  const pts = [[0, 0], [0.13, 0], [0.132, 0.012], [0.128, 0.03], [0.105, 0.048], [0.082, 0.07], [0.07, 0.12], [0.06, 0.2],
    [0.056, 0.258], [0.074, 0.27], [0.078, 0.286], [0.06, 0.3], [0.035, 0.31], [0, 0.312]].map(([r, y]) => new THREE.Vector2(r, y));
  const m = mat(cor);
  const corpo = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), m);
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.088, 44, 30), m); cabeca.position.y = 0.388;
  const mo = mat(COR.g50);
  const olhos = [-1, 1].map(s => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 18, 12), mo); o.position.set(s * 0.032, 0.404, 0.078); return o; });
  const modelo = new THREE.Group(); modelo.add(corpo, cabeca, ...olhos); modelo.scale.setScalar(0.85);
  const corpoG = new THREE.Group(); corpoG.add(modelo);
  const g = new THREE.Group(); g.add(corpoG); sombra(g);
  g.userData.corpo = corpoG;
  return g;
}
function criarCadeira() {
  const g = new THREE.Group();
  const est = mat(COR.g50), met = mat(COR.g300);
  const cil = (r, h, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 36), m);
  const lajeEm = (w, h, r, d, m) => new THREE.Mesh(geoLaje(w, h, r, d), [m, m]);
  const base = cil(0.11, 0.018, met); base.position.y = 0.009;
  const col = cil(0.022, 0.13, met); col.position.y = 0.083;
  const assento = lajeDeitada(0.25, 0.23, 0.05, 0.06, est); assento.position.set(0, 0.148, 0.005);
  const enc = lajeEm(0.23, 0.27, 0.05, 0.055, est); enc.position.set(0, 0.335, -0.15); enc.rotation.x = -0.16;
  const haste = cil(0.008, 0.07, met); haste.position.set(0, 0.49, -0.185);
  const cab = lajeEm(0.13, 0.065, 0.03, 0.045, est); cab.position.set(0, 0.54, -0.2); cab.rotation.x = -0.16;
  const bracos = [-1, 1].flatMap(s => {
    const b = lajeDeitada(0.045, 0.21, 0.02, 0.03, est); b.position.set(s * 0.142, 0.232, 0.0);
    const p = cil(0.009, 0.05, met); p.position.set(s * 0.142, 0.21, 0.05);
    return [b, p];
  });
  const pe = lajeDeitada(0.17, 0.07, 0.02, 0.018, met); pe.position.set(0, 0.05, 0.2); pe.rotation.x = 0.35;
  const barra = cil(0.008, 0.13, met); barra.position.set(0, 0.1, 0.16); barra.rotation.x = 0.75;
  g.add(base, col, assento, enc, haste, cab, ...bracos, pe, barra);
  return sombra(g);
}

// ======================================================================== o caderno de capa azul
function texCapa() {
  const { g, tex } = canvasTex(512, 712);
  g.fillStyle = COR.azul; g.fillRect(0, 0, 512, 712);
  g.fillStyle = rgba(COR.g900, 0.22); g.fillRect(0, 0, 512, 712);
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14000; i++) {   // trama de papelão encapado: fiozinhos claros e escuros
    g.fillStyle = rnd() < 0.5 ? rgba(COR.g900, 0.05) : rgba(COR.branco, 0.035);
    g.fillRect(rnd() * 512, rnd() * 712, 1 + rnd() * 3, 1);
  }
  g.strokeStyle = rgba(COR.branco, 0.14); g.lineWidth = 2;
  g.beginPath(); g.roundRect(26, 26, 460, 660, 14); g.stroke();
  return tex;
}
function desenharPagina() {
  const { g, tex } = canvasTex(1400, 1960);
  g.fillStyle = COR.branco; g.fillRect(0, 0, 1400, 1960);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 12000; i++) { g.fillStyle = rgba(COR.g300, 0.05 + rnd() * 0.06); g.fillRect(rnd() * 1400, rnd() * 1960, 1.5, 1.5); }
  textoC(g, 'BARBEARIA DO', 110, 150, 44, 700, COR.g500, 'left', 6);
  const xT = 110 + larguraC(g, 'BARBEARIA DO ', 44, 700, 6);
  textoC(g, 'SÁBADO', 104, 300, 132, 800, COR.g900, 'left', -2);
  g.fillStyle = COR.g900; g.fillRect(110, 345, 1180, 4);
  g.fillStyle = COR.g200; g.fillRect(250, 380, 2, 1480);
  const HORAS = ['7h', '8h', '9h', '10h', '11h', '12h', '13h', '14h'];
  const NOMES = { 0: 'Nonato', 1: 'Marcelo', 3: 'Fábio e filho', 4: 'Rafael', 6: 'Zé Carlos', 7: 'Ítalo' };
  HORAS.forEach((h, i) => {
    const y0 = 420 + i * 170;
    g.fillStyle = COR.g200; g.fillRect(110, y0 + 170, 1180, 2);
    if (i !== 2) textoC(g, h, 140, y0 + 114, 60, 700, COR.g500);
    if (NOMES[i]) maoC(g, NOMES[i], 300, y0 + 112, 76, COR.azul, i + 3);
  });
  return { tex, xTonho: pxw(xT), zTonho: pz(150), xNove: pxw(140), zNove: pz(420 + 2 * 170 + 114) };
}
function tinta(desenho, w = 800, h = 200) {
  const { g, tex } = canvasTex(w, h);
  desenho(g);
  const pl = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -99);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w / PX, h / PX).rotateX(-Math.PI / 2),
    mat('#ffffff', { map: tex, transparent: true, depthWrite: false, clippingPlanes: [pl], polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true; m.renderOrder = 2;
  m.userData.plano = pl;
  return m;
}

const CAD = {};
function criarCaderno() {
  const grupo = CAD.grupo = reg(new THREE.Group());
  const mCapa = mat('#ffffff', { map: texCapa() }), mLado = mat(new THREE.Color(COR.azul).lerp(new THREE.Color(COR.g900), 0.22));
  grupo.add(lajeDeitada(2.06, 2.86, 0.035, 0.02, mCapa, mLado));
  const pag = desenharPagina();
  const mPag = mat('#ffffff', { map: pag.tex }), mBorda = mat(COR.g100);
  const miolo = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.10, 2.78), [mBorda, mBorda, mPag, mBorda, mBorda, mBorda]);
  miolo.position.y = 0.07; sombra(miolo); grupo.add(miolo);
  const lombada = new THREE.Mesh(new THREE.BoxGeometry(0.014, Y_CAPA, 2.86), mLado);
  lombada.position.set(-1.012, Y_CAPA / 2, 0); sombra(lombada); grupo.add(lombada);
  CAD.pivo = new THREE.Group(); CAD.pivo.position.set(-1.012, Y_CAPA, 0); grupo.add(CAD.pivo);
  const capa = lajeDeitada(2.06, 2.86, 0.035, 0.022, mCapa, mLado); capa.position.set(1.03, -0.022, 0); CAD.pivo.add(capa);

  // ---- o rótulo da série, na capa (gira com ela). y = 0 é a face de cima da capa fechada
  const rot = CAD.rot = new THREE.Group(); rot.position.set(1.03, 0, 0); CAD.pivo.add(rot);
  const sT = Math.min(0.27, 1.62 / largura('NA CADEIRA', 1));
  CAD.tit1 = palavraDeitada('NA CADEIRA', sT, 0.04, COR.branco); CAD.tit1.position.z = -0.14;
  CAD.tit2 = palavraDeitada('DO TONHO', sT, 0.04, COR.branco); CAD.tit2.position.z = 0.2;
  CAD.pilula = new THREE.Group();
  CAD.pilula.add(lajeDeitada(0.5, 0.18, 0.09, 0.03, mat(COR.ambar)));
  const ep = palavraDeitada('EP. 01', 0.095, 0.01, COR.g900); ep.position.set(0, 0.03, 0.0345); CAD.pilula.add(ep);
  CAD.pilula.position.z = -0.86;
  CAD.sub = palavraDeitada('TODA SEMANA TEM EPISÓDIO', 0.068, 0.008, COR.branco, F6); CAD.sub.position.z = 0.48;
  CAD.cadTit = criarCadeira(); CAD.cadTit.position.set(0, 0, 0.92);
  for (const o of [CAD.tit1, CAD.tit2, CAD.sub]) o.rotation.x = -Math.PI / 2;
  rot.add(CAD.tit1, CAD.tit2, CAD.pilula, CAD.sub, CAD.cadTit);
  // chamada para comentar (de pé na capa) e o balão
  const sC = 0.19;
  CAD.cta = ['JÁ', 'ACONTECEU', 'COM', 'VOCÊ?'].map(s => { const o = palavraDeitada(s, sC, 0.035, COR.branco, F8, 'left'); o.rotation.x = -Math.PI / 2; rot.add(o); return o; });
  const esp = largura(' ', sC), w = CAD.cta.map(o => o.userData.w);
  const l1 = w[0] + esp + w[1], l2 = w[2] + esp + w[3];
  CAD.ctaPos = [[-l1 / 2, -0.12], [-l1 / 2 + w[0] + esp, -0.12], [-l2 / 2, 0.2], [-l2 / 2 + w[2] + esp, 0.2]];
  CAD.bolha = criarBolha(); rot.add(CAD.bolha);

  // ---- na página
  CAD.tonho = palavraDeitada('TONHO', 44 / PX, 0.02, COR.g500, F8, 'left');
  CAD.tonho.position.set(pag.xTonho, Y_PAG, pag.zTonho); grupo.add(CAD.tonho);
  CAD.tonho.userData.x0 = pag.xTonho; CAD.tonho.userData.z0 = pag.zTonho;
  CAD.anos = new THREE.Group(); grupo.add(CAD.anos);
  CAD.anosHa = palavra('HÁ', 0.1, 0.035, COR.g500); CAD.anosNum = palavra('15', 0.1, 0.035, COR.g500); CAD.anosAnos = palavra('ANOS', 0.1, 0.035, COR.g500);
  CAD.anos.add(CAD.anosHa, CAD.anosNum, CAD.anosAnos);
  CAD.anos.position.set(pag.xTonho + 0.02, Y_PAG, pag.zTonho + 0.2);

  const mDest = mat(COR.ambar, { transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  CAD.destaque = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.158).translate(0.5, 0, 0).rotateX(-Math.PI / 2), mDest);
  CAD.destaque.position.set(pxw(96), Y_PAG + 0.0006, -0.193); CAD.destaque.receiveShadow = true; CAD.destaque.renderOrder = 1; grupo.add(CAD.destaque);

  // tinta das 9h: Paulo, Diego por cima, e o rabisco
  CAD.tPaulo = tinta(g => maoC(g, 'Paulo', 40, 140, 84, COR.azul, 21));
  CAD.tDiego = tinta(g => { g.translate(118, 176); g.rotate(-0.1); maoC(g, 'Diego', 0, 0, 86, COR.azul, 33, 600); });
  CAD.tRabisco = tinta(g => {
    g.strokeStyle = COR.azul; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(44, 96);
    for (let i = 0; i < 9; i++) g.lineTo(62 + i * 24, i % 2 ? 122 : 84);
    g.stroke();
  });
  for (const m of [CAD.tPaulo, CAD.tDiego, CAD.tRabisco]) { m.position.set(pxw(380) + 400 / PX, Y_PAG + 0.0009, pz(872) - 140 / PX + 100 / PX); grupo.add(m); }
  CAD.xTinta0 = pxw(380);
  // o 9h impresso é uma palavra 3D deitada: levanta no "nove"
  CAD.nove = palavraDeitada('9h', 60 / PX, 0.02, COR.g500, F8, 'left');
  CAD.nove.position.set(pag.xNove, Y_PAG, pag.zNove); grupo.add(CAD.nove);

  // os nomes em 3D (itálico como a letra de mão)
  const nome = (s, sz) => { const gr = new THREE.Group(), m = new THREE.Mesh(geoTexto(s, sz, 0.032, F8, 0.22), mat(COR.azul)); m.castShadow = m.receiveShadow = true; gr.add(m); gr.userData = { m, w: largura(s, sz) }; return gr; };
  CAD.paulo = nome('Paulo', 0.118); CAD.diego = nome('Diego', 0.124);
  grupo.add(CAD.paulo, CAD.diego);

  CAD.peaoA = criarPeao(COR.g800); CAD.peaoB = criarPeao(COR.g800); grupo.add(CAD.peaoA, CAD.peaoB);

  CAD.perg = ['QUEM', 'MARCOU', 'PRIMEIRO?'].map(s => palavra(s, 0.17, 0.05, COR.branco));
  grupo.add(...CAD.perg);
  CAD.menos = palavra('−1', 0.32, 0.08, COR.g900); CAD.corte = palavra('CORTE', 0.112, 0.04, COR.g900);
  grupo.add(CAD.menos, CAD.corte);

  CAD.cadA = criarCadeira(); CAD.cadB = criarCadeira(); grupo.add(CAD.cadA, CAD.cadB);
}
function criarBolha() {
  const w = 0.92, h = 0.5, r = 0.2, s = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + 0.34, y0); s.lineTo(x0 + 0.16, y0 - 0.17); s.lineTo(x0 + 0.24, y0);
  s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0);
  s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2);
  s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
  geo.rotateX(-Math.PI / 2);
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(geo, mat(COR.ambar)); corpo.castShadow = corpo.receiveShadow = true;
  const ja = palavraDeitada('JÁ', 0.26, 0.03, COR.g900); ja.rotation.x = -Math.PI / 2; ja.position.set(0, 0.058, 0.095);
  g.add(corpo, ja); g.userData = { corpo, ja };
  return g;
}

// ======================================================================== câmera (chaves da grua)
// [t, alvo x, y, z, distância, elevação°, azimute°, abertura, foco relativo]
const CHAVES = [
  [0.00, 0, 0.14, 0.75, 9.0, 72, 0, 0.004, 1],
  [0.40, 0, 0.14, 0.70, 8.7, 72.5, 1.25, 0.004, 1],
  [1.10, -0.2, 0.12, -0.72, 4.5, 70, 2.0, 0.008, 1],
  [2.00, -0.25, 0.12, -0.3, 3.9, 64, 0.5, 0.010, 1],
  [3.00, -0.22, 0.17, -0.25, 3.6, 56, 0, 0.012, 1],
  [4.50, -0.17, 0.2, -0.22, 3.0, 46, 0, 0.014, 1],
  [5.50, -0.1, 0.16, -0.62, 3.0, 58, 0, 0.012, 1],
  [6.60, 0.04, 0.16, -1.16, 2.6, 58, 0, 0.014, 1],
  [7.60, 0.06, 0.24, -1.2, 2.75, 62, 0, 0.014, 1],
  [8.70, 0.06, 0.27, -1.2, 3.0, 62, 0, 0.012, 1],
  [9.20, 0, 0.1, -0.5, 8.5, 60, 0, 0.008, 1],
  [9.60, 4, 0, -2, 200, 68, 0, 0.008, 1],
  [10.00, 30, 0, 8, 700, 66, 0, 0.009, 1],
  [10.60, -120, 0, 110, 2300, 68, 0, 0.010, 1],
  [11.10, -165, 0, 150, 2800, 72, 0, 0.010, 1],
  [11.45, -140, 0, 130, 2600, 72, -4, 0.010, 1],
  [11.85, -10, 0, 8, 150, 62, -12, 0.010, 1],
  [12.20, -1.8, 0.05, -0.3, 6.5, 48, -22, 0.012, 1],
  [12.60, -2.04, 0.15, -0.44, 3.4, 34, -30, 0.014, 1],
  [13.60, -1.6, 0.1, -0.25, 4.7, 50, -55, 0.012, 1],
  [14.40, -0.7, 0.1, -0.62, 4.0, 58, -24, 0.012, 1],
  [15.30, -0.4, 0.12, -1.0, 3.0, 62, 0, 0.012, 1],
  [16.20, -0.36, 0.12, -0.86, 2.8, 61, 0, 0.012, 1],
  [17.10, -0.16, 0.12, -0.26, 2.2, 60, 0, 0.012, 1],
  [18.40, -0.18, 0.12, -0.22, 2.15, 58, 0, 0.012, 1],
  [19.80, -0.17, 0.12, -0.2, 1.95, 56, 0, 0.013, 1],
  [20.60, -0.2, 0.16, -0.2, 2.1, 44, -10, 0.014, 1],
  [21.40, -0.2, 0.22, -0.22, 3.3, 24, -22, 0.015, 1],
  [22.60, -0.18, 0.24, -0.24, 3.15, 20, -26, 0.015, 1],
  [23.50, -0.17, 0.24, -0.28, 3.3, 20, -18, 0.015, 1],
  [24.40, -0.15, 0.26, -0.32, 3.35, 20, -8, 0.015, 1.24],
  [25.30, -0.15, 0.36, -0.5, 3.0, 17, -12, 0.015, 1],
  [26.20, -0.15, 0.5, -0.7, 3.3, 14, -12, 0.014, 1],
  [27.50, -0.15, 0.58, -0.75, 3.6, 13, -8, 0.014, 1],
  [28.60, -0.14, 0.25, -0.28, 3.3, 24, -18, 0.015, 1],
  [29.80, 0.0, 0.25, -0.3, 3.1, 24, -14, 0.015, 1],
  [31.00, 0.15, 0.2, -0.75, 3.0, 26, -12, 0.015, 1],
  [32.40, 0.15, 0.28, -0.2, 2.6, 28, 8, 0.015, 1],
  [33.20, 0.1, 0.28, -0.22, 2.75, 30, 4, 0.015, 1],
  [34.15, -1.95, 0.2, -0.46, 2.4, 28, -25, 0.016, 1],
  [35.40, -2.0, 0.2, -0.46, 2.65, 32, -30, 0.015, 1],
  [36.40, -0.9, 0.1, -0.3, 6.5, 70, -10, 0.008, 1],
  [37.30, 0.0, 0.15, -0.8, 4.2, 60, 0, 0.010, 1],
  [38.30, 0.0, 0.15, -0.4, 5.5, 72, 0, 0.008, 1],
  [39.10, 0.0, 0.14, 0.0, 6.6, 82, 0, 0.006, 1],
  [39.60, 0.0, 0.14, 0.05, 5.9, 86, 0, 0.006, 1],
  [40.50, 0.0, 0.14, 0.1, 7.2, 64, -18, 0.007, 1],
  [41.50, 0.0, 0.2, 0.12, 5.6, 70, -6, 0.009, 1],
  [43.00, 0.0, 0.22, 0.1, 5.0, 66, 0, 0.009, 1],
  [44.30, 0.0, 0.32, 0.1, 4.0, 56, 0, 0.010, 1],
  [45.40, 0.0, 0.25, 0.1, 5.6, 66, 0, 0.008, 1],
  [46.80, 0.0, 0.25, 0.2, 6.0, 68, 0, 0.008, 1],
  [48.00, 0.0, 0.25, 0.3, 5.4, 67, 0, 0.008, 1],
  [49.40, 0, 0.15, 0.68, 8.6, 71.5, -5, 0.005, 1],
  [50.30, 0, 0.14, 0.74, 8.9, 72, -2.2, 0.004, 1],
  [51.00, 0, 0.14, 0.75, 9.0, 72, 0, 0.004, 1],
];
const ts = CHAVES.map(k => k[0]);
const CAM = {
  x: curva(ts, CHAVES.map(k => k[1])), y: curva(ts, CHAVES.map(k => k[2])), z: curva(ts, CHAVES.map(k => k[3])),
  d: curva(ts, CHAVES.map(k => Math.log(k[4]))), el: curva(ts, CHAVES.map(k => k[5])), az: curva(ts, CHAVES.map(k => k[6])),
  ap: curva(ts, CHAVES.map(k => k[7])), fr: curva(ts, CHAVES.map(k => k[8])),
};
function camera(t) {
  RIG.alvo.set(CAM.x(t), CAM.y(t), CAM.z(t));
  RIG.d = Math.exp(CAM.d(t)); RIG.el = rad(CAM.el(t)); RIG.az = rad(CAM.az(t)); RIG.ap = CAM.ap(t); RIG.fr = CAM.fr(t);
  // empurrão curto da câmera nos impactos fortes (sem tremer: só uma aproximação que volta macia)
  for (const [ti, k] of IMPACTOS_CAM) { const u = (t - ti) / 0.5; if (u > 0 && u < 1) RIG.d *= 1 - k * Math.exp(-6 * u) * ss(u * 8); }
  uDist.value = RIG.d;
}
let IMPACTOS_CAM = [];

// ======================================================================== utilidades de movimento
// peão: pouso (cai de cima com aceleração e amassa ao tocar), pulos, amasso e giro
function amasso(t, t0, forca = 0.18) { const u = (t - t0) / 0.35; return u > 0 && u < 1 ? forca * Math.sin(Math.PI * u) * Math.exp(-3 * u) * 1.6 : 0; }
function porPeao(p, x, y, z, giro, sq = 0, inclina = 0) {
  p.position.set(x, y, z); p.rotation.set(0, giro, 0);
  const c = p.userData.corpo; c.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5); c.rotation.z = inclina;
}
// caminho em pulinhos: de a até b, um pulo por meia batida a partir de t0
function pulos(t, t0, n, a, b, alt = 0.07, dur = 0.5) {
  const u = cl((t - t0) / (n * dur)), k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k;
  const pos = mix(a, b, (k + ss(f)) / n);
  return { pos, y: u > 0 && u < 1 ? hop(f) * alt : 0 };
}
// palavra de pé subindo de dentro do caderno (u: 0 escondida, 1 no lugar)
function subir(m, u, x, yBase, z, alt = 0.4) { if (!mostrar(m, u > 0.002)) return; m.position.set(x, yBase - alt * (1 - u), z); }

// ======================================================================== cenas
export async function criarCenas() {
  criarMapa(); criarCaderno();
  // os tempos que mandam (da fala)
  const tt = {
    sabado: T('f01', 'Sábado'), nove: T('f01', 'nove'), dois: T('f02', 'Dois'), clientes: T('f02', 'clientes'), chegam: T('f02', 'chegam'), horario: T('f02', 'horário'),
    tonho: T('f03', 'Tonho'), quinze: T('f04', 'quinze'), anos: T('f04', 'anos'), currais: T('f04', 'Currais'), novos: T('f04', 'Novos'), serido: T('f04', 'Seridó'), aqui: T('f04', 'aqui'),
    duas: T('f05', 'Duas'), cadeiras: T('f05', 'cadeiras'), capa: T('f05', 'capa'),
    pagina: T('f06', 'página'), sabado2: T('f06', 'sábado'), nomes: T('f06', 'nomes'), horario2: T('f06', 'horário'),
    escrito: T('f07', 'escrito'), cima: T('f07', 'cima'), outro: T('f07', 'outro'),
    olham: T('f08', 'olham'), doisF8: T('f08', 'dois'), tonhoF9: T('f09', 'Tonho'), graca: T('f09', 'graça'), pergunta: T('f09', 'pergunta'),
    quem: T('f10', 'Quem'), marcou: T('f10', 'marcou'), primeiro: T('f10', 'primeiro'),
    ninguem: T('f11', 'Ninguém'), sabe: T('f11', 'sabe'), deles: T('f12', 'deles'), vai: T('f12', 'vai'), embora: T('f12', 'embora'),
    menos: T('f13', 'Menos'), corte: T('f13', 'corte'), talvez: T('f14', 'talvez'), menos2: T('f14', 'menos'), cliente: T('f14', 'cliente'),
    problema: T('f15', 'problema'), nao: T('f15', 'não'), tonhoF15: T('f15', 'Tonho'), caderno: T('f16', 'caderno'),
    ja1: T('f17', 'já'), aconteceu: T('f17', 'aconteceu'), com: T('f17', 'com'), voce: T('f17', 'você'), comenta: T('f17', 'comenta'), ja2: T('f17', 'já', 2),
    na: T('f18', 'Na'), cadeira: T('f18', 'cadeira'), do: T('f18', 'do'), tonhoF18: T('f18', 'Tonho'), toda: T('f18', 'Toda'), episodio: T('f18', 'episódio'),
  };
  TT = tt;
  IMPACTOS_CAM = [[4.5, 0.025], [32.5, 0.04], [39.5, 0.06], [48.5, 0.035]];
  // os filhos que cada quadro liga ou desliga (começam todo quadro escondidos: nada guarda estado)
  GEST.push(CAD.tit1, CAD.tit2, CAD.pilula, CAD.sub, CAD.cadTit, ...CAD.cta, CAD.bolha, CAD.bolha.userData.ja,
    CAD.tonho, CAD.anos, CAD.nove, CAD.destaque, CAD.tPaulo, CAD.tDiego, CAD.tRabisco, CAD.paulo, CAD.diego, CAD.peaoA, CAD.peaoB,
    ...CAD.perg, CAD.menos, CAD.corte, CAD.cadA, CAD.cadB);
  window.EVENTOS = eventosDoSom(tt);
}
let TT = null;
const GEST = [];

function aplicar(t) {
  const tt = TT;
  esconderTudo();
  camera(t);

  // ---------------------------------------------------------------- mapa (o chão de tudo)
  mostrar(MAP.rn); mostrar(MAP.fora);
  const liftCur = 42 * sp((t - (tt.novos + 0.05)) / 0.45) * (1 - ei(P(t, 11.45, 0.5)));
  const liftSer = 22 * sp((t - (tt.serido - 0.2)) / 0.45) * (1 - ei(P(t, 11.45, 0.5)));
  const regiaoVisivel = t > 9.0 && t < 12.2;
  for (const n of ['serido_oc', 'serido_or']) if (mostrar(MAP[n], regiaoVisivel)) MAP[n].position.y = -0.6 + liftSer + 0.4 * cl(liftSer);
  const yCur = (liftSer + liftCur) > 0.01 ? liftSer + liftCur : -0.6;
  if (mostrar(MAP.currais, regiaoVisivel)) MAP.currais.position.y = yCur;
  const rotu = (m, u, x, y, z) => { if (!mostrar(m, u > 0.01 && regiaoVisivel)) return; m.position.set(x, y + 0.2 - 6 * (1 - u), z); m.scale.setScalar(mix(0.9, 1, u)); };
  rotu(MAP.rotCurrais, sp((t - tt.currais - 0.1) / 0.4) * (1 - ei(P(t, 11.45, 0.4))), 44, yCur, 22);
  rotu(MAP.rotNovos, sp((t - tt.novos) / 0.4) * (1 - ei(P(t, 11.45, 0.4))), 44, yCur, 56);
  rotu(MAP.rotSerido, sp((t - tt.serido) / 0.4) * (1 - ei(P(t, 11.45, 0.4))), -340, liftSer, 190);
  rotu(MAP.rotRN, sp((t - tt.aqui) / 0.5) * (1 - ei(P(t, 11.45, 0.4))), -60, 0, -300);

  // ---------------------------------------------------------------- o caderno
  const G = CAD.grupo; mostrar(G);
  G.position.y = Math.max(0, regiaoVisivel ? yCur : 0);
  // capa: abre no "Sábado", fecha no "caderno" (bate em 39,5)
  const abre = eio(P(t, tt.sabado - 0.02, 0.72));
  const fecha = ei(P(t, tt.caderno - 0.12, 0.33));
  const angulo = t < 20 ? Math.PI * abre : Math.PI * (1 - fecha);
  CAD.pivo.rotation.z = angulo;
  const desce = ss((angulo / Math.PI - 0.5) * 2);           // a dobradiça desce até a mesa na segunda metade do giro
  CAD.pivo.position.y = Y_CAPA * (1 - desce);
  CAD.pivo.position.x = -1.012 - 0.006 * desce;
  for (const o of GEST) o.visible = false;

  // ---- rótulo da série na capa: está lá no 1º quadro (o mesmo do último) e nasce de novo no fim
  const R = CAD.rot; mostrar(R);
  const noInicio = t < 1.3;
  const sobe = (tw, d = 0.42) => sp((t - tw) / d);
  const uT1 = noInicio ? 1 : sobe(tt.na - 0.05), uT2 = noInicio ? 1 : sobe(tt.do - 0.05);
  const emergirRot = (o, u, z, alt = 0.06) => { if (!mostrar(o, u > 0.002)) return; o.position.y = -alt * (1 - u); o.position.z = z; };
  emergirRot(CAD.tit1, uT1, -0.14); emergirRot(CAD.tit2, uT2, 0.2);
  const uSub = noInicio ? 1 : sobe(tt.toda - 0.05);
  emergirRot(CAD.sub, uSub, 0.48, 0.02);
  // a pílula EP. 01 cai de cima e carimba na batida de 48,5
  const tCarimbo = 48.5;
  if (mostrar(CAD.pilula, noInicio || t > tCarimbo - 0.45)) {
    const u = noInicio ? 1 : ei(P(t, tCarimbo - 0.45, 0.45));
    CAD.pilula.position.y = (1 - u) * 0.9;
    const sq = noInicio ? 0 : amasso(t, tCarimbo, 0.35);
    CAD.pilula.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    CAD.pilula.rotation.y = (1 - u) * 0.5;
  }
  // a cadeira do título sobe no "cadeira"
  const uCad = noInicio ? 1 : sp((t - tt.cadeira + 0.05) / 0.5);
  if (mostrar(CAD.cadTit, uCad > 0.002)) { CAD.cadTit.position.y = -0.62 * (1 - uCad); CAD.cadTit.rotation.y = (1 - uCad) * -1.2; }
  // chamada: JÁ · ACONTECEU / COM · VOCÊ? sobem da capa, palavra por palavra, e afundam no "comenta"
  const sai = ei(P(t, tt.comenta - 0.28, 0.3));
  [tt.ja1, tt.aconteceu, tt.com, tt.voce].forEach((tw, i) => {
    const u = sp((t - tw + 0.04) / 0.3) * (1 - sai);
    const o = CAD.cta[i];
    if (!mostrar(o, t > 40 && t < 45 && u > 0.002)) return;
    o.position.set(CAD.ctaPos[i][0], -0.045 * (1 - u), CAD.ctaPos[i][1]);
    o.userData.m.scale.z = Math.max(0.05, u);
  });
  const uB = sp((t - tt.comenta + 0.05) / 0.45) * (1 - ei(P(t, tt.na - 0.35, 0.3)));
  if (mostrar(CAD.bolha, uB > 0.002)) {
    CAD.bolha.position.set(0, -0.12 + 0.13 * uB, 0.02);
    CAD.bolha.rotation.y = (1 - uB) * 0.6;
    const uJ = sp((t - tt.ja2 + 0.03) / 0.3);
    mostrar(CAD.bolha.userData.ja, uJ > 0.002); CAD.bolha.userData.ja.scale.set(1, 1, Math.max(0.02, uJ));
    CAD.bolha.userData.ja.position.y = 0.058 - 0.03 * (1 - uJ);
    const sq = amasso(t, tt.ja2 + 0.05, 0.15); CAD.bolha.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.4);
  }

  // ---- marca-texto âmbar na linha das 9h (no "nove")
  const uDest = eio(P(t, tt.nove - 0.02, 0.5));
  if (mostrar(CAD.destaque, uDest > 0.001 && t < 39.6)) CAD.destaque.scale.x = 1.21 * uDest;

  // ---- 9h: levanta no "nove" (cresce de pé) e deita de novo antes de as peças caírem
  {
    const o = CAD.nove, m = o.userData.m; mostrar(o, t < 39.6);
    const lev = sp((t - (tt.nove - 0.08)) / 0.4) * (1 - ei(P(t, 2.45, 0.4)));
    o.rotation.set(mix(-Math.PI / 2, -0.9, lev), 0, 0);
    o.scale.setScalar(mix(1, 2.2, lev));
    m.scale.z = mix(0.04, 1, lev);
    m.material.color.set(COR.g500).lerp(new THREE.Color(COR.g900), cl(lev * 1.5));
  }
  // ---- TONHO: impresso no cabeçalho; levanta no "Tonho", fica meio sem graça no ep. 9 e sai no "não é o Tonho"
  {
    const o = CAD.tonho, m = o.userData.m, z0 = o.userData.z0;
    const lev1 = sp((t - (tt.tonho - 0.1)) / 0.5) * (1 - ei(P(t, 14.5, 0.45)));
    const lev2 = sp((t - (tt.tonhoF9 - 0.08)) / 0.45) * (1 - ei(P(t, tt.pergunta + 0.1, 0.4)));
    const lev3 = sp((t - (tt.problema - 0.05)) / 0.45);
    const voa = t < 38.9 ? ei(P(t, tt.nao + 0.02, 0.55)) : 0;
    const l3 = t < 38.9 ? lev3 : 0;
    const lev = Math.max(lev1, lev2 * 0.62, l3);
    // sem graça: tomba um pouco para trás e afunda (no "graça")
    const semGraca = sp((t - tt.graca) / 0.4) * (1 - ei(P(t, tt.pergunta + 0.1, 0.4)));
    mostrar(o, voa < 1);
    o.rotation.set(mix(-Math.PI / 2, -0.42, lev) - 0.35 * semGraca, 0, 0);
    o.scale.setScalar(Math.max(mix(1, 2.1, Math.max(lev1, l3)), mix(1, 1.7, lev2)));
    m.scale.z = mix(0.04, 1, lev);
    m.material.color.set(COR.g500).lerp(new THREE.Color(COR.g900), cl(lev * 1.5));
    o.position.set(o.userData.x0, Y_PAG - 0.03 * semGraca + 2.4 * voa, z0 + 1.2 * voa);
  }
  // ---- HÁ 15 ANOS: sobe no "há", o número conta até 15
  {
    const u = sp((t - (tt.quinze - 0.12)) / 0.4) * (1 - ei(P(t, 14.5, 0.4)));
    if (mostrar(CAD.anos, u > 0.002)) {
      const n = Math.max(1, Math.min(15, Math.round(mix(1, 15, eo(P(t, tt.quinze, tt.anos - tt.quinze + 0.1))))));
      CAD.anosNum.geometry = geoTexto(String(n).padStart(2, '0'), 0.1, 0.035);
      const sz = 0.1, esp = largura(' ', sz);
      const wHa = largura('HÁ', sz), wN = largura('15', sz);
      CAD.anosHa.position.set(0, 0, 0); CAD.anosNum.position.set(wHa + esp, 0, 0); CAD.anosAnos.position.set(wHa + esp * 2 + wN, 0, 0);
      const total = (wHa + esp * 2 + wN + largura('ANOS', sz));
      CAD.anos.position.x = CAD.tonho.userData.x0 + CAD.tonho.userData.w * 1.05 - total / 2;
      CAD.anos.position.y = Y_PAG + 0.11 - 0.45 * (1 - u);
      CAD.anos.position.z = CAD.tonho.userData.z0 - 0.07;
      CAD.anos.rotation.x = -0.42;
      CAD.anos.scale.setScalar(1);
    }
  }

  // ---- os peões (clientes)
  const xA0 = -0.64, xB0 = 0.32, RP = 0.112;
  {
    // A: cai no "Dois" (pousa em 3,0), B no "clientes" (pousa em 3,5); andam até se encostar no "horário" (4,5)
    const queda = (tw, tPouso) => { const u = P(t, tw, tPouso - tw); return { y: 1.7 * (1 - u * u), visto: t >= tw }; };
    const qA = queda(tt.dois, 3.0), qB = queda(tt.clientes, 3.5);
    const tEnc = 4.5;
    const andaA = pulos(t, tt.chegam, 2, xA0, -0.16 - RP, 0.06, (tEnc - tt.chegam) / 2);
    const andaB = pulos(t, tt.chegam, 2, xB0, -0.16 + RP, 0.06, (tEnc - tt.chegam) / 2);
    const afasta = sp((t - tEnc) / 0.4) * 0.035;
    // depois do encontrão, cada um volta para a ponta da linha (5,0 → 5,5)
    const volta = pulos(t, 5.0, 1, 0, 1, 0.08, 0.5);
    const xA = mix(andaA.pos - afasta, xA0, volta.pos), xB = mix(andaB.pos + afasta, xB0, volta.pos);
    const sqA = amasso(t, 3.0) + amasso(t, tEnc, 0.1), sqB = amasso(t, 3.5) + amasso(t, tEnc, 0.1);
    // se olham (A no "dois", B no "olham"); voltam de frente no "sabe" e dão de ombros
    const olhaA = sp((t - tt.doisF8) / 0.35) * (1 - sp((t - tt.sabe) / 0.35));
    const olhaB = sp((t - tt.olham + 0.05) / 0.35) * (1 - sp((t - tt.sabe) / 0.35));
    const ombro = hop(P(t, tt.sabe, 0.55)) * 0.16;
    const sumir = ei(P(t, 38.5, 0.4));
    if (mostrar(CAD.peaoA, qA.visto && sumir < 1 && t < 39)) {
      porPeao(CAD.peaoA, xA, Y_PAG + Math.max(0, qA.y) + andaA.y + volta.y - 0.5 * sumir, Z9, olhaA * Math.PI / 2, sqA, ombro);
    }
    // B: depois do "vai", vira de costas e vai embora em pulinhos para o norte, cai da página na mesa e some no escuro
    const vira = sp((t - tt.vai + 0.1) / 0.4);
    const t0 = tt.vai + 0.35;
    const ida = pulos(t, t0, 9, Z9, Z9 - 9 * 0.27, 0.07, 0.5);
    const foraPag = ida.pos < -1.4;
    const yB = Y_PAG + Math.max(0, qB.y) + andaB.y + volta.y + ida.y - (foraPag ? Y_PAG * ei(cl((-1.4 - ida.pos) / 0.1)) : 0);
    if (mostrar(CAD.peaoB, qB.visto && t < 36.5)) {
      porPeao(CAD.peaoB, xB, yB, ida.pos, -olhaB * Math.PI / 2 + vira * Math.PI, sqB, -ombro);
    }
  }

  // ---- os nomes escritos na linha das 9h
  {
    const x0 = CAD.xTinta0;
    const ver = t > 15 && t < 21.2;
    const escreve = (m, a, b, xi, xf) => { if (!mostrar(m, ver && t > a)) return; m.userData.plano.constant = mix(xi, xf, ss(P(t, a, b - a))); };
    escreve(CAD.tPaulo, tt.nomes - 0.1, tt.nomes + 0.75, x0 - 0.02, x0 + 0.62);
    escreve(CAD.tDiego, tt.escrito - 0.12, tt.cima + 0.25, x0 + 0.02, x0 + 0.7);
    escreve(CAD.tRabisco, tt.cima + 0.2, tt.outro + 0.1, x0 - 0.02, x0 + 0.42);
    // em "outro" a tinta vira volume: as duas palavras crescem para fora do papel, levantam e o Diego sobe em cima do Paulo
    const ex = sp((t - (tt.outro + 0.04)) / 0.4);
    const fade = cl(ex * 3);
    for (const m of [CAD.tPaulo, CAD.tDiego, CAD.tRabisco]) m.material.opacity = 1 - fade;
    const levanta = sp((t - (tt.outro + 0.45)) / 0.45);
    const empilha = sp((t - 21.5) / 0.4);
    const somem = ei(P(t, 31.4, 0.45));
    const xp = x0 + 40 / PX, zBase = pz(872);
    if (mostrar(CAD.paulo, ex > 0.001 && somem < 1)) {
      CAD.paulo.position.set(xp, Y_PAG - 0.12 * somem, zBase);
      CAD.paulo.rotation.set(-Math.PI / 2 * (1 - levanta), 0, 0);
      CAD.paulo.userData.m.scale.z = Math.max(0.03, ex);
    }
    // Diego: cai da pilha no "deles" e fica deitado; some junto com o Paulo
    const cai = sp((t - tt.deles) / 0.45);
    if (mostrar(CAD.diego, ex > 0.001 && somem < 1)) {
      const deitadoX = xp + 78 / PX, deitadoZ = zBase + 36 / PX;
      const topoX = xp + 0.03, topoY = Y_PAG + 0.09;
      const px = mix(mix(deitadoX, topoX, empilha), xp + 0.42, cai), py = mix(mix(Y_PAG, topoY, empilha), Y_PAG, cai) + hop(empilha) * 0.12 + hop(cai) * 0.1;
      CAD.diego.position.set(px, py - 0.12 * somem, mix(deitadoZ, zBase - 0.005, empilha));
      CAD.diego.rotation.set(-Math.PI / 2 * (1 - levanta) * (1 - empilha) - Math.PI / 2 * cai, 0, mix(0.1, -0.07, empilha) * (1 - cai) + 0.25 * cai);
      CAD.diego.userData.m.scale.z = Math.max(0.03, ex);
      // balança um pouco quando os dois se olham e no "sem graça"
      CAD.diego.rotation.z += Math.sin((t - 21.9) * 5.5) * 0.05 * hop(P(t, 21.9, 1.6)) * (1 - cai);
    }
  }

  // ---- QUEM / MARCOU / PRIMEIRO? sobem do papel, uma palavra por vez, e afundam no "Ninguém"
  {
    const afunda = ei(P(t, tt.ninguem - 0.05, 0.4));
    const linhas = [[tt.quem, 0.76], [tt.marcou, 0.55], [tt.primeiro, 0.34]];
    CAD.perg.forEach((m, i) => {
      const u = sp((t - linhas[i][0] + 0.03) / 0.32) * (1 - afunda);
      subir(m, u, -0.15 - m.userData.w / 2 * Math.cos(0.2), Y_PAG + linhas[i][1], -0.95 + m.userData.w / 2 * Math.sin(0.2), 1.0);
      m.rotation.y = -0.2;
    });
  }
  // ---- −1 CORTE: cai do alto e bate na batida de 32,5; afunda antes de o caderno fechar
  {
    const tB = 32.5, sz = CAD.menos.userData.w, wc = CAD.corte.userData.w, esp = 0.05;
    const total = sz + esp + wc, x0 = 0.16 - total / 2;
    const u = ei(P(t, tB - 0.4, 0.4)), afunda = ei(P(t, 35.8, 0.4));
    if (mostrar(CAD.menos, t > tB - 0.4 && afunda < 1)) {
      const sq = amasso(t, tB, 0.22);
      CAD.menos.position.set(x0, Y_PAG + (1 - u) * 1.4 - 0.45 * afunda, Z9 - 0.04);
      CAD.menos.scale.set(1 + sq * 0.4, 1 - sq, 1);
    }
    subir(CAD.corte, sp((t - (tB - 0.3)) / 0.3) * (1 - afunda), x0 + sz + esp, Y_PAG, Z9 - 0.04, 0.2);
  }

  // ---- as duas cadeiras na capa aberta: sobem no "cadeiras"; a da direita vira de costas no "talvez" e afunda
  //      no "menos um cliente"; a outra afunda antes de o caderno fechar
  {
    const uA = sp((t - (tt.cadeiras - 0.2)) / 0.45), uB = sp((t - (tt.cadeiras + 0.25)) / 0.45);
    const fim = ei(P(t, 38.4, 0.45));
    if (mostrar(CAD.cadA, uA > 0.002 && fim < 1)) { CAD.cadA.position.set(-2.42, 0.022 - 0.62 * (1 - uA) - 0.62 * fim, -0.42); CAD.cadA.rotation.y = 0.18; }
    const vira = sp((t - tt.talvez) / 0.6), afunda = ei(P(t, tt.menos2 + 0.05, 0.55));
    if (mostrar(CAD.cadB, uB > 0.002 && afunda < 1)) { CAD.cadB.position.set(-1.62, 0.022 - 0.62 * (1 - uB) - 0.62 * afunda, -0.42); CAD.cadB.rotation.y = -0.18 + Math.PI * vira; }
  }
}

export function seek(t) {
  t = ((t % DUR) + DUR) % DUR;
  desenhar(t, aplicar, window.AMOSTRAS || 1);
  const logo = document.getElementById('logo');
  if (logo) logo.style.opacity = String(Math.max(1 - ss(P(t, 0.1, 0.4)), ss(P(t, 49.0, 0.5))));
}

// ======================================================================== som: os momentos que a trilha marca
function eventosDoSom(tt) {
  return {
    dur: DUR,
    folha: [tt.sabado + 0.2, tt.caderno + 0.05],                 // capa abrindo e fechando (papelão)
    toque: [3.0, 3.5, 4.5, 5.5, 22.0],                           // peças tocando o papel
    pulos: [3.8, 4.25, 5.25, 30.75, 31.25, 31.75, 32.25, 32.75],
    caneta: [[tt.nomes - 0.1, tt.nomes + 0.75], [tt.escrito - 0.12, tt.cima + 0.25], [tt.cima + 0.2, tt.outro + 0.1]],
    sobe: [tt.tonho, tt.quinze, tt.cadeiras - 0.2, tt.cadeiras + 0.25, tt.outro + 0.45, tt.quem, tt.marcou, tt.primeiro, tt.problema, tt.ja1, tt.com, tt.comenta, tt.na, tt.do, tt.cadeira],
    whoosh: [[9.0, 11.1], [11.4, 12.25]],                         // a grua sobe até o mapa e mergulha de volta
    impactos: [4.5, 9.6, 10.6, 12.0, 15.0, 21.5, 26.0, 28.5, 36.0, 41.0, 45.0],
    fortes: [32.5, 39.5, 48.5],
    riser: [46.5, 48.5],
  };
}
