// "Na cadeira do Tonho" · Ep. 03 · O cliente que furou.
// Conceito: o tempo perdido vira coisa na mesa. Um relógio grande deitado no balcão, com a cadeira vazia no centro,
// pinta de âmbar os minutos sem cliente; esse pedaço de 40 minutos levanta e vira o mês.
// Câmera: a grua do Ep. 01. Plongée sobre o balcão, sobe para dar contexto e desce para o detalhe, foco raso.
// Mesa (norte = −z = para cima na tela): caderno no centro (abre na página de TERÇA e fecha no fim) · salão a leste
// (relógio, cadeira com a plaquinha "16h · Damião", a porta ao norte) · o mês ao sul do salão (26 furos de 40 min).
import {
  THREE, COR, cl, mix, P, eo, ei, eio, ss, sp, hop, rad, T, S, RIG, reg, esconderTudo, sombra, mat,
  palavra, palavraDeitada, largura, geoTexto, geoLaje, lajeDeitada, canvasTex, textoC, larguraC, rgba, maoC,
  curva, desenhar, F8, F6,
} from './nucleo.js';

export const DUR = 47.0;
const Y_PAG = 0.12, Y_CAPA = 0.142;
const PX = 700;                                 // pixels da textura da página por unidade
const pz = py => py / PX - 1.4, pxw = px => px / PX - 1.0;
const mostrar = (o, sim = true) => { o.visible = !!sim; return !!sim; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ======================================================================== chão (o balcão)
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
  diffuseColor.rgb = mix(diffuseColor.rgb, uLinha, L * uForca); }`);
  };
  return m;
}
let CHAO;
function criarChao() {
  CHAO = reg(new THREE.Mesh(new THREE.PlaneGeometry(600, 600), matChao(COR.g900, COR.g700, 0.5)));
  CHAO.rotation.x = -Math.PI / 2; CHAO.receiveShadow = true;
}

// ======================================================================== peças da série: peão e cadeira
function criarPeao(cor, corOlho = COR.g50) {
  const pts = [[0, 0], [0.13, 0], [0.132, 0.012], [0.128, 0.03], [0.105, 0.048], [0.082, 0.07], [0.07, 0.12], [0.06, 0.2],
    [0.056, 0.258], [0.074, 0.27], [0.078, 0.286], [0.06, 0.3], [0.035, 0.31], [0, 0.312]].map(([r, y]) => new THREE.Vector2(r, y));
  const m = mat(cor);
  const corpo = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), m);
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.088, 44, 30), m); cabeca.position.y = 0.388;
  const mo = mat(corOlho);
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

// ======================================================================== o caderno de capa azul (abre e fecha)
function texCapa() {
  const { g, tex } = canvasTex(512, 712);
  g.fillStyle = COR.azul; g.fillRect(0, 0, 512, 712);
  g.fillStyle = rgba(COR.g900, 0.22); g.fillRect(0, 0, 512, 712);
  let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = rnd() < 0.5 ? rgba(COR.g900, 0.05) : rgba(COR.branco, 0.035);
    g.fillRect(rnd() * 512, rnd() * 712, 1 + rnd() * 3, 1);
  }
  g.strokeStyle = rgba(COR.branco, 0.14); g.lineWidth = 2;
  g.beginPath(); g.roundRect(26, 26, 460, 660, 14); g.stroke();
  return tex;
}
const L16 = 930;                                 // topo da linha das 16h na textura (px)
function desenharPagina() {
  const { g, tex } = canvasTex(1400, 1960);
  g.fillStyle = COR.branco; g.fillRect(0, 0, 1400, 1960);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 12000; i++) { g.fillStyle = rgba(COR.g300, 0.05 + rnd() * 0.06); g.fillRect(rnd() * 1400, rnd() * 1960, 1.5, 1.5); }
  textoC(g, 'BARBEARIA DO TONHO', 110, 150, 44, 700, COR.g500, 'left', 6);
  textoC(g, 'TERÇA', 104, 300, 132, 800, COR.g900, 'left', -2);
  g.fillStyle = COR.g900; g.fillRect(110, 345, 1180, 4);
  g.fillStyle = COR.g200; g.fillRect(250, 380, 2, 1480);
  const HORAS = ['13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h'];
  const NOMES = { 0: 'Ítalo', 1: 'Zé Carlos', 2: 'Marcelo', 4: 'Fábio', 5: 'Rafael e filho', 6: 'Bruno' };
  HORAS.forEach((h, i) => {
    const y0 = 420 + i * 170;
    g.fillStyle = COR.g200; g.fillRect(110, y0 + 170, 1180, 2);
    if (i !== 3) textoC(g, h, 140, y0 + 114, 60, 700, COR.g500);
    if (NOMES[i]) maoC(g, NOMES[i], 300, y0 + 112, 76, COR.azul, i + 3);
  });
  return tex;
}
function tinta(desenho, w = 800, h = 200) {
  const { g, tex } = canvasTex(w, h);
  desenho(g);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w / PX, h / PX).rotateX(-Math.PI / 2),
    mat('#ffffff', { map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true; m.renderOrder = 2;
  return m;
}
function criarBolhaCTA() {
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
  // os três pontinhos de "digitando"
  const pontos = [-1, 0, 1].map(i => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), mat(COR.g900)); p.position.set(i * 0.17, 0.09, -0.01); p.castShadow = true; g.add(p); return p; });
  g.add(corpo); g.userData = { corpo, pontos };
  return g;
}
const CAD = {};
function criarCaderno() {
  const grupo = CAD.grupo = reg(new THREE.Group());
  const mCapa = mat('#ffffff', { map: texCapa() }), mLado = mat(new THREE.Color(COR.azul).lerp(new THREE.Color(COR.g900), 0.22));
  grupo.add(lajeDeitada(2.06, 2.86, 0.035, 0.02, mCapa, mLado));
  const mPag = mat('#ffffff', { map: desenharPagina() }), mBorda = mat(COR.g100);
  const miolo = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.10, 2.78), [mBorda, mBorda, mPag, mBorda, mBorda, mBorda]);
  miolo.position.y = 0.07; sombra(miolo); grupo.add(miolo);
  const lombada = new THREE.Mesh(new THREE.BoxGeometry(0.014, Y_CAPA, 2.86), mLado);
  lombada.position.set(-1.012, Y_CAPA / 2, 0); sombra(lombada); grupo.add(lombada);
  CAD.pivo = new THREE.Group(); CAD.pivo.position.set(-1.012, Y_CAPA, 0); grupo.add(CAD.pivo);
  const capa = lajeDeitada(2.06, 2.86, 0.035, 0.022, mCapa, mLado); capa.position.set(1.03, -0.022, 0); CAD.pivo.add(capa);

  // rótulo da série, na capa (gira com ela). y = 0 é a face de cima da capa fechada
  const rot = CAD.rot = new THREE.Group(); rot.position.set(1.03, 0, 0); CAD.pivo.add(rot);
  const sT = Math.min(0.27, 1.62 / largura('NA CADEIRA', 1));
  CAD.tit1 = palavraDeitada('NA CADEIRA', sT, 0.04, COR.branco); CAD.tit1.position.z = -0.14;
  CAD.tit2 = palavraDeitada('DO TONHO', sT, 0.04, COR.branco); CAD.tit2.position.z = 0.2;
  CAD.pilula = new THREE.Group();
  CAD.pilula.add(lajeDeitada(0.5, 0.18, 0.09, 0.03, mat(COR.ambar)));
  const ep = palavraDeitada('EP. 03', 0.095, 0.012, COR.g900); ep.rotation.x = -Math.PI / 2; ep.position.set(0, 0.03, 0.035); CAD.pilula.add(ep);
  CAD.pilula.position.z = -0.86;
  CAD.sub = palavraDeitada('TODA SEMANA TEM EPISÓDIO', 0.068, 0.008, COR.branco, F6); CAD.sub.position.z = 0.48;
  CAD.cadTit = criarCadeira(); CAD.cadTit.position.set(0, 0, 0.92);
  for (const o of [CAD.tit1, CAD.tit2, CAD.sub]) o.rotation.x = -Math.PI / 2;
  rot.add(CAD.tit1, CAD.tit2, CAD.pilula, CAD.sub, CAD.cadTit);
  // chamada: COMO VOCÊ LIDA / COM QUEM FURA? em relevo, e o balão "digitando"
  CAD.cta = ['COMO VOCÊ LIDA', 'COM QUEM FURA?'].map((s, i) => {
    const o = palavraDeitada(s, 0.155, 0.04, COR.branco); o.rotation.x = -Math.PI / 2; o.position.z = [-0.42, -0.16][i]; rot.add(o); return o;
  });
  CAD.bolha = criarBolhaCTA(); CAD.bolha.position.set(0, 0, 0.58); rot.add(CAD.bolha);

  // ---- na página: o 16h impresso (palavra 3D deitada, levanta no "quatro") e o marca-texto da linha
  const zBase16 = pz(L16 + 114);
  CAD.h16 = palavraDeitada('16h', 60 / PX, 0.02, COR.g500, F8, 'left'); CAD.h16.position.set(pxw(140), Y_PAG, zBase16); grupo.add(CAD.h16);
  const mDest = mat(COR.ambar, { transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  CAD.destaque = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.158).translate(0.5, 0, 0).rotateX(-Math.PI / 2), mDest);
  CAD.destaque.position.set(pxw(96), Y_PAG + 0.0006, pz(L16 + 85)); CAD.destaque.receiveShadow = true; CAD.destaque.renderOrder = 1; grupo.add(CAD.destaque);
  // Damião: a tinta, e a mesma palavra em 3D (itálico como a letra de mão)
  const zTxt = pz(L16 + 112);
  CAD.tDamiao = tinta(g => maoC(g, 'Damião', 40, 140, 84, COR.azul, 21));
  CAD.tDamiao.position.set(pxw(300) - 40 / PX + 400 / PX, Y_PAG + 0.0009, zTxt - 40 / PX); grupo.add(CAD.tDamiao);
  const gD = new THREE.Group(), mD = new THREE.Mesh(geoTexto('Damião', 0.118, 0.032, F8, 0.22), mat(COR.azul)); mD.castShadow = mD.receiveShadow = true;
  gD.add(mD); gD.userData = { m: mD, w: largura('Damião', 0.118) }; gD.position.set(pxw(300) + 0.01, Y_PAG, zTxt); CAD.damiao = gD; grupo.add(gD);
  // onde deveria estar o telefone: um quadrado tracejado com "?"
  CAD.tTel = tinta(g => {
    g.strokeStyle = COR.ambar800; g.lineWidth = 6; g.setLineDash([22, 14]);
    g.beginPath(); g.roundRect(12, 34, 416, 124, 26); g.stroke(); g.setLineDash([]);
    textoC(g, 'telefone?', 220, 116, 54, 700, COR.ambar800, 'center');
  }, 440, 200);
  CAD.tTel.position.set(pxw(735) + 220 / PX, Y_PAG + 0.0009, pz(L16 + 85)); grupo.add(CAD.tTel);
  // SEM TELEFONE / SEM AVISO / SEM COMO REMARCAR: de pé nas linhas de baixo
  CAD.sem = ['SEM TELEFONE', 'SEM AVISO', 'SEM COMO REMARCAR'].map((s, i) => {
    const o = palavraDeitada(s, 0.12, 0.04, COR.g900); o.position.set(0.24, Y_PAG, pz(420 + (4 + i * 1.5) * 170 + 120)); grupo.add(o); return o;
  });
  // o cartão da agenda boa: nome e telefone (duas texturas: antes e depois do número aparecer)
  const texCartao = (comNumero) => {
    const { g, tex } = canvasTex(1100, 240);
    textoC(g, '16:00', 46, 140, 56, 700, COR.g500);
    textoC(g, 'Damião', 236, 140, 64, 800, COR.g900);
    if (comNumero) textoC(g, '(84) 9 ••••-••••', 236, 200, 40, 600, COR.g500);
    else { g.fillStyle = COR.g200; g.fillRect(236, 178, 330, 22); }
    g.fillStyle = COR.ambar; g.beginPath(); g.arc(990, 120, 72, 0, Math.PI * 2); g.fill();
    // ícone de telefone (celular): contorno arredondado com o alto-falante
    g.strokeStyle = COR.g900; g.lineWidth = 9; g.beginPath(); g.roundRect(964, 70, 52, 100, 12); g.stroke();
    g.fillStyle = COR.g900; g.fillRect(982, 150, 16, 7);
    return tex;
  };
  CAD.cartao = new THREE.Group();
  CAD.cartao.add(lajeDeitada(1.28, 0.32, 0.05, 0.035, mat(COR.branco), mat(COR.g100)));
  CAD.texC0 = texCartao(false); CAD.texC1 = texCartao(true);
  CAD.matC = mat('#ffffff', { map: CAD.texC0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const pc = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.32).rotateX(-Math.PI / 2), CAD.matC); pc.position.y = 0.0355; pc.renderOrder = 2; pc.receiveShadow = true;
  CAD.cartao.add(pc); CAD.cartao.position.set(0.0, Y_PAG, pz(L16 + 85)); grupo.add(CAD.cartao);
}

// ======================================================================== o salão: o relógio deitado, a cadeira, a porta
const SAL = {};
const DIAL = V(2.75, 0, -0.3), R_DIAL = 1.1, Y_DIAL = 0.04;
const cacheSetor = new Map();
function geoSetor(a) {   // setor do relógio: do 12 até o ângulo a (horário), deitado
  const k = Math.round(a * 180 / Math.PI * 2) / 2;
  if (cacheSetor.has(k)) return cacheSetor.get(k);
  const ar = k * Math.PI / 180;
  const g = new THREE.RingGeometry(0.27, 0.93, 96, 1, Math.PI / 2 - ar, Math.max(0.0001, ar)).rotateX(-Math.PI / 2);
  cacheSetor.set(k, g);
  return g;
}
function formaSetor(a, R, r) {
  const s = new THREE.Shape(), t0 = Math.PI / 2, t1 = Math.PI / 2 - a;
  s.moveTo(R * Math.cos(t0), R * Math.sin(t0)); s.absarc(0, 0, R, t0, t1, true);
  s.lineTo(r * Math.cos(t1), r * Math.sin(t1)); s.absarc(0, 0, r, t1, t0, false);
  return s;
}
function criarSalao() {
  const g = SAL.grupo = reg(new THREE.Group()); g.position.copy(DIAL);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(R_DIAL, R_DIAL, Y_DIAL, 128), [mat(COR.g700), mat(COR.g800), mat(COR.g800)]);
  disco.position.y = Y_DIAL / 2; disco.receiveShadow = true; disco.castShadow = true; g.add(disco);
  for (let i = 0; i < 12; i++) {   // marcas das horas
    const grande = i % 3 === 0, a = i * Math.PI / 6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(grande ? 0.04 : 0.026, 0.012, grande ? 0.16 : 0.1), mat(grande ? COR.g200 : COR.g400));
    const r = 1.0 - (grande ? 0.08 : 0.05);
    m.position.set(Math.sin(a) * r, Y_DIAL + 0.006, -Math.cos(a) * r); m.rotation.y = -a; m.receiveShadow = true; g.add(m);
  }
  SAL.setor = new THREE.Mesh(geoSetor(0.001), mat(COR.ambar, { polygonOffset: true, polygonOffsetFactor: -1 }));
  SAL.setor.position.y = Y_DIAL + 0.0012; SAL.setor.receiveShadow = true; g.add(SAL.setor);
  SAL.ponteiro = new THREE.Group(); SAL.ponteiro.position.y = Y_DIAL;
  const ph = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.7), mat(COR.branco)); ph.position.set(0, 0.011, -0.6); sombra(ph);
  SAL.ponteiro.add(ph); g.add(SAL.ponteiro);
  SAL.cad = criarCadeira(); SAL.cad.scale.setScalar(1.5); SAL.cad.position.y = Y_DIAL; g.add(SAL.cad);
  // a plaquinha no assento
  const { g: c, tex } = canvasTex(440, 300);
  c.fillStyle = COR.branco; c.fillRect(0, 0, 440, 300);
  textoC(c, '16h', 220, 140, 120, 800, COR.g900, 'center');
  textoC(c, 'DAMIÃO', 220, 240, 58, 800, COR.g500, 'center', 6);
  SAL.placa = new THREE.Group();
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.165, 0.012), [mat(COR.g100), mat(COR.g100), mat(COR.g100), mat(COR.g100), mat('#ffffff', { map: tex }), mat(COR.g100)]);
  placa.position.y = 0.0825; sombra(placa); SAL.placa.add(placa);
  g.add(SAL.placa);
  // a porta, ao norte
  SAL.porta = new THREE.Group(); SAL.porta.position.set(0, 0, -1.3);
  const mp = mat(COR.g300);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.07), mp); p.position.set(s * 0.38, 0.475, 0); sombra(p); SAL.porta.add(p); }
  const verga = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.07, 0.07), mp); verga.position.y = 0.95; sombra(verga); SAL.porta.add(verga);
  g.add(SAL.porta);
  SAL.tonho = palavraDeitada('TONHO', 0.22, 0.065, COR.branco); SAL.tonho.position.set(-0.62, Y_DIAL, 0.72); g.add(SAL.tonho);
  SAL.cliente = reg(criarPeao(COR.g200, COR.g900));
  // o pedaço de 40 minutos com volume (levanta do relógio no "quarenta")
  const ga = new THREE.ExtrudeGeometry(formaSetor(Math.PI * 4 / 3, 0.93, 0.27), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 48 });
  ga.rotateX(-Math.PI / 2);
  SAL.pedaco = reg(new THREE.Group());
  const corpo = new THREE.Mesh(ga, mat(COR.ambar)); corpo.castShadow = corpo.receiveShadow = true; SAL.pedaco.add(corpo);
  const rot40 = palavraDeitada('40 MIN', 0.16, 0.014, COR.g900); rot40.rotation.x = -Math.PI / 2; rot40.position.set(0.5, 0.083, 0.36); SAL.pedaco.add(rot40);
}

// ======================================================================== relógio digital (16:00 → 16:40)
const REL = {};
function criarRelogio() {
  const g = REL.grupo = reg(new THREE.Group()); g.position.set(3.05, 0, 1.0); g.rotation.y = -0.1;
  const sz = REL.sz = 0.2, dp = REL.dp = 0.055;
  REL.slot = Math.max(...'0123456789'.split('').map(d => largura(d, sz)));
  REL.wc = largura(':', sz) + 0.03;
  REL.dig = [0, 1, 2, 3].map(() => { const m = palavra('0', sz, dp, COR.branco); g.add(m); return m; });
  REL.colon = palavra(':', sz, dp, COR.branco); g.add(REL.colon);
  const total = 4 * REL.slot + REL.wc;
  REL.x0 = [-total / 2, -total / 2 + REL.slot, -total / 2 + 2 * REL.slot + REL.wc, -total / 2 + 3 * REL.slot + REL.wc];
  REL.colon.position.x = -total / 2 + 2 * REL.slot + 0.015;
}
function porHora(min, cor) {
  const s = String(Math.floor(min / 60)).padStart(2, '0') + String(min % 60).padStart(2, '0');
  REL.dig.forEach((m, i) => {
    m.geometry = geoTexto(s[i], REL.sz, REL.dp);
    m.position.x = REL.x0[i] + (REL.slot - largura(s[i], REL.sz)) / 2;
    m.material.color.set(cor);
  });
  REL.colon.material.color.set(cor);
}

// ======================================================================== o mês: 26 furos de 40 minutos
const MES = {};
const MES_C = V(2.75, 0, 2.0), CEL = 0.36;
function criarMes() {
  MES.grupo = reg(new THREE.Group()); MES.grupo.position.copy(MES_C);
  const geoBase = new THREE.CylinderGeometry(0.14, 0.14, 0.018, 48);
  const geoMini = new THREE.ExtrudeGeometry(formaSetor(Math.PI * 4 / 3, 0.118, 0.035), { depth: 0.02, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2);
  const mb = mat(COR.g700), mm = mat(COR.ambar);
  MES.cel = [];
  for (let k = 0; k < 26; k++) {
    const c = new THREE.Group();
    const b = new THREE.Mesh(geoBase, mb); b.position.y = 0.009; b.receiveShadow = true; b.castShadow = true;
    const s = new THREE.Mesh(geoMini, mm); s.position.y = 0.018; s.castShadow = s.receiveShadow = true;
    c.add(b, s); c.userData = { base: b, setor: s };
    const col = k % 6, lin = Math.floor(k / 6);
    c.userData.x = (col - 2.5) * CEL; c.userData.z = (lin - 2) * CEL - 0.1;
    MES.grupo.add(c); MES.cel.push(c);
  }
  MES.dias = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((s, i) => {
    const o = palavraDeitada(s, 0.065, 0.006, COR.g300, F6); o.rotation.x = -Math.PI / 2; o.position.set((i - 2.5) * CEL, 0, -2 * CEL - 0.35); MES.grupo.add(o); return o;
  });
  MES.rotulo = palavraDeitada('EXEMPLO: 40 MIN POR DIA, 26 DIAS', 0.07, 0.007, COR.ambar, F6);
  MES.rotulo.rotation.x = -Math.PI / 2; MES.rotulo.position.set(0, 0, 2 * CEL + 0.24); MES.grupo.add(MES.rotulo);
  MES.total = palavraDeitada('17h20', 0.44, 0.11, COR.ambar); MES.total.position.set(0, 0, 0.05); MES.grupo.add(MES.total);
  MES.parada = palavraDeitada('DE CADEIRA PARADA', 0.11, 0.012, COR.branco); MES.parada.rotation.x = -Math.PI / 2; MES.parada.position.set(0, 0, 0.42); MES.grupo.add(MES.parada);
}

// ======================================================================== câmera (chaves da grua)
// [t, alvo x, y, z, distância, elevação°, azimute°, abertura, foco relativo]
const CHAVES = [
  [0.00, 0, 0.14, 0.75, 9.0, 72, 0, 0.004, 1],
  [0.40, 0, 0.14, 0.70, 8.7, 72.5, 1.25, 0.004, 1],
  [1.25, -0.2, 0.12, -0.05, 4.4, 66, 2, 0.008, 1],
  [2.15, -0.15, 0.13, 0.05, 3.5, 58, 0, 0.011, 1],
  [3.15, 2.75, 0.32, -0.3, 4.6, 36, 8, 0.012, 1],
  [4.40, 2.75, 0.36, -0.65, 4.0, 28, 4, 0.013, 1],
  [5.60, 2.75, 0.34, -0.95, 3.5, 24, 0, 0.014, 1],
  [6.40, 2.85, 0.12, -0.15, 5.0, 64, 6, 0.010, 1],
  [8.20, 2.8, 0.12, -0.15, 4.8, 66, 2, 0.010, 1],
  [9.10, 2.2, 0.3, 0.35, 3.9, 22, 8, 0.012, 1],
  [10.20, 2.45, 0.34, -0.45, 4.6, 26, -12, 0.010, 1],
  [11.90, -0.12, 0.12, 0.1, 3.5, 58, 0, 0.011, 1],
  [13.40, -0.2, 0.12, 0.08, 2.9, 56, 0, 0.012, 1],
  [15.00, 0.05, 0.16, 0.08, 4.2, 44, 0, 0.012, 1],
  [16.30, 0.14, 0.18, 0.45, 4.6, 48, 0, 0.011, 1],
  [18.90, 0.16, 0.2, 0.62, 5.1, 46, 0, 0.011, 1],
  [20.30, 0.16, 0.2, 0.62, 5.3, 48, 0, 0.011, 1],
  [21.30, 2.85, 0.12, -0.15, 5.0, 64, 4, 0.010, 1],
  [22.50, 2.9, 0.3, -0.6, 4.7, 40, 10, 0.012, 1],
  [24.00, 2.95, 0.3, -0.4, 4.3, 34, 12, 0.013, 1],
  [25.30, 2.95, 0.36, 0.15, 4.3, 30, 8, 0.013, 1],
  [26.50, 2.95, 0.4, 0.35, 4.1, 26, 4, 0.013, 1],
  [27.90, 2.75, 0.2, 1.55, 6.0, 58, 0, 0.010, 1],
  [29.70, 2.75, 0.1, 1.85, 6.5, 64, 0, 0.009, 1],
  [30.95, 2.75, 0.32, 2.05, 5.2, 24, 0, 0.012, 1],
  [32.70, 2.75, 0.32, 2.05, 4.9, 22, -4, 0.012, 1],
  [33.90, 0.0, 0.12, 0.1, 4.4, 56, 0, 0.011, 1],
  [35.50, 0.0, 0.12, 0.08, 4.2, 54, 0, 0.011, 1],
  [36.60, 0.0, 0.14, 0.2, 6.0, 70, 0, 0.007, 1],
  [37.30, 0.0, 0.14, 0.15, 5.6, 80, 0, 0.006, 1],
  [38.40, 0.0, 0.25, 0.0, 5.2, 62, 0, 0.010, 1],
  [40.70, 0.0, 0.28, 0.2, 5.2, 62, 0, 0.010, 1],
  [41.70, 0.0, 0.25, 0.15, 5.6, 66, 0, 0.008, 1],
  [43.30, 0.0, 0.25, 0.25, 5.6, 67, 0, 0.008, 1],
  [44.90, 0.0, 0.25, 0.3, 5.4, 67, 0, 0.008, 1],
  [45.90, 0, 0.15, 0.68, 8.6, 71.5, -5, 0.005, 1],
  [46.45, 0, 0.14, 0.74, 8.9, 72, -2.2, 0.004, 1],
  [47.00, 0, 0.14, 0.75, 9.0, 72, 0, 0.004, 1],
];
const ts = CHAVES.map(k => k[0]);
const CAM = {
  x: curva(ts, CHAVES.map(k => k[1])), y: curva(ts, CHAVES.map(k => k[2])), z: curva(ts, CHAVES.map(k => k[3])),
  d: curva(ts, CHAVES.map(k => Math.log(k[4]))), el: curva(ts, CHAVES.map(k => k[5])), az: curva(ts, CHAVES.map(k => k[6])),
  ap: curva(ts, CHAVES.map(k => k[7])), fr: curva(ts, CHAVES.map(k => k[8])),
};
let IMPACTOS_CAM = [];
function camera(t) {
  RIG.alvo.set(CAM.x(t), CAM.y(t), CAM.z(t));
  RIG.d = Math.exp(CAM.d(t)); RIG.el = rad(CAM.el(t)); RIG.az = rad(CAM.az(t)); RIG.ap = CAM.ap(t); RIG.fr = CAM.fr(t);
  for (const [ti, k] of IMPACTOS_CAM) { const u = (t - ti) / 0.5; if (u > 0 && u < 1) RIG.d *= 1 - k * Math.exp(-6 * u) * ss(u * 8); }
  uDist.value = RIG.d;
}

// ======================================================================== utilidades de movimento
function amasso(t, t0, forca = 0.18) { const u = (t - t0) / 0.35; return u > 0 && u < 1 ? forca * Math.sin(Math.PI * u) * Math.exp(-3 * u) * 1.6 : 0; }
function porPeao(p, x, y, z, giro, sq = 0, inclina = 0) {
  p.position.set(x, y, z); p.rotation.set(0, giro, 0);
  const c = p.userData.corpo; c.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5); c.rotation.z = inclina;
}
// caminho em pulinhos por uma lista de pontos [x, y, z]: um pulo por trecho, de t0 até t1
function caminho(t, t0, t1, pts, alts) {
  const n = pts.length - 1, u = cl((t - t0) / (t1 - t0)), k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k;
  const a = pts[k], b = pts[k + 1], e = ss(f);
  return { x: mix(a[0], b[0], e), y: mix(a[1], b[1], e) + (u > 0 && u < 1 ? hop(f) * alts[k] : 0), z: mix(a[2], b[2], e),
    giro: Math.atan2(b[0] - a[0], b[2] - a[2]), u };
}
function emergir(o, u, alt = 0.4) { if (!mostrar(o, u > 0.002)) return false; o.position.y = -alt * (1 - u); return true; }

// ======================================================================== montagem
let TT = null;
const GEST = [];
export async function criarCenas() {
  criarChao(); criarCaderno(); criarSalao(); criarRelogio(); criarMes();
  const tt = {
    terca: T('f01', 'Terça'), quatro: T('f01', 'quatro'), tarde: T('f01', 'tarde'),
    cadeira2: T('f02', 'cadeira'), pronta: T('f02', 'pronta'), cliente3: T('f03', 'cliente'), nao3: T('f03', 'não'), veio: T('f03', 'veio'),
    quatro4: T('f04', 'Quatro'), quinze: T('f04', 'quinze'), quatro5: T('f05', 'Quatro'), meia: T('f05', 'meia'),
    tonho5: T('f05', 'Tonho'), olho: T('f05', 'olho'), porta: T('f05', 'porta'),
    ele: T('f06', 'Ele'), procura: T('f06', 'procura'), telefone6: T('f06', 'telefone'), caderno6: T('f06', 'caderno'),
    escrito: T('f07', 'escrito'), damiao: T('f07', 'Damião'),
    sem1: T('f08', 'Sem'), sem2: T('f09', 'Sem'), sem3: T('f10', 'Sem'), remarcar: T('f10', 'remarcar'),
    quatro11: T('f11', 'Quatro'), quarenta11: T('f11', 'quarenta'), chega: T('f11', 'chega'), cliente11: T('f11', 'cliente'), querendo: T('f11', 'querendo'), encaixe: T('f11', 'encaixe'),
    mas: T('f12', 'Mas'), quarenta12: T('f12', 'quarenta'), ja: T('f12', 'já'), foram: T('f12', 'foram'),
    um: T('f13', 'Um'), dia: T('f13', 'dia'), fim: T('f13', 'fim'), mes: T('f13', 'mês'), vira: T('f13', 'vira'), dezessete: T('f13', 'dezessete'), horas: T('f13', 'horas'), cadeira13: T('f13', 'cadeira'), parada: T('f13', 'parada'),
    agenda: T('f14', 'Agenda'), guarda: T('f14', 'guarda'), telefone14: T('f14', 'telefone'), marcou: T('f14', 'marcou'),
    e15: T('f15', 'E'), voce: T('f15', 'você'), como: T('f15', 'como'), quem: T('f15', 'quem'), fura: T('f15', 'fura'),
    conta: T('f16', 'Conta'), aqui: T('f16', 'aqui'),
    na: T('f17', 'Na'), cadeira17: T('f17', 'cadeira'), do: T('f17', 'do'), toda: T('f18', 'Toda'), episodio: T('f18', 'episódio'),
  };
  TT = tt;
  IMPACTOS_CAM = [[tt.quinze + 0.15, 0.015], [31.0, 0.05], [37.0, 0.05], [45.0, 0.035]];
  GEST.push(CAD.tit1, CAD.tit2, CAD.pilula, CAD.sub, CAD.cadTit, ...CAD.cta, CAD.bolha, CAD.h16, CAD.destaque, CAD.tDamiao, CAD.damiao, CAD.tTel,
    ...CAD.sem, CAD.cartao, SAL.setor, SAL.ponteiro, SAL.cad, SAL.placa, SAL.porta, SAL.tonho, ...MES.cel, ...MES.dias, MES.rotulo, MES.total, MES.parada);
  window.EVENTOS = eventosDoSom(tt);
}

// minutos passados desde as 16h no relógio do salão (os saltos caem nas palavras)
function minutos(t) {
  const tt = TT;
  return 15 * eio(P(t, tt.quatro4, tt.quinze - tt.quatro4 + 0.12)) + 15 * eio(P(t, tt.quatro5, tt.meia - tt.quatro5 + 0.12))
    + 10 * eio(P(t, tt.quatro11 + 0.05, tt.quarenta11 - tt.quatro11 + 0.1));
}

function aplicar(t) {
  const tt = TT;
  esconderTudo();
  camera(t);
  for (const o of GEST) o.visible = false;
  mostrar(CHAO);

  // ---------------------------------------------------------------- caderno: abre no "Terça", fecha batendo em 37,0
  const G = CAD.grupo; mostrar(G);
  const abre = eio(P(t, tt.terca - 0.02, 0.72));
  const fecha = ei(P(t, 36.7, 0.3));
  const angulo = t < 20 ? Math.PI * abre : Math.PI * (1 - fecha);
  CAD.pivo.rotation.z = angulo;
  const desce = ss((angulo / Math.PI - 0.5) * 2);
  CAD.pivo.position.y = Y_CAPA * (1 - desce);
  CAD.pivo.position.x = -1.012 - 0.006 * desce;
  const aberto = angulo > 0.02;

  // ---- rótulo da série: está lá no 1º quadro (igual ao último) e nasce de novo no fim
  mostrar(CAD.rot);
  const noInicio = t < 1.3;
  const sobe = (tw, d = 0.42) => sp((t - tw) / d);
  const emergirRot = (o, u, z, alt = 0.06) => { if (!mostrar(o, u > 0.002)) return; o.position.y = -alt * (1 - u); o.position.z = z; };
  emergirRot(CAD.tit1, noInicio ? 1 : sobe(tt.na - 0.08), -0.14);
  emergirRot(CAD.tit2, noInicio ? 1 : sobe(tt.do - 0.05), 0.2);
  emergirRot(CAD.sub, noInicio ? 1 : sobe(tt.toda - 0.05), 0.48, 0.02);
  const tCarimbo = 45.0;
  if (mostrar(CAD.pilula, noInicio || t > tCarimbo - 0.45)) {
    const u = noInicio ? 1 : ei(P(t, tCarimbo - 0.45, 0.45));
    CAD.pilula.position.set(0, (1 - u) * 0.9, -0.86);
    const sq = noInicio ? 0 : amasso(t, tCarimbo, 0.35);
    CAD.pilula.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    CAD.pilula.rotation.y = (1 - u) * 0.5;
  }
  const uCad = noInicio ? 1 : sp((t - tt.cadeira17 + 0.05) / 0.5);
  if (mostrar(CAD.cadTit, uCad > 0.002)) { CAD.cadTit.position.y = -0.62 * (1 - uCad); CAD.cadTit.rotation.y = (1 - uCad) * -1.2; }
  // chamada: COMO VOCÊ LIDA / COM QUEM FURA? em relevo; o balão "digitando" no "Conta"
  {
    const sai = ei(P(t, tt.na - 0.42, 0.28));
    [tt.voce, tt.quem].forEach((tw, i) => {
      const u = sp((t - tw + 0.04) / 0.32) * (1 - sai), o = CAD.cta[i];
      if (!mostrar(o, t > 37 && u > 0.002)) return;
      o.position.y = -0.045 * (1 - u); o.userData.m.scale.z = Math.max(0.05, u);
    });
    const uB = sp((t - tt.conta + 0.05) / 0.45) * (1 - sai);
    if (mostrar(CAD.bolha, t > 37 && uB > 0.002)) {
      CAD.bolha.position.y = -0.12 + 0.13 * uB; CAD.bolha.rotation.y = (1 - uB) * 0.6;
      CAD.bolha.userData.pontos.forEach((p, i) => { p.position.y = 0.09 + 0.07 * hop(((t - tt.conta) * 2.4 - i * 0.22 + 10) % 1) * uB; });
    }
  }

  // ---- a página (só enquanto o caderno está aberto)
  if (aberto) {
    // 16h: levanta no "quatro" e deita de novo
    {
      const o = CAD.h16, m = o.userData.m; mostrar(o);
      const lev = sp((t - (tt.quatro - 0.08)) / 0.4) * (1 - ei(P(t, 2.35, 0.4)));
      o.rotation.set(mix(-Math.PI / 2, -0.9, lev), 0, 0);
      o.scale.setScalar(mix(1, 2.2, lev));
      m.scale.z = mix(0.04, 1, lev);
      m.material.color.set(COR.g500).lerp(new THREE.Color(COR.g900), cl(lev * 1.5));
    }
    // marca-texto na linha das 16h: no "quatro", e de novo varrendo a linha no "procura"
    {
      const u1 = eio(P(t, tt.quatro - 0.02, 0.5)), u2 = eio(P(t, tt.procura - 0.05, tt.caderno6 - tt.procura + 0.3));
      const u = t < tt.procura - 0.1 ? u1 : u2;
      if (mostrar(CAD.destaque, u > 0.001 && t < 33.9)) CAD.destaque.scale.x = 1.21 * u;
    }
    // Damião: a tinta está na página desde o começo; no "Damião" a palavra sai do papel e fica de pé
    {
      const ex = sp((t - (tt.damiao - 0.05)) / 0.4), levanta = sp((t - (tt.damiao + 0.25)) / 0.45);
      const volta = ei(P(t, 20.45, 0.35));
      mostrar(CAD.tDamiao); CAD.tDamiao.material.opacity = 1 - cl(ex * 3) * (1 - volta);
      if (mostrar(CAD.damiao, ex > 0.001 && volta < 1)) {
        CAD.damiao.rotation.set(-Math.PI / 2 * (1 - levanta * 0.78), 0, 0);
        CAD.damiao.userData.m.scale.z = Math.max(0.03, ex * (1 - volta));
        CAD.damiao.position.y = Y_PAG - 0.05 * volta;
      }
      // onde deveria estar o telefone
      const uT = sp((t - (tt.damiao + 0.45)) / 0.35) * (1 - ei(P(t, 20.45, 0.3)));
      if (mostrar(CAD.tTel, uT > 0.002)) { CAD.tTel.scale.setScalar(mix(0.6, 1, uT)); CAD.tTel.material.opacity = uT; }
    }
    // SEM TELEFONE / SEM AVISO / SEM COMO REMARCAR: uma linha por frase, de pé; afundam antes do "Quatro e quarenta"
    {
      const afunda = ei(P(t, 20.4, 0.35));
      [tt.sem1, tt.sem2, tt.sem3].forEach((tw, i) => {
        const o = CAD.sem[i], u = sp((t - tw + 0.04) / 0.36) * (1 - afunda);
        if (!mostrar(o, u > 0.002 && t < 21)) return;
        o.position.y = Y_PAG - 0.25 * (1 - u);
        o.rotation.x = -0.3;
        const sq = amasso(t, tw + 0.32, 0.12); o.scale.set(1 + sq * 0.3, 1 - sq, 1);
      });
    }
    // o cartão da agenda boa: sobe no "guarda", o número aparece no "telefone", carimba no "marcou"
    {
      const u = sp((t - (tt.guarda - 0.08)) / 0.4) * (1 - ei(P(t, 36.4, 0.25)));
      if (mostrar(CAD.cartao, t > 33 && u > 0.002)) {
        CAD.cartao.position.y = Y_PAG + 0.35 * (1 - u) * (1 - u);
        CAD.cartao.rotation.set((1 - u) * -0.5, (1 - u) * 0.3, 0);
        CAD.matC.map = t >= tt.telefone14 + 0.1 ? CAD.texC1 : CAD.texC0;
        const sq = amasso(t, tt.guarda + 0.3, 0.15) + amasso(t, tt.marcou + 0.05, 0.12);
        CAD.cartao.scale.set(1 + sq * 0.2, 1 - sq, 1 + sq * 0.2);
      }
    }
  }

  // ---------------------------------------------------------------- o salão
  {
    const S0 = SAL.grupo; mostrar(S0);
    mostrar(SAL.porta);
    // a cadeira sobe no "cadeira" (já está pronta); a plaquinha "16h · Damião" vem junto
    const uC = sp((t - (tt.cadeira2 - 0.12)) / 0.45);
    if (mostrar(SAL.cad, uC > 0.002)) { SAL.cad.position.y = Y_DIAL - 0.9 * (1 - uC); SAL.cad.rotation.y = (1 - uC) * -0.9; }
    // a plaquinha: de pé no assento até o cliente novo chegar; aí tomba e cai no relógio
    {
      const uP = sp((t - (tt.pronta - 0.05)) / 0.35);
      const cai = eio(P(t, tt.querendo - 0.1, 0.5));
      if (mostrar(SAL.placa, uP > 0.002)) {
        const yAss = Y_DIAL + 0.312 * uC;
        SAL.placa.position.set(mix(0, 0.62, cai), mix(yAss, Y_DIAL, cai) + hop(cai) * 0.3 + (1 - uP) * 0.3, mix(-0.04, 0.35, cai));
        SAL.placa.rotation.set(mix(-0.25, -Math.PI / 2, cai), mix(0, 0.8, cai), 0);
        const sq = amasso(t, tt.querendo + 0.4, 0.12); SAL.placa.scale.set(1, 1 - sq, 1);
      }
    }
    // ponteiro e o setor âmbar dos minutos perdidos
    const m = minutos(t), a = m / 60 * 2 * Math.PI;
    mostrar(SAL.ponteiro); SAL.ponteiro.rotation.y = -a;
    const levanta = sp((t - (tt.quarenta12 - 0.05)) / 0.4);
    if (mostrar(SAL.setor, a > 0.004 && levanta < 0.05)) SAL.setor.geometry = geoSetor(a);
    // TONHO sobe no "Tonho", vira para a porta no "olho"; balança devagar (esperando) e sai antes do mês
    {
      const u = sp((t - (tt.tonho5 - 0.08)) / 0.45) * (1 - ei(P(t, 27.0, 0.4)));
      if (mostrar(SAL.tonho, u > 0.002)) {
        SAL.tonho.position.y = Y_DIAL - 0.36 * (1 - u);
        const olha = sp((t - tt.olho) / 0.5);
        SAL.tonho.rotation.set(-0.12, 0.55 * olha * (1 - sp((t - tt.chega) / 0.4)) + 0.04 * Math.sin(2 * Math.PI * t * 0.5), 0);
      }
    }
    // o cliente novo: entra pela porta no "chega" e pula até o assento ("encaixe")
    {
      const pts = [[0, Y_DIAL * 0, -1.75], [0, 0, -1.3], [0.55, Y_DIAL, -0.95], [0.6, Y_DIAL, -0.15], [0, Y_DIAL + 0.312, 0.0]];
      const c = caminho(t, tt.chega - 0.05, tt.encaixe + 0.3, pts, [0.08, 0.1, 0.1, 0.32]);
      const fim = ei(P(t, 27.0, 0.4));
      if (mostrar(SAL.cliente, t > tt.chega - 0.3 && fim < 1)) {
        const entra = sp((t - (tt.chega - 0.3)) / 0.25);
        const giro = c.u >= 1 ? 0 : c.giro;
        const sq = amasso(t, tt.encaixe + 0.3, 0.2);
        porPeao(SAL.cliente, DIAL.x + c.x, (c.u > 0 ? c.y : 0) - 0.4 * (1 - entra) - 0.6 * fim, DIAL.z + c.z, giro, sq);
      }
    }
    // o pedaço de 40 minutos ganha volume, levanta e vem para a frente; no "dia" vira o 1º dia do mês
    {
      const vem = eio(P(t, tt.quarenta12 + 0.25, 0.6));
      const vai = eio(P(t, tt.um - 0.05, tt.dia - tt.um + 0.25));
      const P_ = SAL.pedaco;
      if (mostrar(P_, levanta > 0.002 && vai < 1)) {
        const alvoMes = V(MES_C.x + MES.cel[0].userData.x, 0.02, MES_C.z + MES.cel[0].userData.z);
        const x0 = DIAL.x, y0 = Y_DIAL + 0.4 * vem, z0 = DIAL.z + 0.75 * vem;
        P_.position.set(mix(x0, alvoMes.x, vai), mix(y0, alvoMes.y, vai) + hop(vai) * 0.5, mix(z0, alvoMes.z, vai));
        P_.rotation.set(0.45 * vem * (1 - vai), 0, 0);
        const e = mix(1, 0.127, vai);
        P_.scale.set(e, e * Math.max(0.08, levanta), e);
      }
    }
    // a porta, a cadeira e o relógio somem antes do mês
    const saiSal = ei(P(t, 27.0, 0.45));
    S0.position.y = -0.08 * saiSal;
    if (saiSal > 0) {
      SAL.porta.position.y = -1.0 * saiSal; SAL.cad.position.y -= 0.9 * saiSal; SAL.placa.position.y -= 0.9 * saiSal;
      SAL.ponteiro.position.y = Y_DIAL - 0.05 * saiSal;
    } else { SAL.porta.position.y = 0; SAL.ponteiro.position.y = Y_DIAL; }
  }

  // ---------------------------------------------------------------- relógio digital: 16:00 → 16:15 → 16:30 → 16:40
  {
    const u = sp((t - (tt.pronta - 0.2)) / 0.4), sai = ei(P(t, 26.9, 0.4));
    if (mostrar(REL.grupo, u > 0.002 && sai < 1)) {
      const min = Math.round(minutos(t));
      porHora(16 * 60 + min, min >= 40 ? COR.ambar : COR.branco);
      REL.grupo.position.y = -0.3 * (1 - u) - 0.3 * sai;
      const sq = amasso(t, tt.quinze + 0.1, 0.12) + amasso(t, tt.meia + 0.1, 0.12) + amasso(t, tt.quarenta11 + 0.1, 0.16);
      REL.grupo.scale.set(1 + sq * 0.3, 1 - sq, 1);
      REL.grupo.rotation.x = -0.12;
    }
  }

  // ---------------------------------------------------------------- o mês: 26 furos, e eles viram 17h20
  {
    const vis = t > 27.4 && t < 33.6;
    mostrar(MES.grupo, vis);
    if (vis) {
      const juntam = eio(P(t, tt.vira, tt.dezessete - tt.vira + 0.05));
      const sai = ei(P(t, 33.1, 0.4));
      MES.cel.forEach((c, k) => {
        const tp = k === 0 ? tt.dia + 0.2 : mix(tt.fim - 0.1, tt.vira - 0.05, (k - 1) / 24);
        if (!mostrar(c, t > (k === 0 ? tt.dia + 0.18 : tp - 0.25) && juntam < 1)) return;
        const cai = k === 0 ? 1 : ei(P(t, tp - 0.25, 0.25));
        const sq = amasso(t, tp, 0.15);
        const x = mix(c.userData.x, 0, juntam), z = mix(c.userData.z, 0.05, juntam);
        c.position.set(x, 0.6 * (1 - cai) + hop(juntam) * 0.3, z);
        const e = 1 - juntam * 0.9; c.scale.set(e * (1 + sq * 0.3), e * (1 - sq), e * (1 + sq * 0.3));
      });
      const uD = sp((t - (tt.fim - 0.2)) / 0.4) * (1 - sai);
      MES.dias.forEach(o => { if (mostrar(o, uD > 0.002)) { o.position.y = -0.02 * (1 - uD); o.userData.m.scale.z = Math.max(0.05, uD); } });
      if (mostrar(MES.rotulo, uD > 0.002)) { MES.rotulo.position.y = -0.02 * (1 - uD); MES.rotulo.userData.m.scale.z = Math.max(0.05, uD); }
      // 17h20 sobe de pé no "dezessete" (bate na batida de 31,0); DE CADEIRA PARADA no "cadeira"
      const uT = sp((t - (tt.dezessete - 0.05)) / 0.4) * (1 - sai);
      if (emergir(MES.total, uT, 0.6)) {
        MES.total.rotation.x = -0.1;
        const sq = amasso(t, 31.0, 0.18); MES.total.scale.set(1 + sq * 0.3, 1 - sq, 1);
      }
      const uP = sp((t - (tt.cadeira13 - 0.08)) / 0.35) * (1 - sai);
      if (mostrar(MES.parada, uP > 0.002)) { MES.parada.position.y = -0.02 * (1 - uP); MES.parada.userData.m.scale.z = Math.max(0.05, uP); }
    }
  }
}

export function seek(t) {
  t = ((t % DUR) + DUR) % DUR;
  desenhar(t, aplicar, window.AMOSTRAS || 1);
  const logo = document.getElementById('logo');
  if (logo) logo.style.opacity = String(Math.max(1 - ss(P(t, 0.1, 0.35)), ss(P(t, 45.3, 0.5))));
}

// ======================================================================== som: os momentos que a trilha marca
function eventosDoSom(tt) {
  return {
    dur: DUR,
    folha: [tt.terca + 0.2, 36.85],
    toque: [tt.encaixe + 0.3, tt.querendo + 0.4, tt.dia + 0.2, 37.0 - 0.0, 45.0],
    pulos: [tt.chega + 0.25, tt.chega + 0.6, 23.0, 23.5],
    cascata: [tt.fim - 0.1, tt.vira - 0.05, 25],
    tique: [[tt.quatro4, tt.quinze + 0.12], [tt.quatro5, tt.meia + 0.12], [tt.quatro11 + 0.05, tt.quarenta11 + 0.15]],
    sobe: [tt.quatro, tt.cadeira2, tt.tonho5, tt.damiao, tt.sem1, tt.sem2, tt.sem3, tt.quarenta12, tt.dezessete, tt.guarda, tt.voce, tt.quem, tt.conta, tt.na, tt.do, tt.cadeira17],
    whoosh: [[2.3, 3.15], [10.7, 11.9], [20.4, 21.3], [27.0, 27.9], [33.0, 33.9]],
    impactos: [tt.quinze + 0.12, tt.meia + 0.12, tt.damiao + 0.3, tt.sem1 + 0.32, tt.sem2 + 0.32, tt.sem3 + 0.32, tt.quarenta11 + 0.15, tt.marcou + 0.05, 41.0],
    fortes: [31.0, 37.0, 45.0],
    riser: [43.0, 45.0],
  };
}
