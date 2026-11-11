// ===================================================================
// 6 · TON
// Alles synthetisch mit Web Audio, keine Dateien. Startet erst nach einer
// Nutzeraktion. Drei getrennte Lautstärken (Effekte, Motor & Sirene, Musik)
// plus Ton-aus. Höchstens MAX_STIMMEN kurze Geräusche gleichzeitig.
// Grundgerüst (Kontext, iPhone-Stummschalter) aus den anderen Pixelhafen-Spielen.
// ===================================================================

const Ton = (() => {
  let ctx = null, haupt = null, busEffekt = null, busFahrt = null, busMusik = null, stummAudio = null, rauschen = null;
  let an = true;
  const pegel = { effekte: 0.8, fahrt: 0.55, musik: 0.35 };
  let motor = null, sirene = null;

  function sitzung() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!ios) return;
      if (!stummAudio) {
        const n = 2000, b = new Uint8Array(44 + n);
        const w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
        const d = new DataView(b.buffer);
        w(0, 'RIFF'); d.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
        d.setUint32(24, 8000, true); d.setUint32(28, 8000, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true); w(36, 'data'); d.setUint32(40, n, true);
        b.fill(128, 44);
        let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
        stummAudio = new Audio('data:audio/wav;base64,' + btoa(bin));
        stummAudio.loop = true; stummAudio.volume = 0.01;
        stummAudio.setAttribute('playsinline', '');
      }
      stummAudio.play().catch(() => {});
    } catch (e) { /* egal */ }
  }

  function wecke() {
    if (!an) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const komp = ctx.createDynamicsCompressor();
        komp.threshold.value = -14; komp.knee.value = 10; komp.ratio.value = 6;
        haupt = ctx.createGain(); haupt.gain.value = 0.85;
        haupt.connect(komp).connect(ctx.destination);
        busEffekt = ctx.createGain(); busFahrt = ctx.createGain(); busMusik = ctx.createGain();
        for (const b of [busEffekt, busFahrt, busMusik]) b.connect(haupt);
        setzePegel();
        // eine Sekunde weißes Rauschen für Boost, Unfall, Kratzen
        rauschen = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const k = rauschen.getChannelData(0);
        for (let i = 0; i < k.length; i++) k[i] = Math.random() * 2 - 1;
      }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      sitzung();
    } catch (e) { ctx = null; }
  }
  const bereit = () => an && ctx && ctx.state === 'running';
  function setzePegel() {
    if (!ctx) return;
    const t = ctx.currentTime;
    busEffekt.gain.setTargetAtTime(pegel.effekte, t, 0.03);
    busFahrt.gain.setTargetAtTime(pegel.fahrt, t, 0.03);
    busMusik.gain.setTargetAtTime(pegel.musik, t, 0.03);
  }

  // Begrenzung gleichzeitiger kurzer Geräusche
  const MAX_STIMMEN = 8;
  let stimmenEnde = [];
  function frei(dauer) {
    const t = ctx.currentTime;
    stimmenEnde = stimmenEnde.filter(e => e > t);
    if (stimmenEnde.length >= MAX_STIMMEN) return false;
    stimmenEnde.push(t + dauer);
    return true;
  }
  function huelle(g, t, laut, dauer, anstieg = 0.005) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t + anstieg);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
  }
  function ton(f1, f2, dauer, { typ = 'square', laut = 0.2, start = 0, anstieg, bus = busEffekt } = {}) {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dauer);
    huelle(g, t, laut, dauer, anstieg);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dauer + 0.05);
  }
  function rausch(dauer, { laut = 0.2, f1 = 800, f2 = 300, q = 0.8, typ = 'lowpass', start = 0, anstieg = 0.004, bus = busEffekt } = {}) {
    const t = ctx.currentTime + start;
    const q0 = ctx.createBufferSource(); q0.buffer = rauschen;
    const f = ctx.createBiquadFilter(); f.type = typ; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dauer);
    const g = ctx.createGain(); huelle(g, t, laut, dauer, anstieg);
    q0.connect(f).connect(g).connect(bus);
    q0.start(t, Math.random() * 0.5); q0.stop(t + dauer + 0.05);
  }

  // ---------- Dauerklänge: Motor und Sirene ----------
  function baueMotor() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 1.2;
    g.gain.value = 0.0001;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(busFahrt);
    o1.start(); o2.start();
    return { o1, o2, f, g };
  }
  function baueSirene() {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lt = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 680;
    lfo.type = 'sine'; lfo.frequency.value = 0.9; lt.gain.value = 170;   // weiches Auf und Ab statt schrillem Signal
    lfo.connect(lt).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 1500;
    g.gain.value = 0.0001;
    o.connect(f).connect(g).connect(busFahrt);
    o.start(); lfo.start();
    return { o, g };
  }

  // ---------- Hintergrundmusik: fröhliche Dur-Schleife, leise, läuft durch ----------
  // Akkorde C | C | Am | Am | F | F | G | G, Achtel bei 118 BPM. Mehr Spannung nur durch eine
  // zusätzliche leise Arpeggio-Schicht, nie durch Lauterwerden oder Hochpitchen.
  const MEL = [0, null, 4, null, 7, null, 4, null, 9, null, 7, null, 4, null, null, null,
    9, null, 12, null, 9, null, 4, null, 7, null, 4, null, null, null, null, null,
    5, null, 9, null, 12, null, 9, null, 7, null, 5, null, 4, null, null, null,
    7, null, 11, null, 14, null, 11, null, 12, null, null, null, 11, null, 7, null];
  const BASS = [130.81, 130.81, 110, 110, 87.31, 87.31, 98, 98];
  const ARP = [[0, 4, 7], [0, 4, 7], [-3, 0, 4], [-3, 0, 4], [-7, -3, 0], [-7, -3, 0], [-5, -1, 2], [-5, -1, 2]];
  const ACHTEL = 60 / 118 / 2;
  let musikAn = false, musikZeit = 0, musikSchritt = 0, musikSpannung = 0;
  function musikPlanen() {
    if (!musikAn || !bereit()) return;
    const jetzt = ctx.currentTime;
    if (musikZeit < jetzt) musikZeit = jetzt + 0.05;
    while (musikZeit < jetzt + 0.3) {
      const st = musikSchritt % 64, takt = Math.floor(st / 8), inTakt = st % 8, start = musikZeit - jetzt;
      const m = MEL[st];
      if (m != null) ton(523.25 * Math.pow(2, m / 12), 523.25 * Math.pow(2, m / 12), ACHTEL * 1.6, { typ: 'triangle', laut: 0.09, start, bus: busMusik, anstieg: 0.01 });
      if (inTakt === 0 || inTakt === 4) ton(BASS[takt], BASS[takt], ACHTEL * 1.7, { typ: 'triangle', laut: 0.16, start, bus: busMusik, anstieg: 0.01 });
      if (inTakt === 6) ton(BASS[takt] * 1.5, BASS[takt] * 1.5, ACHTEL * 0.9, { typ: 'triangle', laut: 0.1, start, bus: busMusik });
      if (inTakt % 2 === 1) rausch(0.03, { laut: 0.012, f1: 7000, f2: 6000, typ: 'highpass', q: 0.7, start, bus: busMusik, anstieg: 0.002 });
      if (musikSpannung > 0) {
        const n = ARP[takt][inTakt % 3];
        ton(1046.5 * Math.pow(2, n / 12), 1046.5 * Math.pow(2, n / 12), ACHTEL * 0.6, { typ: 'sine', laut: 0.03 * musikSpannung, start, bus: busMusik });
      }
      musikZeit += ACHTEL; musikSchritt++;
    }
  }

  return {
    wecke,
    // Musik: an/aus (läuft weiter, ohne Neustart), Spannung 0–1 schaltet die Zusatzschicht
    musik(an, spannung = 0) {
      if (an && !musikAn) { musikAn = true; musikZeit = 0; }
      if (!an) musikAn = false;
      musikSpannung = klemme(spannung, 0, 1);
      musikPlanen();
    },
    musikLaeuft: () => musikAn,
    istAn: () => an,
    status: () => ({ kontext: ctx ? ctx.state : 'keiner', an, stimmen: stimmenEnde.length, motor: !!motor, sirene: !!sirene, musik: musikAn }),
    setze(wert) {
      an = !!wert;
      if (an) { if (ctx || !navigator.userActivation || navigator.userActivation.hasBeenActive) wecke(); }
      else { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); if (stummAudio) stummAudio.pause(); }
    },
    pegel(name, wert) { pegel[name] = klemme(wert, 0, 1); setzePegel(); },
    // Pause / Tabwechsel: alles anhalten; Weiter: wieder aufwecken
    anhalten() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); if (stummAudio) stummAudio.pause(); },
    fortsetzen() { if (an) wecke(); },

    // Motor: Tonhöhe nach Tempo, beim Boost etwas heller. tempo in m/s, null = aus
    fahrt(tempo, boost, sireneNaehe) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (tempo == null) {
        if (motor) { motor.g.gain.setTargetAtTime(0.0001, t, 0.08); const m = motor; setTimeout(() => { try { m.o1.stop(); m.o2.stop(); } catch (e) { /* */ } }, 600); motor = null; }
        if (sirene) { sirene.g.gain.setTargetAtTime(0.0001, t, 0.1); const s = sirene; setTimeout(() => { try { s.o.stop(); } catch (e) { /* */ } }, 700); sirene = null; }
        return;
      }
      if (!bereit()) return;
      if (!motor) motor = baueMotor();
      const f = 38 + tempo * 1.9 + (boost ? 18 : 0);
      motor.o1.frequency.setTargetAtTime(f, t, 0.08);
      motor.o2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
      motor.f.frequency.setTargetAtTime(260 + tempo * 14 + (boost ? 500 : 0), t, 0.1);
      motor.g.gain.setTargetAtTime(0.05 + Math.min(1, tempo / 50) * 0.05, t, 0.1);
      // Sirene: leise, nur in der Nähe einer Streife, nie lauter als 0,07
      const sn = klemme(sireneNaehe || 0, 0, 1);
      if (sn > 0.01 && !sirene) sirene = baueSirene();
      if (sirene) sirene.g.gain.setTargetAtTime(Math.max(0.0001, sn * 0.07), t, 0.25);
    },

    klick() { if (bereit() && frei(0.05)) ton(660, 660, 0.04, { typ: 'square', laut: 0.04 }); },
    // Coup
    zeiger() { if (bereit() && frei(0.03)) ton(1200, 1200, 0.02, { typ: 'square', laut: 0.012 }); },
    treffer(art, nr) {
      if (!bereit() || !frei(0.3)) return;
      const basis = [523, 659, 784][Math.min(2, nr - 1)] || 523;
      ton(basis, basis, 0.09, { typ: 'square', laut: 0.09 });
      ton(basis * 1.5, basis * 1.5, 0.12, { typ: 'triangle', laut: 0.14, start: 0.07 });
      if (art === 'perfekt') ton(basis * 2, basis * 2, 0.16, { typ: 'triangle', laut: 0.12, start: 0.15 });
    },
    daneben() { if (bereit() && frei(0.3)) { ton(220, 150, 0.22, { typ: 'square', laut: 0.06 }); ton(233, 160, 0.22, { typ: 'square', laut: 0.04 }); } },
    oeffnen() {
      if (!bereit()) return;
      rausch(0.5, { laut: 0.18, f1: 1800, f2: 200 });
      ton(130, 60, 0.4, { typ: 'sine', laut: 0.3 });
      [784, 988, 1175, 1568].forEach((f, i) => ton(f, f, 0.14, { typ: 'triangle', laut: 0.08, start: 0.25 + i * 0.07 }));
    },
    beutelRaus() { if (bereit() && frei(0.15)) ton(300, 520, 0.12, { typ: 'sine', laut: 0.08 }); },
    gefangen(extra) {
      if (!bereit() || !frei(0.25)) return;
      const b = extra ? 880 : 784;
      ton(b, b, 0.07, { typ: 'square', laut: 0.06 }); ton(b * 1.26, b * 1.26, 0.1, { typ: 'square', laut: 0.06, start: 0.06 });
      ton(b * 1.5, b * 1.5, 0.14, { typ: 'triangle', laut: 0.1, start: 0.12 });
    },
    verpasst() { if (bereit() && frei(0.2)) ton(260, 120, 0.2, { typ: 'sine', laut: 0.14 }); },
    // Fahrt
    // Boostfeld: kurzes eigenes Arcade-Signal (aufsteigend), beim Auffrischen etwas kürzer
    boostFeld(auffrischen) {
      if (!bereit() || !frei(0.4)) return;
      rausch(0.3, { laut: 0.08, f1: 600, f2: 3200, typ: 'bandpass', q: 1.4, anstieg: 0.03 });
      const noten = auffrischen ? [784, 1175] : [523, 659, 784, 1047];
      noten.forEach((f, i) => ton(f, f * 1.02, 0.09, { typ: 'square', laut: 0.05, start: i * 0.055 }));
      ton(1568, 1568, 0.18, { typ: 'triangle', laut: 0.07, start: noten.length * 0.055 });
    },
    unfall(stark) {
      if (!bereit() || !frei(0.4)) return;
      rausch(0.3, { laut: stark ? 0.32 : 0.2, f1: 900, f2: 120 });   // gedämpft: Tiefpass
      ton(110, 55, 0.25, { typ: 'sine', laut: stark ? 0.35 : 0.22 });
      ton(520, 380, 0.08, { typ: 'triangle', laut: 0.05, start: 0.05 });
    },
    beruehrung() { if (bereit() && frei(0.12)) rausch(0.1, { laut: 0.06, f1: 1500, f2: 600, typ: 'bandpass', q: 2 }); },
    planke() { if (bereit() && frei(0.25)) rausch(0.22, { laut: 0.08, f1: 3000, f2: 1200, typ: 'bandpass', q: 3 }); },
    rempler() { if (bereit() && frei(0.2)) { ton(150, 90, 0.12, { typ: 'sine', laut: 0.12 }); } },
    ueberholt(serie) { if (bereit() && frei(0.08)) { const f = 600 + Math.min(10, serie) * 40; ton(f, f * 1.2, 0.06, { typ: 'triangle', laut: 0.045 }); } },
    knapp() { if (bereit() && frei(0.25)) { rausch(0.18, { laut: 0.07, f1: 900, f2: 3500, typ: 'bandpass', q: 2 }); ton(988, 1319, 0.12, { typ: 'triangle', laut: 0.08, start: 0.05 }); } },
    marke() { if (bereit() && frei(0.5)) { ton(659, 659, 0.12, { typ: 'triangle', laut: 0.12 }); ton(988, 988, 0.22, { typ: 'triangle', laut: 0.12, start: 0.12 }); } },
    polizeiWarnung() { if (bereit() && frei(0.4)) { ton(740, 740, 0.09, { typ: 'triangle', laut: 0.07 }); ton(587, 587, 0.12, { typ: 'triangle', laut: 0.07, start: 0.14 }); } },
    warnung() { if (!bereit()) return; for (let i = 0; i < 3; i++) ton(880, 880, 0.08, { typ: 'square', laut: 0.05, start: i * 0.16 }); },
    entkommen() { if (bereit()) { ton(523, 523, 0.1, { typ: 'triangle', laut: 0.12 }); ton(784, 784, 0.18, { typ: 'triangle', laut: 0.12, start: 0.1 }); } },
    abgehaengt() { if (bereit() && frei(0.3)) { ton(587, 784, 0.16, { typ: 'triangle', laut: 0.1 }); } },
    countdown(letzter) { if (bereit()) ton(letzter ? 988 : 659, letzter ? 988 : 659, letzter ? 0.25 : 0.1, { typ: 'square', laut: 0.06 }); },
    // Kurze Musik (Musik-Lautstärke): fröhlich, Dur, ohne Dröhnen
    sieg() {
      if (!bereit()) return;
      const noten = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38], [988, 0.52], [1047, 0.62], [1319, 0.76], [1568, 0.94]];
      noten.forEach(([f, st], i) => {
        const lang = i === noten.length - 1 ? 0.55 : 0.12;
        ton(f, f, lang, { typ: 'triangle', laut: 0.28, start: st, bus: busMusik });
        ton(f / 2, f / 2, lang, { typ: 'square', laut: 0.05, start: st, bus: busMusik });
      });
      [[131, 0], [175, 0.38], [196, 0.62], [262, 0.94]].forEach(([f, st]) => ton(f, f, 0.3, { typ: 'sine', laut: 0.22, start: st, bus: busMusik }));
    },
    niederlage() {
      if (!bereit()) return;
      ton(392, 370, 0.28, { typ: 'triangle', laut: 0.2, bus: busMusik });
      ton(330, 311, 0.28, { typ: 'triangle', laut: 0.2, start: 0.3, bus: busMusik });
      ton(262, 247, 0.5, { typ: 'triangle', laut: 0.2, start: 0.6, bus: busMusik });
    },
    start() {
      if (!bereit()) return;
      [[392, 0], [523, 0.1], [659, 0.2], [784, 0.32]].forEach(([f, st], i) => ton(f, f, i === 3 ? 0.3 : 0.1, { typ: 'triangle', laut: 0.2, start: st, bus: busMusik }));
    },
  };
})();
