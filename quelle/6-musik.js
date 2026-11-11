// ===================================================================
// 6 · MUSIK „Neonküste“ – eigene Komposition, nur Web Audio
// Melodischer Synthwave/Retro-Arcade, 136 BPM, a-Moll, 36 Takte ≈ 63,5 s.
// Aufbau: Intro (4) · A (8) · B (8) · A' (8) · Brücke (4) · Überleitung (4),
// danach nahtlos wieder ins Intro (E-Dur → a-Moll). Instrumente: warme
// Akkordflächen, treibender Achtel-Bass, Lead-Motiv, dezente Arpeggios,
// elektronische Drums. Alles wird über die Audio-Uhr geplant; jede Note hat
// eine Hüllkurve (keine Klicks), Töne über den Loop hinaus klingen einfach aus.
// planeSchritt() funktioniert mit jedem AudioContext (auch Offline für Tests).
// ===================================================================

const Musik = (() => {
  const BPM = 136, SECHZEHNTEL = 60 / BPM / 4, TAKTE = 36, SCHRITTE = TAKTE * 16;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // Akkorde (Bass-Grundton, Flächentöne) als MIDI-Nummern
  const AKK = {
    Am: [45, [57, 60, 64]], F: [41, [57, 60, 65]], C: [48, [55, 60, 64]], G: [43, [55, 59, 62]],
    Dm: [50, [57, 62, 65]], Em: [40, [55, 59, 64]], E: [40, [56, 59, 64]],
  };
  // Lead-Phrasen: je Takt Liste [Startachtel, MIDI, Länge in Achteln]
  const M1 = [
    [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 74, 2], [6, 76, 2]],
    [[0, 77, 2], [2, 76, 1], [3, 74, 1], [4, 72, 4]],
    [[0, 72, 2], [2, 74, 1], [3, 76, 1], [4, 79, 2], [6, 76, 2]],
    [[0, 74, 3], [3, 71, 1], [4, 74, 4]],
  ];
  const M1_ENDE_B = [[0, 74, 2], [2, 76, 2], [4, 79, 4]];        // steigt in den B-Teil
  const M1_ENDE_AUFL = [[0, 72, 2], [2, 71, 2], [4, 69, 4]];     // löst nach A auf
  const M2 = [
    [[0, 81, 3], [3, 79, 1], [4, 77, 2], [6, 76, 2]],
    [[0, 79, 3], [3, 77, 1], [4, 76, 2], [6, 74, 2]],
    [[0, 76, 2], [2, 79, 2], [4, 83, 2], [6, 79, 2]],
    [[0, 81, 6]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2]],
    [[0, 83, 3], [3, 81, 1], [4, 79, 2], [6, 77, 2]],
    [[0, 76, 4], [4, 80, 4]],
    [[0, 83, 6]],
  ];
  const BRUECKE = [[[0, 77, 8]], [[0, 79, 8]], [[0, 81, 8]], [[0, 79, 4], [4, 83, 4]]];
  const UEBERLEITUNG = [[[0, 76, 4], [4, 72, 4]], [[0, 77, 4], [4, 81, 4]], [[0, 79, 4], [4, 74, 4]], [[0, 76, 2], [2, 80, 2], [4, 83, 4]]];

  // Song-Plan: 36 Takte
  const SONG = [];
  const takt = (akk, lead, teil, opt = {}) => SONG.push({ akk, lead, teil, ...opt });
  for (const a of ['Am', 'F', 'C', 'G']) takt(a, null, 'intro', { arp: true, snare: false });
  for (let i = 0; i < 8; i++) takt(['Am', 'F', 'C', 'G'][i % 4], i === 7 ? M1_ENDE_B : M1[i % 4], 'a', { crash: i === 0 });
  ['F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'E'].forEach((a, i) => takt(a, M2[i], 'b', { arp: true, hats16: true, crash: i === 0 }));
  for (let i = 0; i < 8; i++) takt(['Am', 'F', 'C', 'G'][i % 4], i === 7 ? M1_ENDE_AUFL : M1[i % 4], 'a2', { arp: true, crash: i === 0, oktav: i >= 4 });
  ['Dm', 'Em', 'F', 'G'].forEach((a, i) => takt(a, BRUECKE[i], 'bruecke', { arp: true, crash: i === 0, kickHalb: true }));
  ['Am', 'F', 'G', 'E'].forEach((a, i) => takt(a, UEBERLEITUNG[i], 'ueber', { arp: true, hats16: i === 3 }));

  // ---------- Instrumente (ctx, ziel = Ausgang, t = Startzeit) ----------
  function osz(ctx, ziel, typ, f, t, dauer, laut, { a = 0.01, r = 0.08, detune = 0, filter = 0, q = 0.7 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(f, t); if (detune) o.detune.setValueAtTime(detune, t);
    let kette = o;
    if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(filter, t); fl.Q.value = q; o.connect(fl); kette = fl; }
    const ende = t + Math.max(dauer, a + 0.01);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(laut, t + a);
    g.gain.setValueAtTime(laut, Math.max(t + a, ende - 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, ende + r);
    kette.connect(g).connect(ziel);
    o.start(t); o.stop(ende + r + 0.02);
  }
  function pad(ctx, ziel, noten, t, dauer) {
    for (const m of noten) for (const d of [-7, 7]) osz(ctx, ziel, 'sawtooth', hz(m), t, dauer, 0.016, { a: 0.12, r: 0.35, detune: d, filter: 1500 });
  }
  function bass(ctx, ziel, m, t) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(hz(m), t);
    fl.type = 'lowpass'; fl.Q.value = 3; fl.frequency.setValueAtTime(1300, t); fl.frequency.exponentialRampToValueAtTime(320, t + 0.18);
    const d = SECHZEHNTEL * 1.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + 0.006); g.gain.exponentialRampToValueAtTime(0.03, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
    o.connect(fl).connect(g).connect(ziel); o.start(t); o.stop(t + d + 0.08);
  }
  function lead(ctx, ziel, m, t, dauer) {
    // zwei leicht verstimmte Rechtecke, sanft gefiltert, mit leichtem Vibrato
    for (const d of [-5, 5]) {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(hz(m), t); o.detune.setValueAtTime(d, t);
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(6, t + Math.min(0.3, dauer)); lfo.connect(lg).connect(o.detune);
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(2600, t); fl.Q.value = 0.8;
      const ende = t + dauer;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.034, t + 0.015); g.gain.setValueAtTime(0.03, Math.max(t + 0.02, ende - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, ende + 0.12);
      o.connect(fl).connect(g).connect(ziel); o.start(t); o.stop(ende + 0.15); lfo.start(t); lfo.stop(ende + 0.15);
    }
  }
  function arp(ctx, ziel, m, t, laut) { osz(ctx, ziel, 'triangle', hz(m), t, SECHZEHNTEL * 0.7, laut, { a: 0.004, r: 0.05 }); }
  function kick(ctx, ziel, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(ziel); o.start(t); o.stop(t + 0.32);
  }
  function rauschen(ctx, ziel, buf, t, dauer, laut, typ, f, q = 0.8) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; fl.type = typ; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(laut, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    s.connect(fl).connect(g).connect(ziel); s.start(t, (t * 7.3) % 0.5); s.stop(t + dauer + 0.02);
  }
  function snare(ctx, ziel, buf, t) {
    rauschen(ctx, ziel, buf, t, 0.26, 0.15, 'bandpass', 1900, 0.7);   // etwas „Hall“-Länge, 80er-Gefühl
    osz(ctx, ziel, 'triangle', 190, t, 0.05, 0.1, { a: 0.002, r: 0.06 });
  }
  function hat(ctx, ziel, buf, t, offen) { rauschen(ctx, ziel, buf, t, offen ? 0.16 : 0.035, offen ? 0.035 : 0.028, 'highpass', 7500, 0.6); }
  function crash(ctx, ziel, buf, t) { rauschen(ctx, ziel, buf, t, 1.2, 0.04, 'highpass', 5200, 0.5); }
  function rauschPuffer(ctx) {
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), k = b.getChannelData(0);
    let x = 1; for (let i = 0; i < k.length; i++) { x = (x * 16807) % 2147483647; k[i] = x / 1073741823.5 - 1; }
    return b;
  }

  // Plant den Sechzehntel-Schritt s (0 … SCHRITTE-1) zur Zeit t.
  // weniger = true lässt Zierstimmen weg (Stimmenbegrenzung).
  function planeSchritt(ctx, ziel, buf, s, t, weniger = false) {
    const nr = Math.floor(s / 16) % TAKTE, im = s % 16, T = SONG[nr], [grund, noten] = AKK[T.akk];
    const taktDauer = SECHZEHNTEL * 16;
    if (im === 0) {
      pad(ctx, ziel, noten, t, taktDauer - 0.02);
      if (T.crash) crash(ctx, ziel, buf, t);
    }
    // Bass: treibende Achtel, auf 3 und 7 die Oktave
    if (im % 2 === 0) bass(ctx, ziel, grund + ((im === 6 || im === 14) ? 12 : 0), t);
    // Drums
    if (im === 0 || im === 8 || (T.kickHalb ? false : im === 4 || im === 12)) kick(ctx, ziel, t);
    if (T.snare !== false && (im === 4 || im === 12)) snare(ctx, ziel, buf, t);
    if (!weniger && (T.hats16 ? true : im % 2 === 0)) hat(ctx, ziel, buf, t, im === 14 && nr % 2 === 1);
    // Lead
    if (T.lead && im % 2 === 0) for (const [start, m, laenge] of T.lead) if (start * 2 === im) lead(ctx, ziel, m + (T.oktav && m < 76 ? 12 : 0), t, laenge * SECHZEHNTEL * 2 - 0.03);
    // Arpeggio (dezent): Akkordtöne eine Oktave höher, Muster 0-1-2-1
    if (T.arp && !weniger) arp(ctx, ziel, noten[[0, 1, 2, 1][im % 4]] + 12, t, T.teil === 'bruecke' ? 0.028 : 0.018);
  }

  return { BPM, SECHZEHNTEL, TAKTE, SCHRITTE, SONG, LAENGE: SCHRITTE * SECHZEHNTEL, planeSchritt, rauschPuffer };
})();
