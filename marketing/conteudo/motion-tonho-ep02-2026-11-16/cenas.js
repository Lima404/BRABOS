// "Na cadeira do Tonho" · Ep. 02 · O WhatsApp não para.
// Conceito: mensagem sem resposta vira bloco na mesa. A pilha cresce enquanto a mão do Tonho está ocupada.
// Câmera: a grua do Ep. 01. Plongée sobre o balcão, sobe para dar contexto e desce para o detalhe, foco raso.
// Mesa (unidades da cena, norte = −z = para cima na tela):
//   caderno de capa azul no centro (abre e fecha o vídeo) · celular a leste (x 2,1) · salão ao norte do celular
//   (cadeira, cliente e o TONHO) · relógio e conversa ao sul do celular. Com a câmera baixa olhando para o norte,
//   o Tonho trabalhando fica no fundo de tudo o que acontece com o celular.
import {
  THREE, COR, cl, mix, P, eo, ei, eio, ss, sp, hop, rad, T, S, RIG, reg, esconderTudo, sombra, mat,
  palavra, palavraDeitada, largura, geoTexto, geoLaje, lajeDeitada, canvasTex, textoC, larguraC, rgba,
  curva, desenhar, F8, F6, DIRV,
} from './nucleo.js';

export const DUR = 43.0;
const Y_CAPA = 0.142;
const mostrar = (o, sim = true) => { o.visible = !!sim; return !!sim; };
const DIR0 = DIRV.clone();
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

// ======================================================================== peças do Ep. 01: peão (cliente) e cadeira
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

// ======================================================================== balões (mensagens), com rabicho
const cacheBolha = new Map();
function geoBolha(w, h, lado) {
  const k = `${w}|${h}|${lado}`;
  if (cacheBolha.has(k)) return cacheBolha.get(k);
  const r = Math.min(0.09, h * 0.36), tl = h * 0.27, s = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  if (lado < 0) {   // recebida: ponta embaixo à esquerda
    s.moveTo(x0 - 0.025, y0 - tl); s.lineTo(x0 + 0.13, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
    s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
    s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x0, y0 + 0.02); s.lineTo(x0 - 0.025, y0 - tl);
  } else {          // enviada: ponta embaixo à direita
    s.moveTo(x0 + r, y0); s.lineTo(x1 - 0.13, y0); s.lineTo(x1 + 0.025, y0 - tl); s.lineTo(x1, y0 + 0.02);
    s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
    s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
  }
  const bt = 0.005;
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 2, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); g.translate(0, bt, 0);
  cacheBolha.set(k, g);
  return g;
}
const BW = 0.7, BH = 0.26, BTOPO = 0.045;
function criarMensagem(texto, hora, enviada = false) {
  const corpo = new THREE.Mesh(geoBolha(BW, BH, enviada ? 1 : -1), mat(enviada ? COR.ambar : COR.g50));
  corpo.castShadow = corpo.receiveShadow = true;
  const { g: c, tex } = canvasTex(700, 260);
  let sz = 52; while (larguraC(c, texto, sz, 600) > 616 && sz > 30) sz -= 2;
  textoC(c, texto, 42, 124, sz, 600, COR.g900);
  textoC(c, hora, 654, 222, 32, 600, enviada ? rgba(COR.g900, 0.72) : COR.g500, 'right');
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH).rotateX(-Math.PI / 2),
    mat('#ffffff', { map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  plano.position.y = BTOPO + 0.0004; plano.receiveShadow = true; plano.renderOrder = 2;
  const g = new THREE.Group(); g.add(corpo, plano); g.userData = { corpo, plano };
  return g;
}

// ======================================================================== o caderno de capa azul (fechado)
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
  const q = palavraDeitada('?', 0.3, 0.03, COR.g900); q.rotation.x = -Math.PI / 2; q.position.set(0, 0.058, 0.11);
  g.add(corpo, q); g.userData = { corpo, q };
  return g;
}
const CAD = {};
function criarCaderno() {
  const g = CAD.grupo = reg(new THREE.Group());
  const mCapa = mat('#ffffff', { map: texCapa() }), mLado = mat(new THREE.Color(COR.azul).lerp(new THREE.Color(COR.g900), 0.22));
  g.add(lajeDeitada(2.06, 2.86, 0.035, 0.02, mCapa, mLado));
  const miolo = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.10, 2.78), mat(COR.g100)); miolo.position.y = 0.07; sombra(miolo); g.add(miolo);
  const lomb = new THREE.Mesh(new THREE.BoxGeometry(0.014, Y_CAPA, 2.86), mLado); lomb.position.set(-1.012, Y_CAPA / 2, 0); sombra(lomb); g.add(lomb);
  const capa = lajeDeitada(2.06, 2.86, 0.035, 0.022, mCapa, mLado); capa.position.set(0.018, Y_CAPA - 0.022, 0); g.add(capa);

  // rótulo da série (y = 0 é a face de cima da capa)
  const rot = CAD.rot = new THREE.Group(); rot.position.set(0.018, Y_CAPA, 0); g.add(rot);
  const sT = Math.min(0.27, 1.62 / largura('NA CADEIRA', 1));
  CAD.tit1 = palavraDeitada('NA CADEIRA', sT, 0.04, COR.branco); CAD.tit1.position.z = -0.14;
  CAD.tit2 = palavraDeitada('DO TONHO', sT, 0.04, COR.branco); CAD.tit2.position.z = 0.2;
  CAD.pilula = new THREE.Group();
  CAD.pilula.add(lajeDeitada(0.5, 0.18, 0.09, 0.03, mat(COR.ambar)));
  const ep = palavraDeitada('EP. 02', 0.095, 0.012, COR.g900); ep.rotation.x = -Math.PI / 2; ep.position.set(0, 0.03, 0.035); CAD.pilula.add(ep);
  CAD.pilula.position.z = -0.86;
  CAD.sub = palavraDeitada('TODA SEMANA TEM EPISÓDIO', 0.068, 0.008, COR.branco, F6); CAD.sub.position.z = 0.48;
  CAD.cadTit = criarCadeira(); CAD.cadTit.position.set(0, 0, 0.92);
  for (const o of [CAD.tit1, CAD.tit2, CAD.sub]) o.rotation.x = -Math.PI / 2;
  rot.add(CAD.tit1, CAD.tit2, CAD.pilula, CAD.sub, CAD.cadTit);

  // gancho: TESOURA e CELULAR sobem de pé na capa
  CAD.tesoura = palavraDeitada('TESOURA', 0.21, 0.06, COR.branco); CAD.tesoura.position.set(-0.2, 0, -0.36);
  CAD.celular = palavraDeitada('CELULAR', 0.21, 0.06, COR.branco); CAD.celular.position.set(0.2, 0, 0.34);
  rot.add(CAD.tesoura, CAD.celular);

  // chamada: QUANTAS / POR DIA? em relevo na capa, e o balão âmbar
  CAD.cta = ['QUANTAS', 'POR DIA?'].map((s, i) => {
    const o = palavraDeitada(s, 0.25, 0.05, COR.branco); o.rotation.x = -Math.PI / 2; o.position.z = [-0.42, -0.05][i]; rot.add(o); return o;
  });
  CAD.bolha = criarBolhaCTA(); CAD.bolha.position.set(0, 0, 0.6); rot.add(CAD.bolha);
}

