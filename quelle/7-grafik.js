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

  // Paletten je Abschnitt: dunkles Marineblau/Violett, Akzente Magenta, Cyan, Koralle, Orange
  const PALETTEN = {
    boulevard: { aussen: '#150F2C', rand: '#3A2552', asphalt: '#221C3B', asphalt2: '#241E3F', markierung: '#E8D9F2', licht: '#FF4FD8', lichtAbstand: 32 },
    autobahn:  { aussen: '#0E1630', rand: '#2A2D48', asphalt: '#1F2139', asphalt2: '#21233C', markierung: '#DCE6F2', licht: '#7FD8FF', lichtAbstand: 40 },
    tunnel:    { aussen: '#110B1C', rand: '#3A2E4A', asphalt: '#251E31', asphalt2: '#272034', markierung: '#F2E4C8', licht: '#FFB35C', lichtAbstand: 16 },
    kueste:    { aussen: '#0B1C3A', rand: '#3B2A48', asphalt: '#201F3B', asphalt2: '#22213E', markierung: '#EDE0F0', licht: '#FF8A5B', lichtAbstand: 36 },
    lager:     { aussen: '#121528', rand: '#2C2A44', asphalt: '#1F1E36', asphalt2: '#212039', markierung: '#E2E6EE', licht: '#FFB35C', lichtAbstand: 40 },
  };
  const AUTO_FARBEN = ['#7FE0C2', '#FF9C85', '#F3E3B5', '#8EC9FF', '#C9A7FF'];
  const CONTAINER = ['#E8663D', '#2E9C8F', '#C83E5A', '#3C6FB8', '#D9A23A'];
  const hash = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 0) / 4294967296; };

  // ---------- Projektion: Draufsicht, überall gleicher Maßstab (keine Verengung) ----------
  function projektion(sicht, camD, strecke, spuren) {
    const range = ANSICHT.vorne + ANSICHT.hinten, dMin = camD - ANSICHT.hinten;
    const unten = sicht.y + sicht.h, oben = sicht.y;
    const pxm = sicht.w / ANSICHT.breite, cx = sicht.x + sicht.w / 2;
    const lpx = (unten - oben) / range;                    // Pixel pro Meter in Fahrtrichtung
    const k0 = strecke ? strecke.kurve(camD) : 0;
    return {
      sicht, camD, dMin, dMax: dMin + range, range, unten, oben, pxm, cx, halb: strassenHalbe(spuren), spuren,
      s: () => 1,
      y: d => unten - (d - dMin) * lpx,
      x: (d, x) => cx + (x + (strecke ? strecke.kurve(d) : 0) - k0) * pxm,
      laengs: () => lpx,
      alpha: d => klemme((dMin + range - d) / ANSICHT.einblenden, 0, 1),
    };
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
  const H = 0.22;   // sichtbares Heck: schmal, die Draufsicht bleibt klar
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
      c.strokeStyle = 'rgba(255, 211, 90, 0.55)'; c.lineWidth = 0.06; rr(c, -0.6, -L / 2 - 0.06, 1.2, L + H + 0.12, 0.2); c.stroke();
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
    // klare Kontur gegen den dunklen Asphalt
    c.strokeStyle = 'rgba(255, 244, 220, 0.38)'; c.lineWidth = 0.035; rr(c, -0.5, -L / 2, 1, L + H, 0.16); c.stroke();
    if (o.bremst) {   // Bremslicht: etwas heller, kleiner weicher Schein, nicht blendend
      c.fillStyle = 'rgba(255, 70, 90, 0.28)'; c.beginPath(); c.ellipse(0, L / 2 + H * 0.8, 0.55, 0.16, 0, 0, 7); c.fill();
      heckLeuchten(c, L, '#FF8C99', typ === 'kugel' ? 'rund' : typ === 'kasten' || typ === 'bus' ? 'hoch' : 'eckig');
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
    if (!strecke) return PALETTEN.boulevard;
    const t = strecke.abschnittBei(d);
    const p = PALETTEN[t.licht];
    const zumEnde = t.bis - d, vomAnfang = d - t.von;
    if (zumEnde < 50) { const n = strecke.teilNr(t.nr + 1); if (n && n !== t) return { ...p, mix: PALETTEN[n.licht], mt: 0.5 - zumEnde / 100 }; }
    if (vomAnfang < 50 && t.nr > 0) return { ...p, mix: PALETTEN[strecke.teilNr(t.nr - 1).licht], mt: 0.5 - vomAnfang / 100 };
    return p;
  }
  const farbeAus = (p, name) => (p.mix && p.mix[name] && p[name] ? misch(p[name], p.mix[name], p.mt) : p[name] || p.rand);
  const artBei = (strecke, d) => (strecke ? strecke.abschnittBei(d).licht : 'boulevard');

  // Weltrechteck → Viereck auf dem Bildschirm (folgt der sanften Kurve)
  function wRect(c, P, d0, d1, x0, x1, farbe) {
    quad(c, [P.x(d0, x0), P.y(d0)], [P.x(d0, x1), P.y(d0)], [P.x(d1, x1), P.y(d1)], [P.x(d1, x0), P.y(d1)], farbe);
  }
  function wPfad(c, P, d0, d1, x0, x1) {
    c.beginPath(); c.moveTo(P.x(d0, x0), P.y(d0)); c.lineTo(P.x(d0, x1), P.y(d0)); c.lineTo(P.x(d1, x1), P.y(d1)); c.lineTo(P.x(d1, x0), P.y(d1)); c.closePath();
  }
  // Neon nur um scharfe Formen: breite, durchscheinende Linie unter einer dünnen hellen
  function neonLinie(c, farbe, breite) {
    c.save(); c.strokeStyle = rgba(farbe, 0.28); c.lineWidth = breite * 3.2; c.stroke(); c.restore();
    c.strokeStyle = farbe; c.lineWidth = breite; c.stroke();
  }

  // Boden: Außenbereich, Randstreifen, Fahrbahn – in Streifen, damit die Abschnitte weich übergehen
  function boden(c, P, strecke, breite) {
    const halb = P.halb, schulter = 0.8, schritt = 2;
    for (let d = Math.floor(P.dMax / schritt) * schritt + schritt; d >= P.dMin - schritt; d -= schritt) {
      const d0 = d - schritt, d1 = d;
      const pal = paletteBei(strecke, d0 + 1);
      const y0 = P.y(d0), y1 = P.y(d1);
      c.fillStyle = farbeAus(pal, 'aussen'); c.fillRect(0, y1 - 0.5, breite, y0 - y1 + 1);
      wRect(c, P, d0, d1 + 0.05, -halb - schulter, halb + schulter, farbeAus(pal, 'rand'));
      wRect(c, P, d0, d1 + 0.05, -halb, halb, farbeAus(pal, Math.floor(d0 / 8) % 2 ? 'asphalt' : 'asphalt2'));
    }
  }

  // Zurückhaltende Fahrbahnmarkierungen
  function markierungen(c, P, strecke) {
    const halb = P.halb, sp = P.spuren, strich = 5, periode = 13, br = 0.11;
    const d0 = Math.floor(P.dMin / periode) * periode;
    for (let i = 1; i < sp; i++) {
      const x = -halb + i * SPUR;
      for (let d = d0; d < P.dMax; d += periode) {
        const a = Math.max(d, P.dMin), b = Math.min(d + strich, P.dMax);
        if (b <= a) continue;
        c.globalAlpha = 0.5 * P.alpha(b);
        wRect(c, P, a, b, x - br, x + br, farbeAus(paletteBei(strecke, a), 'markierung'));
      }
    }
    c.globalAlpha = 0.55;
    for (const x of [-halb + 0.2, halb - 0.2]) {
      c.beginPath();
      for (let d = P.dMin; d <= P.dMax; d += 3) { const X = P.x(d, x), Y = P.y(d); if (d === P.dMin) c.moveTo(X, Y); else c.lineTo(X, Y); }
      c.strokeStyle = '#F1EEE3'; c.lineWidth = Math.max(1.5, 0.14 * P.pxm); c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Dezente Lichtreflexe der Laternen auf der Fahrbahn
  function lichtpfuetzen(c, P, strecke) {
    c.save(); c.globalCompositeOperation = 'lighter';
    let d = P.dMin - 8;
    while (d < P.dMax + 8) {
      const pal = paletteBei(strecke, d), ab = pal.lichtAbstand, dd = Math.ceil(d / ab) * ab;
      if (dd > P.dMax + 8) break;
      for (const seite of [-1, 1]) {
        const X = P.x(dd, seite * (P.halb - 1.2)), Y = P.y(dd), rx = 3.8 * P.pxm, ry = 3.8 * P.laengs();
        const g = c.createRadialGradient(X, Y, 0, X, Y, rx);
        g.addColorStop(0, rgba(pal.licht, 0.07 * P.alpha(dd))); g.addColorStop(1, rgba(pal.licht, 0));
        c.fillStyle = g; c.beginPath(); c.ellipse(X, Y, rx, ry, 0, 0, 7); c.fill();
      }
      d = dd + 0.01;
    }
    c.restore();
  }

  // ---------- Kulisse (alles flach von oben, keine Verdeckung der Fahrbahn) ----------
  const mod = (n, m) => ((n % m) + m) % m;
  const HOTELS = ['HOTEL MARINA', 'NEONRIFF', 'PALMHOF', 'LUNA BAY', 'KORALLE', 'SEESTERN'];
  const SCHILDER = ['DOCK 9', 'WERFT 3', 'NACHTKIOSK', 'STRANDBAR', 'FUNKENHALLE', 'KAI 12'];
  function palme(c, P, d, x, n) {
    const X = P.x(d, x), Y = P.y(d), r = 1.7 * P.pxm, ry = 1.7 * P.laengs();
    c.fillStyle = 'rgba(4, 6, 18, 0.45)'; c.beginPath(); c.ellipse(X + r * 0.25, Y + ry * 0.2, r * 0.9, ry * 0.9, 0, 0, 7); c.fill();
    const blaetter = 7, dreh = hash(n) * 6.28;
    for (let i = 0; i < blaetter; i++) {
      const a = dreh + i * 6.283 / blaetter, ca = Math.cos(a), sa = Math.sin(a);
      c.fillStyle = i % 2 ? '#1E6B5C' : '#23806C';
      c.beginPath(); c.moveTo(X, Y);
      c.quadraticCurveTo(X + (ca * 0.6 - sa * 0.35) * r, Y + (sa * 0.6 + ca * 0.35) * ry, X + ca * r, Y + sa * ry);
      c.quadraticCurveTo(X + (ca * 0.6 + sa * 0.35) * r, Y + (sa * 0.6 - ca * 0.35) * ry, X, Y);
      c.fill();
    }
    // Neon-Streiflicht von der Straße
    c.strokeStyle = 'rgba(255, 79, 216, 0.35)'; c.lineWidth = Math.max(1, r * 0.06);
    c.beginPath(); c.ellipse(X, Y, r * 0.95, ry * 0.95, 0, x < 0 ? -0.9 : 2.2, x < 0 ? 0.9 : 4.0); c.stroke();
    c.fillStyle = '#5A3A2A'; c.beginPath(); c.arc(X, Y, Math.max(1.5, r * 0.12), 0, 7); c.fill();
  }
  function hotel(c, P, d0, d1, x0, x1, n) {
    const neon = mod(n, 2) ? '#FF4FD8' : '#24D6CD';
    wRect(c, P, d0, d1, x0, x1, '#271543');
    wPfad(c, P, d0 + 0.6, d1 - 0.6, x0 + 0.6, x1 - 0.6); neonLinie(c, neon, Math.max(1, 0.12 * P.pxm));
    // Fensterlichter an der Straßenseite (auch auf schmalen Handys sichtbar)
    const xs = Math.abs(x0) < Math.abs(x1) ? x0 : x1, innen = Math.sign(x1 + x0);
    for (let d = d0 + 1.6; d < d1 - 1; d += 2.6) {
      const h = hash(Math.round(d * 13 + n));
      if (h < 0.3) continue;
      wRect(c, P, d, d + 1.1, xs + innen * 0.9, xs + innen * 1.4, h > 0.8 ? 'rgba(255, 79, 216, 0.75)' : 'rgba(255, 211, 120, 0.7)');
    }
    if (n % 3 === 0) { wRect(c, P, d0 + 3, d0 + 9, (x0 + x1) / 2 - 1.6, (x0 + x1) / 2 + 1.6, '#1FA9B8'); wRect(c, P, d0 + 3.6, d0 + 8.4, (x0 + x1) / 2 - 1.1, (x0 + x1) / 2 + 1.1, '#5FE3EE'); }
    else for (let i = 0; i < 3; i++) wRect(c, P, d0 + 3 + i * 4, d0 + 5 + i * 4, x0 + 1.2, x0 + 2.6, '#3B2A5C');
    const mx = P.x((d0 + d1) / 2, (x0 + x1) / 2), my = P.y(d1 - 4), gr = Math.max(6, 0.7 * P.pxm);
    c.font = `${gr}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = rgba(neon, 0.3); c.fillText(HOTELS[mod(n, HOTELS.length)], mx + 1, my + 1, Math.abs(P.x(d1, x1) - P.x(d1, x0)) * 0.9);
    c.fillStyle = neon; c.fillText(HOTELS[mod(n, HOTELS.length)], mx, my, Math.abs(P.x(d1, x1) - P.x(d1, x0)) * 0.9);
  }
  function halle(c, P, d0, d1, x0, x1, n) {
    wRect(c, P, d0, d1, x0, x1, '#262A45');
    c.strokeStyle = 'rgba(0, 0, 0, 0.3)'; c.lineWidth = 1;
    for (let d = d0 + 2; d < d1; d += 2) { c.beginPath(); c.moveTo(P.x(d, x0), P.y(d)); c.lineTo(P.x(d, x1), P.y(d)); c.stroke(); }
    wRect(c, P, d0, d1, x0, x0 + 0.4, n % 2 ? '#FF9A3D' : '#24D6CD');
  }
  function container(c, P, d0, x0, n) {
    for (let i = 0; i < 3; i++) {
      const f = CONTAINER[mod(n + i, CONTAINER.length)];
      wRect(c, P, d0 + i * 3.2, d0 + i * 3.2 + 2.6, x0, x0 + 6, misch(f, '#0A0F24', 0.35));
    }
  }
  function kranOben(c, P, d, x0, x1) {
    wRect(c, P, d - 0.7, d + 0.7, x0, x1, '#3B2F63');
    wRect(c, P, d - 1.4, d + 1.4, x1 - 2, x1 - 0.6, '#FF9A3D');
  }
  function wasser(c, P, d0, d1, xRand, seite, breite) {
    const xa = seite < 0 ? -breite : xRand, xb = seite < 0 ? xRand : breite;
    wRect(c, P, d0, d1, xa, xb, '#0A1A38');
    // Spiegelungen: feste kurze Lichtstriche (bewegen sich nur mit der Straße)
    for (let d = Math.floor(d0 / 6) * 6; d < d1; d += 6) {
      const h = hash(Math.round(d * 7 + seite));
      if (h > 0.55) continue;
      const x = xRand + seite * (0.9 + h * 7);
      c.globalAlpha = 0.35; wRect(c, P, d, d + 0.25, x - 0.8 - h, x + 0.8 + h, h < 0.2 ? '#FF4FD8' : '#7FD8FF'); c.globalAlpha = 1;
    }
  }
  function schild(c, P, d, x, n) {
    const farbe = mod(n, 2) ? '#FF4FD8' : '#24D6CD', X = P.x(d, x), Y = P.y(d), w = 4.6 * P.pxm, h = 1.6 * P.laengs() * 1.6;
    c.fillStyle = '#120D24'; rr(c, X - w / 2, Y - h / 2, w, h, 3); c.fill();
    rr(c, X - w / 2, Y - h / 2, w, h, 3); neonLinie(c, farbe, Math.max(1, 0.08 * P.pxm));
    c.fillStyle = farbe; c.font = `${Math.max(5, h * 0.42)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(SCHILDER[mod(n, SCHILDER.length)], X, Y + 0.5, w * 0.88);
  }
  function laterne(c, P, d, x, licht) {
    const X = P.x(d, x), Y = P.y(d), r = Math.max(2, 0.28 * P.pxm);
    c.fillStyle = rgba(licht, 0.22); c.beginPath(); c.arc(X, Y, r * 2.4, 0, 7); c.fill();
    c.fillStyle = licht; c.beginPath(); c.arc(X, Y, r, 0, 7); c.fill();
  }

  function kulisse(c, P, strecke, breite) {
    const halb = P.halb, aussen = halb + 0.8, weit = ANSICHT.breite;
    const a0 = Math.floor((P.dMin - 40) / 8) * 8;
    // 1) Flächen: Wasser, Gehweg, Wände
    for (let d = a0; d < P.dMax + 8; d += 8) {
      const art = artBei(strecke, d + 4);
      if (art === 'kueste') { wasser(c, P, d, d + 8, -aussen - 1.6, -1, weit * 2); wRect(c, P, d, d + 8, -aussen - 1.6, -aussen, '#5A3A52'); }
      else if (art === 'autobahn') { wasser(c, P, d, d + 8, -aussen - 0.4, -1, weit * 2); }
      else if (art === 'boulevard') { for (const s of [-1, 1]) wRect(c, P, d, d + 8, s < 0 ? -aussen - 1.6 : aussen, s < 0 ? -aussen : aussen + 1.6, '#432A5E'); }
      else if (art === 'tunnel') {
        for (const s of [-1, 1]) {
          wRect(c, P, d, d + 8, s < 0 ? -aussen - 1.4 : aussen, s < 0 ? -aussen : aussen + 1.4, '#3D3152');
          wRect(c, P, d + 2, d + 5, s < 0 ? -aussen - 0.5 : aussen + 0.15, s < 0 ? -aussen - 0.15 : aussen + 0.5, '#FFB35C');
        }
      }
    }
    // 2) Objekte je Abschnitt (deterministisch aus der Weltposition)
    for (let d = Math.floor((P.dMin - 40) / 24) * 24; d < P.dMax + 30; d += 24) {
      const n = Math.round(d / 24), art = artBei(strecke, d), h = hash(n);
      if (art === 'boulevard') {
        hotel(c, P, d + 2, d + 22, aussen + 1.8, aussen + 1.8 + 9, n);
        hotel(c, P, d + 6, d + 20, -aussen - 1.8 - 9, -aussen - 1.8, n + 1);
      } else if (art === 'autobahn') {
        if (n % 2) halle(c, P, d + 2, d + 21, aussen + 1.6, aussen + 10.6, n); else container(c, P, d + 4, aussen + 1.8, n);
      } else if (art === 'lager') {
        halle(c, P, d + 1, d + 20, aussen + 1.6, aussen + 10.6, n);
        if (n % 3) container(c, P, d + 3, -aussen - 7.8, n); else halle(c, P, d + 2, d + 18, -aussen - 10.6, -aussen - 1.6, n + 1);
        if (n % 4 === 0) kranOben(c, P, d + 12, -aussen - 14, -aussen - 0.6);
      } else if (art === 'kueste') {
        if (h < 0.6) hotel(c, P, d + 4, d + 20, aussen + 1.8, aussen + 10.8, n);
        else wRect(c, P, d + 2, d + 22, aussen + 1.6, aussen + 12, '#1C2A3E');
      }
    }
    // 3) Palmen, Schilder, Laternen
    for (let d = Math.floor((P.dMin - 10) / 16) * 16; d < P.dMax + 6; d += 16) {
      const n = Math.round(d / 16), art = artBei(strecke, d);
      if (art === 'boulevard') { palme(c, P, d, -aussen - 1.0, n); palme(c, P, d + 8, aussen + 1.0, n + 3); }
      else if (art === 'kueste') { palme(c, P, d, -aussen - 1.0, n); if (n % 2) palme(c, P, d + 6, aussen + 1.0, n + 5); }
      if ((art === 'lager' || art === 'boulevard') && n % 5 === 2) schild(c, P, d + 4, (n % 2 ? 1 : -1) * (aussen + 3.6), n);
    }
    for (let d = Math.floor((P.dMin - 4) / 8) * 8; d < P.dMax + 4; d += 8) {
      const pal = paletteBei(strecke, d), art = artBei(strecke, d);
      if (art === 'tunnel' || Math.round(d) % pal.lichtAbstand !== 0) continue;
      for (const s of [-1, 1]) laterne(c, P, d, s * (halb + 0.45), pal.licht);
    }
    // Leitplanken an der Hafenautobahn
    for (let d = Math.floor(P.dMin / 8) * 8; d < P.dMax; d += 8) {
      if (artBei(strecke, d) !== 'autobahn') continue;
      for (const s of [-1, 1]) wRect(c, P, d, d + 8, s * (halb + 0.65) - 0.08, s * (halb + 0.65) + 0.08, '#8A93B0');
    }
  }

  // Streckenmarke (Banner quer über die Straße) und Zielbereich
  function marke(c, P, d, text) {
    if (d < P.dMin - 2 || d > P.dMax + 2) return;
    c.globalAlpha = P.alpha(d);
    wRect(c, P, d - 0.4, d + 0.4, -P.halb, P.halb, 'rgba(36, 214, 205, 0.55)');
    const X = P.x(d, 0), Y = P.y(d) - 1.6 * P.laengs() - 4, w = (P.halb * 2 + 1.6) * P.pxm, h = Math.max(14, 1.3 * P.pxm);
    c.fillStyle = 'rgba(26, 18, 56, 0.92)'; rr(c, X - w / 2, Y - h / 2, w, h, 4); c.fill();
    rr(c, X - w / 2, Y - h / 2, w, h, 4); neonLinie(c, '#24D6CD', 1.5);
    c.fillStyle = '#24D6CD'; c.font = `${Math.max(6, h * 0.4)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, X, Y + 0.5, w * 0.92);
    c.globalAlpha = 1;
  }
  function zielFlaeche(c, P, von, bis) {
    if (!isFinite(von)) return;
    const a = Math.max(von, P.dMin), b = Math.min(bis + 40, P.dMax);
    if (b <= a) return;
    for (let d = Math.floor(a / 2) * 2; d < b; d += 2) for (let i = 0; i < P.spuren * 2; i++) {
      if ((i + d / 2) % 2 !== 0) continue;
      const x0 = -P.halb + i * SPUR / 2;
      c.globalAlpha = 0.22 * P.alpha(d);
      wRect(c, P, d, d + 2, x0, x0 + SPUR / 2, '#FFD35A');
    }
    c.globalAlpha = 1;
  }
  function zielTor(c, P, d) {
    if (!isFinite(d) || d < P.dMin - 2 || d > P.dMax + 2) return;
    c.globalAlpha = P.alpha(d);
    const X = P.x(d, 0), Y = P.y(d), w = (P.halb * 2 + 2.4) * P.pxm, h = Math.max(18, 1.8 * P.pxm);
    c.fillStyle = '#FFD35A'; rr(c, X - w / 2, Y - h / 2, w, h, 5); c.fill();
    c.fillStyle = '#10243A'; c.font = `${Math.max(7, h * 0.42)}px ${SCHRIFT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('ZIEL · HALLE 7', X, Y + 0.5, w * 0.9);
    c.globalAlpha = 1;
  }

  // Boostfeld: leuchtende türkis-gelbe Pfeile in Fahrtrichtung, flach auf der Fahrbahn
  function boostFeld(c, P, f, zeit) {
    const d0 = f.d - f.laenge / 2, d1 = f.d + f.laenge / 2;
    if (d1 < P.dMin || d0 > P.dMax) return;
    const genutzt = f.status !== 'offen';
    const a = Math.max(d0, P.dMin), b = Math.min(d1, P.dMax), x0 = f.x - f.breite / 2, x1 = f.x + f.breite / 2;
    const pt = (d, x) => [P.x(d, x), P.y(d)];
    c.save();
    c.globalAlpha = P.alpha(d1) * (genutzt ? 0.3 : 1);
    quad(c, pt(a, x0), pt(a, x1), pt(b, x1), pt(b, x0), 'rgba(36, 214, 205, 0.16)');
    c.strokeStyle = 'rgba(36, 214, 205, 0.85)'; c.lineWidth = Math.max(1.2, 0.12 * P.pxm * P.s(f.d));
    c.beginPath(); c.moveTo(...pt(a, x0)); c.lineTo(...pt(b, x0)); c.moveTo(...pt(a, x1)); c.lineTo(...pt(b, x1)); c.stroke();
    // drei Pfeile; ein sanfter Lichtlauf nach vorne (bei „weniger Bewegung“ ruhig)
    for (let i = 0; i < 3; i++) {
      const dd = d0 + 0.8 + i * 2.1, spitze = dd + 1.5, dicke = 0.7, br = f.breite * 0.36;
      if (spitze < P.dMin || dd > P.dMax) continue;
      const hell = genutzt || ruhig ? 0.85 : 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(zeit * 5 - i * 1.4));
      c.fillStyle = i % 2 ? `rgba(255, 211, 90, ${hell})` : `rgba(36, 214, 205, ${hell})`;
      c.beginPath();
      c.moveTo(...pt(dd, f.x - br)); c.lineTo(...pt(spitze, f.x)); c.lineTo(...pt(dd, f.x + br));
      c.lineTo(...pt(dd - dicke, f.x + br)); c.lineTo(...pt(spitze - dicke, f.x)); c.lineTo(...pt(dd - dicke, f.x - br));
      c.closePath(); c.fill();
    }
    c.restore();
  }
  // Vorankündigung: Felder knapp hinter dem Horizont als kleiner Pfeil oben in ihrer Spur
  function feldVorschau(c, P, f, zeit) {
    if (f.status !== 'offen' || f.d - f.laenge / 2 <= P.dMax || f.d > P.dMax + 45) return;
    const X = P.x(P.dMax, f.x), Y = P.oben + 4, g = Math.max(5, 0.5 * P.pxm * P.s(P.dMax));
    c.save();
    c.globalAlpha = ruhig ? 0.85 : 0.65 + 0.25 * Math.sin(zeit * 4);
    c.fillStyle = '#FFD35A'; c.strokeStyle = '#24D6CD'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(X, Y - g); c.lineTo(X + g, Y + g * 0.4); c.lineTo(X - g, Y + g * 0.4); c.closePath(); c.fill(); c.stroke();
    c.restore();
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
    const P = projektion(lay.sicht, sp.d, strecke, w.SP);
    c.save();
    // nichts unter die Steuerfläche zeichnen
    c.beginPath(); c.rect(0, 0, lay.breite, lay.sicht.y + lay.sicht.h); c.clip();
    // kaum spürbares Rütteln nur bei Unfällen und nicht bei „weniger Bewegung“
    if (extra.ruetteln > 0 && !ruhig) c.translate(Math.sin(zeit * 70) * 1.5 * extra.ruetteln, 0);
    boden(c, P, strecke, lay.breite);
    kulisse(c, P, strecke, lay.breite);
    lichtpfuetzen(c, P, strecke);
    markierungen(c, P, strecke);
    zielFlaeche(c, P, strecke.zielVon, strecke.laenge);
    for (const f of w.felder) boostFeld(c, P, f, zeit);
    for (let i = Math.max(0, w.markeNr - 1); i < w.markeNr + 3; i++) {
      const md = strecke.marke(i); if (!isFinite(md)) break;
      const t = strecke.abschnittBei(md + 1);
      marke(c, P, md, strecke.endlos ? `${t.name.toUpperCase()} · MARKE ${i + 1}` : `MARKE ${i + 1}/${strecke.anzahlMarken} · ${t.name.toUpperCase()}`);
    }
    zielTor(c, P, strecke.zielVon);
    // Fahrzeuge von weit vorne nach hinten (das Heck überlappt das Auto dahinter)
    const liste = [];
    const blinkAn = ruhig ? true : (zeit * 2.6) % 1 < 0.6;
    for (const a of w.autos) {
      const blink = a.wechsel ? Math.sign(a.wechsel.nach - a.wechsel.von) : 0;
      liste.push({ d: a.d, mal: cc => zeichneFahrzeug(cc, P, a, 'verkehr', { blink, blinkAn, wackel: a.wackel, bremst: a.v < a.vSoll - 0.4 }) });
    }
    const phase = ruhig ? (zeit % 1.6) < 0.8 : (zeit * 5) % 2 < 1;
    for (const p of w.polizei) liste.push({ d: p.d, mal: cc => zeichneFahrzeug(cc, P, p, 'streife', { licht: w.phase === 'fahrt' ? 1 : 0.3, phase, wackel: p.wackel, fragend: p.fragend }) });
    const schutzBlink = sp.schutz > 0 && !ruhig && (zeit * 12) % 2 < 1;
    liste.push({ d: sp.d, spieler: true, mal: cc => zeichneFahrzeug(cc, P, sp, 'spieler', { neigung: sp.neigung, boost: sp.boostAn, zeit, alpha: schutzBlink ? 0.55 : 1 }) });
    liste.sort((a, b) => b.d - a.d || (a.spieler ? 1 : -1));
    for (const e of liste) e.mal(c);
    for (const f of w.felder) feldVorschau(c, P, f, zeit);
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
    // oben sanft ausblenden (nichts taucht hart auf)
    const fg = c.createLinearGradient(0, P.oben, 0, P.oben + ANSICHT.einblenden * P.laengs() * 1.6);
    fg.addColorStop(0, 'rgba(10, 8, 26, 0.85)'); fg.addColorStop(1, 'rgba(10, 8, 26, 0)');
    c.fillStyle = fg; c.fillRect(0, P.oben - 1, lay.breite, ANSICHT.einblenden * P.laengs() * 1.6 + 1);
    c.restore();
    // Rand außerhalb des Sichtfensters abdunkeln (breite Bildschirme sehen nicht mehr)
    abdunkeln(c, lay);
    return P;
  }

  function abdunkeln(c, lay) {
    const s = lay.sicht;
    c.fillStyle = 'rgba(6, 10, 26, 0.5)';
    if (s.x > 0) { c.fillRect(0, 0, s.x, lay.hoehe); c.fillRect(s.x + s.w, 0, lay.breite - s.x - s.w, lay.hoehe); }
    // feine Rahmenlinie
    if (s.x > 2) {
      c.strokeStyle = 'rgba(47, 90, 133, 0.8)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(s.x, 0); c.lineTo(s.x, lay.hoehe); c.moveTo(s.x + s.w, 0); c.lineTo(s.x + s.w, lay.hoehe); c.stroke();
    }
  }

  // Ruhige Menükulisse: leerer Neonboulevard, der Kombi rollt gemächlich
  function zeichneMenue(c, lay, zeit, strecke) {
    const fake = { d: zeit * 7, x: 0, laenge: SPIELER.laenge, breite: SPIELER.breite };
    const P = projektion(lay.sicht, fake.d, strecke, SPUREN);
    c.fillStyle = '#150F2C'; c.fillRect(0, 0, lay.breite, lay.hoehe);
    boden(c, P, strecke, lay.breite);
    kulisse(c, P, strecke, lay.breite);
    lichtpfuetzen(c, P, strecke);
    markierungen(c, P, strecke);
    zeichneFahrzeug(c, P, fake, 'spieler', {});
    abdunkeln(c, lay);
  }

  // Titelbild: 80er-Neonsonne über dem Meer, Palmen-Silhouetten, der Kombi als Hauptmotiv
  function zeichneTitel(c, w, h, zeit) {
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h * 0.55);
    g.addColorStop(0, '#120B30'); g.addColorStop(0.7, '#3A1656'); g.addColorStop(1, '#7A2A6E');
    c.fillStyle = g; c.fillRect(0, 0, w, h * 0.55);
    // Sonne mit Streifen
    const sx = w / 2, sy = h * 0.5, sr = h * 0.3;
    const sg = c.createLinearGradient(0, sy - sr, 0, sy);
    sg.addColorStop(0, '#FFD35A'); sg.addColorStop(0.6, '#FF8A5B'); sg.addColorStop(1, '#FF4FD8');
    c.save(); c.beginPath(); c.arc(sx, sy, sr, Math.PI, 0); c.closePath(); c.clip();
    c.fillStyle = sg; c.fillRect(sx - sr, sy - sr, sr * 2, sr);
    c.fillStyle = '#3A1656';
    for (let i = 0; i < 5; i++) { const y = sy - sr * 0.45 + i * sr * 0.11; c.fillRect(sx - sr, y, sr * 2, 2 + i * 1.6); }
    c.restore();
    // Meer und Raster
    c.fillStyle = '#0B1C3A'; c.fillRect(0, h * 0.5, w, h * 0.5);
    c.strokeStyle = 'rgba(36, 214, 205, 0.4)'; c.lineWidth = 1.5;
    for (let i = -7; i <= 7; i++) { c.beginPath(); c.moveTo(w / 2 + i * w * 0.035, h * 0.5); c.lineTo(w / 2 + i * w * 0.3, h); c.stroke(); }
    for (let i = 0; i < 5; i++) { const y = h * 0.5 + (h * 0.5) * Math.pow((i + 1) / 6, 1.5); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = 'rgba(255, 79, 216, 0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w, h * 0.5); c.stroke();
    // Palmen-Silhouetten
    const palmeS = (x, y, s, links) => {
      c.strokeStyle = '#120A24'; c.fillStyle = '#120A24'; c.lineWidth = s * 0.06;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (links ? -0.15 : 0.15) * s, y - 0.5 * s, x + (links ? 0.05 : -0.05) * s, y - s); c.stroke();
      const tx = x + (links ? 0.05 : -0.05) * s, ty = y - s;
      for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.95 + i * Math.PI * 0.38; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * s * 0.3, ty + Math.sin(a) * s * 0.3 - s * 0.08, tx + Math.cos(a) * s * 0.42, ty + Math.sin(a) * s * 0.42 + s * 0.12); c.lineWidth = s * 0.045; c.stroke(); }
    };
    palmeS(w * 0.1, h * 0.62, h * 0.5, true); palmeS(w * 0.2, h * 0.58, h * 0.36, false);
    palmeS(w * 0.9, h * 0.62, h * 0.52, false); palmeS(w * 0.8, h * 0.57, h * 0.34, true);
    // Kombi groß
    c.save();
    const bw = h * 0.34;
    c.translate(w / 2, h * 0.68); c.scale(bw, bw);
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
