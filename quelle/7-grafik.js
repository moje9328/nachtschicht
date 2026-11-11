// ===================================================================
// 7 · GRAFIK
// Zeichnet Straße, Kulisse, Fahrzeuge, Effekte und die Coup-Szene auf ein
// Canvas. Die Logik weiß nichts vom Bildschirm: Die Projektion bildet die
// immer gleich große logische Straße (ANSICHT) in das Sichtfenster ab.
// Leichte Schrägsicht: Weiter vorne ist alles etwas kleiner, Fahrzeuge
// zeigen Dach und Heck.
// ===================================================================

const Grafik = (() => {
  const SCHRIFT = "'Press Start 2P', 'Courier New', monospace";
  let ruhig = false;   // prefers-reduced-motion
  const setzeRuhig = r => { ruhig = !!r; };

  // ---------- Farben ----------
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const misch = (a, b, t) => { const x = rgb(a), y = rgb(b); return `rgb(${Math.round(mische(x[0], y[0], t))},${Math.round(mische(x[1], y[1], t))},${Math.round(mische(x[2], y[2], t))})`; };
  const rgba = (h, a) => { const x = rgb(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };

  const PALETTEN = {
    hafen:    { boden: '#121A33', rand: '#1D2440', asphalt: '#272C47', asphalt2: '#292E4A', markierung: '#EDE6CF', licht: '#FFB35C', lichtAbstand: 40, wasser: '#0B1D3A' },
    autobahn: { boden: '#14182E', rand: '#20253F', asphalt: '#262A42', asphalt2: '#282C45', markierung: '#F1EEE3', licht: '#BFE3FF', lichtAbstand: 48, wasser: '#0B1D3A' },
    tunnel:   { boden: '#1B1528', rand: '#2B2238', asphalt: '#2C2638', asphalt2: '#2F293C', markierung: '#F4E7C8', licht: '#FFC46B', lichtAbstand: 16, wand: '#3D3152', wasser: '#0B1D3A' },
    bruecke:  { boden: '#0A2142', rand: '#1E2742', asphalt: '#242B46', asphalt2: '#262D49', markierung: '#EEF1F6', licht: '#9FD7FF', lichtAbstand: 32, wasser: '#0A2142' },
    neon:     { boden: '#160F2B', rand: '#241A3C', asphalt: '#251F3D', asphalt2: '#272140', markierung: '#E8F6FF', licht: '#FF4FD8', lichtAbstand: 40, wasser: '#0B1D3A' },
  };
  const AUTO_FARBEN = ['#7FE0C2', '#FF9C85', '#F3E3B5', '#8EC9FF', '#C9A7FF'];
  const CONTAINER = ['#E8663D', '#2E9C8F', '#C83E5A', '#3C6FB8', '#D9A23A'];
  const hash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 0) / 4294967296; };

  // ---------- Projektion ----------
  function projektion(sicht, camD, strecke, spuren) {
    const range = ANSICHT.vorne + ANSICHT.hinten, dMin = camD - ANSICHT.hinten, A = ANSICHT.schraeg, K = 1 - A / 2;
    const unten = sicht.y + sicht.h, oben = sicht.y + sicht.h * ANSICHT.himmel, Lr = unten - oben;
    const pxm = sicht.w / ANSICHT.breite, cx = sicht.x + sicht.w / 2;
    const k0 = strecke ? strecke.kurve(camD) : 0;
    const P = {
      sicht, camD, dMin, dMax: dMin + range, range, unten, oben, pxm, cx, halb: strassenHalbe(spuren), spuren,
      t: d => (d - dMin) / range,
      s: d => 1 - A * ((d - dMin) / range),
      y(d) { const t = (d - dMin) / range; return unten - Lr * (t - A * t * t / 2) / K; },
      x(d, x) { const t = (d - dMin) / range; return cx + (x + (strecke ? strecke.kurve(d) : 0) - k0) * pxm * (1 - A * t); },
      laengs(d) { const t = (d - dMin) / range; return Lr * (1 - A * t) / (K * range); },
      // Einblenden ganz oben (Horizont), damit nichts plötzlich auftaucht
      alpha(d) { return klemme((dMin + range - d) / ANSICHT.einblenden, 0, 1); },
    };
    return P;
  }

  // ---------- Grundformen ----------
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function quad(c, a, b, d, e, farbe) {
    c.fillStyle = farbe; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath(); c.fill();
  }

  // ===================================================================
  // FAHRZEUGE – alle frei erfunden. Gezeichnet in Einheiten der Fahrzeugbreite:
  // x ∈ [-0,5; 0,5], Länge L (vorne = oben), darunter das sichtbare Heck (Höhe H).
  // ===================================================================
  const H = 0.3;
  function schatten(c, L) {
    c.fillStyle = 'rgba(4, 6, 18, 0.45)';
    rr(c, -0.56, -L / 2 + 0.06, 1.12, L + H + 0.06, 0.25); c.fill();
  }
  function heckLeuchten(c, L, farbe, art) {
    c.fillStyle = farbe;
    if (art === 'rund') { for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 0.32, L / 2 + H * 0.45, 0.07, 0, 7); c.fill(); } }
    else if (art === 'hoch') { for (const s of [-1, 1]) { rr(c, s * 0.42 - 0.04, L / 2 + 0.02, 0.08, H * 0.7, 0.03); c.fill(); } }
    else { for (const s of [-1, 1]) { rr(c, s * 0.38 - 0.09, L / 2 + H * 0.3, 0.18, 0.07, 0.03); c.fill(); } }
  }
  function blinker(c, L, seite, an) {
    if (!seite) return;
    c.fillStyle = an ? '#FFB22E' : 'rgba(255, 178, 46, 0.25)';
    rr(c, seite * 0.5 - (seite > 0 ? 0.13 : 0), L / 2 + H * 0.15, 0.13, H * 0.55, 0.04); c.fill();
    rr(c, seite * 0.5 - (seite > 0 ? 0.11 : 0), -L / 2 + 0.03, 0.11, 0.12, 0.04); c.fill();
    if (an) {
      // deutlicher Pfeil über dem Auto
      c.save(); c.translate(seite * 0.2, -L / 2 - 0.42);
      c.fillStyle = '#FFB22E'; c.strokeStyle = '#2A1A00'; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(seite * 0.34, 0); c.lineTo(seite * 0.04, -0.2); c.lineTo(seite * 0.04, -0.08); c.lineTo(-seite * 0.26, -0.08);
      c.lineTo(-seite * 0.26, 0.08); c.lineTo(seite * 0.04, 0.08); c.lineTo(seite * 0.04, 0.2); c.closePath(); c.stroke(); c.fill();
      c.restore();
    }
  }
  function raeder(c, L, breit = 0.06) {
    c.fillStyle = '#0B0B14';
    for (const s of [-1, 1]) for (const y of [-L * 0.3, L * 0.3]) { rr(c, s * (0.5 + breit / 2) - 0.07, y - 0.15, 0.14, 0.3, 0.05); c.fill(); }
  }

  // Der Kombi des Spielers: breit, dunkelviolett, türkise Akzente, eigenes Leuchtband
  function malKombi(c, L, o = {}) {
    const glanz = '#6A3BB8', basis = '#3B1C6B', dunkel = '#26113F', tuerkis = '#24D6CD', magenta = '#FF4FD8';
    if (!o.ohneSchatten) {
      // dezentes türkises Bodenleuchten macht den Spieler immer gut erkennbar
      const g = c.createRadialGradient(0, L * 0.1, 0.1, 0, L * 0.1, L * 0.75);
      g.addColorStop(0, 'rgba(36, 214, 205, 0.32)'); g.addColorStop(1, 'rgba(36, 214, 205, 0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, L * 0.12, 0.95, L * 0.7, 0, 0, 7); c.fill();
      schatten(c, L);
    }
    raeder(c, L, 0.1);
    // Karosserie mit breiten Kotflügeln
    c.fillStyle = basis;
    c.beginPath();
    c.moveTo(-0.4, -L / 2); c.lineTo(0.4, -L / 2);
    c.quadraticCurveTo(0.5, -L / 2, 0.5, -L / 2 + 0.16);
    c.lineTo(0.53, -L * 0.2); c.lineTo(0.5, L * 0.05); c.lineTo(0.54, L * 0.28); c.lineTo(0.52, L / 2);
    c.lineTo(-0.52, L / 2); c.lineTo(-0.54, L * 0.28); c.lineTo(-0.5, L * 0.05); c.lineTo(-0.53, -L * 0.2);
    c.lineTo(-0.5, -L / 2 + 0.16); c.quadraticCurveTo(-0.5, -L / 2, -0.4, -L / 2); c.closePath(); c.fill();
    // Motorhaube mit Glanzlinie
    c.fillStyle = glanz; rr(c, -0.3, -L / 2 + 0.05, 0.6, L * 0.17, 0.08); c.fill();
    // Seitenstreifen türkis
    c.fillStyle = tuerkis;
    for (const s of [-1, 1]) { rr(c, s * 0.5 - (s > 0 ? 0.05 : 0), -L * 0.2, 0.05, L * 0.62, 0.02); c.fill(); }
    // Langes Kombidach mit Scheiben
    c.fillStyle = '#121A33'; rr(c, -0.38, -L * 0.27, 0.76, L * 0.74, 0.12); c.fill();
    c.fillStyle = '#4A2585'; rr(c, -0.32, -L * 0.15, 0.64, L * 0.5, 0.08); c.fill();
    c.fillStyle = 'rgba(36, 214, 205, 0.55)'; c.fillRect(-0.3, -L * 0.24, 0.6, 0.03);   // Spiegelung Frontscheibe
    // Dachreling
    c.fillStyle = tuerkis; for (const s of [-1, 1]) c.fillRect(s * 0.27 - 0.02, -L * 0.13, 0.04, L * 0.44);
    // Dachspoiler
    c.fillStyle = dunkel; rr(c, -0.4, L * 0.42, 0.8, 0.07, 0.03); c.fill();
    c.fillStyle = magenta; c.fillRect(-0.4, L * 0.42, 0.05, 0.07); c.fillRect(0.35, L * 0.42, 0.05, 0.07);
    // Heck (sichtbare Fläche) mit eigenem Leuchtband: Pfeilsegmente türkis, Enden magenta
    c.fillStyle = dunkel; rr(c, -0.52, L / 2 - 0.04, 1.04, H + 0.04, 0.09); c.fill();
    c.fillStyle = '#0D0A1A'; rr(c, -0.36, L / 2 + 0.01, 0.72, H * 0.38, 0.05); c.fill();   // Heckscheibe
    const yb = L / 2 + H * 0.5, hb = H * 0.26;
    c.fillStyle = 'rgba(36, 214, 205, 0.25)'; rr(c, -0.5, yb - 0.04, 1.0, hb + 0.08, 0.05); c.fill();
    c.fillStyle = tuerkis;
    for (let i = -3; i <= 3; i++) {
      const xx = i * 0.11, r = i < 0 ? 1 : -1;
      c.beginPath(); c.moveTo(xx - 0.035 * r, yb); c.lineTo(xx + 0.04 - 0.035 * r, yb); c.lineTo(xx + 0.04 + 0.035 * r, yb + hb / 2);
      c.lineTo(xx + 0.04 - 0.035 * r, yb + hb); c.lineTo(xx - 0.035 * r, yb + hb); c.lineTo(xx + 0.035 * r, yb + hb / 2); c.closePath(); c.fill();
    }
    c.fillStyle = magenta;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.5, yb - 0.02); c.lineTo(s * 0.4, yb + hb / 2); c.lineTo(s * 0.5, yb + hb + 0.02); c.closePath(); c.fill(); }
    // Diffusor
    c.fillStyle = '#0D0A1A'; rr(c, -0.3, L / 2 + H * 0.84, 0.6, H * 0.14, 0.03); c.fill();
    if (o.boost) {
      // dezente Auspuffflammen
      for (const s of [-0.18, 0.18]) {
        const f = 0.7 + 0.3 * Math.sin((o.zeit || 0) * 40 + s * 10);
        c.fillStyle = 'rgba(255, 154, 61, 0.9)';
        c.beginPath(); c.moveTo(s - 0.05, L / 2 + H); c.lineTo(s + 0.05, L / 2 + H); c.lineTo(s, L / 2 + H + 0.22 * f); c.closePath(); c.fill();
        c.fillStyle = 'rgba(36, 214, 205, 0.95)';
        c.beginPath(); c.moveTo(s - 0.025, L / 2 + H); c.lineTo(s + 0.025, L / 2 + H); c.lineTo(s, L / 2 + H + 0.12 * f); c.closePath(); c.fill();
      }
    }
    // feine helle Kontur
    c.strokeStyle = 'rgba(181, 140, 255, 0.9)'; c.lineWidth = 0.03;
    rr(c, -0.53, -L / 2, 1.06, L + H, 0.14); c.stroke();
  }

  function malVerkehr(c, a, L, o) {
    const typ = a.typ;
    schatten(c, L);
    if (typ === 'laster') {
      const farbe = CONTAINER[a.farbe % CONTAINER.length];
      raeder(c, L, 0.02);
      // Führerhaus vorne
      c.fillStyle = '#C9D1E0'; rr(c, -0.46, -L / 2, 0.92, 0.75, 0.12); c.fill();
      c.fillStyle = '#1B2238'; rr(c, -0.36, -L / 2 + 0.08, 0.72, 0.2, 0.06); c.fill();
      // Container mit Rippen
      c.fillStyle = farbe; rr(c, -0.5, -L / 2 + 0.8, 1, L - 0.8, 0.04); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.025;
      for (let y = -L / 2 + 1.0; y < L / 2 - 0.1; y += 0.32) { c.beginPath(); c.moveTo(-0.46, y); c.lineTo(0.46, y); c.stroke(); }
      c.fillStyle = misch(farbe, '#000000', 0.35); rr(c, -0.5, L / 2 - 0.03, 1, H + 0.03, 0.04); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.03;
      for (const x of [-0.18, 0.18]) { c.beginPath(); c.moveTo(x, L / 2 + 0.03); c.lineTo(x, L / 2 + H - 0.03); c.stroke(); }
      heckLeuchten(c, L, '#FF4A5C', 'eckig');
    } else if (typ === 'bus') {
      raeder(c, L, 0.02);
      c.fillStyle = '#2F7DD1'; rr(c, -0.5, -L / 2, 1, L, 0.14); c.fill();
      c.fillStyle = '#E8F1FF'; rr(c, -0.4, -L / 2 + 0.25, 0.8, L - 0.5, 0.1); c.fill();
      c.fillStyle = '#9DB3D6'; for (let i = 0; i < 3; i++) { rr(c, -0.22, -L / 2 + L * (0.18 + i * 0.26), 0.44, L * 0.1, 0.05); c.fill(); }
      c.fillStyle = '#1C4E86'; rr(c, -0.5, L / 2 - 0.03, 1, H + 0.03, 0.08); c.fill();
      c.fillStyle = '#0D1B33'; rr(c, -0.38, L / 2 + 0.02, 0.76, H * 0.5, 0.04); c.fill();
      c.fillStyle = '#FFD35A'; c.font = `0.13px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', 0, L / 2 + H * 0.28);
      heckLeuchten(c, L, '#FF4A5C', 'hoch');
    } else if (typ === 'kasten') {
      raeder(c, L);
      c.fillStyle = '#D9DEE8'; rr(c, -0.5, -L / 2, 1, L, 0.1); c.fill();
      c.fillStyle = '#1B2238'; rr(c, -0.4, -L / 2 + 0.08, 0.8, 0.22, 0.08); c.fill();
      c.fillStyle = '#EEF1F6'; rr(c, -0.42, -L / 2 + 0.45, 0.84, L - 0.55, 0.06); c.fill();
      c.fillStyle = AUTO_FARBEN[a.farbe % 5]; c.fillRect(-0.5, -L / 2 + 0.6, 1, 0.12);
      c.fillStyle = '#AAB3C5'; rr(c, -0.5, L / 2 - 0.03, 1, H + 0.03, 0.06); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0, L / 2 + 0.02); c.lineTo(0, L / 2 + H - 0.02); c.stroke();
      heckLeuchten(c, L, '#FF4A5C', 'hoch');
    } else if (typ === 'taxi') {
      raeder(c, L);
      c.fillStyle = '#F2B33D'; rr(c, -0.5, -L / 2, 1, L, 0.2); c.fill();
      c.fillStyle = '#1B2238'; rr(c, -0.38, -L * 0.22, 0.76, L * 0.5, 0.12); c.fill();
      c.fillStyle = '#E0A02E'; rr(c, -0.33, -L * 0.1, 0.66, L * 0.28, 0.08); c.fill();
      // Dachschild mit Anker-Symbol (erfunden)
      c.fillStyle = '#FFF4DC'; rr(c, -0.18, -L * 0.02, 0.36, 0.13, 0.04); c.fill();
      c.strokeStyle = '#2A1A00'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0, -L * 0.02 + 0.02); c.lineTo(0, -L * 0.02 + 0.11); c.moveTo(-0.05, -L * 0.02 + 0.09); c.quadraticCurveTo(0, -L * 0.02 + 0.14, 0.05, -L * 0.02 + 0.09); c.stroke();
      c.fillStyle = '#C98A20'; rr(c, -0.5, L / 2 - 0.04, 1, H + 0.04, 0.1); c.fill();
      c.fillStyle = '#26231D'; c.fillRect(-0.5, L / 2 + H * 0.65, 1, 0.05);
      heckLeuchten(c, L, '#FF4A5C', 'eckig');
    } else {
      // Kugelflitzer: rund und freundlich
      raeder(c, L);
      const f = AUTO_FARBEN[a.farbe % 5];
      c.fillStyle = f; rr(c, -0.5, -L / 2, 1, L, 0.38); c.fill();
      c.fillStyle = '#1B2238'; c.beginPath(); c.ellipse(0, L * 0.02, 0.36, L * 0.3, 0, 0, 7); c.fill();
      c.fillStyle = misch(f, '#FFFFFF', 0.35); c.beginPath(); c.ellipse(0, L * 0.06, 0.26, L * 0.18, 0, 0, 7); c.fill();
      c.fillStyle = misch(f, '#000000', 0.3); rr(c, -0.48, L / 2 - 0.05, 0.96, H + 0.05, 0.14); c.fill();
      heckLeuchten(c, L, '#FF4A5C', 'rund');
    }
    blinker(c, L, o.blink, o.blinkAn);
  }

  // Streife: eigenes, stilisiertes Design (weiß/tiefblau, Lichtbalken)
  function malStreife(c, L, o) {
    schatten(c, L);
    if (o.licht > 0) {
      const g = c.createRadialGradient(0, -L * 0.05, 0.05, 0, -L * 0.05, 1.6);
      const farbe = o.phase ? '60, 120, 255' : '255, 79, 216';
      g.addColorStop(0, `rgba(${farbe}, ${0.32 * o.licht})`); g.addColorStop(1, `rgba(${farbe}, 0)`);
      c.fillStyle = g; c.beginPath(); c.ellipse(0, -L * 0.05, 1.5, 1.1, 0, 0, 7); c.fill();
    }
    raeder(c, L);
    c.fillStyle = '#EEF2F7'; rr(c, -0.5, -L / 2, 1, L, 0.18); c.fill();
    c.fillStyle = '#1F3E8C'; rr(c, -0.5, -L / 2, 1, L * 0.26, 0.18); c.fill(); c.fillRect(-0.5, L * 0.2, 1, L * 0.3);
    c.fillStyle = '#1B2238'; rr(c, -0.38, -L * 0.22, 0.76, L * 0.48, 0.12); c.fill();
    c.fillStyle = '#D5DCE8'; rr(c, -0.32, -L * 0.12, 0.64, L * 0.26, 0.08); c.fill();
    // Lichtbalken
    c.fillStyle = '#0D1020'; rr(c, -0.4, -L * 0.06, 0.8, 0.13, 0.05); c.fill();
    const an = o.licht > 0;
    c.fillStyle = an && o.phase ? '#4E8DFF' : '#23345E'; rr(c, -0.38, -L * 0.05, 0.36, 0.11, 0.04); c.fill();
    c.fillStyle = an && !o.phase ? '#FF4FD8' : '#4A2248'; rr(c, 0.02, -L * 0.05, 0.36, 0.11, 0.04); c.fill();
    c.fillStyle = '#18306E'; rr(c, -0.5, L / 2 - 0.04, 1, H + 0.04, 0.1); c.fill();
    c.fillStyle = '#EEF2F7';
    for (let i = 0; i < 5; i++) c.fillRect(-0.45 + i * 0.2, L / 2 + H * 0.6, 0.1, 0.05);
    heckLeuchten(c, L, '#FF4A5C', 'eckig');
    if (o.fragend > 0.3) {
      c.fillStyle = '#FFF4DC'; c.font = `0.4px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('?', 0, -L / 2 - 0.45);
    }
  }

  // Fahrzeug an Weltposition zeichnen
  function zeichneFahrzeug(c, P, f, art, o = {}) {
    const ad = f.d, ax = f.x;
    if (ad < P.dMin - 8 || ad > P.dMax + 2) return;
    const s = P.s(ad), w = f.breite * P.pxm * s, len = f.laenge * P.laengs(ad);
    const X = P.x(ad, ax), Y = P.y(ad);
    const L = Math.max(0.6, len / w);
    c.save();
    c.globalAlpha = P.alpha(ad + f.laenge / 2) * (o.alpha == null ? 1 : o.alpha);
    c.translate(X, Y);
    if (o.wackel) c.rotate(Math.sin(o.wackel * 18) * 0.06 * o.wackel);
    if (o.neigung) c.rotate(o.neigung);
    c.scale(w, w);
    c.translate(0, -H * 0.4);
    if (art === 'spieler') malKombi(c, L, o);
    else if (art === 'streife') malStreife(c, L, o);
    else malVerkehr(c, f, L, o);
    c.restore();
  }

  // ===================================================================
  // STRECKE: Boden, Straße, Markierungen, Kulisse
  // ===================================================================
  function paletteBei(strecke, d) {
    if (!strecke) return PALETTEN.hafen;
    const t = strecke.abschnittBei(d);
    const p = PALETTEN[t.licht];
    const i = strecke.teile.indexOf(t);
    // weicher Übergang 60 m um jede Grenze
    const zumEnde = t.bis - d, vomAnfang = d - t.von;
    if (zumEnde < 60 && strecke.teile[i + 1]) return { ...p, mix: PALETTEN[strecke.teile[i + 1].licht], mt: 0.5 - zumEnde / 120 };
    if (vomAnfang < 60 && strecke.teile[i - 1]) return { ...p, mix: PALETTEN[strecke.teile[i - 1].licht], mt: 0.5 - vomAnfang / 120 };
    return p;
  }
  const farbeAus = (p, name) => (p.mix && p.mix[name] && p[name] ? misch(p[name], p.mix[name], p.mt) : p[name] || p.rand);

  function himmel(c, P, breite, hoehe, zeit, licht) {
    const g = c.createLinearGradient(0, 0, 0, P.oben + 10);
    g.addColorStop(0, '#070B1F'); g.addColorStop(0.6, '#1A1240'); g.addColorStop(1, licht === 'neon' ? '#4A1E5E' : licht === 'tunnel' ? '#2A1E3A' : '#2B2353');
    c.fillStyle = g; c.fillRect(0, 0, breite, P.oben + 2);
    // Mond und Skyline (ruhig, bewegt sich nur leicht mit der Kurve)
    const k = P.cx;
    c.fillStyle = 'rgba(255, 244, 220, 0.85)'; c.beginPath(); c.arc(k + P.sicht.w * 0.32, P.oben - P.sicht.h * 0.045 - 6, Math.max(6, P.sicht.w * 0.025), 0, 7); c.fill();
    c.fillStyle = '#0E0B26';
    const basis = P.oben + 1;
    for (let i = -14; i <= 14; i++) {
      const h = (8 + hash(i + 40) * 22) * P.pxm / 18, bw = (14 + hash(i + 3) * 18) * P.pxm / 18;
      c.fillRect(k + i * 24 * P.pxm / 18 - bw / 2, basis - h, bw, h);
      if (hash(i + 7) > 0.55) { c.fillStyle = hash(i) > 0.5 ? 'rgba(255, 211, 90, 0.6)' : 'rgba(36, 214, 205, 0.55)'; c.fillRect(k + i * 24 * P.pxm / 18 - 1, basis - h + 3, 2, 2); c.fillStyle = '#0E0B26'; }
    }
    // Kräne am Horizont
    c.strokeStyle = '#1A1538'; c.lineWidth = Math.max(1.5, P.pxm * 0.12);
    for (const q of [-0.42, 0.36]) {
      const x0 = k + q * P.sicht.w, hh = P.sicht.h * 0.06;
      c.beginPath(); c.moveTo(x0, basis); c.lineTo(x0, basis - hh); c.lineTo(x0 + q * 60, basis - hh); c.moveTo(x0 - 10, basis - hh); c.lineTo(x0, basis - hh - 8); c.stroke();
    }
    // Horizontleuchten
    const hg = c.createLinearGradient(0, P.oben - 18, 0, P.oben + 6);
    hg.addColorStop(0, 'rgba(255, 79, 216, 0)'); hg.addColorStop(1, licht === 'neon' ? 'rgba(255, 79, 216, 0.35)' : 'rgba(255, 154, 61, 0.18)');
    c.fillStyle = hg; c.fillRect(0, P.oben - 18, breite, 24);
  }

  function boden(c, P, strecke, breite) {
    const halb = P.halb, schulter = 1.6;
    const schritt = 1.5;
    let d1 = P.dMax;
    let yAlt = P.y(d1);
    for (let d = P.dMax - schritt; d >= P.dMin - schritt * 2; d -= schritt) {
      const y = P.y(d);
      const pal = paletteBei(strecke, d + schritt / 2);
      const art = strecke ? strecke.abschnittBei(d).licht : 'hafen';
      // Boden über die ganze Breite (Wasser an Brücke und Kai)
      c.fillStyle = art === 'bruecke' ? farbeAus(pal, 'wasser') : farbeAus(pal, 'boden');
      c.fillRect(0, yAlt - 0.5, breite, y - yAlt + 1);
      if (art === 'hafen') {
        // links das Hafenbecken
        const xl = P.x(d, -halb - schulter - 4.5), xl2 = P.x(d1, -halb - schulter - 4.5);
        quad(c, [0, yAlt - 0.5], [xl2, yAlt - 0.5], [xl, y + 0.5], [0, y + 0.5], farbeAus(pal, 'wasser'));
      }
      // Bankett und Fahrbahn
      const L1 = P.x(d1, -halb - schulter), R1 = P.x(d1, halb + schulter), L0 = P.x(d, -halb - schulter), R0 = P.x(d, halb + schulter);
      quad(c, [L1, yAlt], [R1, yAlt], [R0, y + 0.6], [L0, y + 0.6], farbeAus(pal, 'rand'));
      const l1 = P.x(d1, -halb), r1 = P.x(d1, halb), l0 = P.x(d, -halb), r0 = P.x(d, halb);
      const streifen = Math.floor(d / 8) % 2 === 0;
      quad(c, [l1, yAlt], [r1, yAlt], [r0, y + 0.6], [l0, y + 0.6], farbeAus(pal, streifen ? 'asphalt' : 'asphalt2'));
      // Tunnelwände / Brückengeländer / Leitplanken als niedrige Wände
      if (art === 'tunnel') {
        const hw = 3.2 * P.pxm * P.s(d);
        const wand = farbeAus(pal, 'wand' in pal ? 'wand' : 'rand');
        quad(c, [L1, yAlt], [L1 - hw * 0.35, yAlt - hw], [L0 - hw * 0.35, y - hw], [L0, y + 0.6], wand);
        quad(c, [R1, yAlt], [R1 + hw * 0.35, yAlt - hw], [R0 + hw * 0.35, y - hw], [R0, y + 0.6], wand);
      }
      yAlt = y; d1 = d;
    }
  }

  function markierungen(c, P, strecke) {
    const halb = P.halb, sp = P.spuren;
    const strich = 6, luecke = 9, periode = strich + luecke;
    const breite = 0.15;
    const d0 = Math.floor(P.dMin / periode) * periode;
    for (let i = 1; i < sp; i++) {
      const x = -halb + i * SPUR;
      for (let d = d0; d < P.dMax; d += periode) {
        const a = Math.max(d, P.dMin), b = Math.min(d + strich, P.dMax);
        if (b <= a) continue;
        c.globalAlpha = P.alpha(b);
        const pal = paletteBei(strecke, a);
        quad(c, [P.x(a, x - breite), P.y(a)], [P.x(a, x + breite), P.y(a)], [P.x(b, x + breite), P.y(b)], [P.x(b, x - breite), P.y(b)], farbeAus(pal, 'markierung'));
      }
    }
    // durchgezogene Randlinien
    c.globalAlpha = 1;
    for (const x of [-halb + 0.25, halb - 0.25]) {
      c.beginPath();
      for (let d = P.dMin; d <= P.dMax; d += 2) { const X = P.x(d, x), Y = P.y(d); if (d === P.dMin) c.moveTo(X, Y); else c.lineTo(X, Y); }
      c.strokeStyle = 'rgba(241, 238, 227, 0.75)'; c.lineWidth = Math.max(1.5, 0.18 * P.pxm); c.stroke();
    }
  }

  // zurückhaltende Lichtreflexe der Laternen auf der Straße
  function lichtpfuetzen(c, P, strecke) {
    c.save(); c.globalCompositeOperation = 'lighter';
    let d = P.dMin - 10;
    while (d < P.dMax) {
      const pal = paletteBei(strecke, d);
      const ab = pal.lichtAbstand;
      const dd = Math.ceil(d / ab) * ab;
      if (dd > P.dMax) break;
      for (const seite of [-1, 1]) {
        const x = seite * (P.halb - 1.4), X = P.x(dd, x), Y = P.y(dd), r = 4.2 * P.pxm * P.s(dd);
        const g = c.createRadialGradient(X, Y, 0, X, Y, r);
        g.addColorStop(0, rgba(pal.licht, 0.075 * P.alpha(dd))); g.addColorStop(1, rgba(pal.licht, 0));
        c.fillStyle = g; c.beginPath(); c.ellipse(X, Y, r, r * 0.45, 0, 0, 7); c.fill();
      }
      d = dd + 0.01;
    }
    c.restore();
  }

  // Kulisse: Objekte entlang der Strecke, je Abschnittsart. Liefert Zeichenaufträge mit d.
  function kulisse(P, strecke, liste) {
    const halb = P.halb;
    const lauf = (abstand, versatz, fn) => {
      for (let d = Math.ceil((P.dMin - 12 - versatz) / abstand) * abstand + versatz; d < P.dMax + 4; d += abstand) fn(d, Math.round(d / abstand));
    };
    const art = d => (strecke ? strecke.abschnittBei(d).licht : 'hafen');
    // Laternen
    lauf(8, 0, (d0) => {
      const pal = paletteBei(strecke, d0);
      if (Math.round(d0) % pal.lichtAbstand !== 0) return;
      const a = art(d0);
      for (const seite of [-1, 1]) liste.push({ d: d0, mal: c => laterne(c, P, d0, seite * (halb + 1.0), seite, pal.licht, a) });
    });
    lauf(30, 13, (d, n) => {
      const a = art(d);
      if (a === 'hafen') {
        if (n % 2 === 0) liste.push({ d, mal: c => containerStapel(c, P, d, halb + 4 + hash(n) * 3, n) });
        if (n % 5 === 0) liste.push({ d, mal: c => kran(c, P, d, -halb - 9, n) });
        if (n % 3 === 1) liste.push({ d, mal: c => lagerhaus(c, P, d, halb + 9, n, '#2A2550') });
      } else if (a === 'autobahn') {
        if (n % 2 === 0) for (const s of [-1, 1]) liste.push({ d, mal: c => laermschutz(c, P, d, s * (halb + 2.6)) });
        if (n % 13 === 0) liste.push({ d, mal: c => schilderbruecke(c, P, d, n) });
        if (n % 4 === 1) liste.push({ d, mal: c => lagerhaus(c, P, d, halb + 8, n, '#232849') });
      } else if (a === 'bruecke') {
        if (n % 5 === 0) for (const s of [-1, 1]) liste.push({ d, mal: c => pylon(c, P, d, s * (halb + 1.2), s) });
        if (n % 3 === 0) liste.push({ d, mal: c => boje(c, P, d, (n % 2 ? -1 : 1) * (halb + 6 + hash(n) * 5)) });
      } else if (a === 'neon') {
        if (n % 2 === 0) liste.push({ d, mal: c => fabrik(c, P, d, halb + 6, n, 1) });
        if (n % 2 === 1) liste.push({ d, mal: c => fabrik(c, P, d, -halb - 6, n, -1) });
        if (n % 3 === 0) liste.push({ d, mal: c => neonschild(c, P, d, (n % 2 ? -1 : 1) * (halb + 2.4), n) });
      } else if (a === 'tunnel') {
        // Tunnelportal am Anfang
      }
    });
    // Tunnelportale und Leuchtbänder
    if (strecke) for (const t of strecke.teile) {
      if (t.licht === 'tunnel') {
        if (t.von > P.dMin - 5 && t.von < P.dMax + 5) liste.push({ d: t.von, mal: c => portal(c, P, t.von) });
      }
    }
  }

  function aufrecht(P, d, x, hoeheM) {
    const s = P.s(d);
    return { X: P.x(d, x), Y: P.y(d), h: hoeheM * P.pxm * s * 0.8, s, a: P.alpha(d) };
  }
  function laterne(c, P, d, x, seite, licht, art) {
    if (art === 'tunnel') {
      // Tunnelleuchten oben an der Wand
      const o = aufrecht(P, d, x + seite * 0.5, 3.0);
      c.globalAlpha = o.a; c.fillStyle = licht; c.fillRect(o.X - 3 * o.s, o.Y - o.h, 6 * o.s, 3 * o.s);
      c.fillStyle = rgba(licht, 0.25); c.beginPath(); c.arc(o.X, o.Y - o.h, 9 * o.s, 0, 7); c.fill();
      c.globalAlpha = 1; return;
    }
    const o = aufrecht(P, d, x, 7);
    c.globalAlpha = o.a;
    c.strokeStyle = '#3A3F5E'; c.lineWidth = Math.max(1, 0.18 * P.pxm * o.s);
    c.beginPath(); c.moveTo(o.X, o.Y); c.lineTo(o.X, o.Y - o.h); c.lineTo(o.X - seite * 1.2 * P.pxm * o.s, o.Y - o.h); c.stroke();
    c.fillStyle = licht; c.beginPath(); c.arc(o.X - seite * 1.2 * P.pxm * o.s, o.Y - o.h + 1, Math.max(1.5, 0.3 * P.pxm * o.s), 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  function containerStapel(c, P, d, x, n) {
    const o = aufrecht(P, d, x, 2.6), w = 2.5 * P.pxm * o.s, l = 9 * P.laengs(d);
    c.globalAlpha = o.a;
    for (let i = 0; i < 1 + (n % 3); i++) {
      const f = CONTAINER[(n + i) % CONTAINER.length];
      c.fillStyle = misch(f, '#0A0F24', 0.45); c.fillRect(o.X - w / 2, o.Y - o.h * (i + 1) - l, w * 1.0, l);
      c.fillStyle = misch(f, '#0A0F24', 0.6); c.fillRect(o.X - w / 2, o.Y - o.h * (i + 1), w, o.h);
    }
    c.globalAlpha = 1;
  }
  function kran(c, P, d, x, n) {
    const o = aufrecht(P, d, x, 26);
    c.globalAlpha = o.a * 0.9;
    c.strokeStyle = '#3B2F63'; c.lineWidth = Math.max(1.5, 0.35 * P.pxm * o.s);
    const b = 3 * P.pxm * o.s;
    c.beginPath(); c.moveTo(o.X - b, o.Y); c.lineTo(o.X - b * 0.6, o.Y - o.h); c.moveTo(o.X + b, o.Y); c.lineTo(o.X + b * 0.6, o.Y - o.h);
    c.moveTo(o.X + b * 1.5, o.Y - o.h); c.lineTo(o.X - b * 4.5, o.Y - o.h); c.stroke();
    c.fillStyle = '#FF9A3D'; c.beginPath(); c.arc(o.X - b * 4.5, o.Y - o.h, Math.max(1.5, 2 * o.s), 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  function lagerhaus(c, P, d, x, n, farbe) {
    const o = aufrecht(P, d, x, 6), w = 8 * P.pxm * o.s, l = 16 * P.laengs(d);
    c.globalAlpha = o.a;
    c.fillStyle = farbe; c.fillRect(o.X - w / 2, o.Y - o.h - l, w, l);
    c.fillStyle = misch(farbe, '#000000', 0.3); c.fillRect(o.X - w / 2, o.Y - o.h, w, o.h);
    c.fillStyle = 'rgba(255, 211, 90, 0.55)'; for (let i = 0; i < 3; i++) c.fillRect(o.X - w / 2 + w * (0.15 + i * 0.3), o.Y - o.h * 0.7, w * 0.12, o.h * 0.25);
    c.globalAlpha = 1;
  }
  function laermschutz(c, P, d, x) {
    const o = aufrecht(P, d, x, 2.4), l = 30 * P.laengs(d);
    c.globalAlpha = o.a * 0.9; c.fillStyle = '#24294A'; c.fillRect(o.X - 2, o.Y - o.h - l * 0.1, 4, o.h);
    c.fillStyle = '#2C3258'; c.fillRect(o.X - 1.5, o.Y - o.h - l, 3, l); c.globalAlpha = 1;
  }
  function schilderbruecke(c, P, d, n) {
    const halb = P.halb + 1.2, a = aufrecht(P, d, -halb, 6), b = aufrecht(P, d, halb, 6);
    c.globalAlpha = a.a;
    c.strokeStyle = '#4A5070'; c.lineWidth = Math.max(1.5, 0.2 * P.pxm * a.s);
    c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(a.X, a.Y - a.h); c.lineTo(b.X, b.Y - b.h); c.lineTo(b.X, b.Y); c.stroke();
    const namen = ['KAI NORD', 'LAGERDOCK', 'SPEICHERSTADT', 'WERFTRING', 'LEUCHTTURM'];
    const sw = (b.X - a.X) * 0.42, sh = 1.4 * P.pxm * a.s;
    c.fillStyle = '#1F5E9E'; rr(c, a.X + (b.X - a.X) * 0.08, a.Y - a.h - sh * 0.5, sw, sh, 3); c.fill();
    c.fillStyle = '#EAF2FF'; c.font = `${Math.max(5, sh * 0.42)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(namen[Math.abs(n) % namen.length], a.X + (b.X - a.X) * 0.08 + sw / 2, a.Y - a.h, sw * 0.9);
    c.globalAlpha = 1;
  }
  function pylon(c, P, d, x, s) {
    const o = aufrecht(P, d, x, 18);
    c.globalAlpha = o.a;
    c.strokeStyle = '#B9C4E0'; c.lineWidth = Math.max(1, 0.06 * P.pxm * o.s);
    for (let i = 1; i <= 3; i++) { c.beginPath(); c.moveTo(o.X, o.Y - o.h * 0.95); c.lineTo(o.X, o.Y - o.h * 0.2 * i); c.lineTo(P.x(d - 12 * i, x), P.y(d - 12 * i)); c.stroke(); }
    c.fillStyle = '#5C6A92'; c.fillRect(o.X - 0.4 * P.pxm * o.s, o.Y - o.h, 0.8 * P.pxm * o.s, o.h);
    c.fillStyle = '#FF4A5C'; c.beginPath(); c.arc(o.X, o.Y - o.h, Math.max(1.5, 0.35 * P.pxm * o.s), 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  function boje(c, P, d, x) {
    const o = aufrecht(P, d, x, 1.2);
    c.globalAlpha = o.a * 0.8;
    c.fillStyle = 'rgba(159, 215, 255, 0.18)'; c.beginPath(); c.ellipse(o.X, o.Y, 1.6 * P.pxm * o.s, 0.5 * P.pxm * o.s, 0, 0, 7); c.fill();
    c.fillStyle = '#FF9A3D'; c.fillRect(o.X - 2 * o.s, o.Y - o.h, 4 * o.s, o.h);
    c.globalAlpha = 1;
  }
  function fabrik(c, P, d, x, n, seite) {
    const o = aufrecht(P, d, x, 7 + hash(n) * 5), w = 7 * P.pxm * o.s, l = 18 * P.laengs(d);
    c.globalAlpha = o.a;
    c.fillStyle = '#1E1838'; c.fillRect(o.X - w / 2, o.Y - o.h - l, w, l);
    c.fillStyle = '#16112B'; c.fillRect(o.X - w / 2, o.Y - o.h, w, o.h);
    c.fillStyle = '#16112B'; c.fillRect(o.X + seite * w * 0.2, o.Y - o.h * 1.8 - l * 0.4, w * 0.12, o.h);
    // Neonröhren an der Front
    c.fillStyle = n % 2 ? '#FF4FD8' : '#24D6CD';
    c.fillRect(o.X - w * 0.4, o.Y - o.h * 0.8, w * 0.8, Math.max(1, 0.12 * P.pxm * o.s));
    c.globalAlpha = 1;
  }
  function neonschild(c, P, d, x, n) {
    const o = aufrecht(P, d, x, 5), w = 4 * P.pxm * o.s, h = 1.4 * P.pxm * o.s;
    const texte = ['NACHTKIOSK', 'DOCK 9', 'FUNKEN', 'NEON', 'WERFT'];
    const f = n % 2 ? '#FF4FD8' : '#24D6CD';
    c.globalAlpha = o.a;
    c.strokeStyle = '#3A3158'; c.lineWidth = Math.max(1, 0.15 * P.pxm * o.s); c.beginPath(); c.moveTo(o.X, o.Y); c.lineTo(o.X, o.Y - o.h); c.stroke();
    c.fillStyle = '#120D24'; rr(c, o.X - w / 2, o.Y - o.h - h, w, h, 3); c.fill();
    c.strokeStyle = f; c.lineWidth = Math.max(1, h * 0.1); rr(c, o.X - w / 2, o.Y - o.h - h, w, h, 3); c.stroke();
    c.fillStyle = f; c.font = `${Math.max(4, h * 0.4)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(texte[Math.abs(n) % texte.length], o.X, o.Y - o.h - h / 2, w * 0.9);
    c.globalAlpha = 1;
  }
  function portal(c, P, d) {
    const halb = P.halb + 1.6, a = aufrecht(P, d, -halb, 5.5), b = aufrecht(P, d, halb, 5.5);
    c.globalAlpha = a.a;
    c.fillStyle = '#2B2240';
    c.fillRect(a.X - 2 * P.pxm * a.s, a.Y - a.h - 1.2 * P.pxm * a.s, b.X - a.X + 4 * P.pxm * a.s, 1.2 * P.pxm * a.s);
    c.fillStyle = '#FFC46B'; c.fillRect(a.X, a.Y - a.h - 0.3 * P.pxm * a.s, b.X - a.X, 0.25 * P.pxm * a.s);
    c.globalAlpha = 1;
  }

  // Streckenmarke (Überkopf-Banner) und Zielbereich
  function marke(c, P, d, text) {
    const halb = P.halb + 1.0, a = aufrecht(P, d, -halb, 5.2), b = aufrecht(P, d, halb, 5.2);
    if (d < P.dMin || d > P.dMax) return;
    c.globalAlpha = a.a;
    c.strokeStyle = '#7A6BB0'; c.lineWidth = Math.max(1.5, 0.22 * P.pxm * a.s);
    c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(a.X, a.Y - a.h); c.moveTo(b.X, b.Y); c.lineTo(b.X, b.Y - b.h); c.stroke();
    const h = 1.5 * P.pxm * a.s;
    c.fillStyle = '#1A1238'; rr(c, a.X, a.Y - a.h - h / 2, b.X - a.X, h, 4); c.fill();
    c.strokeStyle = '#24D6CD'; c.lineWidth = Math.max(1, h * 0.08); rr(c, a.X, a.Y - a.h - h / 2, b.X - a.X, h, 4); c.stroke();
    c.fillStyle = '#24D6CD'; c.font = `${Math.max(5, h * 0.36)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, (a.X + b.X) / 2, a.Y - a.h, (b.X - a.X) * 0.92);
    // Linie über die Fahrbahn
    c.fillStyle = 'rgba(36, 214, 205, 0.55)';
    quad(c, [P.x(d, -P.halb), P.y(d)], [P.x(d, P.halb), P.y(d)], [P.x(d + 0.8, P.halb), P.y(d + 0.8)], [P.x(d + 0.8, -P.halb), P.y(d + 0.8)], 'rgba(36, 214, 205, 0.55)');
    c.globalAlpha = 1;
  }
  function zielFlaeche(c, P, von, bis) {
    const a = Math.max(von, P.dMin), b = Math.min(bis + 40, P.dMax);
    if (b <= a) return;
    for (let d = Math.floor(a / 2) * 2; d < b; d += 2) {
      for (let i = 0; i < P.spuren * 2; i++) {
        if ((i + d / 2) % 2 !== 0) continue;
        const x0 = -P.halb + i * SPUR / 2, x1 = x0 + SPUR / 2;
        c.globalAlpha = 0.22 * P.alpha(d);
        quad(c, [P.x(d, x0), P.y(d)], [P.x(d, x1), P.y(d)], [P.x(d + 2, x1), P.y(d + 2)], [P.x(d + 2, x0), P.y(d + 2)], '#FFD35A');
      }
    }
    c.globalAlpha = 1;
  }
  function zielTor(c, P, d) {
    if (d < P.dMin - 2 || d > P.dMax) return;
    const halb = P.halb + 1.2, a = aufrecht(P, d, -halb, 6.5), b = aufrecht(P, d, halb, 6.5);
    c.globalAlpha = a.a;
    c.strokeStyle = '#FFD35A'; c.lineWidth = Math.max(2, 0.35 * P.pxm * a.s);
    c.beginPath(); c.moveTo(a.X, a.Y); c.lineTo(a.X, a.Y - a.h); c.lineTo(b.X, b.Y - b.h); c.lineTo(b.X, b.Y); c.stroke();
    const h = 1.8 * P.pxm * a.s;
    c.fillStyle = '#FFD35A'; rr(c, a.X + (b.X - a.X) * 0.12, a.Y - a.h - h * 0.6, (b.X - a.X) * 0.76, h, 4); c.fill();
    c.fillStyle = '#10243A'; c.font = `${Math.max(6, h * 0.42)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('ZIEL · HALLE 7', (a.X + b.X) / 2, a.Y - a.h - h * 0.1, (b.X - a.X) * 0.7);
    c.globalAlpha = 1;
  }

  // ===================================================================
  // PARTIKEL (begrenzt)
  // ===================================================================
  const MAX_PARTIKEL = 140;
  const welt = [];     // an der Straße: d, x, h (Höhe in m)
  const bild = [];     // im Coup-Bild: x, y in Bruchteilen der Sicht
  function partikel(liste, p) { if (liste.length >= MAX_PARTIKEL) liste.shift(); liste.push(p); }
  function weltPartikel(p) { partikel(welt, { leben: 0, dauer: 0.6, h: 0, vh: 0, vd: 0, vx: 0, groesse: 0.3, ...p }); }
  function bildPartikel(p) { partikel(bild, { leben: 0, dauer: 1, vx: 0, vy: 0, g: 0, groesse: 0.01, dreh: 0, ...p }); }
  function partikelSchritt(dt) {
    for (const L of [welt, bild]) {
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i]; p.leben += dt;
        if (p.leben >= p.dauer) { L.splice(i, 1); continue; }
        if (L === welt) { p.d += p.vd * dt; p.x += p.vx * dt; p.h += p.vh * dt; p.vh -= (p.g || 0) * dt; }
        else { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.dreh += (p.vdreh || 0) * dt; }
      }
    }
  }
  function partikelLeeren() { welt.length = 0; bild.length = 0; }
  function zeichneWeltPartikel(c, P) {
    for (const p of welt) {
      if (p.d < P.dMin || p.d > P.dMax) continue;
      const u = p.leben / p.dauer, s = P.s(p.d);
      const X = P.x(p.d, p.x), Y = P.y(p.d) - p.h * P.pxm * s * 0.8;
      const r = Math.max(1, p.groesse * P.pxm * s * (p.wachsen ? 1 + u * 1.5 : 1));
      c.globalAlpha = (1 - u) * (p.alpha || 1);
      c.fillStyle = p.farbe;
      if (p.art === 'funke') { c.fillRect(X - r / 2, Y - r / 2, r, r); }
      else { c.beginPath(); c.arc(X, Y, r, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
  }

  // Comic-Schriftzüge an der Straße („KLONK!“, „KNAPP!“)
  const sprechblasen = [];
  function blase(text, d, x, farbe = '#FFD35A', dauer = 0.9, groesse = 1) {
    if (sprechblasen.length > 6) sprechblasen.shift();
    sprechblasen.push({ text, d, x, farbe, leben: 0, dauer, groesse });
  }
  function blasenSchritt(dt) { for (let i = sprechblasen.length - 1; i >= 0; i--) { sprechblasen[i].leben += dt; if (sprechblasen[i].leben > sprechblasen[i].dauer) sprechblasen.splice(i, 1); } }
  function zeichneBlasen(c, P, spielerD) {
    for (const b of sprechblasen) {
      const d = b.d == null ? spielerD + 6 : b.d;
      if (d < P.dMin || d > P.dMax) continue;
      const u = b.leben / b.dauer, s = P.s(d);
      const X = P.x(d, b.x), Y = P.y(d) - (2.5 + u * 1.5) * P.pxm * s * 0.8;
      const gr = Math.max(9, 0.85 * P.pxm * s * b.groesse) * (u < 0.15 && !ruhig ? 0.6 + u / 0.15 * 0.4 : 1);
      c.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      c.font = `${gr}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = gr * 0.35; c.strokeStyle = '#10243A'; c.strokeText(b.text, X, Y);
      c.fillStyle = b.farbe; c.fillText(b.text, X, Y);
    }
    c.globalAlpha = 1;
  }

  // ===================================================================
  // FAHRT-SZENE
  // ===================================================================
  function zeichneFahrt(c, lay, F, zeit, extra = {}) {
    const { w, sp, strecke } = F;
    const camD = sp.d;
    const P = projektion(lay.sicht, camD, strecke, w.SP);
    const licht = strecke.abschnittBei(camD + 30).licht;
    c.save();
    // nichts unter die Steuerfläche zeichnen
    c.beginPath(); c.rect(0, 0, lay.breite, lay.sicht.y + lay.sicht.h); c.clip();
    // leichtes Rütteln nur bei Unfällen und nicht bei „weniger Bewegung“
    if (extra.ruetteln > 0 && !ruhig) c.translate(Math.sin(zeit * 70) * 2.5 * extra.ruetteln, Math.cos(zeit * 55) * 1.5 * extra.ruetteln);
    himmel(c, P, lay.breite, lay.hoehe, zeit, licht);
    boden(c, P, strecke, lay.breite);
    lichtpfuetzen(c, P, strecke);
    markierungen(c, P, strecke);
    zielFlaeche(c, P, strecke.zielVon, strecke.laenge);
    // Zeichenliste: Kulisse und Fahrzeuge, von hinten (weit vorne) nach vorne
    const liste = [];
    kulisse(P, strecke, liste);
    strecke.marken.forEach((md, i) => liste.push({ d: md, mal: cc => marke(cc, P, md, `MARKE ${i + 1}/${strecke.marken.length} · ${strecke.teile[i + 1].name.toUpperCase()}`) }));
    liste.push({ d: strecke.zielVon, mal: cc => zielTor(cc, P, strecke.zielVon) });
    const blinkAn = ruhig ? true : (zeit * 2.6) % 1 < 0.6;
    for (const a of w.autos) {
      const blink = a.wechsel ? Math.sign(a.wechsel.nach - a.wechsel.von) : 0;
      liste.push({ d: a.d, mal: cc => zeichneFahrzeug(cc, P, a, 'verkehr', { blink, blinkAn, wackel: a.wackel }) });
    }
    const phase = ruhig ? (zeit % 1.6) < 0.8 : (zeit * 5) % 2 < 1;
    for (const p of w.polizei) liste.push({ d: p.d, mal: cc => zeichneFahrzeug(cc, P, p, 'streife', { licht: w.phase === 'fahrt' ? 1 : 0.3, phase, wackel: p.wackel, fragend: p.fragend }) });
    const schutzBlink = sp.schutz > 0 && !ruhig && (zeit * 12) % 2 < 1;
    liste.push({ d: sp.d, spieler: true, mal: cc => zeichneFahrzeug(cc, P, sp, 'spieler', { neigung: sp.neigung, boost: sp.boostAn, zeit, alpha: schutzBlink ? 0.55 : 1 }) });
    liste.sort((a, b) => b.d - a.d || (a.spieler ? 1 : -1));
    for (const e of liste) e.mal(c);
    zeichneWeltPartikel(c, P);
    zeichneBlasen(c, P, sp.d);
    // Vorwarnung für Streifen: Pfeil am unteren Rand in der Spur
    for (const m of w.anmeldungen) {
      const X = P.x(sp.d - ANSICHT.hinten + 1, spurX(m.spur, w.SP)), Y = P.unten - 16;
      const u = 1 - m.rest / m.gesamt, puls = ruhig ? 1 : 0.6 + 0.4 * Math.sin(zeit * 12);
      c.globalAlpha = 0.6 + 0.4 * puls;
      c.fillStyle = '#4E8DFF'; c.strokeStyle = '#FFF4DC'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(X, Y - 18); c.lineTo(X + 14, Y + 2); c.lineTo(X - 14, Y + 2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#FF4FD8'; c.fillRect(X - 14, Y + 6, 28 * u, 4);
      c.font = `8px ${SCHRIFT}`; c.textAlign = 'center'; c.fillStyle = '#FFF4DC'; c.fillText('STREIFE', X, Y - 24);
      c.globalAlpha = 1;
    }
    c.restore();
    // Rand außerhalb des Sichtfensters abdunkeln (breite Bildschirme sehen nicht mehr)
    abdunkeln(c, lay);
    return P;
  }

  function abdunkeln(c, lay) {
    const s = lay.sicht;
    c.fillStyle = 'rgba(6, 10, 26, 0.72)';
    if (s.x > 0) { c.fillRect(0, 0, s.x, lay.hoehe); c.fillRect(s.x + s.w, 0, lay.breite - s.x - s.w, lay.hoehe); }
    // feine Rahmenlinie
    if (s.x > 2) {
      c.strokeStyle = 'rgba(47, 90, 133, 0.8)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(s.x, 0); c.lineTo(s.x, lay.hoehe); c.moveTo(s.x + s.w, 0); c.lineTo(s.x + s.w, lay.hoehe); c.stroke();
    }
  }

  // Ruhige Menükulisse: leere Straße, der Kombi rollt gemächlich
  function zeichneMenue(c, lay, zeit, strecke) {
    const fake = { d: zeit * 7, x: 0, laenge: SPIELER.laenge, breite: SPIELER.breite };
    const P = projektion(lay.sicht, fake.d, strecke, 4);
    himmel(c, P, lay.breite, lay.hoehe, zeit, 'hafen');
    boden(c, P, strecke, lay.breite);
    lichtpfuetzen(c, P, strecke);
    markierungen(c, P, strecke);
    const liste = [];
    kulisse(P, strecke, liste);
    liste.push({ d: fake.d, mal: cc => zeichneFahrzeug(cc, P, fake, 'spieler', {}) });
    liste.sort((a, b) => b.d - a.d);
    for (const e of liste) e.mal(c);
    abdunkeln(c, lay);
  }

  // Großes Titelbild: der Kombi als Hauptmotiv
  function zeichneTitel(c, w, h, zeit) {
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0B1030'); g.addColorStop(0.55, '#2A1850'); g.addColorStop(1, '#10243A');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // Neon-Horizont
    c.strokeStyle = 'rgba(255, 79, 216, 0.6)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w, h * 0.5); c.stroke();
    c.strokeStyle = 'rgba(36, 214, 205, 0.35)'; c.lineWidth = 1.5;
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(w / 2 + i * w * 0.04, h * 0.5); c.lineTo(w / 2 + i * w * 0.3, h); c.stroke(); }
    for (let i = 0; i < 4; i++) { const y = h * 0.5 + (h * 0.5) * Math.pow((i + 1) / 5, 1.6); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    // Kran-Silhouetten
    c.strokeStyle = '#1A1538'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(w * 0.12, h * 0.5); c.lineTo(w * 0.14, h * 0.18); c.lineTo(w * 0.34, h * 0.18); c.moveTo(w * 0.84, h * 0.5); c.lineTo(w * 0.82, h * 0.22); c.lineTo(w * 0.62, h * 0.22); c.stroke();
    // Kombi groß
    c.save();
    const bw = h * 0.36;
    c.translate(w / 2, h * 0.6); c.scale(bw, bw);
    malKombi(c, 1.15, { boost: true, zeit });
    c.restore();
  }

  // ===================================================================
  // COUP-SZENE (Phase 1): erfundenes Wertterminal, Timing-Anzeige, Beute
  // ===================================================================
  function zeichneCoup(c, lay, coup, zeit, extra = {}) {
    const s = lay.sicht, cc = coup.c;
    const W = s.w, Hh = s.h, ox = s.x, oy = s.y;
    const X = f => ox + f * W, Y = f => oy + f * Hh, E = W / 100;   // E: Einheit
    // Kulisse: Himmel, Wasser, Kai
    let g = c.createLinearGradient(0, oy, 0, oy + Hh);
    g.addColorStop(0, '#070B1F'); g.addColorStop(0.33, '#22164A'); g.addColorStop(0.34, '#0B1D3A'); g.addColorStop(0.5, '#0E2446'); g.addColorStop(0.51, '#1D2440'); g.addColorStop(1, '#141A33');
    c.fillStyle = g; c.fillRect(0, 0, lay.breite, lay.hoehe);
    c.fillStyle = 'rgba(255, 244, 220, 0.85)'; c.beginPath(); c.arc(X(0.82), Y(0.07), E * 4, 0, 7); c.fill();
    // Kräne und Containerschiff hinten (ruhig)
    c.strokeStyle = '#2A2052'; c.lineWidth = E * 0.9;
    c.beginPath(); c.moveTo(X(0.08), Y(0.33)); c.lineTo(X(0.1), Y(0.08)); c.lineTo(X(0.4), Y(0.08)); c.moveTo(X(0.18), Y(0.33)); c.lineTo(X(0.16), Y(0.08)); c.stroke();
    c.fillStyle = '#16123A'; c.fillRect(X(0.5), Y(0.28), W * 0.45, Hh * 0.06);
    for (let i = 0; i < 6; i++) { c.fillStyle = misch(CONTAINER[i % 5], '#0A0F24', 0.55); c.fillRect(X(0.52 + i * 0.07), Y(0.24), W * 0.06, Hh * 0.04); }
    // Wasserspiegelungen (fest, nicht flackernd)
    c.fillStyle = 'rgba(255, 211, 90, 0.18)';
    for (let i = 0; i < 9; i++) c.fillRect(X(0.05 + i * 0.11), Y(0.37 + (i % 3) * 0.035), W * 0.05, 2);
    // Kaikante
    c.fillStyle = '#2A3050'; c.fillRect(0, Y(0.5), lay.breite, Hh * 0.012);
    for (let i = 0; i < 12; i++) { c.fillStyle = '#F2B33D'; c.fillRect(X(i * 0.09), Y(0.512), W * 0.04, Hh * 0.006); }

    // --- Wertterminal (erfunden, comicartig) ---
    const tx = X(0.3), ty = Y(0.4), tw = W * 0.36, th = Hh * 0.22;
    const offen = cc.phase === 'oeffnen' || cc.phase === 'beute' || cc.phase === 'abfahrt' || cc.phase === 'fertig';
    const oeffnenU = cc.phase === 'oeffnen' ? Math.min(1, cc.phaseZeit / 0.5) : offen ? 1 : 0;
    c.fillStyle = 'rgba(4, 6, 18, 0.45)'; c.beginPath(); c.ellipse(tx, ty + th * 0.52, tw * 0.6, th * 0.08, 0, 0, 7); c.fill();
    c.fillStyle = '#1F4066'; rr(c, tx - tw / 2, ty - th / 2, tw, th, E * 2.5); c.fill();
    c.strokeStyle = '#24D6CD'; c.lineWidth = E * 0.6; rr(c, tx - tw / 2, ty - th / 2, tw, th, E * 2.5); c.stroke();
    // Antenne mit Lämpchen
    c.strokeStyle = '#B5CBE0'; c.lineWidth = E * 0.5; c.beginPath(); c.moveTo(tx + tw * 0.3, ty - th / 2); c.lineTo(tx + tw * 0.36, ty - th * 0.75); c.stroke();
    c.fillStyle = (ruhig || (zeit * 2) % 2 < 1) ? '#FF4FD8' : '#5A2050'; c.beginPath(); c.arc(tx + tw * 0.36, ty - th * 0.75, E * 1.1, 0, 7); c.fill();
    // Schild
    c.fillStyle = '#10243A'; rr(c, tx - tw * 0.42, ty - th * 0.44, tw * 0.84, th * 0.18, E); c.fill();
    c.fillStyle = '#FFD35A'; c.font = `${Math.max(7, E * 2.6)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('WERTTERMINAL', tx, ty - th * 0.35, tw * 0.8);
    // Drei Impuls-Lämpchen
    for (let i = 0; i < 3; i++) {
      const lx = tx - tw * 0.25 + i * tw * 0.25, ly = ty - th * 0.13;
      const an = i < cc.treffer;
      c.fillStyle = an ? '#24D6CD' : '#10243A'; c.beginPath(); c.arc(lx, ly, E * 2, 0, 7); c.fill();
      c.strokeStyle = an ? '#E8FFFD' : '#2F5A85'; c.lineWidth = E * 0.5; c.stroke();
      if (an) { c.fillStyle = 'rgba(36, 214, 205, 0.3)'; c.beginPath(); c.arc(lx, ly, E * 3.6, 0, 7); c.fill(); }
    }
    // Runde Comic-Klappe
    const kx = tx, ky = ty + th * 0.2, kr = th * 0.22;
    c.fillStyle = '#0D1B33'; c.beginPath(); c.arc(kx, ky, kr, 0, 7); c.fill();
    if (oeffnenU < 1) {
      c.save(); c.translate(kx - kr * oeffnenU, ky); c.scale(1 - oeffnenU * 0.85, 1);
      c.fillStyle = '#B5CBE0'; c.beginPath(); c.arc(0, 0, kr * 0.92, 0, 7); c.fill();
      c.strokeStyle = '#2F5A85'; c.lineWidth = E * 0.6; c.beginPath(); c.arc(0, 0, kr * 0.62, 0, 7); c.stroke();
      // stilisierter Schlüsselschlitz-Stern (kein echtes Schloss)
      c.fillStyle = cc.treffer >= 3 ? '#24D6CD' : '#2F5A85';
      c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? kr * 0.16 : kr * 0.36, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
      c.restore();
    } else {
      c.fillStyle = '#FFD35A'; c.globalAlpha = 0.25; c.beginPath(); c.arc(kx, ky, kr * 0.8, 0, 7); c.fill(); c.globalAlpha = 1;
      c.fillStyle = '#B5CBE0'; c.save(); c.translate(kx - kr * 1.05, ky); c.scale(0.18, 1); c.beginPath(); c.arc(0, 0, kr * 0.92, 0, 7); c.fill(); c.restore();
    }
    // begrenzter Lichtblitz beim Öffnen (kein Vollbild)
    if (cc.phase === 'oeffnen' && cc.phaseZeit < 0.6) {
      const u = cc.phaseZeit / 0.6, r = tw * (0.4 + u * 0.6);
      const gl = c.createRadialGradient(kx, ky, 0, kx, ky, r);
      const st = (ruhig ? 0.35 : 0.7) * (1 - u);
      gl.addColorStop(0, `rgba(255, 244, 220, ${st})`); gl.addColorStop(0.5, `rgba(255, 211, 90, ${st * 0.5})`); gl.addColorStop(1, 'rgba(255, 211, 90, 0)');
      c.fillStyle = gl; c.beginPath(); c.arc(kx, ky, r, 0, 7); c.fill();
    }

    // --- Kombi rechts mit offener Heckklappe, Fangring ---
    const ab = cc.phase === 'abfahrt' || cc.phase === 'fertig' ? Math.min(1, cc.phaseZeit / 1.1) : 0;
    const kbx = X(0.74), kby = Y(0.6) - ab * ab * Hh * 0.45;
    c.save(); c.translate(kbx, kby); const kw = W * 0.19; c.scale(kw * (1 - ab * 0.4), kw * (1 - ab * 0.4)); malKombi(c, 1.15, { boost: ab > 0, zeit }); c.restore();
    const ringX = X(0.74), ringY = Y(0.69), ringR = E * 6.5;
    if (cc.phase === 'beute') {
      const fangbar = cc.beutel.some(b => b.status === 'fliegt' && b.u >= coup.BEUTE.fensterVon && b.u <= coup.BEUTE.fensterBis);
      c.strokeStyle = fangbar ? '#FFD35A' : 'rgba(36, 214, 205, 0.6)'; c.lineWidth = E * (fangbar ? 1.1 : 0.6);
      c.setLineDash([E * 1.5, E * 1.2]); c.beginPath(); c.arc(ringX, ringY, ringR * (fangbar && !ruhig ? 1 + 0.06 * Math.sin(zeit * 20) : 1), 0, 7); c.stroke(); c.setLineDash([]);
      if (fangbar) { c.fillStyle = 'rgba(255, 211, 90, 0.12)'; c.beginPath(); c.arc(ringX, ringY, ringR, 0, 7); c.fill(); }
    }
    // Beutetaschen im Bogen vom Terminal zum Ring
    for (const b of cc.beutel) {
      if (b.status === 'wartet') continue;
      let bx, by, al = 1, gr = E * 4.2;
      if (b.status === 'fliegt' || (b.status === 'gefangen' && b.nach < 0.01)) {
        const u = Math.max(0, b.u);
        bx = mische(kx, ringX, u); by = mische(ky, ringY, u) - Math.sin(u * Math.PI) * Hh * 0.2;
        if (b.u > 1) by += (b.u - 1) * Hh * 0.2;
      } else if (b.status === 'gefangen') {
        const u = Math.min(1, b.nach / 0.35); bx = ringX; by = mische(ringY, Y(0.62), u); al = 1 - u; gr *= 1 - u * 0.5;
      } else {
        const u = Math.min(1, b.nach / 0.45); bx = mische(ringX, ringX + W * 0.08, u) + (coup.BEUTE.fensterBis - coup.BEUTE.fensterVon) * 0; by = mische(ringY, Y(0.95), u * u); al = 1 - u;
      }
      c.globalAlpha = al; beutel(c, bx, by, gr, b.extra); c.globalAlpha = 1;
    }
    // Rauch und Konfetti
    for (const p of bild) {
      const u = p.leben / p.dauer, px = X(p.x), py = Y(p.y);
      c.globalAlpha = (1 - u) * (p.alpha || 1);
      if (p.art === 'rauch') { c.fillStyle = p.farbe; c.beginPath(); c.arc(px, py, E * p.groesse * 100 * (1 + u), 0, 7); c.fill(); }
      else { c.save(); c.translate(px, py); c.rotate(p.dreh); c.fillStyle = p.farbe; c.fillRect(-E * 0.8, -E * 0.4, E * 1.6, E * 0.8); c.restore(); }
    }
    c.globalAlpha = 1;

    // --- Timing-Anzeige ---
    if (cc.phase === 'intro' || cc.phase === 'laden') {
      const gx = X(0.08), gy = Y(0.86), gw = W * 0.84, gh = Hh * 0.055;
      c.fillStyle = '#10243A'; rr(c, gx - E, gy - E, gw + 2 * E, gh + 2 * E, E * 1.6); c.fill();
      c.fillStyle = '#16314F'; rr(c, gx, gy, gw, gh, E); c.fill();
      const z = cc.zone, zx = gx + (z.mitte - z.breite / 2) * gw, zw = z.breite * gw;
      c.fillStyle = 'rgba(36, 214, 205, 0.55)'; rr(c, zx, gy, zw, gh, E * 0.8); c.fill();
      c.fillStyle = '#E8FFFD'; const pw = zw * 0.38; rr(c, gx + z.mitte * gw - pw / 2, gy, pw, gh, E * 0.6); c.fill();
      const mx = gx + cc.zeiger * gw;
      const fehl = cc.sperre > 0;
      c.fillStyle = fehl ? '#FF805B' : '#FFD35A';
      c.beginPath(); c.moveTo(mx, gy - E * 0.5); c.lineTo(mx - E * 1.8, gy - E * 3.2); c.lineTo(mx + E * 1.8, gy - E * 3.2); c.closePath(); c.fill();
      c.fillRect(mx - E * 0.5, gy - E * 0.5, E, gh + E);
      c.fillStyle = '#FFF4DC'; c.font = `${Math.max(7, E * 2.4)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText(`IMPULSSCHLÜSSEL ${cc.treffer}/3`, X(0.5), gy - E * 4.4);
    }
    // Rückmeldungen
    if (extra.text) {
      const u = extra.textZeit;
      c.globalAlpha = u > 0.8 ? Math.max(0, (1.1 - u) / 0.3) : 1;
      const gr = Math.max(10, E * 4.4);
      c.font = `${gr}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = gr * 0.35; c.strokeStyle = '#10243A'; c.strokeText(extra.text, X(0.5), Y(0.17));
      c.fillStyle = extra.textFarbe || '#FFD35A'; c.fillText(extra.text, X(0.5), Y(0.17));
      c.globalAlpha = 1;
    }
    abdunkeln(c, lay);
  }
  function beutel(c, x, y, r, extra) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(4, 6, 18, 0.35)'; c.beginPath(); c.ellipse(0, r * 0.95, r * 0.8, r * 0.22, 0, 0, 7); c.fill();
    c.fillStyle = extra ? '#F2B33D' : '#6A3BB8';
    c.beginPath(); c.moveTo(-r * 0.35, -r * 0.6); c.quadraticCurveTo(-r * 1.0, r * 0.1, -r * 0.7, r * 0.8); c.quadraticCurveTo(0, r * 1.05, r * 0.7, r * 0.8); c.quadraticCurveTo(r * 1.0, r * 0.1, r * 0.35, -r * 0.6); c.closePath(); c.fill();
    c.fillStyle = extra ? '#C98A20' : '#3B1C6B'; c.fillRect(-r * 0.42, -r * 0.72, r * 0.84, r * 0.2);
    // Stern als Spielpunkt-Symbol (kein Geld)
    c.fillStyle = extra ? '#FFF4DC' : '#24D6CD';
    c.beginPath(); for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.16 : r * 0.38, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 + r * 0.25); } c.closePath(); c.fill();
    c.restore();
  }

  return {
    setzeRuhig, projektion, zeichneFahrt, zeichneMenue, zeichneTitel, zeichneCoup, malKombi, beutel,
    weltPartikel, bildPartikel, partikelSchritt, partikelLeeren, blase, blasenSchritt,
    anzahlPartikel: () => welt.length + bild.length,
    leereBlasen: () => { sprechblasen.length = 0; },
  };
})();