// ======================================================================== o salão: cadeira, cliente e o TONHO
const SAL = {};
function criarSalao() {
  const g = SAL.grupo = reg(new THREE.Group()); g.position.set(2.2, 0, -2.35);
  SAL.cad = criarCadeira(); SAL.cad.scale.setScalar(1.5); SAL.cad.position.set(0.1, 0, 0);
  SAL.cliente = criarPeao(COR.g800); SAL.cliente.scale.setScalar(1.15);
  SAL.tonho = palavraDeitada('TONHO', 0.24, 0.07, COR.branco); SAL.tonho.position.set(-0.48, 0, -0.12);
  g.add(SAL.cad, SAL.cliente, SAL.tonho);
}

// ======================================================================== o celular, a pilha de mensagens e o contador
const CEL = {};
const CEL_POS = V(2.1, 0, -0.55), CEL_ROT = -0.08, TELA_Y = 0.0757;
function noCelular(x, y, z, alvo = new THREE.Vector3()) {   // coordenada do celular → mundo
  const c = Math.cos(CEL_ROT), s = Math.sin(CEL_ROT);
  return alvo.set(CEL_POS.x + x * c + z * s, CEL_POS.y + y, CEL_POS.z - x * s + z * c);
}
function texTela() {
  const { g, tex } = canvasTex(720, 1560);
  g.fillStyle = COR.g950; g.fillRect(0, 0, 720, 1560);
  textoC(g, 'Conversas', 48, 150, 58, 800, COR.branco);
  const L = [['R', 'Rafael', 'Tem horário hoje à tarde?', '11:02', '1'], ['D', 'Diego', 'Amanhã cedo dá?', '11:05', '2'],
    ['L', 'Luan', 'Quanto tá corte e barba?', '11:09', '1'], ['M', 'Marcos', 'Tá aberto hoje?', '11:14', '3'],
    ['C', 'Caio', 'Dá pra encaixar agora?', '11:20', '1'], ['B', 'Bruno', 'Tem vaga às 17h?', '11:31', '2'],
    ['J', 'João', 'Sábado tem vaga?', '11:52', '1']];
  L.forEach(([ini, nome, prev, hora, n], i) => {
    const y = 230 + i * 182;
    g.fillStyle = COR.g800; g.beginPath(); g.arc(104, y + 74, 54, 0, Math.PI * 2); g.fill();
    textoC(g, ini, 104, y + 90, 44, 700, COR.g300, 'center');
    textoC(g, nome, 186, y + 62, 40, 700, COR.branco);
    textoC(g, prev, 186, y + 116, 32, 500, COR.g300);
    textoC(g, hora, 676, y + 62, 28, 700, COR.ambar, 'right');
    g.fillStyle = COR.ambar; g.beginPath(); g.arc(650, y + 106, 26, 0, Math.PI * 2); g.fill();
    textoC(g, n, 650, y + 116, 28, 800, COR.g900, 'center');
    g.fillStyle = COR.g800; g.fillRect(186, y + 170, 534, 2);
  });
  return tex;
}
const MSG = [
  ['Tem horário hoje à tarde?', '11:02'], ['Amanhã cedo dá?', '11:05'], ['Quanto tá corte e barba?', '11:09'],
  ['Tá aberto hoje?', '11:14'], ['Dá pra encaixar agora?', '11:20'], ['Tem vaga às 17h?', '11:31'], ['Bom dia! Tem horário?', '11:38'],
  ['Sábado tem vaga?', '11:52'], ['Tô indo aí, pode?', '12:06'], ['Oi', '12:15'], ['Tem horário pra dois?', '12:31'], ['Que horas fecha?', '12:47'],
  ['Ainda tem vaga?', '13:10'], ['Responde aí', '13:42'], ['Tem horário amanhã?', '14:05'], ['Oi??', '14:21'],
];
// pouso de cada mensagem na pilha: o número dito aparece no instante da palavra (3 no "Três", 7 no "Sete", 12 no "Doze")
let POUSO = [];
const PILHA = [];
function criarCelular() {
  const g = CEL.grupo = reg(new THREE.Group()); g.position.copy(CEL_POS); g.rotation.y = CEL_ROT;
  g.add(lajeDeitada(0.8, 1.64, 0.12, 0.075, mat(COR.g800), mat(COR.g700)));
  const tex = texTela();
  CEL.matTela = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.56).rotateX(-Math.PI / 2), CEL.matTela);
  tela.position.y = TELA_Y; tela.receiveShadow = true; g.add(tela);
  CEL.badge = new THREE.Group();
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 48), mat(COR.ambar)); disco.position.y = 0.025; sombra(disco);
  CEL.num = palavraDeitada('0', 0.14, 0.012, COR.g900); CEL.num.rotation.x = -Math.PI / 2; CEL.num.position.set(0, 0.05, 0.051);
  CEL.badge.add(disco, CEL.num); CEL.badge.position.set(0.37, TELA_Y, -0.8); g.add(CEL.badge);
  let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  MSG.slice(0, 12).forEach(([txt, h], k) => {
    const o = reg(criarMensagem(txt, h));
    PILHA.push({ o, jx: (rnd() - 0.5) * 0.1, jz: (rnd() - 0.5) * 0.12, jr: (rnd() - 0.5) * 0.36,
      // para onde cada uma cai quando a pilha desaba (no chão, em volta do celular, longe do caderno e da conversa)
      ax: 0.55 + rnd() * 0.75, az: -1.3 + rnd() * 1.6, ar: (rnd() - 0.5) * 1.6, lado: rnd() < 0.5 ? -1 : 1 });
  });
  // metade cai para o leste, metade para o oeste (sem entrar no caderno)
  PILHA.forEach((p, k) => { if (p.lado < 0) { p.ax = -0.5 - (p.ax - 0.55) * 0.25; p.az = -1.6 - Math.abs(p.az) * 0.4; } });
}
function numeroBadge(n) {
  const m = CEL.num.userData.m, s = String(n);
  m.geometry = geoTexto(s, 0.14, 0.012); m.position.x = -largura(s, 0.14) / 2;
}

