// ===================================================================
// 3 · COUP (Phase 1)
// Reines Arcade-Timing ohne echte Technik: Ein Zeiger läuft über eine
// Anzeige, drei Treffer im markierten Feld laden den erfundenen
// „Impulsschlüssel“. Danach springt das Wertterminal comicartig auf und
// Beutetaschen fliegen zum Kombi; Tippen im richtigen Moment fängt sie.
// Ohne DOM, läuft identisch im Browser und in Node-Tests.
// ===================================================================

function erstelleCoup(einst, zufallswert) {
  const rnd = zufall(zufallswert);
  const PH = { intro: 1.1, oeffnen: 1.7, abfahrt: 1.3 };
  const BEUTE = { abstand: 0.78, flug: 1.15, fensterVon: 0.56, fensterBis: 0.9 };
  const c = {
    phase: 'intro', zeit: 0, phaseZeit: 0,
    zeiger: 0, richtung: 1, tempo: einst.tempo,
    zone: { mitte: 0.7, breite: einst.zone },
    treffer: 0, perfekte: 0, gute: 0, daneben: 0, folgeDaneben: 0, sperre: 0,
    punkte: 0, trefferPunkte: 0, abzug: 0, beutelGesamt: 0, beutel: [], gefangen: 0, verpasst: 0, fangSperre: 0,
    ergebnisse: [], ereignisse: [],
  };
  const sende = (typ, daten = {}) => c.ereignisse.push({ typ, ...daten });
  // Timing-Punkte minus Fehlversuche (nie unter 0) plus gefangene Taschen
  const timing = () => Math.max(0, c.trefferPunkte - c.abzug);
  function rechne() { c.punkte = timing() + c.gefangen * PUNKTE.beutel; }

  function neueZone() {
    // neue Lage, nicht direkt neben der alten; Breite schrumpft leicht mit jedem Treffer
    const alt = c.zone.mitte;
    let m = alt;
    for (let i = 0; i < 12 && Math.abs(m - alt) < 0.25; i++) m = rnd.zwischen(0.18, 0.82);
    c.zone = { mitte: m, breite: einst.zone * (1 - 0.08 * c.treffer) };
  }
  function wechsle(phase) { c.phase = phase; c.phaseZeit = 0; sende('phase', { phase }); }

  function schritt(dt) {
    c.zeit += dt; c.phaseZeit += dt;
    if (c.sperre > 0) c.sperre = Math.max(0, c.sperre - dt);
    if (c.fangSperre > 0) c.fangSperre = Math.max(0, c.fangSperre - dt);
    if (c.phase === 'intro' && c.phaseZeit >= PH.intro) wechsle('laden');
    else if (c.phase === 'laden') {
      // Hilfe gegen Hängenbleiben: nach langer Zeit wird das Feld großzügiger
      if (c.phaseZeit > 12) c.zone.breite = Math.min(0.5, c.zone.breite + dt * 0.04);
      if (c.sperre <= 0) {
        // Zeiger pendelt hin und her; Tempo steigt ein wenig mit jedem Treffer
        const v = c.tempo * (1 + 0.14 * c.treffer) * 2;
        c.zeiger += c.richtung * v * dt;
        if (c.zeiger > 1) { c.zeiger = 2 - c.zeiger; c.richtung = -1; }
        if (c.zeiger < 0) { c.zeiger = -c.zeiger; c.richtung = 1; }
      }
    } else if (c.phase === 'oeffnen' && c.phaseZeit >= PH.oeffnen) {
      wechsle('beute');
      c.beutelGesamt = 3 + Math.min(3, c.perfekte);
      for (let i = 0; i < c.beutelGesamt; i++) c.beutel.push({ nr: i, start: 0.25 + i * BEUTE.abstand, u: -1, status: 'wartet', extra: i >= 3 });
      sende('beuteStart', { anzahl: c.beutelGesamt });
    } else if (c.phase === 'beute') {
      for (const b of c.beutel) {
        if (b.status === 'wartet' && c.phaseZeit >= b.start) { b.status = 'fliegt'; sende('beutelRaus', { nr: b.nr }); }
        if (b.status === 'fliegt') {
          b.u = (c.phaseZeit - b.start) / BEUTE.flug;
          if (b.u > BEUTE.fensterBis) { b.status = 'verpasst'; c.verpasst++; sende('beutelVerpasst', { nr: b.nr }); }
        }
        if (b.status === 'gefangen' || b.status === 'verpasst') b.nach = (b.nach || 0) + dt;
      }
      if (c.beutel.every(b => (b.status === 'gefangen' || b.status === 'verpasst') && b.nach > 0.45)) wechsle('abfahrt');
    } else if (c.phase === 'abfahrt' && c.phaseZeit >= PH.abfahrt) wechsle('fertig');
  }

  // Tippen / Leertaste
  function aktion() {
    if (c.phase === 'laden') {
      if (c.sperre > 0) return null;
      const abst = Math.abs(c.zeiger - c.zone.mitte);
      const halb = c.zone.breite / 2;
      let art;
      if (abst <= halb * 0.38) art = 'perfekt';
      else if (abst <= halb) art = 'gut';
      else art = 'daneben';
      c.ergebnisse.push(art);
      if (art === 'daneben') {
        c.daneben++; c.folgeDaneben++;
        c.abzug -= PUNKTE.daneben; rechne();
        c.sperre = 0.7;                                   // kostet etwas Zeit
        if (c.folgeDaneben >= 2) c.zone.breite = Math.min(0.42, c.zone.breite * 1.3); // nie dauerhaft blockiert
        sende('daneben', { zeiger: c.zeiger });
        return art;
      }
      c.folgeDaneben = 0;
      c.treffer++;
      if (art === 'perfekt') { c.perfekte++; c.trefferPunkte += PUNKTE.perfekt; } else { c.gute++; c.trefferPunkte += PUNKTE.gut; }
      rechne();
      sende('treffer', { art, nr: c.treffer, zeiger: c.zeiger });
      if (c.treffer >= 3) wechsle('oeffnen'); else neueZone();
      return art;
    }
    if (c.phase === 'beute') {
      if (c.fangSperre > 0) return null;
      const b = c.beutel.find(x => x.status === 'fliegt' && x.u >= BEUTE.fensterVon && x.u <= BEUTE.fensterBis);
      if (!b) { c.fangSperre = 0.22; sende('fangDaneben'); return 'leer'; }
      b.status = 'gefangen'; b.nach = 0; c.gefangen++;
      rechne();
      sende('gefangen', { nr: b.nr, extra: b.extra });
      return 'gefangen';
    }
    return null;
  }

  return {
    c, schritt, aktion, PH, BEUTE, timing,
    fertig: () => c.phase === 'fertig',
    // Erwartete Zeit, bis der Zeiger wieder in der Zonenmitte ist (für Tests und den Bot)
    imFeld: () => c.phase === 'laden' && c.sperre <= 0 && Math.abs(c.zeiger - c.zone.mitte) <= c.zone.breite / 2 * 0.3,
    fangbar: () => c.phase === 'beute' && c.beutel.some(x => x.status === 'fliegt' && x.u >= BEUTE.fensterVon + 0.06 && x.u <= BEUTE.fensterBis - 0.06),
  };
}
