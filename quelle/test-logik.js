// Logik-Tests ohne Browser: node quelle/test-logik.js  (Argument "schnell" = weniger Seeds)
// Prüft dieselben Dateien wie im Spiel (lade-logik.js).
const L = require('./lade-logik.js')();
const mische = (a, b, t) => a + (b - a) * t;
const { AUFGABEN, LACKE, pruefeAufgaben, TEMPO_BEZUG, DT, ANSICHT, SPIELER, BOOST, SCHADEN, DRUCK, PUNKTE, AUFTRAEGE, AUFTRAG_LISTE, MODI, FAHRZEUGE, erstelleCoup, erstelleFahrt, Testfahrer, spurX, schwierigkeit, steigerung, baueStrecke } = L;
const SCHNELL = process.argv.includes('schnell');
let geprueft = 0, fehler = 0;
function ok(bed, text) { geprueft++; if (!bed) { fehler++; console.log('  FEHLER:', text); } }
function abschnitt(t) { console.log('\n# ' + t); }

// ------------------------------------------------------------------
abschnitt('Coup: gute Treffer');
function spieleCoup(einst, strategie, seed = 1, maxZeit = 60) {
  const co = erstelleCoup(einst, seed);
  let t = 0, naechsterTipp = 0;
  const ev = [];
  while (!co.fertig() && t < maxZeit) {
    co.schritt(DT); t += DT;
    const a = strategie(co, t);
    if (a) co.aktion();
    ev.push(...co.c.ereignisse); co.c.ereignisse.length = 0;
  }
  return { co, t, ev };
}
// perfekter Spieler: tippt genau in der Mitte, fängt jede Tasche mittig
const perfekt = co => {
  const k = co.c;
  if (k.phase === 'laden') return k.sperre <= 0 && Math.abs(k.zeiger - k.zone.mitte) < 0.012;
  if (k.phase === 'beute') return k.beutel.some(b => b.status === 'fliegt' && Math.abs(b.u - 0.73) < 0.02);
  return false;
};
for (const id of AUFTRAG_LISTE) {
  const { co, t } = spieleCoup(AUFTRAEGE[id].coup, perfekt, 3);
  const k = co.c;
  ok(co.fertig(), `${id}: Coup endet`);
  ok(k.perfekte === 3 && k.daneben === 0, `${id}: drei perfekte Treffer (${k.perfekte}/${k.daneben})`);
  ok(k.beutelGesamt === 6 && k.gefangen === 6, `${id}: 3 + 3 Extra-Taschen gefangen (${k.gefangen}/${k.beutelGesamt})`);
  ok(k.punkte === 3 * PUNKTE.perfekt + 6 * PUNKTE.beutel, `${id}: Punkte perfekt (${k.punkte})`);
  ok(t >= 8 && t <= 20, `${id}: Dauer perfekt ${t.toFixed(1)} s liegt bei 10–20 s`);
}
// guter, aber nicht perfekter Spieler (Treffer im guten Feld)
{
  const gut = co => { const k = co.c; if (k.phase === 'laden') return k.sperre <= 0 && Math.abs(Math.abs(k.zeiger - k.zone.mitte) - k.zone.breite * 0.35) < 0.01; if (k.phase === 'beute') return k.beutel.some(b => b.status === 'fliegt' && Math.abs(b.u - 0.7) < 0.02); return false; };
  const { co, t } = spieleCoup(AUFTRAEGE.containerkai.coup, gut, 4);
  ok(co.c.gute === 3 && co.c.perfekte === 0, `gute Treffer zählen als „gut“ (${co.c.gute}/${co.c.perfekte})`);
  ok(co.c.beutelGesamt === 3, 'ohne perfekte Treffer nur die 3 Grundtaschen');
  ok(co.c.punkte === 3 * PUNKTE.gut + 3 * PUNKTE.beutel, `Punkte gut (${co.c.punkte})`);
  ok(t >= 9 && t <= 20, `Dauer gut ${t.toFixed(1)} s`);
}

abschnitt('Coup: schlechte Treffer');
{
  // zuerst zwei Fehlversuche, dann gut
  let fehlversuche = 0;
  const schlecht = co => {
    const k = co.c;
    if (k.phase === 'laden' && fehlversuche < 2 && k.sperre <= 0 && Math.abs(k.zeiger - k.zone.mitte) > 0.4) { fehlversuche++; return true; }
    return perfekt(co);
  };
  const co = erstelleCoup(AUFTRAEGE.neonviertel.coup, 5);
  const breite0 = co.c.zone.breite;
  let t = 0, sperreGesehen = false, zeigerStand = true, zeigerVorher = null, breiteNachZwei = 0;
  while (!co.fertig() && t < 60) {
    co.schritt(DT); t += DT;
    if (co.c.sperre > 0) { sperreGesehen = true; if (zeigerVorher != null && co.c.zeiger !== zeigerVorher) zeigerStand = false; zeigerVorher = co.c.zeiger; } else zeigerVorher = null;
    if (schlecht(co)) { co.aktion(); if (co.c.daneben === 2 && !breiteNachZwei) breiteNachZwei = co.c.zone.breite; }
    co.c.ereignisse.length = 0;
  }
  ok(co.c.daneben === 2, `zwei Fehlversuche gezählt (${co.c.daneben})`);
  ok(sperreGesehen && zeigerStand, 'Fehlversuch kostet Zeit (Zeiger steht kurz)');
  ok(breiteNachZwei > breite0 * 1.2, `nach zwei Fehlversuchen wird das Feld breiter (${breite0.toFixed(3)} → ${breiteNachZwei.toFixed(3)})`);
  ok(co.c.punkte === 3 * PUNKTE.perfekt + co.c.gefangen * PUNKTE.beutel + 2 * PUNKTE.daneben && co.timing() === 3 * PUNKTE.perfekt + 2 * PUNKTE.daneben, `Fehlversuche kosten Bonuspunkte (${co.c.punkte})`);
  ok(co.fertig(), 'Coup endet trotz Fehlversuchen');
}
{
  // Wildes Tippen ohne Ziel: blockiert nicht dauerhaft, Punkte fallen nie unter 0
  const z = L.zufall(9);
  const { co, t } = spieleCoup(AUFTRAEGE.nachthafen.coup, () => z() < 0.08, 9, 120);
  ok(co.fertig(), `zufälliges Dauertippen kommt trotzdem zur Fahrt (${t.toFixed(1)} s, ${co.c.daneben} daneben)`);
  ok(co.c.punkte >= 0, 'Punkte nie negativ');
}
{
  // Nie tippen: Feld wird mit der Zeit großzügiger, ein später Treffer reicht
  const co = erstelleCoup(AUFTRAEGE.nachthafen.coup, 2);
  for (let i = 0; i < 20 / DT; i++) co.schritt(DT);
  ok(co.c.phase === 'laden' && co.c.zone.breite > AUFTRAEGE.nachthafen.coup.zone * 1.5, `ohne Tippen wird das Feld großzügiger (${co.c.zone.breite.toFixed(2)})`);
  // Taschen alle verpassen: Phase endet trotzdem
  const { co: co2 } = spieleCoup(AUFTRAEGE.containerkai.coup, c2 => c2.c.phase === 'laden' && perfekt(c2), 6);
  ok(co2.fertig() && co2.c.gefangen === 0 && co2.c.verpasst === co2.c.beutelGesamt, 'verpasste Taschen: Phase endet, keine Beutepunkte');
  // Tippen ohne Tasche im Ring: kurze Sperre, keine Punkte
  const co3 = erstelleCoup(AUFTRAEGE.containerkai.coup, 7);
  while (co3.c.phase !== 'beute') { co3.schritt(DT); if (perfekt(co3) && co3.c.phase === 'laden') co3.aktion(); }
  const p0 = co3.c.punkte;
  ok(co3.aktion() === 'leer' && co3.c.punkte === p0, 'Tippen ohne Tasche im Ring: nichts passiert');
  ok(co3.aktion() === null, 'gleich danach gesperrt (kein Dauertippen-Fangen)');
}

