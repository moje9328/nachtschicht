// ===================================================================
// 3 · FAHRT (Phase 2)
// Die ganze Verfolgungsfahrt ohne DOM: Spieler, Verkehr, Streifen,
// Kollisionen, Druck, Punkte. Fester Schritt DT. Läuft identisch in Node.
//
// Fairness: Jedes neue Verkehrsauto und jeder Spurwechsel wird vorher
// durchgerechnet (pfadFrei): Mit der tatsächlichen Geschwindigkeit des
// Spielers (Grundtempo und Boostfeld-Tempo) und seiner begrenzten Seitengeschwindigkeit
// muss es von seiner Position aus einen Weg an allen Autos vorbei geben, bis
// er alle passiert hat. Sonst entsteht das Auto nicht bzw. der Wechsel nicht.
// ===================================================================

function erstelleFahrt(auftragId, optionen = {}) {
  const A = AUFTRAEGE[auftragId];
  const strecke = baueStrecke(A);
  const rnd = zufall(optionen.seed == null ? 12345 : optionen.seed);
  const SP = SPUREN, HALB = strassenHalbe(SP);
  let vGrund = A.tempo;   // im Endlosmodus steigt es weich bis A.tempoMax
  const P = optionen.ohnePolizei ? null : A.polizei;
  const X_MIN = -HALB + SPIELER.breite / 2 + 0.12, X_MAX = -X_MIN;
  const SPAWN_MIN = ANSICHT.vorne + 20;     // nie im sichtbaren Bereich entstehen

  const sp = {
    d: 0, x: spurX(Math.floor((SP - 1) / 2), SP) + (SP % 2 ? 0 : SPUR / 2), v: vGrund * (optionen.startFaktor || 0.55),
    vx: 0, neigung: 0, zustand: 100, boostRest: 0, boostAnteil: 0, boostAn: false, schutz: 0,
    planke: 0, laenge: SPIELER.laenge, breite: SPIELER.breite,
  };
  if (SP % 2 === 0) sp.x = spurX(SP / 2, SP);   // gerade Spurzahl: rechte Mittelspur

  const w = {
    auftragId, A, strecke, sp, zeit: 0, phase: 'fahrt', grund: '', phaseZeit: 0,
    autos: [], polizei: [], anmeldungen: [], felder: [], naechstesFeld: BOOST.ersteBei,
    druck: 0, warnung: -1, maxDruck: 0,
    punkte: { strecke: 0, boostFelder: 0, serien: 0, ueberholen: 0, knapp: 0, marken: 0, abschluss: 0, zustand: 0, abgehaengt: 0 },
    statistik: { ueberholt: 0, knapp: 0, unfaelle: 0, polizeiKontakt: 0, abgehaengt: 0, boostZeit: 0, boostFelder: 0, maxTempo: 0, serien: 0, muster: {}, schaden: 0, warnungen: 0, besteSerie: 0 },
    serie: 0, letzterUnfall: -99, markeNr: 0,
    ereignisse: [], naechsteId: 1,
    spawnUhr: 0, polizeiUhr: P ? P.erste : 1e9,
    pruefung: { versuche: 0, abgelehnt: 0, wechselAbgelehnt: 0, rechnungen: 0, feldVerschoben: 0 },
    vGrund, HALB, SP,
  };
  const sende = (typ, daten = {}) => w.ereignisse.push({ typ, zeit: w.zeit, ...daten });

  // ---------------------------------------------------------------
  // Hilfen
  const spurVon = x => klemme(Math.round(x / SPUR + (SP - 1) / 2), 0, SP - 1);
  function autoX(a, t) {
    // seitliche Lage eines Verkehrsautos in t Sekunden (inkl. geplantem Spurwechsel)
    const wc = a.wechsel;
    if (!wc) return a.x;
    const tt = w.zeit + t;
    if (tt <= wc.beginn) return wc.ausX != null ? wc.ausX : spurX(wc.von, SP);
    const u = glatt((tt - wc.beginn) / wc.dauer);
    return mische(wc.ausX != null ? wc.ausX : spurX(wc.von, SP), spurX(wc.nach, SP), u);
  }
  function belegtSpur(a, spur) {
    if (a.wechsel) return a.wechsel.von === spur || a.wechsel.nach === spur;
    return spurVon(a.x) === spur;
  }

  // ---------------------------------------------------------------
  // Vorausschau: gibt es von der Spielerposition aus einen erreichbaren Weg?
  // extra: zusätzliche (geplante) Autos; ersatz: Map id → geändertes Auto
  const ZELLE = 0.35;
  const ZELLEN = Math.floor((X_MAX - X_MIN) / ZELLE) + 1;
  const PL_B = SPIELER.trefferLaenge + 2.6, PW_B = SPIELER.trefferBreite + 0.5;
  function pfadFrei(extra = [], vPlan = vGrund, alleStarts = false, ersatz = null, vorsprung = 0, streng = false) {
    const d0 = sp.d + vorsprung;
    // Planung (streng) mit zusätzlicher Reserve, damit nur Wege mit echtem Spielraum zählen
    const PL = PL_B + (streng ? 3 : 0), PW = PW_B + (streng ? 0.35 : 0);
    w.pruefung.rechnungen++;
    const liste = [];
    for (const a of w.autos) liste.push(ersatz && ersatz.has(a.id) ? ersatz.get(a.id) : a);
    for (const a of extra) liste.push(a);
    let T = 0;
    for (const a of liste) {
      const vor = a.d + a.laenge / 2 + PL / 2 + 1 - d0;
      if (vor < -2) continue;
      T = Math.max(T, vor / Math.max(0.8, vPlan - a.v));
    }
    if (T <= 0) return true;
    T = Math.min(T, 28);
    const dt = 0.12, schritte = Math.ceil(T / dt);
    const seitZellen = Math.max(1, Math.floor(SPIELER.seitMax * 0.7 * dt / ZELLE));
    // Zeitfenster je Auto, in dem es längs neben dem Spieler liegt (konstante Tempi → direkt berechenbar)
    const aktiv = [];
    const angestossen = [];   // Autos mit Anstoß nach einem Unfall: Schritt für Schritt vorausrechnen
    for (const a of liste) {
      if (a.stoss > 0.3) { angestossen.push({ a, r: (a.breite + PW) / 2, h: (a.laenge + PL) / 2 }); continue; }
      const rel = a.d - d0, dv = a.v - vPlan, h = (a.laenge + PL) / 2;
      let lo, hi;
      if (Math.abs(dv) < 1e-6) { if (Math.abs(rel) >= h) continue; lo = 0; hi = T; }
      else { const t1 = (-h - rel) / dv, t2 = (h - rel) / dv; lo = Math.min(t1, t2); hi = Math.max(t1, t2); }
      const k1 = Math.max(1, Math.ceil(lo / dt)), k2 = Math.min(schritte, Math.floor(hi / dt));
      if (k2 >= k1) aktiv.push({ a, k1, k2, r: (a.breite + PW) / 2 });
    }
    let reich = new Uint8Array(ZELLEN), neu = new Uint8Array(ZELLEN);
    if (alleStarts) reich.fill(1);
    else {
      const j0 = Math.round((klemme(sp.x, X_MIN, X_MAX) - X_MIN) / ZELLE);
      for (let j = j0 - 1; j <= j0 + 1; j++) if (j >= 0 && j < ZELLEN) reich[j] = 1;
    }
    const block = new Uint8Array(ZELLEN);
    for (let k = 1; k <= schritte; k++) {
      const t = k * dt;
      block.fill(0);
      for (const q of angestossen) {
        const ad = q.a.d + q.a.v * t + q.a.stoss * 1.1 * (1 - Math.exp(-t / 1.1));
        if (Math.abs(ad - (d0 + vPlan * t)) >= q.h) continue;
        const ax = autoX(q.a, t);
        const j1 = Math.max(0, Math.ceil((ax - q.r - X_MIN) / ZELLE)), j2 = Math.min(ZELLEN - 1, Math.floor((ax + q.r - X_MIN) / ZELLE));
        for (let j = j1; j <= j2; j++) block[j] = 1;
      }
      for (const q of aktiv) {
        if (k < q.k1 || k > q.k2) continue;
        const ax = autoX(q.a, t);
        const j1 = Math.max(0, Math.ceil((ax - q.r - X_MIN) / ZELLE)), j2 = Math.min(ZELLEN - 1, Math.floor((ax + q.r - X_MIN) / ZELLE));
        for (let j = j1; j <= j2; j++) block[j] = 1;
      }
      // Ausbreiten um seitZellen (gleitende Summe) und Blockiertes streichen
      let irgendwas = false, summe = 0;
      for (let j = 0; j < Math.min(ZELLEN, seitZellen); j++) summe += reich[j];
      for (let j = 0; j < ZELLEN; j++) {
        if (j + seitZellen < ZELLEN) summe += reich[j + seitZellen];
        if (j - seitZellen - 1 >= 0) summe -= reich[j - seitZellen - 1];
        const r = !block[j] && summe > 0 ? 1 : 0;
        neu[j] = r; if (r) irgendwas = true;
      }
      if (!irgendwas) return false;
      const tmp = reich; reich = neu; neu = tmp;
    }
    return true;
  }
  // Ein Plan ist fair, wenn er für Grundtempo und Boost-Tempo einen Weg lässt.
  // War die Lage schon vorher eng (eigene Fahrfehler), darf er wenigstens keine Wand bauen.
  // Zusätzlich darf für keinen Ankunftszeitpunkt (Spieler hat z. B. geboostet) eine geschlossene Wand entstehen.
  const VORSPRUENGE = [-26, -13, 0, 10, 20, 32, 46, 62, 80];   // negativ = Spieler kommt später an (z. B. nach einem Unfall)
  // Ergebnisse ohne Kandidat gelten für den ganzen Schritt: zwischenspeichern
  let merkZeit = -1, merk = new Map();
  function vorherFrei(v, alle, vs) {
    if (merkZeit !== w.zeit) { merkZeit = w.zeit; merk = new Map(); }
    const k = v + '|' + alle + '|' + vs;
    if (!merk.has(k)) merk.set(k, pfadFrei([], v, alle, null, vs, true));
    return merk.get(k);
  }
  function fair(extra, ersatz) {
    for (const v of [vGrund, Math.max(vGrund * BOOST.faktor, sp.v)]) {
      if (vorherFrei(v, false, 0)) { if (!pfadFrei(extra, v, false, ersatz, 0, true)) return false; }
      else if (!pfadFrei(extra, v, true, ersatz, 0, true)) return false;
    }
    for (const vs of VORSPRUENGE) {
      if (vorherFrei(vGrund, true, vs) && !pfadFrei(extra, vGrund, true, ersatz, vs, true)) return false;
    }
    // Verkehr und Boostfelder gemeinsam: Ein Weg über ein kommendes Feld (mit dem höheren
    // Tempo danach) darf durch neuen Verkehr nicht verbaut werden.
    for (const f of w.felder) {
      if (f.status !== 'offen' || f.d < sp.d || f.d > sp.d + 220) continue;
      if (!merk.has('feld' + f.id)) merk.set('feld' + f.id, feldWegFrei(f, [], null, true));
      if (merk.get('feld' + f.id) && !feldWegFrei(f, extra, ersatz, true)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // Weg über ein Boostfeld: bis zum Feld Grundtempo, auf dem Feld muss die Mitte des Autos
  // über dem Feld liegen, danach volle Boostdauer mit +30 % und Abklingen.
  function feldWegFrei(f, extra = [], ersatz = null, alleStarts = false) {
    const liste = [];
    for (const a of w.autos) liste.push(ersatz && ersatz.has(a.id) ? ersatz.get(a.id) : a);
    for (const a of extra) liste.push(a);
    const v0 = Math.max(vGrund, sp.v), vB = vGrund * BOOST.faktor;
    const tF = Math.max(0, (f.d - sp.d) / v0);
    const tB = BOOST.dauer + BOOST.abklingen * 0.5;
    const weg = t => (t <= tF ? v0 * t : v0 * tF + vB * Math.min(t - tF, tB) + vGrund * Math.max(0, t - tF - tB));
    let T = tF + 0.5;
    for (const a of liste) {
      const vor = a.d + a.laenge / 2 + 12 - sp.d;
      if (vor > 0) T = Math.max(T, vor / Math.max(0.8, vGrund - a.v));
    }
    T = Math.min(T, 30);
    const PL = PL_B + 3, PW = PW_B + 0.35;
    const dt = 0.1, schritte = Math.ceil(T / dt);
    const seitZellen = Math.max(1, Math.floor(SPIELER.seitMax * 0.7 * dt / ZELLE));
    let reich = new Uint8Array(ZELLEN), neu = new Uint8Array(ZELLEN);
    if (alleStarts) reich.fill(1);
    else { const j0 = Math.round((klemme(sp.x, X_MIN, X_MAX) - X_MIN) / ZELLE); for (let j = j0 - 1; j <= j0 + 1; j++) if (j >= 0 && j < ZELLEN) reich[j] = 1; }
    const block = new Uint8Array(ZELLEN);
    const kTor = Math.max(1, Math.round(tF / dt));
    for (let k = 1; k <= schritte; k++) {
      const t = k * dt, pd = sp.d + weg(t);
      block.fill(0);
      for (const a of liste) {
        if (Math.abs(a.d + a.v * t - pd) >= (a.laenge + PL) / 2) continue;
        const ax = autoX(a, t), r = (a.breite + PW) / 2;
        const j1 = Math.max(0, Math.ceil((ax - r - X_MIN) / ZELLE)), j2 = Math.min(ZELLEN - 1, Math.floor((ax + r - X_MIN) / ZELLE));
        for (let j = j1; j <= j2; j++) block[j] = 1;
      }
      if (k === kTor) for (let j = 0; j < ZELLEN; j++) if (Math.abs(X_MIN + j * ZELLE - f.x) > f.breite / 2 - 0.2) block[j] = 1;   // „Tor“: über das Feld
      let irgendwas = false, summe = 0;
      for (let j = 0; j < Math.min(ZELLEN, seitZellen); j++) summe += reich[j];
      for (let j = 0; j < ZELLEN; j++) {
        if (j + seitZellen < ZELLEN) summe += reich[j + seitZellen];
        if (j - seitZellen - 1 >= 0) summe -= reich[j - seitZellen - 1];
        const r = !block[j] && summe > 0 ? 1 : 0;
        neu[j] = r; if (r) irgendwas = true;
      }
      if (!irgendwas) return false;
      const tmp = reich; reich = neu; neu = tmp;
    }
    return true;
  }

  // Boostfelder platzieren: außerhalb des Bildes, auf einer Spur ohne Auto darüber, nur wenn
  // der Weg über das Feld und danach mit Boosttempo frei ist. Erstes Feld leicht (eigene Spur).
  function planeFelder() {
    if (sp.d + ANSICHT.vorne + 30 < w.naechstesFeld) return;
    const d = Math.max(w.naechstesFeld, sp.d + ANSICHT.vorne + 12);
    if (d > strecke.zielVon - BOOST.zielFrei) { w.naechstesFeld = 1e9; return; }
    const erstes = w.felder.length === 0;
    const eigene = spurVon(sp.x);
    let spuren = [...Array(SP).keys()].sort(() => rnd() - 0.5);
    if (erstes) spuren = [eigene];
    else if (rnd() < 0.35) spuren = [eigene, ...spuren.filter(s => s !== eigene)];
    for (const s of spuren) {
      const f = { id: w.naechsteId++, d, spur: s, x: spurX(s, SP), laenge: BOOST.feldLaenge, breite: BOOST.feldBreite, status: 'offen' };
      const darueber = w.autos.concat(w.polizei).some(a => Math.abs(a.x - f.x) < (a.breite + f.breite) / 2 && Math.abs(a.d - f.d) < (a.laenge + f.laenge) / 2 + 12);
      if (darueber) continue;
      if (!feldWegFrei(f, [], null, false) || !feldWegFrei(f, [], null, true)) continue;
      w.felder.push(f);
      w.naechstesFeld = d + rnd.zwischen(BOOST.abstand[0], BOOST.abstand[1]);
      return;
    }
    w.naechstesFeld = d + 25; w.pruefung.feldVerschoben++;   // gerade kein fairer Platz: etwas später versuchen
  }

  // ---------------------------------------------------------------
  // Verkehr erzeugen
  function typWahl(abschnitt) {
    const liste = Object.entries(FAHRZEUGE).map(([k, f]) => [k, f.anteil * ((k === 'laster' || k === 'bus') ? abschnitt.laster : 1)]);
    let s = liste.reduce((q, [, a]) => q + a, 0) * rnd();
    for (const [k, a] of liste) { s -= a; if (s <= 0) return k; }
    return 'taxi';
  }
  function neuesAuto(typ, spur, d, v) {
    const f = FAHRZEUGE[typ];
    return {
      id: w.naechsteId++, typ, spur, x: spurX(spur, SP), d, v, vSoll: v, stoss: 0,
      laenge: f.laenge, breite: f.breite, wechsel: null, wechselSperre: 2 + rnd() * 3,
      vorbei: false, getroffen: false, knappMin: 99, knappFertig: false, kontaktBis: -1, wackel: 0,
      farbe: rnd.ganz(5), geboren: w.zeit,
    };
  }
  // Aktuelle Werte (Endlos: weich ansteigend bis zur Obergrenze; Missionen: fest)
  function stand() {
    const u = schwierigkeit(A, sp.d);
    const m = {};
    for (const k of Object.keys(A.muster)) m[k] = A.endlos ? mische(A.muster[k], A.musterMax[k], u) : A.muster[k];
    return {
      u, muster: m,
      dichte: A.endlos ? mische(A.dichte, A.dichteZiel, steigerung(A, sp.d)) : A.dichte,
      wechsel: A.endlos ? mische(A.wechselFaktor, A.wechselZiel, steigerung(A, sp.d)) : A.wechselFaktor,
      tempo: A.endlos ? Math.min(A.tempoSicher, mische(A.tempo, A.tempoZiel, steigerung(A, sp.d))) : A.tempo,
    };
  }
  // Rhythmus: intensive Abschnitte im Wechsel mit kurzer Entlastung (nie ganz leer)
  function welle(d) { const [an, aus] = A.welle; return (d % (an + aus)) < an ? 1.12 : 0.5; }
  w.welle = welle;

  function passtInSpur(kand) {
    // Abstand und Tempo zu Autos in derselben Spur, damit niemand auffährt
    for (const a of w.autos.concat(w.polizei)) {
      if (!belegtSpur(a, kand.spur)) continue;
      const luecke = Math.abs(a.d - kand.d) - (a.laenge + kand.laenge) / 2;
      if (luecke < A.mindestLuecke) return false;
      if (!a.typ) continue;   // Streifen passen ihr Tempo selbst an, nur Abstand halten
      if (a.d < kand.d && a.v > kand.v + 0.3 && luecke < 900) kand.v = kand.vSoll = Math.max(kand.v, a.v); // hinten schneller → mitziehen
      if (a.d > kand.d && a.v < kand.v - 0.3) kand.v = kand.vSoll = Math.min(kand.v, a.v);
    }
    return kand.v < vGrund - 6;   // Verkehr bleibt deutlich langsamer als der Spieler
  }
  function reihenfolgeOk(kand) {
    for (const a of w.autos) {
      if (!belegtSpur(a, kand.spur)) continue;
      if (a.d < kand.d && a.v > kand.v + 0.3) return false;   // hinten schneller → würde auffahren
      if (a.d > kand.d && a.v < kand.v - 0.3) return false;   // vorne langsamer → würde aufholen
    }
    return true;
  }
  const klein = () => (rnd() < 0.55 ? 'kugel' : 'taxi');
  const tempoVon = typ => rnd.zwischen(FAHRZEUGE[typ].tempo[0], FAHRZEUGE[typ].tempo[1]) * vGrund / TEMPO_BEZUG;
  function musterWahl(gewichte) {
    let summe = 0; for (const k in gewichte) summe += gewichte[k];
    let r = rnd() * summe;
    for (const k in gewichte) { r -= gewichte[k]; if (r <= 0) return k; }
    return 'einzel';
  }
  // Baut eine Verkehrsgruppe ab Spur s0. Gruppen fahren gleich schnell (außer Lkw-Mix), damit
  // ihre Form erhalten bleibt und die Lücke lesbar ist.
  function baueGruppe(muster, s0, dSpawn, ab) {
    const r = rnd() < 0.5 ? -1 : 1;
    const nb = s0 + r >= 0 && s0 + r < SP ? s0 + r : s0 - r;
    const g = [];
    if (muster === 'paar') { const t = klein(); g.push(neuesAuto(t, s0, dSpawn, tempoVon(t)), neuesAuto(klein(), nb, dSpawn + rnd.zwischen(-2, 3), 0)); }
    else if (muster === 'versetzt') { const t = klein(); g.push(neuesAuto(t, s0, dSpawn, tempoVon(t)), neuesAuto(rnd() < 0.3 ? 'kasten' : klein(), nb, dSpawn + rnd.zwischen(12, 18), 0)); }
    else if (muster === 'lkwMix') {
      g.push(neuesAuto('laster', s0, dSpawn + 6, tempoVon('laster')));
      const t = klein(); g.push(neuesAuto(t, nb, dSpawn - rnd.zwischen(4, 9), tempoVon(t)));
      return g;   // eigene Tempi: der Kleinwagen ist schneller und zieht vorbei
    } else if (muster === 'tor') {
      // drei Autos nebeneinander, eine Lücke: rechtzeitig in die freie Spur wechseln
      const t = klein(), v = tempoVon(t);
      for (let s = 0; s < SP; s++) if (s !== s0) g.push(neuesAuto(rnd() < 0.25 ? 'kasten' : klein(), s, dSpawn + rnd.zwischen(-1.5, 1.5), v));
    } else if (muster === 'slalom') {
      // abwechselnde Ausweichrichtung: Spur s0, Nachbar, wieder s0
      const t = klein(), v = tempoVon(t);
      g.push(neuesAuto(t, s0, dSpawn, v), neuesAuto(klein(), nb, dSpawn + 21, v), neuesAuto(klein(), s0, dSpawn + 42, v));
    } else { const t = typWahl(ab); g.push(neuesAuto(t, s0, dSpawn, tempoVon(t))); return g; }
    const v = g[0].v; for (const a of g) a.v = a.vSoll = v;
    return g;
  }
  function versucheSpawn() {
    const dSpawn = sp.d + SPAWN_MIN + rnd() * 32;
    if (dSpawn > strecke.zielVon - 130) return;
    if (sp.d < 120 && A.erklaeren) return;   // kurzer ruhiger Start
    const ab = strecke.abschnittBei(dSpawn);
    const st = stand();
    const ziel = st.dichte * ab.dichte * welle(dSpawn);
    // Dichte = Autos je 100 m Straße vor dem Spieler (bis zur Spawnzone)
    let vorne = 0;
    for (const a of w.autos) if (a.d > sp.d - 6 && a.d < sp.d + SPAWN_MIN + 26) vorne++;
    if (vorne >= ziel * (SPAWN_MIN + 32) / 100) return;
    w.pruefung.versuche++;
    // In der Entlastung nur Einzelautos
    const muster = welle(dSpawn) < 1 ? 'einzel' : musterWahl(st.muster);
    // alle Spuren als Kandidaten (die Wegsuche ist schnell genug)
    const spuren = [...Array(SP).keys()].sort(() => rnd() - 0.5);
    for (const s0 of spuren) {
      const gruppe = baueGruppe(muster, s0, dSpawn, ab);
      if (!gruppe.every(passtInSpur)) { w.pruefung.luecke = (w.pruefung.luecke || 0) + 1; continue; }
      if (muster !== 'einzel' && muster !== 'lkwMix') {
        // gemeinsames Tempo im Bereich, den alle Spuren der Gruppe erlauben (niemand holt später jemanden ein)
        let lo = 0, hi = vGrund - 6;
        for (const g of gruppe) for (const a of w.autos) {
          if (!belegtSpur(a, g.spur)) continue;
          if (a.d < g.d) lo = Math.max(lo, a.v); else hi = Math.min(hi, a.v);
        }
        if (lo > hi + 1e-9) { w.pruefung.tempoBereich = (w.pruefung.tempoBereich || 0) + 1; continue; }
        const v = klemme(Math.min(...gruppe.map(a => a.v)), lo, hi);
        for (const a of gruppe) a.v = a.vSoll = v;
      }
      if (!gruppe.every(reihenfolgeOk)) { w.pruefung.reihenfolge = (w.pruefung.reihenfolge || 0) + 1; continue; }
      if (!fair(gruppe, null)) { w.pruefung.abgelehnt++; continue; }
      for (const a of gruppe) w.autos.push(a);
      w.statistik.muster[muster] = (w.statistik.muster[muster] || 0) + 1;
      return;
    }
  }

  // ---------------------------------------------------------------
  // Spurwechsel des Verkehrs: sichtbare Vorankündigung, freier Zielbereich
  const BLINK = 1.45, WECHSEL = 1.55;
  function spielerGefahr(a, nachSpur, ab, bis) {
    // Würde der Wechsel den Spieler schneiden? Spieler mit aktuellem und mit Boost-Tempo
    const zielX = spurX(nachSpur, SP);
    if (Math.abs(sp.x - zielX) > SPUR / 2 + sp.breite / 2 + 0.6) return false;
    for (const v of [sp.v, vGrund * BOOST.faktor]) {
      for (let t = ab; t <= bis + 0.01; t += 0.2) {
        const rel = (sp.d + v * t) - (a.d + a.v * t);
        if (rel > -(a.laenge / 2 + 16) && rel < a.laenge / 2 + 5) return true;
      }
    }
    return false;
  }
  function zielFrei(a, nach, bis) {
    for (const b of w.autos.concat(w.polizei)) {
      if (b === a || !belegtSpur(b, nach)) continue;
      for (let t = 0; t <= bis + 1; t += 0.25) {
        if (Math.abs((b.d + b.v * t) - (a.d + a.v * t)) < (a.laenge + b.laenge) / 2 + 7) return false;
      }
    }
    return true;
  }
  function planeWechsel(a, ab) {
    if (a.wechsel || a.wechselSperre > 0 || a.wackel > 0) return;
    const rel = a.d - sp.d;
    if (rel < 24 || rel > ANSICHT.vorne - 6) return;
    const p = ab.wechsel * stand().wechsel * (a.typ === 'laster' || a.typ === 'bus' ? 0.4 : 1);
    if (rnd() > p * DT * 12) return;      // wird nur alle 12 Schritte gefragt
    const nach = a.spur + (rnd() < 0.5 ? -1 : 1);
    if (nach < 0 || nach >= SP) return;
    if (!zielFrei(a, nach, BLINK + WECHSEL)) return;
    if (spielerGefahr(a, nach, BLINK, BLINK + WECHSEL)) return;
    const plan = { ...a, wechsel: { von: a.spur, nach, beginn: w.zeit + BLINK, dauer: WECHSEL } };
    if (!fair([], new Map([[a.id, plan]]))) { w.pruefung.wechselAbgelehnt++; a.wechselSperre = 2; return; }
    a.wechsel = plan.wechsel;
    sende('blinker', { id: a.id });
  }

  // ---------------------------------------------------------------
  // Hindernis voraus (für Verkehr und Streifen): nächstes Fahrzeug in der eigenen Breite
  function vorderes(a, liste) {
    let best = null, luecke = 1e9;
    for (const b of liste) {
      if (b === a || b.d <= a.d) continue;
      if (Math.abs(b.x - a.x) > (a.breite + b.breite) / 2 + 0.35) continue;
      const l = b.d - b.laenge / 2 - (a.d + a.laenge / 2);
      if (l < luecke) { luecke = l; best = b; }
    }
    return best ? { b: best, luecke } : null;
  }

  function aktualisiereVerkehr() {
    const alle = w.autos.concat(w.polizei, [sp]);
    const ab = strecke.abschnittBei(sp.d + 40);
    for (const a of w.autos) {
      a.wechselSperre -= DT; if (a.wackel > 0) a.wackel = Math.max(0, a.wackel - DT * 1.4);
      if (w.phase === 'fahrt' && (w.zeit * 120 | 0) % 12 === a.id % 12) planeWechsel(a, ab);
      // Blinken läuft: Spieler hineingefahren? Dann abbrechen (vor dem Losfahren)
      if (a.wechsel && w.zeit < a.wechsel.beginn && spielerGefahr(a, a.wechsel.nach, a.wechsel.beginn - w.zeit, a.wechsel.beginn - w.zeit + a.wechsel.dauer)) {
        a.wechsel = null; a.wechselSperre = 3;
      }
      if (a.wechsel) {
        a.x = autoX(a, 0);
        if (w.zeit >= a.wechsel.beginn + a.wechsel.dauer) { a.spur = a.wechsel.nach; a.x = spurX(a.spur, SP); a.wechsel = null; a.wechselSperre = 4; }
      }
      // Tempo: Wunschtempo, aber niemals auffahren (auch nicht auf Spieler oder Streife)
      let vz = a.vSoll;
      const vo = vorderes(a, alle);
      if (vo) {
        const vb = vo.b.v + (vo.b.stoss || 0);
        if (vo.luecke < 6 + a.v * 0.35 && vb < vz) vz = vb - (vo.luecke < 3 ? 1.5 : 0);
      }
      if (a.v < vz) a.v = Math.min(vz, a.v + 2.2 * DT); else a.v = Math.max(vz, a.v - 7 * DT);
      a.stoss *= Math.exp(-DT / 1.1);
      a.d += (a.v + a.stoss) * DT;
    }
    // Autos verlassen das Bild nach hinten bzw. sind zu weit vorne
    w.autos = w.autos.filter(a => a.d > sp.d - ANSICHT.hinten - 30 && a.d < sp.d + 400);
    if (w.felder.length > 6) w.felder = w.felder.filter(f => f.d > sp.d - ANSICHT.hinten - 20);
  }

  // ---------------------------------------------------------------
  // Streifen
  function planePolizei(dt) {
    if (!P || w.phase !== 'fahrt') return;
    for (const m of w.anmeldungen) {
      m.rest -= dt;
      if (m.rest <= 0 && !m.erledigt) {
        // Platz hinter dem Spieler frei? Sonst kurz warten
        const d = sp.d - ANSICHT.hinten - 7, x = spurX(m.spur, SP);   // knapp außerhalb des Bildes, nach Vorwarnung
        const frei = w.autos.concat(w.polizei).every(b => Math.abs(b.d - d) > (b.laenge + POLIZEI_AUTO.laenge) / 2 + 4 || Math.abs(b.x - x) > 2.6);
        if (!frei) { m.rest = 0.25; continue; }
        m.erledigt = true;
        w.polizei.push({
          id: w.naechsteId++, d, x, vx: 0, v: Math.min(vGrund * P.tempo, Math.max(sp.v + 3, vGrund * 0.8)), spur: m.spur, zielSpur: m.spur, planUhr: 0,
          laenge: POLIZEI_AUTO.laenge, breite: POLIZEI_AUTO.breite, kontaktBis: -1, wackel: 0, stoss: 0, geboren: w.zeit, fragend: 0,
        });
        sende('polizeiDa');
      }
    }
    w.anmeldungen = w.anmeldungen.filter(m => !m.erledigt);
    w.polizeiUhr -= dt;
    if (w.polizeiUhr > 0) return;
    const polMax = A.endlos && schwierigkeit(A, sp.d) > 0.7 ? P.maxSpaet : P.max;
    if (w.polizei.length + w.anmeldungen.length >= polMax || sp.d > strecke.zielVon - 450) { w.polizeiUhr = 1; return; }
    // Spur mit wenig Verkehr hinter dem Spieler, nicht direkt die Spielerspur, wenn es anders geht
    const ps = spurVon(sp.x);
    let best = null, bestWert = 1e9;
    for (let s = 0; s < SP; s++) {
      let wert = (s === ps ? 3 : 0) + Math.abs(s - ps) * 0.4 + rnd() * 0.5;
      for (const b of w.autos) if (belegtSpur(b, s) && b.d < sp.d && b.d > sp.d - 70) wert += 5;
      for (const m of w.anmeldungen) if (m.spur === s) wert += 9;
      if (wert < bestWert) { bestWert = wert; best = s; }
    }
    w.anmeldungen.push({ spur: best, rest: 2.3, gesamt: 2.3 });
    sende('polizeiWarnung', { spur: best });
    w.polizeiUhr = P.pause + rnd() * 5;
  }

  function aktualisierePolizei() {
    if (!P) return;
    const vMax = vGrund * P.tempo;
    const ps = spurVon(sp.x);
    const hindernisse = w.autos.concat(w.polizei, [sp]);
    // Spielerspur vorne belegt? Dann Platz lassen.
    const eingeengt = w.autos.some(a => a.d > sp.d && a.d - sp.d < 34 && Math.abs(a.x - sp.x) < (a.breite + sp.breite) / 2 + 0.4);
    for (const p of w.polizei) {
      if (p.wackel > 0) p.wackel = Math.max(0, p.wackel - DT * 1.4);
      if (w.phase !== 'fahrt') {   // Ziel erreicht oder gescheitert: Streifen rollen aus
        p.v = Math.max(0, p.v - 8 * DT); p.d += p.v * DT; p.fragend += DT; continue;
      }
      p.planUhr -= DT;
      const nah = sp.d - p.d < 16;
      if (p.planUhr <= 0) {
        p.planUhr = 0.3;
        // Spur mit der größten freien Lücke voraus; in der Nähe bevorzugt neben den Spieler
        let best = p.zielSpur, bestWert = 1e9;
        const eigene = spurVon(p.x);
        for (let s = 0; s < SP; s++) {
          let frei = 60;
          for (const b of w.autos) if (belegtSpur(b, s) && b.d > p.d - 3) frei = Math.min(frei, b.d - b.laenge / 2 - (p.d + p.laenge / 2));
          const ab = Math.abs(s - ps);
          let wert = -Math.max(0, frei) + Math.abs(s - eigene) * 5;
          if (nah) wert += ab === 1 ? 0 : ab === 0 ? 8 : 16;
          for (const q of w.polizei) if (q !== p && q.zielSpur === s) wert += 10;
          if (wert < bestWert) { bestWert = wert; best = s; }
        }
        p.zielSpur = best;
      }
      // Wunschabstand: seitlich hinter dem Spieler, in seiner Spur 11 m dahinter. Ist die Spur des
      // Spielers vorne belegt, fällt die Streife weiter zurück – sie klemmt ihn nie ein.
      const gleicheSpur = p.zielSpur === ps;
      let zielD = sp.d - (gleicheSpur ? 11 : 6.5);
      if (eingeengt) zielD = Math.min(zielD, sp.d - 13);
      let vw = klemme(sp.v + klemme((zielD - p.d) * 0.85, -9, 9), vGrund * 0.55, vMax);
      // Nichts rammen und nichts durchfahren
      // Nichts rammen und nichts durchfahren: rechtzeitig bremsen (echter Bremsweg bei 14 m/s²)
      const vo = vorderes(p, hindernisse);
      let notbremse = false;
      if (vo) {
        const vb = vo.b.v + (vo.b.stoss || 0), dv = Math.max(0, p.v - vb);
        const noetig = (vo.b === sp ? 3 + p.v * 0.05 : 4 + p.v * 0.12) + dv * dv / (2 * 14);
        if (vo.luecke < noetig) { vw = Math.min(vw, vb - (vo.luecke < noetig * 0.6 ? 2 : 0.3)); notbremse = vo.luecke < noetig * 0.8; }
      }
      // Nie vor den Spieler setzen
      if (p.d > sp.d - 0.5 && Math.abs(p.x - sp.x) < 2.6) vw = Math.min(vw, sp.v - 1.5);
      if (p.d > sp.d + 2) vw = Math.min(vw, sp.v - 2);
      if (p.v < vw) p.v = Math.min(vw, p.v + 8.5 * DT); else p.v = Math.max(vw, p.v - (notbremse ? 18 : 12) * DT);
      // Seitlich: nur wenn der Korridor frei ist, begrenzte Lenkrate
      const zielX = spurX(p.zielSpur, SP);
      let vxw = klemme((zielX - p.x) * 2.6, -P.seit, P.seit);
      if (Math.abs(vxw) > 0.05) {
        const richtung = Math.sign(vxw);
        for (const b of hindernisse) {
          if (b === p) continue;
          const seitlich = (b.x - p.x) * richtung;
          const abstandX = seitlich - (b.breite + p.breite) / 2;
          if (seitlich > 0 && abstandX < 1.2 && Math.abs(b.d - p.d) < (b.laenge + p.laenge) / 2 + 2.5) { vxw = 0; break; }
        }
      }
      // Dem Spieler ausweichen, wenn er herüberzieht
      const dx = p.x - sp.x;
      if (Math.abs(p.d - sp.d) < (p.laenge + sp.laenge) / 2 + 1.5 && Math.abs(dx) < (p.breite + sp.breite) / 2 + 0.9 && Math.sign(sp.vx) === -Math.sign(dx) && Math.abs(sp.vx) > 1) {
        const weg = Math.sign(dx) * P.seit, rand = p.x + Math.sign(dx) * 1.5;
        if (rand > -HALB + 1 && rand < HALB - 1) vxw = weg;
      }
      p.vx += klemme(vxw - p.vx, -18 * DT, 18 * DT);
      p.x = klemme(p.x + p.vx * DT, -HALB + p.breite / 2 + 0.1, HALB - p.breite / 2 - 0.1);
      p.stoss *= Math.exp(-DT / 0.8);
      p.d += (p.v + p.stoss) * DT;
    }
    // Abgehängt: weit zurückgefallen
    for (const p of w.polizei) {
      if (w.phase === 'fahrt' && p.d < sp.d - 75) {
        p.weg = true; w.statistik.abgehaengt++; w.punkte.abgehaengt += PUNKTE.abgehaengt;
        w.druck = Math.max(0, w.druck - DRUCK.abgehaengt);
        sende('abgehaengt', { punkte: PUNKTE.abgehaengt });
      }
      if (w.phase !== 'fahrt' && p.d < sp.d - 60) p.weg = true;
    }
    w.polizei = w.polizei.filter(p => !p.weg);
  }

  // ---------------------------------------------------------------
  // Spieler
  function aktualisiereSpieler(e) {
    const imZiel = w.phase !== 'fahrt';
    // Boost nur durch Boostfelder: weich an, volle Dauer, sanft zurück
    if (!imZiel && sp.boostRest > 0) {
      sp.boostRest = Math.max(0, sp.boostRest - DT);
      sp.boostAnteil = Math.min(1, sp.boostAnteil + DT / BOOST.anstieg);
    } else sp.boostAnteil = Math.max(0, sp.boostAnteil - DT / BOOST.abklingen);
    if (imZiel) sp.boostRest = 0;
    const warAn = sp.boostAn;
    sp.boostAn = sp.boostAnteil > 0.02;
    if (warAn && !sp.boostAn) sende('boostEnde');
    if (sp.boostAn) w.statistik.boostZeit += DT;
    // Längs: automatisch auf Grundtempo, mit Boostfeld bis +30 %; im Ziel ausrollen
    let vZiel = imZiel ? 0 : vGrund * (1 + (BOOST.faktor - 1) * glatt(sp.boostAnteil));
    // Klebt der Kombi direkt am Heck eines Autos, beschleunigt er nicht weiter hinein (kein Dauerrempeln) –
    // vorbei kommt man durch einen Spurwechsel
    for (const a of w.autos) {
      if (a.d <= sp.d || Math.abs(a.x - sp.x) > (a.breite * 0.88 + SPIELER.trefferBreite) / 2) continue;
      const luecke = a.d - sp.d - (a.laenge * 0.92 + SPIELER.trefferLaenge) / 2;
      if (luecke < 0.8) vZiel = Math.min(vZiel, a.v + (a.stoss || 0));
    }
    if (sp.v < vZiel) sp.v = Math.min(vZiel, sp.v + (sp.boostAn ? SPIELER.boostBeschl : SPIELER.beschl) * DT);
    else sp.v = Math.max(vZiel, sp.v - (imZiel ? 9 : SPIELER.bremsen) * DT);
    w.statistik.maxTempo = Math.max(w.statistik.maxTempo, sp.v);
    // Quer: Finger-Ziel (relativ), Richtungstasten oder ausrollen – kein automatischer Spurwechsel
    let vxw = 0;
    if (imZiel) vxw = 0;
    else if (e.ziel != null && e.spur) vxw = klemme((klemme(e.ziel, X_MIN, X_MAX) - sp.x) * SPIELER.spurFaktor, -SPIELER.spurMax, SPIELER.spurMax);
    else if (e.ziel != null) vxw = klemme((klemme(e.ziel, X_MIN, X_MAX) - sp.x) * SPIELER.zielFaktor, -SPIELER.seitMax, SPIELER.seitMax);
    else if (e.richtung) vxw = e.richtung * SPIELER.seitMax;
    const seitA = e.spur ? SPIELER.spurBeschl : (vxw === 0 || Math.sign(vxw) !== Math.sign(sp.vx)) ? SPIELER.seitBremse : SPIELER.seitBeschl;
    sp.vx += klemme(vxw - sp.vx, -seitA * DT, seitA * DT);
    sp.x += sp.vx * DT;
    if (sp.x < X_MIN || sp.x > X_MAX) {
      sp.x = klemme(sp.x, X_MIN, X_MAX);
      if (Math.abs(sp.vx) > 2.5 && sp.planke <= 0) { sende('planke', { seite: Math.sign(sp.vx) }); sp.planke = 0.4; }
      sp.vx = 0;
      if (!imZiel) sp.v *= Math.pow(SCHADEN.leitplanke, DT * 60);
    }
    if (sp.planke > 0) sp.planke -= DT;
    sp.neigung += (klemme(sp.vx / SPIELER.seitMax, -1.4, 1.4) * SPIELER.neigungMax - sp.neigung) * Math.min(1, DT * 14);
    const dAlt = sp.d;
    sp.d += sp.v * DT;
    // Boostfelder: Überfahrt in Weltkoordinaten, über die ganze in diesem Schritt gefahrene Strecke
    // (kein Überspringen bei hohem Tempo). Die Wagenmitte muss über dem Feld liegen.
    for (const f of w.felder) {
      if (f.status !== 'offen') continue;
      const hinten = dAlt - SPIELER.trefferLaenge / 2, vorne = sp.d + SPIELER.trefferLaenge / 2;
      if (vorne >= f.d - f.laenge / 2 && hinten <= f.d + f.laenge / 2) {
        if (!imZiel && Math.abs(sp.x - f.x) <= f.breite / 2) {
          f.status = 'genutzt';
          const auffrischen = sp.boostRest > 0 || sp.boostAnteil > 0.02;
          sp.boostRest = BOOST.dauer;            // auffrischen, nicht addieren
          w.statistik.boostFelder++;
          w.punkte.boostFelder += PUNKTE.boostFeld;
          sende('boostFeld', { auffrischen, punkte: PUNKTE.boostFeld, id: f.id });
        }
      } else if (hinten > f.d + f.laenge / 2) f.status = 'verpasst';
    }
    if (sp.schutz > 0) sp.schutz = Math.max(0, sp.schutz - DT);
  }

  // ---------------------------------------------------------------
  // Kollisionen: Spielerbox etwas kleiner als das Bild, höchstens ein Schaden pro Schritt
  function ueberlapp(a, aw, al, b, bw, bl) {
    const ox = (aw + bw) / 2 - Math.abs(a.x - b.x), od = (al + bl) / 2 - Math.abs(a.d - b.d);
    return ox > 0 && od > 0 ? { ox, od } : null;
  }
  function kollisionen() {
    let schadenSchon = false;
    const imZiel = w.phase !== 'fahrt';
    const trefferMit = (b, istPolizei) => {
      const bw = b.breite * (istPolizei ? 0.9 : 0.88), bl = b.laenge * 0.92;
      const o = ueberlapp(sp, SPIELER.trefferBreite, SPIELER.trefferLaenge, b, bw, bl);
      if (!o) return;
      if (imZiel) return;
      const vonHinten = sp.d < b.d && o.od / bl < o.ox / bw * 1.3;    // Spieler fährt auf
      const vonVorne = sp.d > b.d && o.od / bl < o.ox / bw * 1.3;     // wird angefahren
      let art;
      if (vonHinten) {
        art = 'auffahren';
        sp.d = b.d - (bl + SPIELER.trefferLaenge) / 2 - 0.05;
        sp.v = Math.min(sp.v, Math.max(b.v * 0.97, sp.v * SCHADEN.tempoNachUnfall));
        b.stoss = Math.max(b.stoss || 0, SCHADEN.stoss);   // einmaliger Schubs, nie aufaddiert
      } else if (vonVorne) {
        art = 'angefahren';
        b.d = sp.d - (bl + SPIELER.trefferLaenge) / 2 - 0.05;
        b.v = Math.min(b.v, sp.v * 0.85);
      } else {
        art = 'seite';
        const r = Math.sign(sp.x - b.x) || 1;
        sp.x = klemme(sp.x + r * (o.ox * 0.75 + 0.04), X_MIN, X_MAX);
        b.x += -r * o.ox * 0.25;
        sp.vx = r * 3.5;
        sp.v *= SCHADEN.tempoNachStreifen;
      }
      b.wackel = 1;
      // Derselbe Kontakt: solange sich die Autos berühren und bis 3,5 s nach dem letzten Schaden durch dieses Auto
      const neuerKontakt = b.kontaktBis < w.zeit && !(b.schadenZeit > w.zeit - 3.5);
      b.kontaktBis = w.zeit + 0.35;
      b.getroffen = true;
      if (!neuerKontakt || sp.schutz > 0 || schadenSchon) { sende('beruehrung', { id: b.id }); return; }
      schadenSchon = true;
      b.schadenZeit = w.zeit;
      const schaden = istPolizei ? SCHADEN.polizei : art === 'seite' ? SCHADEN.streifschuss : SCHADEN.verkehr;
      sp.zustand = Math.max(0, sp.zustand - schaden);
      sp.schutz = SCHADEN.schutzzeit;
      w.statistik.schaden += schaden;
      w.serie = 0; w.letzterUnfall = w.zeit;
      w.druck = Math.min(DRUCK.max, w.druck + (istPolizei ? DRUCK.polizeiKontakt : DRUCK.unfall));
      if (istPolizei) w.statistik.polizeiKontakt++; else w.statistik.unfaelle++;
      sende('unfall', { art, schaden, polizei: istPolizei, x: (sp.x + b.x) / 2, d: (sp.d + b.d) / 2, id: b.id });
    };
    for (const a of w.autos) trefferMit(a, false);
    for (const p of w.polizei) trefferMit(p, true);
    // Streifen und Verkehr durchdringen sich nie: auseinanderschieben, Streife bremst
    for (const p of w.polizei) for (const a of w.autos) {
      const o = ueberlapp(p, p.breite, p.laenge, a, a.breite, a.laenge);
      if (!o) continue;
      if (o.od < o.ox * 1.4) {
        if (p.d < a.d) { p.d -= o.od + 0.05; p.v = Math.min(p.v, a.v) * 0.9; } else { a.d -= o.od + 0.05; a.v = Math.min(a.v, p.v); }
      } else { const r = Math.sign(p.x - a.x) || 1; p.x += r * (o.ox + 0.05); p.vx = 0; }
      if (p.kontaktBis < w.zeit) sende('rempler', { x: (p.x + a.x) / 2, d: (p.d + a.d) / 2 });
      p.kontaktBis = w.zeit + 0.4; p.wackel = 1; a.wackel = 1;
    }
    // Verkehr untereinander (Sicherheitsnetz): nie ineinander
    for (let i = 0; i < w.autos.length; i++) for (let j = i + 1; j < w.autos.length; j++) {
      const a = w.autos[i], b = w.autos[j];
      const o = ueberlapp(a, a.breite, a.laenge, b, b.breite, b.laenge);
      if (!o) continue;
      const [hinten, vorn] = a.d < b.d ? [a, b] : [b, a];
      if (o.od < o.ox * 1.4) { hinten.d -= o.od + 0.05; hinten.v = Math.min(hinten.v, vorn.v); }
      else { const r = Math.sign(a.x - b.x) || 1; a.x += r * o.ox / 2; b.x -= r * o.ox / 2; }
    }
    for (const p of w.polizei) for (const q of w.polizei) {
      if (p.id >= q.id) continue;
      const o = ueberlapp(p, p.breite, p.laenge, q, q.breite, q.laenge);
      if (!o) continue;
      if (o.od < o.ox * 1.4) { const h = p.d < q.d ? p : q; h.d -= o.od + 0.05; h.v *= 0.95; }
      else { const r = Math.sign(p.x - q.x) || 1; p.x += r * o.ox / 2; q.x -= r * o.ox / 2; }
    }
  }

  // ---------------------------------------------------------------
  // Punkte für Überholen und knappes Vorbeifahren – je Auto genau einmal
  function wertung() {
    for (const a of w.autos) {
      const ueberlappt = Math.abs(sp.d - a.d) < (sp.laenge + a.laenge) / 2;
      if (ueberlappt && !a.knappFertig) a.knappMin = Math.min(a.knappMin, Math.abs(sp.x - a.x) - (sp.breite + a.breite) / 2);
      if (!a.vorbei && sp.d > a.d) {
        a.vorbei = true;
        if (!a.getroffen && w.phase === 'fahrt') {
          const faktor = 1 + Math.min(w.serie, PUNKTE.serieMax) * PUNKTE.serieStufe;
          const p = Math.round(PUNKTE.ueberholen * faktor);
          w.punkte.ueberholen += p; w.serie++; w.statistik.ueberholt++;
          w.statistik.besteSerie = Math.max(w.statistik.besteSerie, w.serie);
          if (w.serie % PUNKTE.serieSchritt === 0) { w.punkte.serien += PUNKTE.serieBonus; w.statistik.serien++; sende('serie', { serie: w.serie, punkte: PUNKTE.serieBonus }); }
          w.druck = Math.max(0, w.druck - DRUCK.ueberholen);
          sende('ueberholt', { punkte: p, serie: w.serie, id: a.id });
        }
      }
      if (a.vorbei && !a.knappFertig && sp.d - sp.laenge / 2 > a.d + a.laenge / 2) {
        a.knappFertig = true;
        if (!a.getroffen && a.knappMin < PUNKTE.knappAbstand && w.phase === 'fahrt') {
          w.punkte.knapp += PUNKTE.knapp; w.statistik.knapp++;
          sende('knapp', { punkte: PUNKTE.knapp, id: a.id, x: a.x, d: a.d });
        }
      }
    }
  }

  // ---------------------------------------------------------------
  function druckUndWarnung() {
    if (!P || w.phase !== 'fahrt') return;
    let gewinn = 0, nahe = false, fern = false;
    for (const p of w.polizei) {
      const dist = Math.hypot(sp.d - p.d, (sp.x - p.x) * 1.4);
      if (dist < DRUCK.naheRadius) { nahe = true; gewinn += P.druck * (1 - 0.6 * dist / DRUCK.naheRadius); }
      else if (dist < DRUCK.fernRadius) fern = true;
    }
    let delta = gewinn;
    if (!nahe) delta -= fern ? DRUCK.zerfallFern : DRUCK.zerfallFrei;
    if (w.zeit - w.letzterUnfall > DRUCK.sauberNach) delta -= DRUCK.sauberBonus;
    w.druck = klemme(w.druck + delta * DT, 0, DRUCK.max);
    w.maxDruck = Math.max(w.maxDruck, w.druck);
    if (w.warnung < 0 && w.druck >= DRUCK.max) { w.warnung = DRUCK.warnungDauer; w.statistik.warnungen++; sende('warnung'); }
    else if (w.warnung >= 0) {
      w.warnung -= DT;
      if (w.druck < DRUCK.warnungEnde) { w.warnung = -1; sende('entkommen'); }
      else if (w.warnung <= 0) beende('gestellt');
    }
  }

  function beende(grund) {
    if (w.phase !== 'fahrt') return;
    w.phase = grund === 'ziel' ? 'ziel' : 'aus';
    w.grund = grund; w.phaseZeit = 0; w.warnung = -1;
    if (grund === 'ziel') {
      w.punkte.abschluss = PUNKTE.abschluss * (A.nr || 0.4);
      w.punkte.zustand = Math.round(sp.zustand) * PUNKTE.proZustand;
    }
    sp.boostRest = 0;
    sende('ende', { grund });
  }

  // ---------------------------------------------------------------
  function schritt(eingabe = {}) {
    if (w.phase === 'fertig') return;
    w.zeit += DT; w.phaseZeit += DT;
    // Endlos: Grundtempo steigt weich mit der Strecke – immer weiter, aber abflachend
    if (A.endlos && w.phase === 'fahrt') { vGrund = vGrund + klemme(stand().tempo - vGrund, -0.5 * DT, 0.5 * DT); w.vGrund = vGrund; }
    aktualisiereSpieler(eingabe);
    aktualisiereVerkehr();
    aktualisierePolizei();
    kollisionen();
    wertung();
    if (w.phase === 'fahrt') {
      w.punkte.strecke += sp.v * DT * PUNKTE.proMeter * (sp.boostAn ? PUNKTE.boostFaktor : 1);
      druckUndWarnung();
      w.spawnUhr -= DT;
      if (w.spawnUhr <= 0) { w.spawnUhr = 0.15; versucheSpawn(); planeFelder(); }
      planePolizei(DT);
      while (sp.d >= strecke.marke(w.markeNr)) {
        w.markeNr++; w.punkte.marken += PUNKTE.marke;
        w.druck = Math.max(0, w.druck - DRUCK.marke);
        sende('marke', { nr: w.markeNr, von: strecke.anzahlMarken + 1, abschnitt: strecke.abschnittBei(sp.d + 1).name, punkte: PUNKTE.marke });
      }
      if (sp.zustand <= 0) beende('wrack');
      else if (sp.d >= strecke.zielVon) beende('ziel');
    } else if (w.phaseZeit > (w.phase === 'ziel' ? 3.2 : 2.2)) {
      w.phase = 'fertig';
      sende('fertig');
    }
  }

  function summe() {
    const p = w.punkte;
    return Math.round(p.strecke + p.boostFelder + p.serien + p.ueberholen + p.knapp + p.marken + p.abschluss + p.zustand + p.abgehaengt);
  }

  return {
    w, sp, strecke, schritt, summe, pfadFrei, fair, spurVon, autoX, X_MIN, X_MAX,
    rest: () => Math.max(0, strecke.zielVon - sp.d),
  };
}