// ======================================================================== relógio (11:02 → 14:40), em números de pé
const REL = {};
function criarRelogio() {
  const g = REL.grupo = reg(new THREE.Group()); g.position.set(2.1, 0, 0.42);
  const sz = REL.sz = 0.22, dp = REL.dp = 0.06;
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

// ======================================================================== a conversa: pergunta, resposta, recusa
const CONV = {};
const Q_POS = V(1.85, 0, 1.02), A_POS = V(2.36, 0, 1.44), R_POS = V(1.85, 0, 1.86), ESC = 1.3;
function criarConversa() {
  CONV.a = reg(criarMensagem('Tenho às 15h!', '14:40', true));
  CONV.r = reg(criarMensagem('Já cortei, obrigado.', '14:41'));
}

// ======================================================================== RUIM riscado → TRABALHANDO
const FR = {};
function criarFrase() {
  FR.grupo = reg(new THREE.Group()); FR.grupo.position.set(2.1, 0, 1.25);
  FR.ruim = palavraDeitada('RUIM', 0.34, 0.08, COR.branco);
  FR.risco = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.035).translate(0.5, 0, 0), mat(COR.ambar)); sombra(FR.risco);
  FR.trab = palavraDeitada('TRABALHANDO', 0.18, 0.06, COR.ambar);
  FR.grupo.add(FR.ruim, FR.risco, FR.trab);
}

// ======================================================================== a agenda que o cliente vê (a virada)
const AG = {};
function texHora(hora, rotulo, corTxt, corRot) {
  const { g, tex } = canvasTex(860, 300);
  textoC(g, hora, 56, 196, 120, 800, corTxt);
  if (rotulo) textoC(g, rotulo, 806, 182, 46, 800, corRot, 'right', 6);
  return tex;
}
function criarAgenda() {
  AG.grupo = reg(new THREE.Group()); AG.grupo.position.set(2.1, 0, 0);
  const H = [['14h', false], ['15h', true], ['16h', true], ['17h', false]];
  AG.zs = [0.68, 1.03, 1.38, 1.73];
  AG.tiles = H.map(([h, livre], i) => {
    const mTopo = mat(COR.g700), mLado = mat(COR.g800);
    const corpo = lajeDeitada(0.86, 0.3, 0.06, 0.04, mTopo, mLado);
    const texOcup = texHora(h, livre ? '' : 'OCUPADO', COR.g300, COR.g400);
    const texLivre = livre ? texHora(h, 'LIVRE', COR.g900, COR.ambar800) : null;
    const texMarc = livre ? texHora(h, 'MARCADO', COR.g900, COR.g900) : null;
    const mt = mat('#ffffff', { map: texOcup, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.3).rotateX(-Math.PI / 2), mt); plano.position.y = 0.0404; plano.receiveShadow = true; plano.renderOrder = 2;
    const t = new THREE.Group(); t.add(corpo, plano); t.position.z = AG.zs[i];
    AG.grupo.add(t);
    return { t, corpo, mTopo, mt, texOcup, texLivre, texMarc, livre };
  });
  AG.peao = reg(criarPeao(COR.g200, COR.g900));
}