// ------------------------------------------------------------------
abschnitt('Fahrt: Steuerung, Boost, Tempo');
{
  const F = erstelleFahrt('containerkai', { seed: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;
  const x0 = F.sp.x;
  for (let i = 0; i < 120 * 3; i++) F.schritt({});
  ok(Math.abs(F.sp.v - F.w.vGrund) < 0.01, `automatische Beschleunigung auf Grundtempo (${F.sp.v.toFixed(2)})`);
  ok(Math.abs(F.sp.x - x0) < 1e-9, 'ohne Eingabe kein seitliches Wandern');
  // Fingerziel: begrenzte Seitengeschwindigkeit, keine Verzögerung
  let maxVx = 0;
  for (let i = 0; i < 12; i++) { F.schritt({ ziel: x0 - 3.6 }); maxVx = Math.max(maxVx, Math.abs(F.sp.vx)); }
  ok(F.sp.x < x0 - 0.15, `reagiert sofort (nach 0,1 s ${(x0 - F.sp.x).toFixed(2)} m)`);
  for (let i = 0; i < 120; i++) { F.schritt({ ziel: x0 - 3.6 }); maxVx = Math.max(maxVx, Math.abs(F.sp.vx)); }
  ok(maxVx <= SPIELER.seitMax + 1e-9, `Seitengeschwindigkeit begrenzt (${maxVx.toFixed(2)} m/s)`);
  ok(Math.abs(F.sp.x - (x0 - 3.6)) < 0.05, 'erreicht das Ziel ohne Überschwingen');
  ok(Math.abs(F.sp.neigung) < 0.02, 'Neigung geht nach dem Lenken zurück');
  // Loslassen mitten im Spurwechsel: Auto bleibt, wo es ist (kein Einrasten)
  for (let i = 0; i < 20; i++) F.schritt({ ziel: x0 });
  const xl = F.sp.x;
  for (let i = 0; i < 120; i++) F.schritt({});
  ok(Math.abs(F.sp.x - xl) < 0.45 && Math.abs(F.sp.vx) < 1e-6, `Loslassen: kein automatischer Spurwechsel (${xl.toFixed(2)} → ${F.sp.x.toFixed(2)})`);
  // Tasten
  const xk = F.sp.x;
  let neigungMax = 0;
  for (let i = 0; i < 30; i++) { F.schritt({ richtung: 1 }); neigungMax = Math.max(neigungMax, F.sp.neigung); }
  ok(F.sp.x > xk + 1, 'Richtungstaste lenkt');
  ok(neigungMax > 0.02 && neigungMax <= SPIELER.neigungMax + 1e-9, `kleine Neigung beim Lenken (${neigungMax.toFixed(3)} rad)`);
  // Straßenrand
  for (let i = 0; i < 400; i++) F.schritt({ richtung: 1 });
  ok(F.sp.x <= F.X_MAX + 1e-9, 'Straßenrand begrenzt');
}
{
  // Spurwechsel per Tipp: ein Befehl = genau eine Spur, zügig, ohne Überschwingen
  const F = erstelleFahrt('containerkai', { seed: 1, startFaktor: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;
  for (let i = 0; i < 10; i++) F.schritt({});
  const x0 = F.sp.x, ziel = x0 - 3.6;
  let t = 0, ueber = 0, fertig = null;
  for (let i = 0; i < 120; i++) { F.schritt({ ziel, spur: true }); t += DT; ueber = Math.max(ueber, ziel - F.sp.x); if (fertig == null && Math.abs(F.sp.x - ziel) < 0.1) fertig = t; }
  ok(fertig != null && fertig <= 0.28, `Spurwechsel per Tipp in ${fertig && fertig.toFixed(2)} s`);
  ok(ueber < 0.12 && Math.abs(F.sp.x - ziel) < 0.02, `landet genau in der Spurmitte (Überschwingen ${ueber.toFixed(2)} m)`);
  ok(Math.abs(F.sp.vx) < 0.05, 'steht danach seitlich still');
}

abschnitt('Boostfelder');
function feldFahrt(auftrag = 'containerkai') {
  const F = erstelleFahrt(auftrag, { seed: 1, startFaktor: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;   // kein Verkehr, keine automatischen Felder
  for (let i = 0; i < 10; i++) F.schritt({});
  return F;
}
function feldVor(F, abstand, dx = 0) {
  const f = { id: F.w.naechsteId++, d: F.sp.d + abstand, spur: F.spurVon(F.sp.x + dx), x: F.sp.x + dx, laenge: BOOST.feldLaenge, breite: BOOST.feldBreite, status: 'offen' };
  F.w.felder.push(f); return f;
}
const zaehle = (F, typ) => { const n = F.w.ereignisse.filter(e => e.typ === typ).length; F.w.ereignisse.length = 0; return n; };
{
  // Genau einmal auslösen, weich beschleunigen, begrenzt, sanft zurück
  const F = feldFahrt();
  const vg = F.w.vGrund;
  feldVor(F, 20);
  let n = 0, vMax = 0, dvMax = 0, vAlt = F.sp.v, zeitBisVoll = null, t = 0;
  for (let i = 0; i < 120 * 8; i++) {
    F.schritt({}); t += DT; n += zaehle(F, 'boostFeld');
    dvMax = Math.max(dvMax, Math.abs(F.sp.v - vAlt) / DT); vAlt = F.sp.v; vMax = Math.max(vMax, F.sp.v);
    if (zeitBisVoll == null && n && F.sp.v >= vg * BOOST.faktor - 0.05) zeitBisVoll = t;
  }
  ok(n === 1 && F.w.statistik.boostFelder === 1, `Feld löst genau einmal aus (${n})`);
  ok(Math.abs(vMax - vg * BOOST.faktor) < 0.05, `+30 % Tempo (${(vMax / vg).toFixed(3)} × Grundtempo)`);
  ok(dvMax <= SPIELER.boostBeschl + 0.01 && dvMax <= Math.max(SPIELER.boostBeschl, SPIELER.bremsen, SPIELER.beschl) + 0.01, `weiche Beschleunigung, keine Sprünge (max ${dvMax.toFixed(1)} m/s²)`);
  ok(Math.abs(F.sp.v - vg) < 0.05 && !F.sp.boostAn, 'danach sanft zurück auf Grundtempo');
  ok(F.w.punkte.boostFelder === PUNKTE.boostFeld, 'Boostfeld gibt kleinen Punktbonus');
}
{
  // Seitliches Vorbeifahren löst nicht aus (Wagenmitte neben dem Feld), auch nicht nachträglich
  const F = feldFahrt();
  const f = feldVor(F, 20, BOOST.feldBreite / 2 + 0.25);
  let n = 0;
  for (let i = 0; i < 120 * 2; i++) { F.schritt({}); n += zaehle(F, 'boostFeld'); }
  ok(n === 0 && f.status === 'verpasst' && !F.sp.boostAn, 'Vorbeifahren knapp neben dem Feld: kein Boost');
  // nur ein Leuchten berühren genügt nicht: Rad über dem Rand, Mitte daneben
  const G = feldFahrt();
  feldVor(G, 20, BOOST.feldBreite / 2 + SPIELER.trefferBreite / 2 - 0.2);
  for (let i = 0; i < 120 * 2; i++) { G.schritt({}); n += zaehle(G, 'boostFeld'); }
  ok(n === 0, 'Berührung nur am Rand reicht nicht');
}
{
  // Mehrere Felder: nicht stapeln, nur Dauer auffrischen
  const F = feldFahrt();
  const vg = F.w.vGrund;
  feldVor(F, 15); feldVor(F, 15 + vg * 1.5); feldVor(F, 15 + vg * 2.6);
  let vMax = 0, auffr = 0, ausl = 0, restNachZweitem = null;
  for (let i = 0; i < 120 * 10; i++) {
    F.schritt({});
    for (const e of F.w.ereignisse) if (e.typ === 'boostFeld') { ausl++; if (e.auffrischen) { auffr++; if (restNachZweitem == null) restNachZweitem = F.sp.boostRest; } }
    F.w.ereignisse.length = 0; vMax = Math.max(vMax, F.sp.v);
  }
  ok(ausl === 3 && auffr === 2, `drei Felder, zwei Auffrischungen (${ausl}/${auffr})`);
  ok(Math.abs(restNachZweitem - BOOST.dauer) < DT * 1.5, `Auffrischen setzt die volle Dauer, addiert nicht (${restNachZweitem && restNachZweitem.toFixed(2)} s)`);
  ok(vMax <= vg * BOOST.faktor + 1e-6, `Tempo stapelt sich nicht (${(vMax / vg).toFixed(3)} ×)`);
}
{
  // Höchsttempo: Felder werden nicht übersprungen (Überfahrt über die ganze Schrittstrecke)
  const F = feldFahrt();
  F.sp.v = 120; F.w.vGrund;
  feldVor(F, 30);
  let n = 0;
  for (let i = 0; i < 60; i++) { F.sp.v = 120; F.schritt({}); n += zaehle(F, 'boostFeld'); }
  ok(n === 1, `bei 120 m/s (1 m pro Schritt) ausgelöst (${n})`);
  // Felder wirken nur auf den Spieler und sind keine Hindernisse
  const G = feldFahrt();
  const f = feldVor(G, 40, 3.6);
  const a = { id: 777, typ: 'taxi', spur: f.spur, x: f.x, d: f.d - 10, v: 20, vSoll: 20, stoss: 0, laenge: 4.6, breite: 1.85, wechsel: null, wechselSperre: 99, vorbei: false, getroffen: false, knappMin: 99, knappFertig: false, kontaktBis: -1, wackel: 0, farbe: 0, geboren: 0 };
  G.w.autos.push(a);
  for (let i = 0; i < 120 * 2; i++) G.schritt({});
  ok(Math.abs(a.v - 20) < 1e-9 && f.status !== 'genutzt', 'Verkehr fährt unbeeinflusst über ein Feld und löst es nicht aus');
  ok(G.sp.zustand === 100, 'Felder sind keine Stoßkörper');
}
{
  // Ende setzt den Boost zurück; eingefrorene Simulation (Pause) verbraucht keine Wirkzeit
  const F = feldFahrt();
  feldVor(F, 10);
  for (let i = 0; i < 60; i++) F.schritt({});
  const rest = F.sp.boostRest;
  ok(rest > 0 && rest < BOOST.dauer, 'Boost läuft');
  // Pause = keine Schritte: Wirkzeit bleibt unverändert
  ok(F.sp.boostRest === rest, 'ohne Simulationsschritt (Pause) läuft keine Wirkzeit ab');
  F.sp.d = F.strecke.zielVon - 0.1;
  for (let i = 0; i < 120 * 4; i++) F.schritt({});
  ok(F.sp.boostRest === 0 && !F.sp.boostAn, 'Spielende setzt den Boost sauber zurück');
}

abschnitt('Fahrt: Kollisionen');
function testFahrt(auftrag = 'containerkai', seed = 1) {
  const F = erstelleFahrt(auftrag, { seed, startFaktor: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;   // kein automatischer Verkehr
  for (let i = 0; i < 10; i++) F.schritt({});
  return F;
}
function autoVor(F, abstand, dx = 0, typ = 'taxi', v = 20) {
  const f = FAHRZEUGE[typ];
  const a = { id: F.w.naechsteId++, typ, spur: F.spurVon(F.sp.x), x: F.sp.x + dx, d: F.sp.d + abstand, v, vSoll: v, stoss: 0, laenge: f.laenge, breite: f.breite, wechsel: null, wechselSperre: 99, vorbei: false, getroffen: false, knappMin: 99, knappFertig: false, kontaktBis: -1, wackel: 0, farbe: 0, geboren: 0 };
  F.w.autos.push(a);
  return a;
}
{
  // Maximaltempo: auch mit Boosttempo und sehr hohem Tempo kein Durchtunneln
  for (const v of [F0 => F0.w.vGrund * BOOST.faktor, () => 90]) {
    const F = testFahrt();
    F.sp.v = v(F);
    const a = autoVor(F, 25, 0, 'kugel', 5);
    let unfaelle = 0, n = 0;
    while (F.sp.d < a.d + 10 && n++ < 600) { F.sp.v = v(F); F.schritt({}); if (v(F) === 90) F.sp.v = 90; unfaelle += F.w.ereignisse.filter(e => e.typ === 'unfall').length; F.w.ereignisse.length = 0; if (unfaelle) break; }
    ok(unfaelle === 1, `Kollision bei ${v(F).toFixed(0)} m/s erkannt (${unfaelle})`);
  }
  // Boost macht nicht unverwundbar
  const F = testFahrt();
  F.w.felder.push({ id: 5555, d: F.sp.d + 6, spur: 0, x: F.sp.x, laenge: BOOST.feldLaenge, breite: BOOST.feldBreite, status: 'offen' });
  autoVor(F, 40, 0, 'taxi', 10);
  let boostBeimUnfall = false;
  for (let i = 0; i < 240; i++) { F.schritt({}); if (F.w.ereignisse.some(e => e.typ === 'unfall')) boostBeimUnfall = F.sp.boostAn; F.w.ereignisse.length = 0; }
  ok(F.sp.zustand < 100 && boostBeimUnfall, 'Unfall auch während Boost kostet Zustand');
}
{
  // Dauerkontakt: nur einmal Schaden; Schutzphase
  const F = testFahrt();
  const a = autoVor(F, 3, 1.2, 'kasten', F.sp.v);   // halb neben dem Spieler, gleiches Tempo
  let schaeden = 0;
  for (let i = 0; i < 240; i++) { F.schritt({ ziel: a.x }); schaeden += F.w.ereignisse.filter(e => e.typ === 'unfall').length; F.w.ereignisse.length = 0; }
  ok(schaeden === 1, `Dauerkontakt beim Hineinlenken: genau ein Schaden (${schaeden})`);
  ok(F.sp.zustand === 100 - SCHADEN.streifschuss || F.sp.zustand === 100 - SCHADEN.verkehr, `Zustand sinkt um einen Treffer (${F.sp.zustand})`);
  // nie ineinander: Überlappung bleibt klein
  ok(Math.abs(F.sp.x - a.x) > (SPIELER.trefferBreite + a.breite * 0.88) / 2 - 0.05 || Math.abs(F.sp.d - a.d) > (SPIELER.trefferLaenge + a.laenge * 0.92) / 2 - 0.05, 'Autos durchdringen sich nicht');
}
{
  // Zwei Autos im selben Schritt: höchstens ein Zustandsverlust pro Schritt
  const F = testFahrt();
  F.sp.x = 0;
  const a = autoVor(F, 1.0, -1.55, 'taxi', F.sp.v), b = autoVor(F, 1.0, 1.55, 'taxi', F.sp.v);
  a.x = -1.55; b.x = 1.55;
  F.sp.x = 0;
  const z0 = F.sp.zustand;
  F.schritt({});
  const n = F.w.ereignisse.filter(e => e.typ === 'unfall').length;
  ok(n <= 1 && z0 - F.sp.zustand <= SCHADEN.verkehr, `zwei Berührungen im selben Schritt: ${n} Schaden`);
}
{
  // Nach der Schutzphase: dasselbe Auto erneut rammen gibt erst nach Abstand neuen Schaden
  const F = testFahrt();
  const a = autoVor(F, 8, 0, 'laster', 12);
  let schaeden = 0;
  for (let i = 0; i < 120 * 2.5; i++) { F.schritt({}); schaeden += F.w.ereignisse.filter(e => e.typ === 'unfall').length; F.w.ereignisse.length = 0; }
  ok(schaeden === 1, `Immer wieder auf denselben Laster auffahren: in 2,5 s nur ein Schaden (${schaeden})`);
  ok(a.stoss <= SCHADEN.stoss + 1e-9, `Anstoß des vorderen Autos wird nicht aufaddiert (${a.stoss.toFixed(1)} m/s)`);
  ok(F.sp.v < F.w.vGrund, 'Unfall reduziert kurz das Tempo');
}
{
  // Nähe allein ist kein Unfall
  const F = testFahrt();
  const a = autoVor(F, 0, (SPIELER.breite + FAHRZEUGE.taxi.breite) / 2 + 0.08, 'taxi', F.sp.v);
  for (let i = 0; i < 120; i++) F.schritt({});
  ok(F.sp.zustand === 100, 'Nebeneinander mit 8 cm Lücke zwischen den sichtbaren Karosserien: kein Unfall');
}

abschnitt('Fahrt: Punkte nur einmal pro Auto');
{
  const F = testFahrt();
  const a = autoVor(F, 15, 0, 'taxi', 15);
  a.x = F.sp.x + (SPIELER.breite + a.breite) / 2 + 0.4;   // 40 cm Lücke: knapp
  let ueber = 0, knapp = 0;
  for (let i = 0; i < 120 * 3; i++) { F.schritt({}); ueber += F.w.ereignisse.filter(e => e.typ === 'ueberholt').length; knapp += F.w.ereignisse.filter(e => e.typ === 'knapp').length; F.w.ereignisse.length = 0; }
  ok(ueber === 1 && knapp === 1, `Überholen und knapp vorbei je einmal (${ueber}/${knapp})`);
  // Das Auto überholt zurück (Spieler langsam) und der Spieler überholt erneut: keine neuen Punkte
  F.sp.v = 5; a.d = F.sp.d - 2; a.v = 25; a.vSoll = 25;
  for (let i = 0; i < 120 * 1; i++) { F.sp.v = Math.min(F.sp.v, 5); F.schritt({}); }
  a.v = a.vSoll = 5;
  for (let i = 0; i < 120 * 4; i++) { F.schritt({}); ueber += F.w.ereignisse.filter(e => e.typ === 'ueberholt').length; knapp += F.w.ereignisse.filter(e => e.typ === 'knapp').length; F.w.ereignisse.length = 0; }
  ok(ueber === 1 && knapp === 1, `dasselbe Auto zählt nie doppelt (${ueber}/${knapp})`);
  // Nebenherfahren gibt keine Punkte
  const G = testFahrt();
  const b = autoVor(G, 0, 0, 'taxi', G.sp.v); b.x = G.sp.x + (SPIELER.breite + b.breite) / 2 + 0.3;
  for (let i = 0; i < 120; i++) { G.schritt({}); b.d = G.sp.d - 0.5; }
  const p0 = G.w.punkte.ueberholen + G.w.punkte.knapp;
  for (let i = 0; i < 120 * 5; i++) { G.schritt({}); b.d = G.sp.d + (i % 240 < 120 ? -0.5 : 0.5); }
  ok(G.w.punkte.ueberholen + G.w.punkte.knapp === p0, `dauerhaftes Nebenherfahren (auch vor und zurück) bringt keine weiteren Punkte (${p0})`);
  // Angefahrenes Auto: kein Überholbonus
  const H2 = testFahrt();
  autoVor(H2, 10, 0, 'taxi', 10);
  for (let i = 0; i < 60; i++) H2.schritt({});
  for (let i = 0; i < 120 * 3; i++) H2.schritt({ ziel: H2.X_MIN });
  ok(H2.w.statistik.ueberholt === 0, 'gerammtes Auto zählt nicht als sauber überholt');
}

abschnitt('Fahrt: Verfolgungsdruck und Warnphase');
{
  // Streife direkt neben dem Spieler halten → Druck voll → Warnphase → Ende
  const F = erstelleFahrt('nachthafen', { seed: 2, startFaktor: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;
  for (let i = 0; i < 10; i++) F.schritt({});
  F.w.druck = 85;
  F.w.polizei.push({ id: 999, d: F.sp.d - 6, x: F.sp.x - 3.6, vx: 0, v: F.sp.v, spur: 0, zielSpur: F.spurVon(F.sp.x) - 1, planUhr: 99, laenge: 4.8, breite: 1.95, kontaktBis: -1, wackel: 0, stoss: 0, geboren: 0, fragend: 0 });
  let warnZeit = null, endeZeit = null;
  for (let i = 0; i < 120 * 40 && F.w.phase === 'fahrt'; i++) {
    F.schritt({});
    for (const e of F.w.ereignisse) { if (e.typ === 'warnung') warnZeit = F.w.zeit; if (e.typ === 'ende') endeZeit = F.w.zeit; }
    F.w.ereignisse.length = 0;
  }
  ok(warnZeit != null, 'Druck erreicht das Maximum → Warnphase');
  ok(F.w.grund === 'gestellt' && endeZeit - warnZeit >= DRUCK.warnungDauer - 0.05, `Ende erst nach der Warnphase (${(endeZeit - warnZeit).toFixed(2)} s)`);
}
{
  // In der Warnphase Druck senken → Auftrag läuft weiter
  const F = erstelleFahrt('nachthafen', { seed: 2, startFaktor: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;
  for (let i = 0; i < 10; i++) F.schritt({});
  const pol = { id: 998, d: F.sp.d - 5, x: F.sp.x - 3.6, vx: 0, v: F.sp.v, spur: 0, zielSpur: F.spurVon(F.sp.x) - 1, planUhr: 99, laenge: 4.8, breite: 1.95, kontaktBis: -1, wackel: 0, stoss: 0, geboren: 0, fragend: 0 };
  F.w.polizei.push(pol);
  F.w.druck = 99;
  for (let i = 0; i < 120 * 3 && F.w.warnung < 0; i++) F.schritt({});
  ok(F.w.warnung > 0, 'volle Anzeige startet die Warnphase');
  F.w.polizei.length = 0;   // Spieler hat die Streife abgehängt
  let entkommen = false;
  for (let i = 0; i < 120 * 3; i++) { F.schritt({}); if (F.w.ereignisse.some(e => e.typ === 'entkommen')) entkommen = true; F.w.ereignisse.length = 0; }
  ok(entkommen && F.w.phase === 'fahrt' && F.w.warnung < 0, 'ohne Streife in der Nähe sinkt der Druck: Warnung endet, Auftrag läuft weiter');
  // Kollision erhöht, Streckenmarke senkt
  const G = testFahrt('containerkai');
  G.w.druck = 50; autoVor(G, 6, 0, 'taxi', 10);
  for (let i = 0; i < 60; i++) G.schritt({});
  ok(G.w.druck > 50, `Kollision erhöht den Druck (${G.w.druck.toFixed(1)})`);
  G.w.druck = 60; G.sp.d = G.strecke.marke(0) - 0.5;
  for (let i = 0; i < 10; i++) G.schritt({});
  ok(G.w.druck < 60 - DRUCK.marke + 1, `Streckenmarke senkt den Druck (${G.w.druck.toFixed(1)})`);
}

// ------------------------------------------------------------------
abschnitt('Faire Verkehrserzeugung (reproduzierbare Seeds)');
const SEEDS = SCHNELL ? 6 : 16;
const endlosZeiten = [];
const zusammenfassung = {};
for (const id of MODI) {
  let waende = 0, waendeNachUnfall = 0, proben = 0, zuNah = 0, blinkKurz = 0, wechsel = 0, ueberlapp = 0, polOhneWarnung = 0, polVorne = 0, polZuSchnell = 0, polImBild = 0, geschafft = 0, polizeiAnzahl = 0, tempoZuHoch = 0;
  let warnBisDa = [], felderNah = 0, felderUnterAuto = 0, felderVorZiel = 0, felderAbstand = 0, felderGesamt = 0, ersteNichtEigene = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const F = erstelleFahrt(id, { seed });
    const bot = Testfahrer.erstelle(F, { spur: true });   // Standardsteuerung: Spurwechsel per Tipp
    const gesehen = new Set(), blinkStart = new Map(), feldGesehen = new Set();
    let letztesFeldD = -1e9;
    let letzteWarnung = -1, letzterKontakt = -99;
    const P = AUFTRAEGE[id].polizei;
    let n = 0;
    const grenze = AUFTRAEGE[id].endlos ? 120 * 150 : 120 * 400;   // Endlos: bis 150 s Fahrt prüfen
    while (F.w.phase !== 'fertig' && n++ < grenze) {
      F.schritt(bot());
      const w = F.w, sp = F.sp;
      if (sp.v > w.vGrund * BOOST.faktor + 1e-6) tempoZuHoch++;
      for (const e of w.ereignisse) {
        if (e.typ === 'unfall' || e.typ === 'beruehrung' || e.typ === 'rempler') letzterKontakt = w.zeit;
        if (e.typ === 'polizeiWarnung') letzteWarnung = w.zeit;
        if (e.typ === 'polizeiDa') { polizeiAnzahl++; if (letzteWarnung < 0) polOhneWarnung++; else warnBisDa.push(w.zeit - letzteWarnung); }
      }
      w.ereignisse.length = 0;
      for (const f of w.felder) if (!feldGesehen.has(f.id)) {
        feldGesehen.add(f.id); felderGesamt++;
        if (f.d - sp.d < ANSICHT.vorne + 8) felderNah++;
        if (w.autos.some(a => Math.abs(a.x - f.x) < (a.breite + f.breite) / 2 && Math.abs(a.d - f.d) < (a.laenge + f.laenge) / 2)) felderUnterAuto++;
        if (f.d > w.strecke.zielVon - BOOST.zielFrei) felderVorZiel++;
        if (f.d - letztesFeldD < BOOST.abstand[0] - 1) felderAbstand++;
        if (feldGesehen.size === 1 && f.spur !== F.spurVon(sp.x)) ersteNichtEigene++;
        letztesFeldD = f.d;
      }
      for (const a of w.autos) {
        if (!gesehen.has(a.id)) {
          gesehen.add(a.id);
          if (a.d - sp.d < ANSICHT.vorne + 10) zuNah++;            // nie im Sichtbereich auftauchen
        }
        if (a.wechsel && !blinkStart.has(a.id + ':' + a.wechsel.beginn)) { blinkStart.set(a.id + ':' + a.wechsel.beginn, w.zeit); wechsel++; if (a.wechsel.beginn - w.zeit < 1.4) blinkKurz++; }
      }
      for (const p of w.polizei) {
        if (w.zeit - p.geboren < 0.02 && p.d > sp.d - ANSICHT.hinten - 2) polImBild++;   // erscheint außerhalb des Bildes
        if (P && p.v > w.vGrund * P.tempo + 0.01 && w.phase === 'fahrt') polZuSchnell++;
        if (p.d - p.laenge / 2 > sp.d + sp.laenge / 2 + 0.5 && Math.abs(p.x - sp.x) < 1.8) polVorne++;
        for (const a of w.autos) if (Math.abs(p.x - a.x) < (p.breite + a.breite) / 2 - 0.12 && Math.abs(p.d - a.d) < (p.laenge + a.laenge) / 2 - 0.12) ueberlapp++;
      }
      if (n % 30 === 0 && w.phase === 'fahrt') {
        // Lagen bis 6 s nach eigenem Unfall zählen nicht: dort hat der Spieler selbst Tempo und Lage verändert
        // ebenso Lagen, in denen der Spieler hinter einem Auto dessen Tempo fährt (nicht im Grundtempo unterwegs)
        if (w.zeit - letzterKontakt < 6 || sp.v < w.vGrund * 0.9) { if (!F.pfadFrei([], w.vGrund, true)) waendeNachUnfall++; }
        else { proben++; if (!F.pfadFrei([], w.vGrund, true)) waende++; }
      }
    }
    if (F.w.grund === 'ziel' || (AUFTRAEGE[id].endlos && F.w.zeit >= 20)) geschafft++;
    if (AUFTRAEGE[id].endlos) endlosZeiten.push(F.w.zeit);
  }
  zusammenfassung[id] = { geschafft, polizeiAnzahl };
  ok(waende === 0, `${id}: Verkehr baut keine geschlossene Wand: ${proben} Stichproben, ${waende} Wände (nach eigenen Unfällen/beim Hinterherfahren: ${waendeNachUnfall})`);
  ok(zuNah === 0, `${id}: kein Auto taucht im Sichtbereich auf (${zuNah})`);
  ok(blinkKurz === 0, `${id}: jeder Spurwechsel ≥ 1,4 s vorher angekündigt (${wechsel} Wechsel)`);
  ok(tempoZuHoch === 0, `${id}: Tempo nie über Boost-Grenze`);
  ok(felderGesamt >= SEEDS * 3, `${id}: Boostfelder kommen vor (${felderGesamt})`);
  ok(felderNah === 0 && felderUnterAuto === 0, `${id}: Felder entstehen außerhalb des Bildes und nicht unter Autos (${felderNah}/${felderUnterAuto})`);
  ok(felderVorZiel === 0 && felderAbstand === 0, `${id}: keine Boostketten, keine Felder kurz vor dem Ziel`);
  ok(ersteNichtEigene === 0, `${id}: erstes Feld liegt zur Einführung auf der eigenen Spur`);
  if (AUFTRAEGE[id].polizei) {
    ok(polizeiAnzahl > 0, `${id}: Streifen kommen vor (${polizeiAnzahl})`);
    ok(polOhneWarnung === 0 && Math.min(...warnBisDa) >= 2.2, `${id}: jede Streife mit Vorwarnung ≥ 2,2 s (min ${Math.min(...warnBisDa).toFixed(2)} s)`);
    ok(polImBild === 0, `${id}: Streifen entstehen außerhalb des Bildes hinter dem Spieler`);
    ok(polZuSchnell === 0, `${id}: Streifen halten ihre Höchstgeschwindigkeit ein`);
    ok(polVorne === 0, `${id}: keine Streife setzt sich vor den Spieler (${polVorne})`);
    ok(ueberlapp === 0, `${id}: Streifen fahren nie durch andere Autos (${ueberlapp})`);
  }
  // Endlos: ein Kontakt beendet die Fahrt, es wird immer schwerer; der Einstieg (20 s) muss sicher machbar sein
  ok(geschafft >= SEEDS - (AUFTRAEGE[id].endlos ? Math.ceil(SEEDS / 8) : 0), `${id}: Testfahrer ${AUFTRAEGE[id].endlos ? 'übersteht den Einstieg (20 s)' : 'schafft'}: ${geschafft} von ${SEEDS} Seeds`);
  if (AUFTRAEGE[id].endlos) { endlosZeiten.sort((a, b) => a - b); const med = endlosZeiten[endlosZeiten.length >> 1]; ok(med >= 30 && med <= 400, `${id}: guter Testfahrer kommt im Median ${med.toFixed(0)} s weit (spielbar, aber endlich)`); }
}

abschnitt('Niemand bleibt im Verkehr hängen');
for (const id of AUFTRAG_LISTE) {
  let langsam = 0, zeit = 0, laengste = 0;
  for (let seed = 61; seed < 61 + (SCHNELL ? 3 : 6); seed++) {
    const F = erstelleFahrt(id, { seed }); const bot = Testfahrer.erstelle(F, { spur: true, reaktion: 0.3, horizont: 2.2, seed });
    let k = 0, seit = 0;
    while (F.w.phase === 'fahrt' && k++ < 120 * 300) { F.schritt(bot()); zeit += DT; if (F.sp.v < F.w.vGrund * 0.8 && F.w.zeit > 3) { langsam += DT; seit += DT; laengste = Math.max(laengste, seit); } else seit = 0; }
  }
  ok(langsam / zeit < 0.12 && laengste < 12, `${id}: kaum Hängen hinter Autos (${(100 * langsam / zeit).toFixed(0)} % der Zeit langsam, längstens ${laengste.toFixed(1)} s)`);
}

abschnitt('Abschließbarkeit mit menschenähnlichen Fehlern');
for (const id of AUFTRAG_LISTE) {
  let ok2 = 0; const n = SCHNELL ? 4 : 8;
  for (let seed = 101; seed < 101 + n; seed++) {
    const F = erstelleFahrt(id, { seed });
    const bot = Testfahrer.erstelle(F, { spur: true, reaktion: 0.3, horizont: 2.2, seed });
    let k = 0;
    while (F.w.phase !== 'fertig' && k++ < 120 * 400) F.schritt(bot());
    if (F.w.grund === 'ziel') ok2++;
  }
  ok(ok2 >= Math.ceil(n * 0.75), `${id}: Bot mit Reaktionszeit 0,3 s (Spurwechsel per Tipp) schafft ${ok2}/${n}`);
}

abschnitt('Boostfelder sind freiwillig');
for (const id of AUFTRAG_LISTE) {
  let ok2 = 0; const n = SCHNELL ? 3 : 6;
  for (let seed = 301; seed < 301 + n; seed++) {
    const F = erstelleFahrt(id, { seed });
    F.w.naechstesFeld = 1e9;   // ganz ohne Boostfelder
    const bot = Testfahrer.erstelle(F, { felder: false });
    let k = 0;
    while (F.w.phase !== 'fertig' && k++ < 120 * 400) F.schritt(bot());
    if (F.w.grund === 'ziel' && F.w.statistik.boostFelder === 0) ok2++;
  }
  ok(ok2 >= n - 1, `${id}: ganz ohne Boostfelder schaffbar (${ok2}/${n})`);
}

abschnitt('Neon-Endlos: ein Kontakt beendet die Fahrt');
{
  const F = erstelleFahrt('endlos', { seed: 1, startFaktor: 1 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;
  for (let i = 0; i < 10; i++) F.schritt({});
  // Nähe allein ist kein Crash
  const a = autoVor(F, 0, (SPIELER.breite + FAHRZEUGE.taxi.breite) / 2 + 0.08, 'taxi', F.sp.v);
  for (let i = 0; i < 60; i++) F.schritt({});
  ok(F.w.phase === 'fahrt', 'Vorbeifahren mit 8 cm Lücke: kein Crash');
  F.w.autos.length = 0;
  const b = autoVor(F, 12, 0, 'taxi', 10);
  let crashs = 0;
  for (let i = 0; i < 120 * 3; i++) { F.schritt({}); crashs += F.w.ereignisse.filter(e => e.typ === 'unfall').length; F.w.ereignisse.length = 0; }
  ok(crashs === 1 && F.w.grund === 'crash' && F.w.phase === 'fertig', `Berührung = sofort Ende (genau ein Crash, ${crashs})`);
  ok(b.d - F.sp.d > 0, 'nach dem Crash rollt der Kombi nicht durch das Auto');
  ok(F.w.druck === 0 && F.w.warnung < 0, 'kein Verfolgungsdruck im Endlosmodus');
}

abschnitt('Suchtfaktor: Kombo, Rekordlinie, Aufgaben, Lackierungen');
{
  // Kombo: jedes knappe Manöver +1, verfällt nach komboZeit, Crash setzt zurück
  const F = erstelleFahrt('endlos', { seed: 1, startFaktor: 1, rekordD: 300 });
  F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9; F.w.naechstesFeld = 1e9;
  for (let i = 0; i < 10; i++) F.schritt({});
  for (const off of [15, 40]) { const a = autoVor(F, off, 0, 'kugel', 10); a.x = F.sp.x + (SPIELER.breite + a.breite) / 2 + 0.4; }
  let komboEvents = [];
  for (let i = 0; i < 120 * 3; i++) { F.schritt({}); for (const e of F.w.ereignisse) if (e.typ === 'knapp') komboEvents.push(e.kombo); F.w.ereignisse.length = 0; }
  ok(komboEvents.join(',') === '2,3' && F.w.kombo === 3, `zwei knappe Manöver: Kombo ×2, dann ×3 (${komboEvents})`);
  ok(F.w.punkte.knapp === PUNKTE.knapp * 2 + PUNKTE.knapp * 3, 'knapp-Punkte werden mit der Kombo multipliziert');
  let ende = false, rekord = 0;
  for (let i = 0; i < 120 * (PUNKTE.komboZeit + 2); i++) { F.schritt({}); for (const e of F.w.ereignisse) { if (e.typ === 'komboEnde') ende = true; if (e.typ === 'rekord') rekord++; } F.w.ereignisse.length = 0; }
  ok(ende && F.w.kombo === 1, `Kombo verfällt nach ${PUNKTE.komboZeit} s ohne knappes Manöver`);
  ok(rekord === 1 && F.w.rekordGeknackt, 'Rekordlinie: genau ein Rekord-Ereignis beim Überfahren');
  ok(F.w.statistik.maxKombo === 3, 'höchste Kombo wird gemerkt');
}
{
  // Aufgaben: erfüllte geben einen Stern und werden ersetzt; neue zählen erst ab dem nächsten Lauf
  const stand = { aktiv: [0, 1, 2], naechste: 3, sterne: 0 };
  const lauf = { strecke: 3000, knapp: 0, felder: 5, tempo: 200, ueberholt: 50, kombo: 1, serie: 0, punkte: 1000 };
  const ausnahmen = new Set();
  const e1 = pruefeAufgaben(stand, lauf, { strecke: 0, knapp: 0, felder: 0 }, ausnahmen);
  ok(e1.length === 2 && stand.sterne === 2 && stand.aktiv.includes(1), `2 von 3 Aufgaben erfüllt (${e1.map(a => a.text).join(' / ')})`);
  const e2 = pruefeAufgaben(stand, lauf, { strecke: 0, knapp: 0, felder: 0 }, ausnahmen);
  ok(e2.length === 0 && stand.sterne === 2, 'neue Aufgaben werden im selben Lauf nicht sofort mitgezählt (keine Sternenkette)');
  const e3 = pruefeAufgaben(stand, lauf, { strecke: 0, knapp: 0, felder: 0 }, new Set());
  ok(e3.length >= 1, 'im nächsten Lauf zählen sie');
  const g = AUFGABEN.nr(6);
  ok(g.art === 'gesamt' && pruefeAufgaben({ aktiv: [6, 1, 2], naechste: 30, sterne: 0 }, { strecke: 1000 }, { strecke: 9500 }).length >= 1, 'Gesamt-Aufgaben zählen bisherige Läufe mit');
  let steigt = true; for (let n = AUFGABEN.anzahlFest; n < AUFGABEN.anzahlFest + 40; n += 4) if (AUFGABEN.nr(n + 4).ziel <= AUFGABEN.nr(n).ziel) steigt = false;
  ok(steigt && AUFGABEN.nr(500).text.length > 5, 'nach der festen Liste geht es endlos mit wachsenden Zielen weiter');
  ok(LACKE[0].sterne === 0 && LACKE.every((l, i) => i === 0 || l.sterne > LACKE[i - 1].sterne) && new Set(LACKE.map(l => l.id)).size === LACKE.length, `${LACKE.length} Lackierungen mit steigender Sternzahl`);
}

abschnitt('Spielgefühl: Tempo, Vorwarnzeit, Verkehrsrhythmus (Abnahme)');
// Vorher (Runde 2) gemessen: Annäherung an den Verkehr im Median 10,3–11,6 m/s, Vorwarnzeit 5,3–6,0 s,
// im Containerkai 13 % der Fahrzeit ohne Auto im Bild. Ziel: ~1,5-fache Annäherung, kaum Leerlauf.
const VORHER = { containerkai: 10.3, neonviertel: 11.5, nachthafen: 11.6, endlos: 11.6 };   // Median-Annäherung Runde 2
for (const id of MODI) {
  const naeh = [];
  let zeit = 0, leer = 0, laengsteLeere = 0, leerSeit = 0, n = SCHNELL ? 3 : 5;
  for (let seed = 21; seed < 21 + n; seed++) {
    const F = erstelleFahrt(id, { seed }); const bot = Testfahrer.erstelle(F, { felder: false });
    let k = 0;
    const grenze = AUFTRAEGE[id].endlos ? 120 * 30 : 120 * 400;   // Endlos: Einstieg messen (danach wird es gewollt schneller)
    while (F.w.phase === 'fahrt' && k++ < grenze) {
      F.schritt(bot());
      if (F.w.zeit < 8) continue;   // kurze Startphase nicht mitzählen
      const sicht = F.w.autos.filter(a => a.d > F.sp.d && a.d - F.sp.d < ANSICHT.vorne);
      if (k % 12 === 0) for (const a of sicht) naeh.push(F.sp.v - a.v);
      if (!sicht.length) { leer += DT; leerSeit += DT; laengsteLeere = Math.max(laengsteLeere, leerSeit); } else leerSeit = 0;
      zeit += DT;
    }
  }
  naeh.sort((a, b) => a - b);
  const m = naeh[naeh.length >> 1];
  ok(m >= VORHER[id] * 1.4 && m <= VORHER[id] * 2, `${id}: Annäherung an den Verkehr ${m.toFixed(1)} m/s = ${(m / VORHER[id]).toFixed(2)} × vorher (Ziel ~1,5×)`);
  ok(ANSICHT.vorne / m >= 2.2, `${id}: Vorwarnzeit ${(ANSICHT.vorne / m).toFixed(1)} s (≥ 2,2 s auf allen Geräten gleich)`);
  if (AUFTRAEGE[id].endlos) {
    // auch bei sehr hohem Endlos-Tempo bleibt genug Zeit für einen Spurwechsel (~0,2 s)
    const A = AUFTRAEGE.endlos, v = Math.min(A.tempoSicher, mische(A.tempo, A.tempoZiel, steigerung(A, 20000)));
    const naehMax = v - 16 * v / TEMPO_BEZUG;   // langsamster Verkehr
    ok(ANSICHT.vorne / naehMax >= 0.9, `Endlos bei 20 km (${(v * 3.6).toFixed(0)} km/h): Vorwarnzeit mindestens ${(ANSICHT.vorne / naehMax).toFixed(2)} s`);
  }
  ok(leer / zeit < 0.08 && laengsteLeere < 4, `${id}: kaum Leerlauf (${(100 * leer / zeit).toFixed(1)} % ohne Auto im Bild, längste Pause ${laengsteLeere.toFixed(1)} s)`);
}
{
  // Regelmäßiges Ausweichen ist nötig: Wer nie lenkt, fährt bald auf
  for (const id of MODI) {
    const zeiten = [];
    for (let seed = 41; seed < 47; seed++) {
      const F = erstelleFahrt(id, { seed });
      if (AUFTRAEGE[id].endlos) F.sp.d = 2000;
      let k = 0;
      while (F.w.phase === 'fahrt' && k++ < 120 * 120 && F.w.statistik.unfaelle === 0) F.schritt({});
      zeiten.push(F.w.zeit);
    }
    zeiten.sort((a, b) => a - b);
    const med = zeiten[zeiten.length >> 1];
    ok(med < 14, `${id}: ohne Lenken kommt es im Median nach ${med.toFixed(1)} s zum Unfall (Ausweichen ist Pflicht)`);
  }
}
{
  // Endlos: weich steigend, mit Obergrenze; alle Verkehrsmuster kommen vor
  const A = AUFTRAEGE.endlos;
  let mono = true, alt = -1;
  for (let d = 0; d < 20000; d += 50) { const u = schwierigkeit(A, d); if (u < alt - 1e-12) mono = false; alt = u; }
  ok(mono && schwierigkeit(A, 0) === 0 && schwierigkeit(A, 1e7) === 1, 'Endlos-Schwierigkeit steigt stetig und endet bei 1');
  // immer schneller und voller: streng steigend, aber abflachend und technisch begrenzt
  let steigt = true, a0 = -1;
  for (let d = 400; d < 60000; d += 400) { const g = steigerung(A, d); if (g <= a0) steigt = false; a0 = g; }
  const v5 = mische(A.tempo, A.tempoZiel, steigerung(A, 5000)), v15 = mische(A.tempo, A.tempoZiel, steigerung(A, 15000)), v30 = mische(A.tempo, A.tempoZiel, steigerung(A, 30000));
  ok(steigt && v15 > v5 + 4 && v30 > v15 + 2, `Endlos wird immer schneller: 5 km ${(v5 * 3.6).toFixed(0)} km/h, 15 km ${(v15 * 3.6).toFixed(0)} km/h, 30 km ${(v30 * 3.6).toFixed(0)} km/h`);
  ok(v30 - v15 < v15 - v5 + 1e-9 && A.tempoSicher < A.tempoZiel, 'Zunahme flacht ab, technische Sicherheitsgrenze bleibt');
  const F = erstelleFahrt('endlos', { seed: 5 }); F.w.spawnUhr = 1e9; F.w.polizeiUhr = 1e9;   // nur das Tempo messen
  let k = 0, vAlt = F.w.vGrund, sinkt = false;
  while (F.w.phase === 'fahrt' && k++ < 120 * 60) { F.schritt({}); if (F.w.vGrund < vAlt - 1e-9) sinkt = true; vAlt = F.w.vGrund; }
  ok(!sinkt && F.w.vGrund > A.tempo + 10, `Grundtempo steigt schnell und stetig: nach 60 s ${(A.tempo * 3.6).toFixed(0)} → ${(F.w.vGrund * 3.6).toFixed(0)} km/h`);
  ok(F.w.vGrund * BOOST.faktor >= F.sp.v - 1e-6, 'Höchsttempo = Grundtempo × Boostfaktor (Boost addiert nichts darüber hinaus)');
  const G = erstelleFahrt('endlos', { seed: 5 }); G.sp.d = A.rampe[1]; const botG = Testfahrer.erstelle(G, { spur: true });
  let kg = 0; while (G.w.phase === 'fahrt' && kg++ < 120 * 120) G.schritt(botG());
  const m = G.w.statistik.muster;
  ok(['einzel', 'paar', 'versetzt', 'lkwMix', 'slalom'].every(x => m[x] > 0) && Object.keys(m).length >= 5, `Verkehrsmuster kommen vor ${JSON.stringify(m)}`);
  // Strecke ohne Ende, Abschnitte wiederholen sich, Streckenmarken laufen weiter
  const st = baueStrecke(A);
  ok(!isFinite(st.laenge) && st.abschnittBei(4400 * 3 + 10).art === 'boulevard' && isFinite(st.marke(50)), 'Endlos-Strecke wiederholt ihre Abschnitte ohne Ende');
}
{
  // Missionen: kompakt (60–90 s) mit klarem Ziel
  for (const id of AUFTRAG_LISTE) {
    const F = erstelleFahrt(id, { seed: 3 }); const bot = Testfahrer.erstelle(F, { felder: false });
    let k = 0; while (F.w.phase !== 'fertig' && k++ < 120 * 300) F.schritt(bot());
    ok(F.w.grund === 'ziel' && F.w.zeit >= 55 && F.w.zeit <= 95, `${id}: Missionsdauer ${F.w.zeit.toFixed(0)} s`);
  }
}
{
  // Unfall bremst nur leicht: ein Fehler erzwingt nicht den nächsten
  const F = testFahrt('nachthafen');
  const a = autoVor(F, 8, 0, 'taxi', 20);
  const v0 = F.sp.v;
  let vNach = null;
  for (let i = 0; i < 120 && vNach == null; i++) { F.schritt({}); if (F.w.ereignisse.some(e => e.typ === 'unfall')) vNach = F.sp.v; F.w.ereignisse.length = 0; }
  ok(vNach >= v0 * SCHADEN.tempoNachUnfall - 0.5, `Auffahren: Tempo ${v0.toFixed(1)} → ${vNach && vNach.toFixed(1)} m/s (kein starkes Abbremsen)`);
  ok(F.sp.zustand === 100 - SCHADEN.verkehr && F.w.phase === 'fahrt', 'ein Fehler kostet Zustand, beendet den Lauf aber nicht');
  // Saubere Serie: Bonus genau alle 10 sauberen Überholungen
  const G = testFahrt('nachthafen');
  G.sp.x = spurX(0, 4);
  for (let i = 0; i < 25; i++) autoVor(G, 20 + i * 14, spurX(3, 4) - G.sp.x, 'kugel', 10);
  let serien = 0;
  for (let i = 0; i < 120 * 30; i++) { G.schritt({}); serien += G.w.ereignisse.filter(e => e.typ === 'serie').length; G.w.ereignisse.length = 0; }
  ok(G.w.statistik.ueberholt === 25 && serien === 2 && G.w.punkte.serien === 2 * PUNKTE.serieBonus, `Serienbonus bei 10 und 20 (${G.w.statistik.ueberholt} überholt, ${serien} Serien)`);
}

abschnitt('Reproduzierbarkeit');
{
  const spur = seed => { const F = erstelleFahrt('neonviertel', { seed }); const b = Testfahrer.erstelle(F); for (let i = 0; i < 120 * 30; i++) F.schritt(b()); return F.w.autos.map(a => `${a.typ}${a.d.toFixed(3)}`).join(',') + F.summe(); };
  ok(spur(42) === spur(42), 'gleicher Seed → gleicher Verkehr und gleiche Punkte');
  ok(spur(42) !== spur(43), 'anderer Seed → anderer Verkehr');
}

console.log(`\n${geprueft} Prüfungen, ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
