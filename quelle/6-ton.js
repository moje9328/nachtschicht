// ===================================================================
// 6 · TON
// Alles synthetisch mit Web Audio, keine Dateien. Startet erst nach einer
// Nutzeraktion. Zwei getrennte Lautstärken (Musik, Effekte) plus Ton-aus.
// Kein Motorgeräusch, keine Dauersirene: nur kurze Effekte und die Musik
// „Neonküste“ (6-musik.js). Höchstens MAX_STIMMEN kurze Effekte gleichzeitig.
// Grundgerüst (Kontext, iPhone-Stummschalter) aus den anderen Pixelhafen-Spielen.
// ===================================================================

const Ton = (() => {
  let ctx = null, haupt = null, busEffekt = null, busMusik = null, busJingle = null, musikFade = null, stummAudio = null, rauschen = null, musikRauschen = null;
  let an = true;
  const pegel = { effekte: 0.8, musik: 0.45 };

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
        busEffekt = ctx.createGain(); busMusik = ctx.createGain(); busJingle = ctx.createGain();
        busEffekt.connect(haupt); busJingle.connect(haupt);
        // Musik: angenehme Höhen (Tiefpass) und eigene Blende für Ein-/Ausblenden und Ducking
        const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 8000; mf.Q.value = 0.5;
        musikFade = ctx.createGain(); musikFade.gain.value = 0.0001;
        busMusik.connect(mf).connect(musikFade).connect(haupt);
        musikRauschen = Musik.rauschPuffer(ctx);
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
    busMusik.gain.setTargetAtTime(pegel.musik, t, 0.03);
    busJingle.gain.setTargetAtTime(pegel.musik, t, 0.03);
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

  // ---------- Hintergrundmusik: ein einziger Planer über die Audio-Uhr ----------
  // Läuft unabhängig vom Spieltempo. Beim Wieder-Einschalten wird nichts doppelt gestartet.
  let musikAn = false, musikSchritt = 0, musikZeit = 0, musikGestartet = 0;
  function musikPlanen() {
    if (!musikAn || !bereit()) return;
    const jetzt = ctx.currentTime;
    if (musikZeit < jetzt + 0.02) musikZeit = jetzt + 0.06;   // nach Pause/Hänger: weiter ohne Nachholen
    const voll = stimmenEnde.filter(e => e > jetzt).length >= MAX_STIMMEN - 2;
    while (musikZeit < jetzt + 0.35) {
      try { Musik.planeSchritt(ctx, busMusik, musikRauschen, musikSchritt % Musik.SCHRITTE, musikZeit, voll); } catch (e) { musikAn = false; return; }
      musikZeit += Musik.SECHZEHNTEL; musikSchritt++;
    }
  }
  function blende(ziel, dauer) {
    if (!ctx || !musikFade) return;
    const t = ctx.currentTime;
    musikFade.gain.cancelScheduledValues(t);
    musikFade.gain.setValueAtTime(Math.max(0.0001, musikFade.gain.value), t);
    musikFade.gain.linearRampToValueAtTime(Math.max(0.0001, ziel), t + dauer);
  }

  return {
    wecke,
    // Musik an/aus. Mehrfaches Einschalten startet keine zweite Schleife.
    musik(an) {
      if (an) {
        if (!musikAn && bereit()) { musikAn = true; musikSchritt = 0; musikZeit = 0; musikGestartet++; blende(1, 1.2); }
        musikPlanen();
      } else if (musikAn) { musikAn = false; blende(0.0001, 0.5); }
    },
    // kurz leiser für Ergebnis-Jingles
    musikDucken(dauer = 1.6) { if (!musikAn) return; blende(0.3, 0.15); const t = ctx.currentTime; musikFade.gain.setValueAtTime(0.3, t + dauer); musikFade.gain.linearRampToValueAtTime(1, t + dauer + 0.6); },
    musikLaeuft: () => musikAn,
    istAn: () => an,
    status: () => ({ kontext: ctx ? ctx.state : 'keiner', an, stimmen: stimmenEnde.length, musik: musikAn, musikStarts: musikGestartet, musikSchritt, dauerquellen: 0 }),
    setze(wert) {
      an = !!wert;
      if (an) { if (ctx || !navigator.userActivation || navigator.userActivation.hasBeenActive) wecke(); }
      else { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); if (stummAudio) stummAudio.pause(); }
    },
    pegel(name, wert) { pegel[name] = klemme(wert, 0, 1); setzePegel(); },
    // Pause / Tabwechsel: alles anhalten; Weiter: wieder aufwecken
    anhalten() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); if (stummAudio) stummAudio.pause(); },
    fortsetzen() { if (an) wecke(); },

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
    serie() { if (bereit() && frei(0.5)) { [659, 880, 1109, 1319].forEach((f, i) => ton(f, f, 0.1, { typ: 'square', laut: 0.045, start: i * 0.06 })); ton(1760, 1760, 0.22, { typ: 'triangle', laut: 0.06, start: 0.24 }); } },
    // knapp vorbei: Tonhöhe steigt mit der Kombo (eine Dur-Tonleiter hinauf)
    knapp(kombo = 1) {
      if (!bereit() || !frei(0.25)) return;
      const stufe = [0, 2, 4, 5, 7, 9, 11, 12][Math.min(7, Math.max(0, kombo - 1))];
      const f = 784 * Math.pow(2, stufe / 12);
      rausch(0.14, { laut: 0.06, f1: 900, f2: 3500, typ: 'bandpass', q: 2 });
      ton(f, f, 0.08, { typ: 'square', laut: 0.05, start: 0.02 }); ton(f * 1.5, f * 1.5, 0.12, { typ: 'triangle', laut: 0.08, start: 0.08 });
    },
    komboEnde() { if (bereit() && frei(0.3)) ton(520, 330, 0.22, { typ: 'triangle', laut: 0.06 }); },
    rekord() {
      if (!bereit() || !frei(0.8)) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => ton(f, f, 0.12, { typ: 'square', laut: 0.05, start: i * 0.07 }));
      ton(1568, 1568, 0.4, { typ: 'triangle', laut: 0.09, start: 0.35 });
    },
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
        ton(f, f, lang, { typ: 'triangle', laut: 0.28, start: st, bus: busJingle });
        ton(f / 2, f / 2, lang, { typ: 'square', laut: 0.05, start: st, bus: busJingle });
      });
      [[131, 0], [175, 0.38], [196, 0.62], [262, 0.94]].forEach(([f, st]) => ton(f, f, 0.3, { typ: 'sine', laut: 0.22, start: st, bus: busJingle }));
    },
    niederlage() {
      if (!bereit()) return;
      ton(392, 370, 0.28, { typ: 'triangle', laut: 0.2, bus: busJingle });
      ton(330, 311, 0.28, { typ: 'triangle', laut: 0.2, start: 0.3, bus: busJingle });
      ton(262, 247, 0.5, { typ: 'triangle', laut: 0.2, start: 0.6, bus: busJingle });
    },
    start() {
      if (!bereit()) return;
      [[392, 0], [523, 0.1], [659, 0.2], [784, 0.32]].forEach(([f, st], i) => ton(f, f, i === 3 ? 0.3 : 0.1, { typ: 'triangle', laut: 0.2, start: st, bus: busJingle }));
    },
  };
})();