// ======================================================================== câmera (chaves da grua)
// [t, alvo x, y, z, distância, elevação°, azimute°, abertura, foco relativo]
const CHAVES = [
  [0.00, 0, 0.14, 0.75, 9.0, 72, 0, 0.004, 1],
  [0.35, 0, 0.14, 0.70, 8.6, 71, 1.0, 0.004, 1],
  [1.25, -0.22, 0.26, -0.3, 4.4, 44, -6, 0.010, 1],
  [2.30, 0.2, 0.26, 0.42, 4.4, 40, 6, 0.011, 1],
  [3.30, 0.4, 0.2, 0.05, 5.0, 52, 10, 0.009, 1],
  [4.25, 1.92, 0.34, -2.3, 4.4, 26, 10, 0.013, 1],
  [5.20, 1.95, 0.3, -2.15, 4.0, 22, 14, 0.014, 1],
  [6.20, 2.1, 0.12, -0.6, 3.6, 48, 8, 0.012, 1],
  [7.20, 2.1, 0.3, -0.55, 3.9, 30, 10, 0.013, 1],
  [8.80, 2.1, 0.45, -0.55, 4.1, 25, 12, 0.013, 1],
  [10.30, 2.1, 0.55, -0.55, 4.3, 22, 14, 0.012, 1],
  [11.25, 2.1, 0.3, 0.2, 4.2, 28, 8, 0.012, 1],
  [12.50, 2.0, 0.18, 0.7, 4.2, 44, 6, 0.012, 1],
  [13.60, 1.88, 0.06, 0.98, 3.7, 62, 0, 0.012, 1],
  [14.70, 2.1, 0.24, 0.42, 3.4, 26, 8, 0.015, 1],
  [15.40, 2.1, 0.24, 0.42, 3.4, 26, 6, 0.016, 1.85],
  [16.20, 2.1, 0.24, 0.42, 3.2, 25, 4, 0.016, 1],
  [17.20, 2.1, 0.22, 0.42, 3.0, 24, 2, 0.016, 1],
  [18.20, 2.1, 0.1, 1.3, 5.8, 60, 4, 0.010, 1],
  [19.50, 2.1, 0.1, 1.42, 5.9, 62, 0, 0.010, 1],
  [20.60, 2.1, 0.1, 1.42, 6.0, 60, -2, 0.010, 1],
  [21.50, 2.0, 0.3, 0.5, 6.4, 46, 8, 0.009, 1],
  [23.60, 2.1, 0.28, 1.25, 3.5, 17, -4, 0.015, 1],
  [24.90, 2.1, 0.26, 1.25, 3.6, 16, 2, 0.015, 1],
  [25.90, 2.1, 0.26, 1.25, 4.4, 17, 4, 0.016, 1.85],
  [26.80, 2.0, 0.2, 1.2, 4.6, 30, 6, 0.013, 1],
  [27.50, 1.92, 0.1, 1.2, 4.7, 56, 8, 0.011, 1],
  [28.70, 1.95, 0.1, 1.2, 4.6, 60, 4, 0.011, 1],
  [30.00, 1.95, 0.1, 1.15, 4.3, 58, -2, 0.012, 1],
  [31.10, 2.05, 0.12, 1.05, 3.8, 54, -6, 0.012, 1],
  [32.30, 0.3, 0.2, 0.1, 5.2, 58, -4, 0.009, 1],
  [33.30, 0.0, 0.25, -0.22, 4.1, 60, 0, 0.010, 1],
  [35.30, 0.0, 0.28, -0.14, 4.2, 58, 2, 0.010, 1],
  [36.60, 0.0, 0.28, 0.12, 4.7, 62, 0, 0.010, 1],
  [37.60, 0.0, 0.25, 0.15, 5.6, 66, 0, 0.008, 1],
  [39.20, 0.0, 0.25, 0.25, 5.6, 67, 0, 0.008, 1],
  [40.40, 0.0, 0.25, 0.3, 5.4, 67, 0, 0.008, 1],
  [41.60, 0, 0.15, 0.68, 8.6, 71.5, -5, 0.005, 1],
  [42.40, 0, 0.14, 0.74, 8.9, 72, -2.2, 0.004, 1],
  [43.00, 0, 0.14, 0.75, 9.0, 72, 0, 0.004, 1],
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
function pulos(t, t0, n, a, b, alt = 0.07, dur = 0.5) {
  const u = cl((t - t0) / (n * dur)), k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k;
  return { pos: mix(a, b, (k + ss(f)) / n), y: u > 0 && u < 1 ? hop(f) * alt : 0, u };
}
// vibração do celular: tremor de 30 Hz dentro das janelas (o desfoque de movimento borra o tremor)
let ZUMBIDO = [];
function zumbido(t, janelas = ZUMBIDO) {
  let e = 0;
  for (const [a, b] of janelas) if (t > a && t < b) e = Math.max(e, Math.sin(Math.PI * (t - a) / (b - a)));
  return e;
}
// palavra de pé subindo do chão ou da capa: u = 0 escondida, 1 no lugar
function emergir(o, u, alt = 0.4) { if (!mostrar(o, u > 0.002)) return false; o.position.y = -alt * (1 - u); return true; }

// ======================================================================== montagem
let TT = null;
const GEST = [];
export async function criarCenas() {
  criarChao(); criarCaderno(); criarSalao(); criarCelular(); criarRelogio(); criarConversa(); criarFrase(); criarAgenda();
  const tt = {
    tesoura: T('f01', 'Tesoura'), mao: T('f01', 'mão'), celular: T('f02', 'Celular'), outra: T('f02', 'outra'),
    o3: T('f03', 'O'), tonho: T('f03', 'Tonho'), cortando: T('f03', 'cortando'), cel3: T('f03', 'celular'), nao3: T('f03', 'não'), para: T('f03', 'para'),
    tres: T('f04', 'Três'), sete: T('f05', 'Sete'), doze: T('f06', 'Doze'),
    onze: T('f07', 'Onze'), dois: T('f07', 'dois'), tem: T('f07', 'tem'), horario7: T('f07', 'horário'), tarde: T('f07', 'tarde'),
    o8: T('f08', 'O'), tonho8: T('f08', 'Tonho'), responder: T('f08', 'responder'), duas: T('f08', 'duas'), quarenta: T('f08', 'quarenta'),
    tenho: T('f09', 'Tenho'), tres9: T('f09', 'três'), ja: T('f10', 'Já'), cortei: T('f10', 'cortei'), obrigado: T('f10', 'obrigado'),
    ele: T('f11', 'Ele'), perdeu: T('f11', 'perdeu'), por11: T('f11', 'por'), ser: T('f11', 'ser'), ruim: T('f11', 'ruim'),
    perdeu12: T('f12', 'Perdeu'), estar: T('f12', 'estar'), trabalhando: T('f12', 'trabalhando'),
    e13: T('f13', 'E'), cliente13: T('f13', 'cliente'), ver: T('f13', 'ver'), horarios: T('f13', 'horários'), livres: T('f13', 'livres'),
    sem: T('f13', 'sem'), precisar: T('f13', 'precisar'), perguntar: T('f13', 'perguntar'),
    quantas: T('f14', 'Quantas'), por14: T('f14', 'por'), dia: T('f14', 'dia'), horario14: T('f14', 'horário'),
    comenta: T('f15', 'Comenta'), numero: T('f15', 'número'),
    na: T('f16', 'Na'), cadeira: T('f16', 'cadeira'), do: T('f16', 'do'), tonho16: T('f16', 'Tonho'),
    ate: T('f17', 'Até'), proximo: T('f17', 'próximo'), episodio: T('f17', 'episódio'),
  };
  TT = tt;
  POUSO = [tt.tres - 0.24, tt.tres - 0.12, tt.tres,
    tt.sete - 0.36, tt.sete - 0.24, tt.sete - 0.12, tt.sete,
    tt.doze - 0.48, tt.doze - 0.36, tt.doze - 0.24, tt.doze - 0.12, tt.doze];
  ZUMBIDO = [[tt.cel3 - 0.03, tt.cel3 + 0.42], [tt.nao3 - 0.04, tt.para + 0.36],
    ...POUSO.map(p => [p - 0.03, p + 0.16]), [tt.ja - 0.02, tt.ja + 0.3]];
  IMPACTOS_CAM = [[17.0, 0.025], [21.0, 0.05], [40.5, 0.035]];
  GEST.push(CAD.tit1, CAD.tit2, CAD.pilula, CAD.sub, CAD.cadTit, CAD.tesoura, CAD.celular, ...CAD.cta, CAD.bolha, CAD.bolha.userData.q,
    SAL.cad, SAL.cliente, SAL.tonho, CEL.badge, FR.ruim, FR.risco, FR.trab, ...AG.tiles.map(x => x.t));
  window.EVENTOS = eventosDoSom(tt);
}

const _v = new THREE.Vector3();
function aplicar(t) {
  const tt = TT;
  esconderTudo();
  camera(t);
  for (const o of GEST) o.visible = false;
  mostrar(CHAO);

  // a luz da tarde: a sombra gira enquanto o relógio corre (11:02 → 14:40) e volta antes do fim
  const sol = rad(70) * eio(P(t, 14.7, 2.6)) * (1 - eio(P(t, 31.6, 1.6)));
  DIRV.copy(DIR0).applyAxisAngle(V(0, 1, 0), -sol);

  // ---------------------------------------------------------------- caderno e rótulo da série
  mostrar(CAD.grupo); mostrar(CAD.rot);
  const noInicio = t < 0.05;
  const saiRot = ei(P(t, 0.05, 0.36));
  const sobe = (tw, d = 0.42) => sp((t - tw) / d);
  const emergirRot = (o, u, z, alt = 0.06) => { if (!mostrar(o, u > 0.002)) return; o.position.y = -alt * (1 - u); o.position.z = z; };
  const fimT = t > 37;
  emergirRot(CAD.tit1, fimT ? sobe(tt.na - 0.14) : 1 - saiRot, -0.14);
  emergirRot(CAD.tit2, fimT ? sobe(tt.do - 0.05) : 1 - saiRot, 0.2);
  emergirRot(CAD.sub, fimT ? sobe(tt.ate - 0.05) : 1 - saiRot, 0.48, 0.02);
  // a pílula EP. 02 afunda no começo e carimba de novo na batida de 40,5
  const tCarimbo = 40.5;
  if (!fimT) { emergirRot(CAD.pilula, 1 - saiRot, -0.86, 0.05); CAD.pilula.scale.set(1, 1, 1); CAD.pilula.rotation.y = 0; }
  else if (mostrar(CAD.pilula, t > tCarimbo - 0.45)) {
    const u = ei(P(t, tCarimbo - 0.45, 0.45));
    CAD.pilula.position.set(0, (1 - u) * 0.9, -0.86);
    const sq = amasso(t, tCarimbo, 0.35);
    CAD.pilula.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    CAD.pilula.rotation.y = (1 - u) * 0.5;
  }
  const uCad = fimT ? sp((t - tt.cadeira + 0.05) / 0.5) : 1 - saiRot;
  if (mostrar(CAD.cadTit, uCad > 0.002)) { CAD.cadTit.position.y = -0.62 * (1 - uCad); CAD.cadTit.rotation.y = (1 - uCad) * -1.2; }

  // ---- gancho: TESOURA e CELULAR sobem de pé, tombam para trás na batida de 3,5 e afundam
  {
    const tomba = ei(P(t, 3.18, 0.32)), afunda = ei(P(t, 3.62, 0.32));
    const por = (o, tw) => {
      const u = sp((t - tw + 0.02) / 0.4);
      if (!mostrar(o, u > 0.002 && afunda < 1)) return;
      o.position.y = -0.3 * (1 - u) - 0.08 * afunda;
      o.rotation.x = mix(-0.3, -Math.PI / 2, tomba);
      o.userData.m.scale.z = Math.max(0.04, 1 - afunda);
      const sq = amasso(t, 3.5, 0.12);
      o.scale.set(1 + sq * 0.3, 1, 1 - sq);
    };
    por(CAD.tesoura, tt.tesoura); por(CAD.celular, tt.celular);
    const z = zumbido(t, [[tt.outra - 0.02, tt.outra + 0.45]]);
    CAD.celular.position.x = 0.2 + 0.012 * z * Math.sin(2 * Math.PI * 31 * t);
    CAD.celular.rotation.y = 0.04 * z * Math.sin(2 * Math.PI * 27 * t + 1);
  }

  // ---- chamada no fim: QUANTAS / POR DIA? em relevo; o balão "?" no "Comenta"
  {
    const sai = ei(P(t, tt.na - 0.44, 0.28));
    [tt.quantas, tt.por14].forEach((tw, i) => {
      const u = sp((t - tw + 0.04) / 0.32) * (1 - sai), o = CAD.cta[i];
      if (!mostrar(o, t > 31.5 && t < 38.5 && u > 0.002)) return;
      o.position.y = -0.045 * (1 - u); o.userData.m.scale.z = Math.max(0.05, u);
    });
    const uB = sp((t - tt.comenta + 0.05) / 0.45) * (1 - sai);
    if (mostrar(CAD.bolha, t > 31.5 && t < 38.5 && uB > 0.002)) {
      CAD.bolha.position.y = -0.12 + 0.13 * uB; CAD.bolha.rotation.y = (1 - uB) * 0.6;
      const uQ = sp((t - tt.numero + 0.03) / 0.3);
      const q = CAD.bolha.userData.q;
      mostrar(q, uQ > 0.002); q.scale.set(1, 1, Math.max(0.02, uQ)); q.position.y = 0.058 - 0.03 * (1 - uQ);
      const sq = amasso(t, tt.numero + 0.05, 0.15); CAD.bolha.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.4);
    }
  }

  // ---------------------------------------------------------------- o salão (o Tonho trabalhando)
  {
    const sai = ei(P(t, 31.5, 0.6));
    const vis = t > 3.6 && sai < 1;
    mostrar(SAL.grupo, vis);
    if (vis) {
      const uC = sp((t - (tt.o3 - 0.15)) / 0.45);
      if (mostrar(SAL.cad, uC > 0.002)) { SAL.cad.position.y = -0.9 * (1 - uC) - 0.9 * sai; SAL.cad.rotation.y = (1 - uC) * -0.9; }
      // TONHO sobe no "Tonho" e balança no ritmo do corte (uma ida e volta por segundo)
      const uT = sp((t - (tt.tonho - 0.06)) / 0.45);
      if (mostrar(SAL.tonho, uT > 0.002)) {
        SAL.tonho.position.y = -0.36 * (1 - uT) - 0.36 * sai;
        const corta = cl((t - tt.cortando) / 0.4);
        SAL.tonho.rotation.set(-0.12, 0.09 * corta * Math.sin(2 * Math.PI * t + 1), 0.045 * corta * Math.sin(2 * Math.PI * t));
      }
      // o cliente cai na cadeira no "cortando" (pousa na batida de 4,5)
      const tP = 4.5, u = P(t, tP - 0.35, 0.35);
      if (mostrar(SAL.cliente, t > tP - 0.35)) {
        porPeao(SAL.cliente, 0.1, 0.312 * 1 + 1.2 * (1 - u * u) - 0.9 * sai, 0.01, 0, amasso(t, tP, 0.2));
      }
    }
  }

  // ---------------------------------------------------------------- o celular
  {
    mostrar(CEL.grupo);
    const z = zumbido(t);
    CEL.grupo.position.set(CEL_POS.x + 0.01 * z * Math.sin(2 * Math.PI * 31 * t), 0, CEL_POS.z + 0.006 * z * Math.sin(2 * Math.PI * 23 * t));
    CEL.grupo.rotation.y = CEL_ROT + 0.025 * z * Math.sin(2 * Math.PI * 27 * t + 1);
    const liga = ss(P(t, tt.cel3 - 0.08, 0.2));
    CEL.matTela.color.set(COR.g700).lerp(new THREE.Color('#ffffff'), liga);
    CEL.matTela.emissiveIntensity = 0.3 * liga;
    // contador: quantas já pousaram; some no desabamento
    const n = POUSO.filter(p => t >= p).length;
    const uB = sp((t - (POUSO[0] - 0.05)) / 0.3) * (1 - ei(P(t, 20.95, 0.25)));
    if (mostrar(CEL.badge, n > 0 && uB > 0.002)) {
      numeroBadge(n);
      const sq = POUSO.reduce((a, p) => a + amasso(t, p, 0.22), 0);
      CEL.badge.scale.set(uB * (1 + sq * 0.5), uB * (1 - sq), uB * (1 + sq * 0.5));
      CEL.badge.position.y = TELA_Y + 0.5 * ei(P(t, 20.95, 0.25));
    }
  }

  // ---------------------------------------------------------------- a pilha de mensagens
  {
    const tira = sp((t - (tt.tem + 0.14)) / 0.25);        // a de baixo sai e a pilha desce um andar
    const desaba = 21.0;
    const afundaChao = ei(P(t, 26.9, 0.4));
    PILHA.forEach((p, k) => {
      const o = p.o, tp = POUSO[k];
      if (!mostrar(o, t > tp - 0.22 && afundaChao < 1)) return;
      o.scale.setScalar(1);
      if (k === 0 && t > tt.tem) {
        // a pergunta: escorrega para fora da pilha e pula para o lugar dela na conversa
        const u1 = sp((t - tt.tem) / 0.3);
        const ini = noCelular(p.jx, TELA_Y, p.jz + 0.7 * u1, _v).clone();
        const u2 = eio(P(t, tt.tem + 0.26, 0.5));
        const pouso = tt.tem + 0.76;
        const sq = amasso(t, pouso, 0.14);
        const afunda = ei(P(t, 21.5, 0.4));
        o.position.set(mix(ini.x, Q_POS.x, u2), mix(ini.y, 0, u2) + hop(u2) * 0.4 - 0.08 * afunda, mix(ini.z, Q_POS.z, u2));
        o.rotation.set(0, mix(CEL_ROT + p.jr, 0, u2), 0);
        const e = mix(1, ESC, u2); o.scale.set(e * (1 + sq * 0.3), e * (1 - sq) * (1 - afunda * 0.9), e * (1 + sq * 0.3));
        mostrar(o, afunda < 1);
        return;
      }
      const andar = k - (k > 0 ? tira : 0);
      const yPilha = TELA_Y + andar * BTOPO;
      const cai = ei(P(t, tp - 0.22, 0.22));
      const sq = amasso(t, tp, 0.12);
      const base = noCelular(p.jx, yPilha + 0.5 * (1 - cai), p.jz, _v);
      if (t < desaba + k * 0.012) {
        o.position.copy(base); o.rotation.set(0, CEL_ROT + p.jr, 0);
        o.scale.set(1 + sq * 0.3, 1 - sq, 1 + sq * 0.3);
      } else {
        // o desabamento: cada uma tomba para fora do celular e cai deitada no balcão
        const u = ei(P(t, desaba + k * 0.012, 0.5));
        const alvo = noCelular(p.ax, 0, p.az).clone();
        const sq2 = amasso(t, desaba + k * 0.012 + 0.5, 0.1);
        o.position.set(mix(base.x, alvo.x, u), mix(base.y, 0, u) + hop(u) * 0.22 - 0.06 * afundaChao, mix(base.z, alvo.z, u));
        o.rotation.set(p.lado * 2 * Math.PI * u, CEL_ROT + p.jr + p.ar * u, 0);
        o.scale.set(1 + sq2 * 0.3, 1 - sq2, 1 + sq2 * 0.3);
      }
    });
  }

  // ---------------------------------------------------------------- relógio: 11:02 no "Onze", corre até 14:40 no "quarenta"
  {
    const u = sp((t - (tt.onze - 0.06)) / 0.4), sai = ei(P(t, 21.5, 0.4));
    if (mostrar(REL.grupo, u > 0.002 && sai < 1)) {
      const corre = eio(P(t, tt.o8 + 0.15, 17.0 - (tt.o8 + 0.15)));
      const min = Math.round(mix(11 * 60 + 2, 14 * 60 + 40, corre));
      const chegou = t >= 17.0;
      porHora(min, chegou ? COR.ambar : COR.branco);
      REL.grupo.position.y = -0.36 * (1 - u) - 0.36 * sai;
      const sq = amasso(t, 17.0, 0.16);
      REL.grupo.scale.set(1 + sq * 0.3, 1 - sq, 1);
      REL.grupo.rotation.x = -0.12;
    }
  }

  // ---------------------------------------------------------------- a conversa: "Tenho às 15h!" e "Já cortei, obrigado."
  {
    const A = CONV.a, Rr = CONV.r;
    const uA = eio(P(t, tt.tenho - 0.04, 0.5)), pA = tt.tenho + 0.46;
    if (mostrar(A, t > tt.tenho - 0.04 && t < 21.5)) {
      const ini = noCelular(0, TELA_Y, 0.1, _v).clone();
      const murcha = ei(P(t, 21.0, 0.35));
      const sq = amasso(t, pA, 0.14);
      A.position.set(mix(ini.x, A_POS.x, uA), mix(ini.y, 0, uA) + hop(uA) * 0.5 - 0.04 * murcha, mix(ini.z, A_POS.z, uA));
      A.rotation.set(0, mix(CEL_ROT, 0, uA), 0);
      const e = mix(0.6, ESC, uA);
      A.scale.set(e * (1 + sq * 0.3 + 0.12 * murcha), e * Math.max(0.08, (1 - sq) * (1 - 0.92 * murcha)), e * (1 + sq * 0.3 + 0.12 * murcha));
    }
    const pR = tt.ja + 0.3, uR = ei(P(t, tt.ja, 0.3));
    if (mostrar(Rr, t > tt.ja && t < 21.9)) {
      const afunda = ei(P(t, 21.5, 0.4));
      const sq = amasso(t, pR, 0.18);
      Rr.position.set(R_POS.x, 1.6 * (1 - uR) - 0.08 * afunda, R_POS.z);
      Rr.rotation.set(0, 0, 0);
      Rr.scale.set(ESC * (1 + sq * 0.3), ESC * (1 - sq) * (1 - 0.9 * afunda), ESC * (1 + sq * 0.3));
    }
  }

  // ---------------------------------------------------------------- RUIM riscado → TRABALHANDO
  {
    const uR = sp((t - (tt.ser - 0.02)) / 0.38), saiR = ei(P(t, tt.perdeu12, 0.32));
    const vis = t > 22 && t < 27.3;
    mostrar(FR.grupo, vis);
    if (vis) {
      if (emergir(FR.ruim, uR * (1 - saiR), 0.45)) FR.ruim.rotation.x = -0.1;
      const w = FR.ruim.userData.w, uX = eio(P(t, tt.ruim + 0.22, 0.28));
      if (mostrar(FR.risco, uX > 0.002 && saiR < 1)) {
        FR.risco.position.set(-w / 2 - 0.05, 0.125 - 0.45 * saiR, 0.1);
        FR.risco.scale.x = (w + 0.1) * uX;
        FR.risco.rotation.set(-0.1, 0, 0.06);
      }
      const uT = sp((t - (tt.trabalhando - 0.04)) / 0.4) * (1 - ei(P(t, 26.75, 0.35)));
      if (emergir(FR.trab, uT, 0.3)) FR.trab.rotation.x = -0.1;
    }
  }

  // ---------------------------------------------------------------- a virada: o cliente vê os horários livres e marca
  {
    const sai = ei(P(t, 31.6, 0.5));
    const vis = t > 27.0 && sai < 1;
    mostrar(AG.grupo, vis);
    if (vis) {
      AG.tiles.forEach((x, i) => {
        const u = sp((t - (tt.horarios + i * 0.11)) / 0.32);
        if (!mostrar(x.t, u > 0.002)) return;
        // os livres acendem no "livres": pulinho e a cor muda no meio dele
        const acende = x.livre ? P(t, tt.livres + (i - 1) * 0.12, 0.3) : 0;
        const marcado = x.livre && i === 1 && t >= tt.perguntar;
        x.mTopo.color.set(marcado ? COR.ambar : acende >= 0.5 ? COR.g50 : COR.g700);
        x.mt.map = marcado ? x.texMarc : acende >= 0.5 ? x.texLivre : x.texOcup;
        const sq = (x.livre ? amasso(t, tt.livres + (i - 1) * 0.12 + 0.15, 0.2) : 0) + (marcado ? amasso(t, tt.perguntar, 0.25) : 0);
        x.t.position.y = -0.1 * (1 - u) - 0.1 * sai + hop(acende) * 0.06;
        x.t.scale.set(1 + sq * 0.2, 1 - sq, 1 + sq * 0.2);
      });
      // o cliente cai no "cliente", olha para a agenda no "ver" e pula no 15h no "sem precisar perguntar"
      const tP = tt.cliente13 + 0.1, u = P(t, tP - 0.32, 0.32);
      if (mostrar(AG.peao, t > tP - 0.32 && sai < 1)) {
        const olha = sp((t - tt.ver) / 0.35);
        const ida = pulos(t, tt.sem - 0.05, 3, 1.45, 2.1, 0.12, (tt.perguntar - tt.sem + 0.05) / 3);
        const sobeTile = ida.u >= 1 ? 0.04 : ida.u > 0.67 ? 0.04 * ss((ida.u - 0.67) / 0.33) : 0;
        const sq = amasso(t, tP, 0.2) + amasso(t, tt.perguntar, 0.18);
        porPeao(AG.peao, ida.pos, 1.2 * (1 - u * u) + ida.y + sobeTile - 0.4 * sai, AG.zs[1], olha * Math.PI / 2 * (1 - ss(P(t, tt.perguntar + 0.15, 0.4))), sq);
      }
    }
  }
}

