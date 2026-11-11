// ===================================================================
// 9 · APP
// Zustände: menue → coup → fahrt → ergebnis, dazu pause. Ein einziger
// Game Loop (requestAnimationFrame) mit festem Simulationsschritt DT.
// Neustart baut alles frisch auf: Simulation, Partikel, Eingabe, Meldungen.
// window.__nacht ist nur für die automatischen Tests da.
// ===================================================================

(() => {
  const $ = id => document.getElementById(id);
  const cv = $('bild'), c = cv.getContext('2d');
  const titelCv = $('startTitel'), titelC = titelCv.getContext('2d');
  const ergCv = $('ergebnisBild'), ergC = ergCv.getContext('2d');
  const params = new URLSearchParams(location.search);
  const TEMPO = klemme(Number(params.get('tempo')) || 1, 0.1, 16);        // nur für Tests
  const FESTER_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
  const bewegungRuhig = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  Grafik.setzeRuhig(bewegungRuhig.matches);
  if (bewegungRuhig.addEventListener) bewegungRuhig.addEventListener('change', e => Grafik.setzeRuhig(e.matches));

  // ---------------------------------------------------------------
  // Zustand
  let zustand = 'menue';              // menue | coup | fahrt | pause | ergebnis
  let vorPause = null;
  let lauf = null;                    // aktueller Auftrag
  let menueStrecke = baueStrecke(AUFTRAEGE.endlos);
  let touchGesehen = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const zahl = n => Math.round(n).toLocaleString('de-DE');

  function setzeZustand(z) {
    zustand = z;
    document.body.dataset.zustand = z === 'pause' ? (vorPause || 'fahrt') : z;
    Eingabe.leeren();
    aktualisiereSteuerung();
  }

  // ---------------------------------------------------------------
  // Layout: festes logisches Sichtfenster, mittig, gleich viel Straße auf allen Geräten
  const lay = { breite: 0, hoehe: 0, dpr: 1, sicht: { x: 0, y: 0, w: 1, h: 1 }, modus: 'unten' };
  function sichereRaender() {
    const s = getComputedStyle($('sicherProbe'));
    return { l: parseFloat(s.paddingLeft) || 0, t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0 };
  }
  function layout() {
    const W = window.innerWidth, Hh = window.innerHeight, sr = sichereRaender();
    lay.breite = W; lay.hoehe = Hh;
    lay.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * lay.dpr); cv.height = Math.round(Hh * lay.dpr);
    const hud = $('hud');
    const hudH = (hud.offsetHeight || 80) + Math.max(6, sr.t) + 6;
    const quer = W > Hh * 0.95;
    lay.modus = touchGesehen && !quer ? 'unten' : 'seite';
    const flaeche = $('lenkflaeche'), aktion = $('aktionKnopf'), links = $('linksKnopf'), rechts = $('rechtsKnopf');
    const knoepfe = Speicher.knoepfe;
    const setze = (el, x, y, w, h) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    let area;
    if (lay.modus === 'unten') {
      const steuerH = klemme(Hh * 0.15, 104, 140);   // ohne Boostknopf: mehr Platz für die Fahransicht
      const oben = Hh - sr.b - steuerH;
      area = { x: sr.l, y: hudH, w: W - sr.l - sr.r, h: oben - hudH - 4 };
      setze(flaeche, 0, oben, W, steuerH + sr.b);
      flaeche.className = '';
      $('lenkHinweis').style.right = '0px';
      const ks = Math.min(76, steuerH - 40);
      setze(links, sr.l + 12, steuerH - ks - 12, ks, ks);
      setze(rechts, sr.l + 24 + ks, steuerH - ks - 12, ks, ks);
      setze(aktion, W / 2 - Math.min(150, W * 0.35), oben + 16, Math.min(300, W * 0.7), steuerH - 32);
    } else {
      area = { x: sr.l + 4, y: hudH, w: W - sr.l - sr.r - 8, h: Hh - sr.b - hudH - 6 };
    }
    // Sichtfenster einpassen: schmale/hohe Flächen bekommen oben mehr Himmel, keine zusätzliche Straße
    const A = ANSICHT.seitenverhaeltnis;
    let sw, sh, sx, sy;
    if (area.w / area.h > A) { sh = area.h; sw = sh * A; sx = area.x + (area.w - sw) / 2; sy = area.y; }
    else { sw = area.w; sh = sw / A; sx = area.x; sy = area.y + area.h - sh; }
    lay.sicht = { x: sx, y: sy, w: sw, h: sh };
    if (lay.modus === 'seite') {
      const linksB = sx - sr.l, rechtsB = W - sr.r - (sx + sw);
      if (touchGesehen && linksB >= 130) {
        setze(flaeche, 0, hudH, sx, Hh - hudH); flaeche.className = 'seite';
        $('lenkHinweis').style.right = '0px';
        const ks = Math.min(84, (linksB - 36) / 2);
        setze(links, sr.l + 12, Hh - hudH - sr.b - ks - 20, ks, ks);
        setze(rechts, sr.l + 24 + ks, Hh - hudH - sr.b - ks - 20, ks, ks);
      } else {
        // Maus/Desktop: auf der Straße selbst ziehen
        setze(flaeche, sx, sy, sw, sh); flaeche.className = 'unsichtbar';
      }
      const aw = Math.min(260, Math.max(rechtsB - 30, 180));
      if (rechtsB >= 200) setze(aktion, sx + sw + (rechtsB - aw) / 2, Hh - sr.b - 110, aw, 80);
      else setze(aktion, sx + sw / 2 - 120, sy + sh - 100, 240, 76);
      const tipp = $('tastenTipp');
      if (!touchGesehen && linksB > 170) {
        tipp.hidden = false;
        Object.assign(tipp.style, { left: (sr.l + 16) + 'px', top: (sy + sh * 0.45) + 'px', width: (linksB - 32) + 'px' });
      } else tipp.hidden = true;
    } else $('tastenTipp').hidden = true;
    const ue = $('ueberspringenKnopf');
    Object.assign(ue.style, { left: (sx + sw - 150) + 'px', top: (sy + 8) + 'px' });
    $('meldung').style.top = (sy + sh * 0.2) + 'px';
    $('hinweis').style.top = (sy + 6) + 'px';
    links.hidden = rechts.hidden = !knoepfe;
    $('lenkHinweis').hidden = !(lay.modus === 'unten' || flaeche.className === 'seite');
    aktualisiereSteuerung();
    zeichneTitel();
  }
  function aktualisiereSteuerung() {
    const fahrt = zustand === 'fahrt' || (zustand === 'pause' && vorPause === 'fahrt');
    const coup = zustand === 'coup' || (zustand === 'pause' && vorPause === 'coup');
    const spiel = fahrt || coup;
    $('lenkflaeche').hidden = !spiel;
    $('aktionKnopf').hidden = !coup;
    $('ueberspringenKnopf').hidden = !(coup && lauf);
    $('linksKnopf').hidden = $('rechtsKnopf').hidden = !(fahrt && Speicher.knoepfe);
    $('lenkHinweis').style.visibility = fahrt ? 'visible' : 'hidden';
    const tipp = $('tastenTipp');
    tipp.innerHTML = coup ? '<b>LEERTASTE</b><br>Impuls / Fangen<br><br><b>P</b> Pause<br><b>M</b> Ton'
      : '<b>PFEILTASTEN</b><br>oder <b>A</b> / <b>D</b><br>lenken<br><br>Pfeilfelder auf<br>der Straße geben<br><b>BOOST</b><br><br><b>P</b> Pause<br><b>M</b> Ton<br><br>Maus: auf der<br>Straße ziehen';
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));

  // ---------------------------------------------------------------
  // Eingabe verbinden
  Eingabe.verbindeFlaeche($('lenkflaeche'));
  Eingabe.verbindeKnoepfe($('linksKnopf'), $('rechtsKnopf'));
  Eingabe.st.aktiv = () => (zustand === 'fahrt' && lauf && lauf.fahrt ? 'fahrt' : zustand === 'coup' ? 'coup' : null);
  Eingabe.st.spieler = () => {
    const F = lauf && lauf.fahrt;
    if (!F) return { x: 0, min: -5, max: 5, breite: 12 };
    return { x: F.sp.x, min: F.X_MIN, max: F.X_MAX, breite: F.X_MAX - F.X_MIN + SPIELER.breite };
  };
  Eingabe.st.empfindlich = Speicher.empfindlich;
  Eingabe.st.beiAktion = () => coupAktion();
  Eingabe.st.beiPause = () => { if (zustand === 'pause') weiter(); else if (zustand === 'coup' || zustand === 'fahrt') pause(false); };
  Eingabe.st.beiTon = () => schalteTon();
  Eingabe.st.beiErsterBeruehrung = e => {
    Ton.wecke();
    if (e.pointerType === 'touch' && !touchGesehen) { touchGesehen = true; layout(); }
  };
  // Klicks auf die Bühne (Coup: tippen irgendwo)
  cv.addEventListener('pointerdown', e => { Ton.wecke(); if (e.pointerType === 'touch' && !touchGesehen) { touchGesehen = true; layout(); } if (zustand === 'coup') { e.preventDefault(); coupAktion(); } });
  $('aktionKnopf').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); Ton.wecke(); if (zustand === 'coup') coupAktion(); });
  $('aktionKnopf').addEventListener('click', e => e.preventDefault());
  $('ueberspringenKnopf').addEventListener('click', e => { e.stopPropagation(); if (zustand === 'coup' && lauf) { Ton.klick(); starteFahrt(true); } });
  $('pauseKnopf').addEventListener('click', () => { if (zustand === 'coup' || zustand === 'fahrt') pause(false); });
  $('neustartSchnell').addEventListener('click', () => { if (lauf && (zustand === 'fahrt' || zustand === 'coup')) { Ton.klick(); starteAuftrag(lauf.id, false); } });
  document.addEventListener('pointerdown', () => Ton.wecke(), { capture: true });
  document.addEventListener('keydown', () => Ton.wecke(), { capture: true });

  // ---------------------------------------------------------------
  // Ton-Schalter
  function zeigeTon() {
    const an = Speicher.ton;
    document.querySelectorAll('.js-ton').forEach(k => { k.setAttribute('aria-pressed', String(an)); if (!k.classList.contains('rund')) k.textContent = `Ton: ${an ? 'an' : 'aus'}`; });
  }
  function schalteTon() { Speicher.ton = !Speicher.ton; Ton.setze(Speicher.ton); if (Speicher.ton) Ton.klick(); zeigeTon(); }
  document.querySelectorAll('.js-ton').forEach(k => k.addEventListener('click', schalteTon));
  for (const [id, name] of [['pegelEffekte', 'effekte'], ['pegelMusik', 'musik']]) {
    const el = $(id), aus = $(id + 'Wert');
    el.value = Math.round(Speicher[name] * 100); aus.textContent = `${el.value} %`;
    Ton.pegel(name, Speicher[name]);
    el.addEventListener('input', () => { Speicher[name] = el.value / 100; aus.textContent = `${el.value} %`; Ton.pegel(name, Speicher[name]); });
    el.addEventListener('change', () => { if (name !== 'musik') Ton.klick(); });
  }
  Ton.setze(Speicher.ton); zeigeTon();

  // Steuerungs-Einstellungen
  $('knoepfeWahl').checked = Speicher.knoepfe;
  $('knoepfeWahl').addEventListener('change', e => { Speicher.knoepfe = e.target.checked; layout(); });
  function zeigeEmpf() { document.querySelectorAll('.js-empf').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.wert) === Speicher.empfindlich))); }
  document.querySelectorAll('.js-empf').forEach(b => b.addEventListener('click', () => { Speicher.empfindlich = Number(b.dataset.wert); Eingabe.st.empfindlich = Speicher.empfindlich; Ton.klick(); zeigeEmpf(); }));
  zeigeEmpf();

  // ---------------------------------------------------------------
  // Fenster
  const ABSCHNITTE_FENSTER = ['fStart', 'fAuftraege', 'fSound', 'fSteuerung', 'fPause', 'fErgebnis'];
  let fensterZurueck = 'fStart';
  function zeigeFenster(id) {
    const f = $('fenster');
    if (!id) { f.hidden = true; cv.focus({ preventScroll: true }); return; }
    f.hidden = false;
    for (const a of ABSCHNITTE_FENSTER) $(a).hidden = a !== id;
    f.querySelector('.tafel').setAttribute('aria-labelledby', id + 'Titel');
    f.querySelector('.tafel').classList.toggle('breit', id === 'fSteuerung' || id === 'fAuftraege');
    const erster = $(id).querySelector('.btn.main') || $(id).querySelector('.auftrag') || $(id).querySelector('.btn');
    if (erster) erster.focus({ preventScroll: true });
  }
  document.querySelectorAll('.js-zurueck').forEach(b => b.addEventListener('click', () => { Ton.klick(); zeigeFenster(fensterZurueck); }));
  $('auftragWahlKnopf').addEventListener('click', () => { Ton.klick(); zeigeAuftraege(); });
  $('spielenKnopf').addEventListener('click', () => { Ton.klick(); starteAuftrag('endlos', false); });
  $('soundKnopf').addEventListener('click', () => { Ton.klick(); fensterZurueck = 'fStart'; zeigeFenster('fSound'); });
  $('steuerungKnopf').addEventListener('click', () => { Ton.klick(); fensterZurueck = 'fStart'; zeigeFenster('fSteuerung'); });
  $('pauseSteuerungKnopf').addEventListener('click', () => { Ton.klick(); fensterZurueck = 'fPause'; zeigeFenster('fSteuerung'); });
  $('weiterKnopf').addEventListener('click', () => weiter());
  $('neustartKnopf').addEventListener('click', () => { Ton.klick(); if (lauf) starteAuftrag(lauf.id, lauf.mitCoup); });
  $('pauseMenueKnopf').addEventListener('click', () => { Ton.klick(); zeigeStart(); });
  $('nochmalKnopf').addEventListener('click', () => { Ton.klick(); if (lauf) starteAuftrag(lauf.id, lauf.mitCoup); });
  $('ergebnisAuftraegeKnopf').addEventListener('click', () => { Ton.klick(); if (lauf && lauf.id !== 'endlos') { beendeLauf(); zeigeAuftraege(); } else zeigeStart(); });

  function zeigeStart() {
    beendeLauf();
    const r = Speicher.beste('endlos');
    $('startRekord').hidden = !r.versuche;
    $('startRekord').textContent = `Neon-Endlos-Rekord: ${zahl(r.punkte)} Punkte · ${(r.strecke / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
    fensterZurueck = 'fStart';
    zeigeFenster('fStart');
    zeichneTitel();
  }
  function zeigeAuftraege() {
    fensterZurueck = 'fStart';
    const liste = $('auftragListe');
    liste.textContent = '';
    for (const id of AUFTRAG_LISTE) {
      const A = AUFTRAEGE[id], b = Speicher.beste(id), km = (baueStrecke(A).laenge / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 });
      const k = document.createElement('button');
      k.type = 'button'; k.className = 'auftrag'; k.dataset.auftrag = id; k.style.setProperty('--g', A.farbe);
      const alt = Speicher.alt(id);
      k.innerHTML = `<span class="nr">${A.nr}</span><h3>${A.name.toUpperCase()}</h3><p>${A.kurz} · ${km} km</p><p>${A.text}</p>`
        + `<p class="best">${b.geschafft ? `Bestleistung: ${zahl(b.punkte)} Punkte · ${b.zeit.toLocaleString('de-DE')} s` : b.versuche ? 'Noch nicht geschafft' : 'Neu'}${alt && alt.geschafft ? ` · vor der Überarbeitung: ${zahl(alt.punkte)}` : ''}</p>`;
      k.title = A.text;
      k.addEventListener('click', () => { Ton.klick(); starteAuftrag(id, $('coupWahl').checked); });
      liste.appendChild(k);
    }
    $('coupWahl').checked = Speicher.coupEinstieg;
    zeigeFenster('fAuftraege');
  }
  $('coupWahl').addEventListener('change', e => { Speicher.coupEinstieg = e.target.checked; });

  // ---------------------------------------------------------------
  // Meldungen und Hinweise (zeitgesteuert über den Game Loop, keine setTimeout)
  const meldung = { text: '', rest: 0, klasse: '' };
  function melde(text, dauer = 1.6, klasse = '') { meldung.text = text; meldung.rest = dauer; meldung.klasse = klasse; $('meldung').textContent = text; $('meldung').className = klasse; $('ansage').textContent = text.replace(/\n/g, ' '); }
  const hinweis = { rest: 0, gezeigt: new Set() };
  function zeigeHinweis(schluessel, text, dauer = 4.5, immer = false) {
    if (!immer && (!lauf || !lauf.A.erklaeren)) return;
    if (hinweis.gezeigt.has(schluessel)) return;
    // keine Erklärtexte in dichten Verkehrssituationen (später erneut versuchen)
    const F = lauf && lauf.fahrt;
    if (F && F.sp.d > 150 && F.w.autos.some(a => a.d > F.sp.d && a.d - F.sp.d < ANSICHT.vorne * 0.7)) return;
    dauer = Math.min(dauer, 3);
    hinweis.gezeigt.add(schluessel);
    $('hinweis').textContent = text; $('hinweis').hidden = false; hinweis.rest = dauer;
  }
  function meldungenSchritt(dt) {
    if (meldung.rest > 0) { meldung.rest -= dt; if (meldung.rest <= 0) { $('meldung').textContent = ''; } }
    if (hinweis.rest > 0) { hinweis.rest -= dt; if (hinweis.rest <= 0) $('hinweis').hidden = true; }
  }
  function meldungenLeeren() { meldung.rest = 0; $('meldung').textContent = ''; hinweis.rest = 0; $('hinweis').hidden = true; hinweis.gezeigt = new Set(); }

  // ---------------------------------------------------------------
  // Auftrag starten / Coup / Fahrt
  function beendeLauf() {
    lauf = null;
    vorPause = null;
    Grafik.partikelLeeren(); Grafik.leereBlasen();
    meldungenLeeren();
    setzeZustand('menue');
  }
  function neuerSeed() { return FESTER_SEED != null ? FESTER_SEED : (Math.random() * 4294967296) >>> 0; }
  function starteAuftrag(id, mitCoup) {
    beendeLauf();
    const A = AUFTRAEGE[id];
    const coup = id !== 'endlos' && !!mitCoup;
    lauf = { id, A, seed: neuerSeed(), coup: null, fahrt: null, startUhr: 0, ruetteln: 0, mitCoup: coup, coupErgebnis: null, gesamtZeit: 0 };
    Speicher.auftrag = id === 'endlos' ? Speicher.auftrag : id;
    document.body.dataset.modus = id === 'endlos' ? 'endlos' : 'auftrag';
    zeigeFenster(null);
    if (!coup) { starteFahrt(false); return; }
    lauf.coup = erstelleCoup(A.coup, lauf.seed ^ 0x5eed);
    setzeZustand('coup');
    melde(`MISSION ${A.nr}\n${A.name.toUpperCase()}`, 1.6, 'gross');
    zeigeHinweis('coup', touchGesehen ? 'Tippe, wenn der Zeiger im hellen Feld steht. Drei Treffer laden den Impulsschlüssel.' : 'Leertaste, wenn der Zeiger im hellen Feld steht. Drei Treffer laden den Impulsschlüssel.', 4, true);
  }
  function starteFahrt(uebersprungen) {
    const C = lauf.coup && lauf.coup.c;
    lauf.coupErgebnis = !C
      ? { gespielt: false, uebersprungen: false, timing: 0, beutel: 0, beutelPunkte: 0, perfekte: 0, gute: 0, daneben: 0 }
      : uebersprungen
        ? { gespielt: false, uebersprungen: true, timing: 0, beutel: 0, beutelPunkte: 0, perfekte: 0, gute: 0, daneben: 0 }
        : { gespielt: true, uebersprungen: false, timing: Math.max(0, C.trefferPunkte - C.abzug), beutel: C.gefangen, beutelPunkte: C.gefangen * PUNKTE.beutel, perfekte: C.perfekte, gute: C.gute, daneben: C.daneben };
    lauf.coup = null;
    lauf.fahrt = erstelleFahrt(lauf.id, { seed: lauf.seed });
    lauf.startUhr = lauf.id === 'endlos' ? 0.6 : 1.1;
    Grafik.partikelLeeren(); Grafik.leereBlasen();
    $('hudBeuteFeld').classList.toggle('ausgeblendet', !lauf.coupErgebnis.gespielt);
    $('hudRestTitel').textContent = lauf.id === 'endlos' ? 'STRECKE' : 'ZIEL';
    setzeZustand('fahrt');
    melde(lauf.id === 'endlos' ? 'NEON-ENDLOS' : `MISSION ${lauf.A.nr}\n${lauf.A.name.toUpperCase()}`, 1.0, 'gross');
    zeigeHinweis('lenken', touchGesehen ? `Lenken: Finger ${lay.modus === 'unten' ? 'unten' : 'links'} auf die Steuerfläche legen und seitlich ziehen.` : 'Lenken: Pfeiltasten oder A / D.', 3.5, true);
  }
  function coupAktion() {
    if (zustand !== 'coup' || !lauf || !lauf.coup) return;
    const erg = lauf.coup.aktion();
    if (!erg) return;
    verarbeiteCoupEreignisse();
  }

  // ---------------------------------------------------------------
  // Pause, Tabwechsel
  function pause(automatisch) {
    if (zustand !== 'coup' && zustand !== 'fahrt') return;
    vorPause = zustand;
    setzeZustand('pause');
    Ton.anhalten();
    $('pauseText').textContent = automatisch ? 'Automatisch angehalten, weil das Spiel nicht im Vordergrund war. Weiter geht es erst, wenn du es willst.' : 'Alles steht still, bis du weiterspielst.';
    fensterZurueck = 'fPause';
    zeigeFenster('fPause');
  }
  function weiter() {
    if (zustand !== 'pause' || !lauf) return;
    Ton.fortsetzen(); Ton.klick();
    zeigeFenster(null);
    const z = vorPause; vorPause = null;
    setzeZustand(z);
    if (z === 'fahrt') { lauf.startUhr = Math.max(lauf.startUhr, 0.9); melde('WEITER!', 0.9, 'gross'); }
    letzteZeit = performance.now(); akku = 0;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (zustand === 'coup' || zustand === 'fahrt') pause(true); else Ton.anhalten(); } else if (zustand !== 'pause') Ton.fortsetzen(); });
  window.addEventListener('blur', () => { if (zustand === 'coup' || zustand === 'fahrt') pause(true); });
  window.addEventListener('pagehide', () => { if (zustand === 'coup' || zustand === 'fahrt') pause(true); });

  // ---------------------------------------------------------------
  // Ereignisse → Ton, Partikel, Meldungen
  let coupText = null;
  function verarbeiteCoupEreignisse() {
    const co = lauf.coup; if (!co) return;
    for (const e of co.c.ereignisse) {
      if (e.typ === 'treffer') {
        Ton.treffer(e.art, e.nr);
        coupText = { text: e.art === 'perfekt' ? `PERFEKT! +${PUNKTE.perfekt}` : `GUT! +${PUNKTE.gut}`, zeit: 0, farbe: e.art === 'perfekt' ? '#24D6CD' : '#FFD35A' };
        const n = e.art === 'perfekt' ? 14 : 7;
        for (let i = 0; i < n; i++) Grafik.bildPartikel({ art: 'konfetti', x: 0.08 + e.zeiger * 0.84, y: 0.86, vx: (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.3, g: 0.9, dauer: 0.9, farbe: ['#24D6CD', '#FFD35A', '#FF4FD8'][i % 3], vdreh: 8 });
      } else if (e.typ === 'daneben') {
        Ton.daneben();
        coupText = { text: `DANEBEN! ${PUNKTE.daneben}`, zeit: 0, farbe: '#FF805B' };
      } else if (e.typ === 'phase' && e.phase === 'oeffnen') {
        Ton.oeffnen();
        melde('KLACK!', 1.0, 'gross');
        const anzahl = bewegungRuhig.matches ? 14 : 40;
        for (let i = 0; i < anzahl; i++) Grafik.bildPartikel({ art: 'konfetti', x: 0.3, y: 0.5, vx: (Math.random() - 0.5) * 0.9, vy: -0.25 - Math.random() * 0.6, g: 0.8, dauer: 1.6, farbe: ['#24D6CD', '#FFD35A', '#FF4FD8', '#FF9A3D'][i % 4], vdreh: (Math.random() - 0.5) * 12 });
        for (let i = 0; i < 9; i++) Grafik.bildPartikel({ art: 'rauch', x: 0.3 + (Math.random() - 0.5) * 0.25, y: 0.52 + (Math.random() - 0.5) * 0.1, vx: (Math.random() - 0.5) * 0.08, vy: -0.05, dauer: 1.4, groesse: 0.04 + Math.random() * 0.03, farbe: 'rgba(181, 160, 220, 0.75)' });
      } else if (e.typ === 'beuteStart') {
        zeigeHinweis('fangen', touchGesehen ? 'Tippe, wenn eine Tasche im Ring ist!' : 'Leertaste, wenn eine Tasche im Ring ist!', 2.5, true);
      } else if (e.typ === 'beutelRaus') Ton.beutelRaus();
      else if (e.typ === 'gefangen') { Ton.gefangen(e.extra); coupText = { text: `GEFANGEN! +${PUNKTE.beutel}`, zeit: 0, farbe: '#24D6CD' }; }
      else if (e.typ === 'beutelVerpasst') { Ton.verpasst(); coupText = { text: 'PLUMPS!', zeit: 0, farbe: '#FF805B' }; }
      else if (e.typ === 'phase' && e.phase === 'abfahrt') { melde('AB IN DEN KOMBI!', 1.2, 'gross'); $('hinweis').hidden = true; }
    }
    co.c.ereignisse.length = 0;
  }

  function verarbeiteFahrtEreignisse() {
    const F = lauf.fahrt, w = F.w, sp = F.sp;
    for (const e of w.ereignisse) {
      switch (e.typ) {
        case 'boostFeld':
          Ton.boostFeld(e.auffrischen);
          Grafik.blase('BOOST!', sp.d + 11, sp.x, '#FFD35A', 0.8, 0.9);
          for (let i = 0; i < (bewegungRuhig.matches ? 4 : 10); i++) Grafik.weltPartikel({ d: sp.d - 2.4, x: sp.x + (Math.random() - 0.5) * 1.6, h: 0.4, vh: 0.8, vd: sp.v * 0.75, vx: (Math.random() - 0.5) * 1.5, dauer: 0.5, groesse: 0.22, farbe: i % 2 ? 'rgba(255, 211, 90, 0.8)' : 'rgba(36, 214, 205, 0.8)' });
          zeigeHinweis('boostFeld', 'Boost! Schneller und mehr Punkte – aber weniger Zeit zum Reagieren.', 3);
          break;
        case 'unfall': {
          Ton.unfall(e.art !== 'seite');
          Eingabe.neuBasis();
          lauf.ruetteln = 0.25;
          Grafik.blase(e.polizei ? 'BONK!' : e.art === 'seite' ? 'RATSCH!' : 'KLONK!', e.d, e.x, '#FFD35A', 0.9, 1.2);
          for (let i = 0; i < 10; i++) Grafik.weltPartikel({ art: 'funke', d: e.d, x: e.x, h: 0.6, vh: 2 + Math.random() * 3, g: 9, vd: sp.v * 0.6 + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 6, dauer: 0.5, groesse: 0.18, farbe: i % 2 ? '#FFD35A' : '#FF9A3D' });
          for (let i = 0; i < 4; i++) Grafik.weltPartikel({ d: e.d, x: e.x + (Math.random() - 0.5), h: 0.8, vh: 1, vd: sp.v * 0.7, dauer: 0.9, groesse: 0.55, wachsen: true, farbe: 'rgba(181, 160, 220, 0.6)' });
          if (sp.zustand <= 40) zeigeHinweis('zustand', 'Achtung: Der Kombi hält nicht mehr viel aus!', 3, true);
          break;
        }
        case 'beruehrung': Ton.beruehrung(); break;
        case 'planke': Ton.planke(); for (let i = 0; i < 5; i++) Grafik.weltPartikel({ art: 'funke', d: sp.d, x: sp.x + e.seite * 1.0, h: 0.3, vh: 1.5, g: 8, vd: sp.v * 0.8, vx: (Math.random() - 0.5) * 2, dauer: 0.35, groesse: 0.14, farbe: '#FFD35A' }); break;
        case 'rempler': Ton.rempler(); Grafik.blase('BONK', e.d, e.x, '#B5CBE0', 0.7, 0.8); break;
        case 'ueberholt': Ton.ueberholt(e.serie); break;
        case 'serie': Ton.serie(); Grafik.blase('SAUBERE SERIE!', sp.d + 12, 0, '#24D6CD', 1.1, 1); Grafik.blase(`+${e.punkte}`, sp.d + 8, 0, '#24D6CD', 1.0, 0.8); break;
        case 'knapp': Ton.knapp(); Grafik.blase('KNAPP VORBEI!', sp.d + 7, sp.x, '#FF4FD8', 0.9, 0.8); zeigeHinweis('knapp', 'Knapp vorbei gibt einen kleinen Bonus – pro Auto nur einmal.', 3); break;
        case 'marke': Ton.marke(); melde(`STRECKENMARKE ${e.nr}/${e.von - 1}\n${e.abschnitt.toUpperCase()}`, 1.8); Grafik.blase(`+${e.punkte}`, sp.d + 5, sp.x, '#24D6CD', 1.0, 1); zeigeHinweis('marke', 'Streckenmarken geben Punkte und senken den Verfolgungsdruck.', 3.5); break;
        case 'polizeiWarnung': Ton.polizeiWarnung(); zeigeHinweis('polizei', 'Eine Streife kommt von hinten (blauer Pfeil unten). Abstand halten, Boostfelder nutzen, sauber fahren!', 4.5, true); break;
        case 'polizeiDa': break;
        case 'abgehaengt': Ton.abgehaengt(); melde(`ABGEHÄNGT! +${e.punkte}`, 1.4); break;
        case 'warnung': Ton.warnung(); melde('DRUCK VOLL!\nSCHÜTTLE DIE STREIFE AB!', 2.2, 'warn'); zeigeHinweis('warnung', 'Boostfelder und Abstand senken den Druck. Bleibt er voll, endet der Auftrag.', 4, true); break;
        case 'entkommen': Ton.entkommen(); melde('PUH – ENTKOMMEN!', 1.4); break;
        case 'ende':
          if (e.grund === 'ziel') {
            Ton.sieg(); melde('ZIEL ERREICHT!\nHALLE 7 – TOR ZU!', 3.2, 'gross');
            for (let i = 0; i < (bewegungRuhig.matches ? 10 : 30); i++) Grafik.weltPartikel({ art: 'funke', d: sp.d + 8 + Math.random() * 6, x: (Math.random() - 0.5) * 10, h: 3 + Math.random() * 2, vh: 2 + Math.random() * 3, g: 4, vd: sp.v * 0.5, vx: (Math.random() - 0.5) * 3, dauer: 1.6, groesse: 0.3, farbe: ['#24D6CD', '#FFD35A', '#FF4FD8', '#FF9A3D'][i % 4] });
          } else {
            Ton.niederlage();
            melde(e.grund === 'wrack' ? 'DER KOMBI QUALMT!' : 'GESTELLT!', 2.2, 'gross warn');
            for (let i = 0; i < 6; i++) Grafik.weltPartikel({ d: sp.d, x: sp.x + (Math.random() - 0.5), h: 1, vh: 1.2, vd: sp.v * 0.5, dauer: 1.6, groesse: 0.7, wachsen: true, farbe: 'rgba(160, 150, 190, 0.7)' });
          }
          break;
        case 'fertig': zeigeErgebnis(); break;
      }
    }
    w.ereignisse.length = 0;
  }

  // ---------------------------------------------------------------
  // HUD (nur ändern, wenn sich etwas ändert)
  const hudAlt = {};
  function setzeText(id, text) { if (hudAlt[id] !== text) { hudAlt[id] = text; $(id).textContent = text; } }
  function setzeBalken(id, wert, extra) {
    const v = Math.round(klemme(wert, 0, 100));
    const k = id + '|' + v + '|' + (extra || '');
    if (hudAlt[id] === k) return;
    hudAlt[id] = k;
    const el = $(id); el.querySelector('i').style.transform = `scaleX(${v / 100})`; el.setAttribute('aria-valuenow', String(v));
    if (id === 'zustandBalken') el.classList.toggle('tief', v <= 40);
    if (id === 'druckBalken') el.classList.toggle('warnung', extra === 'w');
  }
  function aktualisiereHud() {
    if (!lauf) return;
    if (lauf.coup) {
      setzeText('aktionKnopf', lauf.coup.c.phase === 'beute' ? 'FANGEN!' : 'IMPULS!');
      setzeText('hudPunkte', zahl(lauf.coup.c.punkte));
      setzeText('hudBeutel', String(lauf.coup.c.gefangen));
      return;
    }
    const F = lauf.fahrt; if (!F) return;
    const ce = lauf.coupErgebnis;
    setzeText('hudPunkte', zahl(F.summe() + ce.timing + ce.beutelPunkte));
    const rest = F.rest();
    const anzeigeM = lauf.id === 'endlos' ? F.sp.d : rest;
    setzeText('hudRest', anzeigeM > 950 ? `${(anzeigeM / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : `${Math.max(0, Math.round(anzeigeM / 10) * 10)} m`);
    setzeText('hudBeutel', String(ce.beutel));
    setzeBalken('zustandBalken', F.sp.zustand);
    // Verfolgungsdruck nur, wenn er relevant ist
    const druckSicht = F.w.polizei.length > 0 || F.w.anmeldungen.length > 0 || F.w.druck > 0.5;
    if (hudAlt.druckSicht !== druckSicht) { hudAlt.druckSicht = druckSicht; $('druckBalken').classList.toggle('ausgeblendet', !druckSicht); }
        setzeBalken('druckBalken', F.w.druck, F.w.warnung >= 0 ? 'w' : '');
    // Wirkzeit nur während des Effekts (kein Vorrat, kein Bedienelement)
    const an = F.sp.boostAn;
    if (hudAlt.boostSicht !== an) { hudAlt.boostSicht = an; $('boostWirkung').hidden = !an; }
    if (an) setzeBalken('boostWirkung', F.sp.boostRest > 0 ? F.sp.boostRest / BOOST.dauer * 100 : 0);
  }

  // ---------------------------------------------------------------
  // Ergebnis
  function zeigeErgebnis() {
    const F = lauf.fahrt, w = F.w, ce = lauf.coupErgebnis;
    const endlos = lauf.id === 'endlos';
    const geschafft = w.grund === 'ziel';
    const p = w.punkte;
    const zeilen = [];
    if (ce.gespielt) {
      zeilen.push([`Coup-Timing (${ce.perfekte}× perfekt, ${ce.gute}× gut, ${ce.daneben}× daneben)`, ce.timing]);
      zeilen.push([`Beutetaschen (${ce.beutel})`, ce.beutelPunkte]);
    }
    const km = Math.min(F.sp.d, F.strecke.laenge) / 1000;
    zeilen.push([`Strecke (${km.toLocaleString('de-DE', { maximumFractionDigits: 2 })} km)`, p.strecke]);
    zeilen.push([`Sauber überholt (${w.statistik.ueberholt}, beste Serie ${w.statistik.besteSerie})`, p.ueberholen]);
    zeilen.push([`Saubere Serien (${w.statistik.serien})`, p.serien]);
    zeilen.push([`Knapp vorbei (${w.statistik.knapp})`, p.knapp]);
    zeilen.push([`Boostfelder (${w.statistik.boostFelder})`, p.boostFelder]);
    zeilen.push([`Streckenmarken (${w.markeNr})`, p.marken]);
    if (w.statistik.abgehaengt) zeilen.push([`Streifen abgehängt (${w.statistik.abgehaengt})`, p.abgehaengt]);
    if (geschafft) { zeilen.push(['Mission geschafft', p.abschluss]); zeilen.push([`Fahrzeugzustand (${Math.round(F.sp.zustand)} %)`, p.zustand]); }
    const gesamt = Math.round(F.summe() + ce.timing + ce.beutelPunkte);
    const vorher = Speicher.beste(lauf.id);
    const alterRekord = { punkte: vorher.punkte, strecke: vorher.strecke };
    const neu = Speicher.trageEin(lauf.id, { geschafft, punkte: gesamt, beutel: ce.beutel, zeit: w.zeit, strecke: F.sp.d });
    const best = Speicher.beste(lauf.id);
    $('fErgebnisTitel').textContent = endlos ? (neu.punkte && alterRekord.punkte > 0 ? 'Neuer Rekord!' : 'Lauf beendet') : geschafft ? 'Mission geschafft!' : 'Mission gescheitert';
    const grund = $('ergebnisGrund');
    grund.className = 'ergebnisgrund' + (geschafft || endlos ? '' : ' schlecht');
    grund.textContent = geschafft
      ? `${lauf.A.name}: Halle 7 erreicht, Tor zu – Feierabend. Zeit: ${w.zeit.toLocaleString('de-DE', { maximumFractionDigits: 1 })} s.`
      : endlos ? `${km.toLocaleString('de-DE', { maximumFractionDigits: 2 })} km Neon-Endlos. ` + (w.grund === 'wrack' ? 'Der Kombi qualmt – Zustand leer.' : 'Die Streife hat aufgeschlossen.')
      : w.grund === 'wrack' ? 'Grund: Der Fahrzeugzustand ist leer – der Kombi qualmt und rollt aus.'
      : 'Grund: Der Verfolgungsdruck blieb zu lange voll – die Streife hat aufgeschlossen.';
    const dl = $('ergebnisZahlen'); dl.textContent = '';
    for (const [t, v] of zeilen) {
      const d = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
      dt.textContent = t; dd.textContent = (v < 0 ? '−' : '') + zahl(Math.abs(v)); if (v < 0) dd.className = 'minus';
      d.append(dt, dd); dl.appendChild(d);
    }
    const g = document.createElement('div'); g.className = 'gross';
    const gdt = document.createElement('dt'); gdt.textContent = 'Gesamt'; const gdd = document.createElement('dd'); gdd.textContent = zahl(gesamt);
    g.append(gdt, gdd); dl.appendChild(g);
    const bestEl = $('ergebnisBest');
    bestEl.hidden = false;
    if (endlos) bestEl.textContent = `${neu.punkte ? 'NEUER REKORD' : 'REKORD'}: ${zahl(best.punkte)} · ${(best.strecke / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} KM`;
    else bestEl.textContent = geschafft
      ? (neu.punkte ? `NEUE BESTLEISTUNG: ${zahl(best.punkte)}` : `BESTLEISTUNG: ${zahl(best.punkte)}`)
      : best.geschafft ? `BESTLEISTUNG: ${zahl(best.punkte)} (zählt nur bei geschaffter Mission)` : 'Bestleistung zählt, sobald du die Mission schaffst.';
    $('nochmalKnopf').textContent = endlos ? 'Sofort nochmal' : 'Noch einmal';
    $('ergebnisAuftraegeKnopf').textContent = endlos ? 'Menü' : 'Missionen';
    Ton.musikDucken(2.2);
    setzeZustand('ergebnis');
    zeichneErgebnisBild(geschafft, ce.beutel);
    zeigeFenster('fErgebnis');
    $('nochmalKnopf').focus({ preventScroll: true });
  }
  function zeichneErgebnisBild(geschafft, beutel) {
    const W = ergCv.width, Hh = ergCv.height;
    Grafik.zeichneTitel(ergC, W, Hh, 0);
    if (geschafft) {
      ergC.fillStyle = 'rgba(255, 211, 90, 0.9)'; ergC.font = `28px 'Press Start 2P', monospace`; ergC.textAlign = 'center';
      ergC.fillText('HALLE 7', W / 2, 46);
      for (let i = 0; i < Math.min(beutel, 6); i++) Grafik.beutel(ergC, W / 2 - (Math.min(beutel, 6) - 1) * 26 + i * 52, Hh * 0.3, 18, i >= 3);
    } else {
      ergC.fillStyle = 'rgba(160, 150, 190, 0.6)';
      for (let i = 0; i < 5; i++) { ergC.beginPath(); ergC.arc(W / 2 + (i - 2) * 30, Hh * 0.45 - i % 2 * 14, 22 + i * 3, 0, 7); ergC.fill(); }
    }
  }

  // Freunde herausfordern: Bestleistung je Auftrag
  const duell = PixelDuell.erstelle({
    spiel: 'Nachtschicht: Hafenflucht',
    adresse: 'https://moje9328.github.io/nachtschicht/',
    schluessel: 'pixelhafen.nachtschicht.freunde',
    stand: st => ({ punkte: Speicher.beste(st).punkte }),
    stufen: { endlos: 'Neon-Endlos', containerkai: 'Containerkai', neonviertel: 'Neonviertel', nachthafen: 'Nachthafen' },
    stufe: () => (lauf ? lauf.id : 'endlos'),
    beiStufe: () => {},
    einheit: 'Punkte', levelWort: '', wasText: 'deine Bestleistung',
    erklaerung: 'Gezählt wird deine beste Punktzahl im gewählten Modus.',
  });
  if (duell.offen) { $('startDuell').textContent = duell.startText(); $('startDuell').hidden = false; }
  $('freundeKnopf').addEventListener('click', () => { Ton.klick(); duell.oeffne(); });
  $('ergebnisFreunde').addEventListener('click', () => { Ton.klick(); duell.oeffne(); });

  // ---------------------------------------------------------------
  // Der eine Game Loop
  let letzteZeit = performance.now(), akku = 0, uhr = 0;
  let botEingabe = null;   // nur Tests
  function schritt(dt) {
    meldungenSchritt(dt);
    Grafik.partikelSchritt(dt); Grafik.blasenSchritt(dt);
    if (coupText) { coupText.zeit += dt; if (coupText.zeit > 1.1) coupText = null; }
    if (!lauf) return;
    if (lauf.ruetteln > 0) lauf.ruetteln = Math.max(0, lauf.ruetteln - dt);
    if (zustand === 'coup' && lauf.coup) {
      lauf.coup.schritt(dt);
      verarbeiteCoupEreignisse();
      if (lauf.coup.fertig()) starteFahrt(false);
      return;
    }
    if (zustand === 'fahrt' && lauf.fahrt) {
      if (lauf.startUhr > 0) {
        lauf.startUhr -= dt;
        if (lauf.startUhr <= 0) { melde('LOS!', 0.8, 'gross'); Ton.countdown(true); }
        return;
      }
      const e = botEingabe ? botEingabe() : Eingabe.lesen();
      lauf.fahrt.schritt(e);
      if (lauf.fahrt.w.felder.some(f => f.status === 'offen' && f.d - lauf.fahrt.sp.d < ANSICHT.vorne)) zeigeHinweis('felder', 'Fahre über die leuchtenden Pfeilfelder für einen Temposchub!', 4, true);
      lauf.gesamtZeit += dt;
      verarbeiteFahrtEreignisse();
    }
  }
  function zeichne() {
    c.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);
    c.fillStyle = '#10243A'; c.fillRect(0, 0, lay.breite, lay.hoehe);
    if (lauf && lauf.coup) Grafik.zeichneCoup(c, lay, lauf.coup, uhr, coupText ? { text: coupText.text, textZeit: coupText.zeit, textFarbe: coupText.farbe } : {});
    else if (lauf && lauf.fahrt) Grafik.zeichneFahrt(c, lay, lauf.fahrt, uhr, { ruetteln: lauf.ruetteln });
    else Grafik.zeichneMenue(c, lay, uhr * (bewegungRuhig.matches ? 0.3 : 1), menueStrecke);
  }
  function rahmen(jetzt) {
    requestAnimationFrame(rahmen);
    let dt = Math.min(0.1, Math.max(0, (jetzt - letzteZeit) / 1000)) * TEMPO;
    letzteZeit = jetzt;
    if (zustand === 'pause') { akku = 0; zeichne(); return; }
    uhr += dt;
    akku += dt;
    let n = 0;
    while (akku >= DT && n < 12 * TEMPO + 12) { schritt(DT); akku -= DT; n++; }
    if (n >= 12 * TEMPO + 12) akku = 0;
    // Musik: eine einzige Schleife, läuft nach der ersten Nutzeraktion durch (Menü, Fahrt, Ergebnis);
    // in der Pause steht der Audiokontext still. Kein Motorgeräusch.
    if (Speicher.ton) Ton.musik(true);
    aktualisiereHud();
    zeichne();
  }

  function zeichneTitel() { Grafik.zeichneTitel(titelC, titelCv.width, titelCv.height, uhr); }

  // ---------------------------------------------------------------
  // Start
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { zeichneTitel(); });
  zeigeStart();
  requestAnimationFrame(t => { letzteZeit = t; rahmen(t); });

  // Offline-Helfer (nicht lokal, damit Tests und Entwicklung immer frisch laden)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/^(127\.|localhost)/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Nur für automatische Tests
  window.__nacht = {
    zustand: () => zustand, lauf: () => lauf, lay: () => lay,
    fahrt: () => lauf && lauf.fahrt, coup: () => lauf && lauf.coup,
    starte: (id, ueber) => starteAuftrag(id, ueber), weiter, pause: () => pause(false),
    eingabe: () => Eingabe.lesen(), eingabeSt: Eingabe.st,
    setzeBot(fn) { botEingabe = fn; },
    erstelleBot(opt) { const F = lauf && lauf.fahrt; botEingabe = F && typeof Testfahrer !== 'undefined' ? Testfahrer.erstelle(F, opt || {}) : null; return !!botEingabe; },
    partikel: () => Grafik.anzahlPartikel(), ton: () => Ton.status(), speicher: Speicher,
    zeigeAuftraege, zeigeStart,
  };
})();
