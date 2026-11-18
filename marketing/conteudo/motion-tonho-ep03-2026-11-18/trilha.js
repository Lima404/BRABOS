// Trilha em Web Audio (OfflineAudioContext), 120 BPM, na grade do vídeo. Os momentos vêm de window.EVENTOS
// (cenas.js, calculados a partir da fala). Devolve um WAV 48 kHz estéreo em base64.
//   - bumbo macio em toda batida, acento no começo do compasso (o mesmo do Ep. 01)
//   - pad de acordes (Lá menor, Fá, Dó, Sol: 2 compassos cada), bem por baixo da voz
//   - sons de cena: a capa de papelão abrindo e fechando, peças tocando a mesa, o cliente pulando, os 26 dias
//     caindo em cascata, o tique do relógio correndo, coisas subindo, a grua (vento)
//   - impacto em cada troca de cena, impactos fortes (o 17h20, o caderno fechando, o carimbo) e o riser antes do fim
window.gerarTrilha = async function () {
  const E = window.EVENTOS, SR = 48000, DUR = E.dur, BAT = 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
  const mestre = ctx.createGain(); mestre.gain.value = 0.85; mestre.connect(ctx.destination);
  const verbo = ctx.createConvolver();
  { const n = SR * 1.2, b = ctx.createBuffer(2, n, SR); let s = 99;
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / n, 3.2); } }
    verbo.buffer = b; }
  const somaVerbo = ctx.createGain(); somaVerbo.gain.value = 0.16; verbo.connect(somaVerbo).connect(mestre);
  const saida = (no, seco = 1, molhado = 0) => { const g = ctx.createGain(); g.gain.value = seco; no.connect(g).connect(mestre); if (molhado) { const w = ctx.createGain(); w.gain.value = molhado; no.connect(w).connect(verbo); } };

  let sem = 12345; const rnd = () => ((sem = (sem * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const ruido = ctx.createBuffer(1, SR * 4, SR); { const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd(); }
  const fonteRuido = (t, dur, inicio = 0) => { const n = ctx.createBufferSource(); n.buffer = ruido; n.loop = true; n.start(t, inicio % 3.5); n.stop(t + dur); return n; };
  const env = (g, t, a, pico, d, fim = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + a); g.gain.exponentialRampToValueAtTime(fim, t + a + d); };

  function bumbo(t, forca) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    env(g, t, 0.004, 0.55 * forca, 0.3);
    o.connect(g); saida(g); o.start(t); o.stop(t + 0.36);
    const n = fonteRuido(t, 0.02, t), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 2800; env(gn, t, 0.001, 0.07 * forca, 0.012);
    n.connect(f).connect(gn); saida(gn);
  }
  function pad(t0, t1, notas) {
    for (const [k, hz] of notas.entries()) {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det + k * 1.5;
        f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.4;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.018, t0 + 0.6);
        g.gain.setValueAtTime(0.018, t1 - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.4);
        o.connect(f).connect(g); saida(g, 1, 0.5); o.start(t0); o.stop(t1 + 0.5);
      }
    }
  }
  function folha(t) {   // papelão da capa: ruído de banda média que abre e fecha
    const n = fonteRuido(t, 0.6, t * 1.7), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.25); f.frequency.exponentialRampToValueAtTime(900, t + 0.55);
    env(g, t, 0.08, 0.22, 0.45);
    n.connect(f).connect(g); saida(g, 1, 0.4);
  }
  function toque(t, forca = 1) {   // peça tocando a mesa (mensagem pousando, peão, pílula)
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.06);
    env(g, t, 0.002, 0.3 * forca, 0.09);
    o.connect(g); saida(g, 1, 0.3); o.start(t); o.stop(t + 0.12);
    const n = fonteRuido(t, 0.03, t * 3), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 2200; env(gn, t, 0.001, 0.11 * forca, 0.025);
    n.connect(f).connect(gn); saida(gn);
  }
  function zumbido(t0, t1, forca = 1) {   // celular vibrando no balcão: zumbido grave que chacoalha
    const d = t1 - t0;
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createGain();
    o.type = 'square'; o.frequency.value = 172;
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 31; lfoG.gain.value = 0.5;
    am.gain.value = 0.5; lfo.connect(lfoG).connect(am.gain);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.11 * forca, t0 + Math.min(0.04, d * 0.3));
    g.gain.setValueAtTime(0.11 * forca, t1 - Math.min(0.05, d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t1);
    o.connect(lp).connect(am).connect(g); saida(g, 1, 0.15);
    o.start(t0); o.stop(t1 + 0.02); lfo.start(t0); lfo.stop(t1 + 0.02);
  }
  function plim(t) {   // notificação: duas notas curtas
    [[1318.5, 0], [1760, 0.07]].forEach(([hz, dt]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      env(g, t + dt, 0.004, 0.07, 0.28);
      o.connect(g); saida(g, 1, 0.35); o.start(t + dt); o.stop(t + dt + 0.35);
    });
  }
  function tesoura(t) {   // um corte: dois estalinhos agudos bem curtos
    for (const dt of [0, 0.045]) {
      const n = fonteRuido(t + dt, 0.03, (t + dt) * 7), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'highpass'; f.frequency.value = 4200;
      env(g, t + dt, 0.001, dt ? 0.05 : 0.07, 0.022);
      n.connect(f).connect(g); saida(g, 1, 0.12);
    }
  }
  function tique(t, forca) {   // o relógio correndo
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.02);
    env(g, t, 0.001, 0.05 * forca, 0.03);
    o.connect(g); saida(g, 1, 0.1); o.start(t); o.stop(t + 0.05);
  }
  function sobe(t) {
    const n = fonteRuido(t, 0.3, t * 2.3), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
    env(g, t, 0.06, 0.08, 0.2);
    n.connect(f).connect(g); saida(g, 1, 0.3);
  }
  function vento(t0, t1, sobeDesce) {
    const n = fonteRuido(t0, t1 - t0 + 0.4, t0), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 0.9;
    const [a, b] = sobeDesce ? [300, 3000] : [3500, 250];
    f.frequency.setValueAtTime(a, t0); f.frequency.exponentialRampToValueAtTime(b, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.13, t0 + (t1 - t0) * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.35);
    n.connect(f).connect(g); saida(g, 1, 0.5);
  }
  function impacto(t, forte = false) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(forte ? 105 : 90, t); o.frequency.exponentialRampToValueAtTime(36, t + (forte ? 0.6 : 0.28));
    env(g, t, 0.005, forte ? 0.85 : 0.33, forte ? 1.3 : 0.4);
    o.connect(g); saida(g, 1, forte ? 0.6 : 0.25); o.start(t); o.stop(t + 1.5);
    const n = fonteRuido(t, 1.1, t * 1.3), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(forte ? 5500 : 3200, t); f.frequency.exponentialRampToValueAtTime(350, t + (forte ? 0.9 : 0.3));
    env(gn, t, 0.003, forte ? 0.4 : 0.13, forte ? 0.95 : 0.28);
    n.connect(f).connect(gn); saida(gn, 1, 0.4);
  }
  function riser(t0, t1) {
    const n = fonteRuido(t0, t1 - t0, t0), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 2.2; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(6500, t1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1);
    n.connect(f).connect(g); saida(g, 1, 0.4);
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), go = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(660, t1);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t0); lp.frequency.exponentialRampToValueAtTime(4000, t1);
    go.gain.setValueAtTime(0.0001, t0); go.gain.exponentialRampToValueAtTime(0.06, t1 - 0.02); go.gain.linearRampToValueAtTime(0, t1);
    o.connect(lp).connect(go); saida(go); o.start(t0); o.stop(t1);
  }

  // grade: bumbo em toda batida (some no último meio compasso, que é o título)
  for (let k = 0; k * BAT < DUR - 0.01; k++) {
    const t = k * BAT;
    if (t >= DUR - 1.0) continue;
    bumbo(t, k % 4 === 0 ? 1 : 0.68);
  }
  const ACORDES = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]];
  for (let c = 0; c * 4 < DUR; c++) pad(c * 4, Math.min(DUR, c * 4 + 4), ACORDES[c % 4].map(h => h / 2));
  E.folha.forEach(t => folha(t));
  E.toque.forEach(t => toque(t));
  E.pulos.forEach(t => toque(t, 0.45));
  { const [a, b, n] = E.cascata; for (let k = 0; k < n; k++) toque(a + (b - a) * k / (n - 1), 0.32); }
  // o tique acelera no meio de cada salto do relógio
  E.tique.forEach(([a, b]) => { let t = a; while (t < b) { const u = (t - a) / (b - a); tique(t, 0.7 + 0.5 * u); t += 0.16 - 0.1 * Math.sin(Math.PI * u); } });
  E.sobe.forEach(t => sobe(t));
  E.whoosh.forEach(([a, b]) => vento(a, b, false));
  E.impactos.forEach(t => impacto(t));
  E.fortes.forEach(t => impacto(t, true));
  riser(E.riser[0], E.riser[1]);

  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length;
  const ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab);
  const str = (o, x) => { for (let i = 0; i < x.length; i++) v.setUint8(o + i, x.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++, o += 4) {
    v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, Rr[i])) * 32767, true);
  }
  const bytes = new Uint8Array(ab); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