export function seek(t) {
  t = ((t % DUR) + DUR) % DUR;
  desenhar(t, aplicar, window.AMOSTRAS || 1);
  const logo = document.getElementById('logo');
  if (logo) logo.style.opacity = String(Math.max(1 - ss(P(t, 0.1, 0.35)), ss(P(t, 41.2, 0.5))));
}

// ======================================================================== som: os momentos que a trilha marca
function eventosDoSom(tt) {
  return {
    dur: DUR,
    zumbido: ZUMBIDO.filter(([a]) => a > 4),
    zumbidoPalavra: [[tt.outra - 0.02, tt.outra + 0.45]],
    plim: [POUSO[2], POUSO[6], POUSO[11], tt.ja + 0.3],
    toque: [3.5, 4.5, ...POUSO, tt.tem + 0.76, tt.tenho + 0.46, tt.cliente13 + 0.1, 40.5 - 0.0],
    pulos: [tt.sem + 0.2, tt.sem + 0.45, tt.perguntar],
    tesoura: [[tt.cortando, 6.3], [25.6, 26.8]],
    tique: [tt.o8 + 0.15, 17.0],
    sobe: [tt.tesoura, tt.celular, tt.tonho, tt.onze, tt.tenho, tt.ser, tt.trabalhando, tt.horarios, tt.quantas, tt.por14, tt.comenta, tt.na, tt.do, tt.cadeira],
    whoosh: [[3.3, 4.25], [31.2, 32.4]],
    impactos: [3.5, 7.0, 11.0, 13.0, 17.0, tt.ja + 0.3, 22.0, 24.6, 27.0, 31.0, 37.0],
    fortes: [21.0, 40.5],
    riser: [38.5, 40.5],
  };
}
