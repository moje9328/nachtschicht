// Logik-Tests ohne Browser: node quelle/test-logik.js  (Argument "schnell" = weniger Seeds)
// Prüft dieselben Dateien wie im Spiel (lade-logik.js).
const L = require('./lade-logik.js')();
const { DT, ANSICHT, SPIELER, BOOST, SCHADEN, DRUCK, PUNKTE, AUFTRAEGE, AUFTRAG_LISTE, FAHRZEUGE, erstelleCoup, erstelleFahrt, Testfahrer, spurX } = L;
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
  const F = erstelleFahrt('training', { seed: 1 });
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
  const F = erstelleFahrt('training', { seed: 1, startFaktor: 1 });
  F.w.spawnUhr = 1e9;
  let vMax = 0, boostMin = 100;
  for (let i = 0; i < 120 * 6; i++) { F.schritt({ boost: true }); vMax = Math.max(vMax, F.sp.v); boostMin = Math.min(boostMin, F.sp.boost); }
  ok(vMax <= F.w.vGrund * BOOST.faktor + 1e-6 && vMax > F.w.vGrund * 1.25, `Boost erhöht Tempo begrenzt (${vMax.toFixed(1)} von ${F.w.vGrund})`);
  ok(boostMin === 0 && !F.sp.boostAn, 'Boost verbraucht sich und endet bei leer');
  const b0 = F.sp.boost;
  F.schritt({ boost: true });
  ok(!F.sp.boostAn, `leer: kein Neustart unter Mindestladung (${BOOST.mindestStart})`);
  for (let i = 0; i < 120 * 4; i++) F.schritt({});
  ok(F.sp.boost > b0 + 25 && F.sp.boost < 50, `lädt langsam wieder auf (${F.sp.boost.toFixed(1)} nach 4 s)`);
  ok(Math.abs(F.sp.v - F.w.vGrund) < 0.1, 'nach dem Boost zurück auf Grundtempo (kein endloses Steigern)');
}

abschnitt('Fahrt: Kollisionen');
function testFahrt(auftrag = 'training', seed = 1) {
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
  // Maximaltempo: auch mit Boost und sehr hohem Tempo kein Durchtunneln
  for (const v of [F0 => F0.w.vGrund * BOOST.faktor, () => 90]) {
    const F = testFahrt();
    F.sp.v = v(F);
    const a = autoVor(F, 25, 0, 'kugel', 5);
    let unfaelle = 0, n = 0;
    while (F.sp.d < a.d + 10 && n++ < 600) { F.schritt({ boost: true }); if (v(F) === 90) F.sp.v = 90; unfaelle += F.w.ereignisse.filter(e => e.typ === 'unfall').length; F.w.ereignisse.length = 0; if (unfaelle) break; }
    ok(unfaelle === 1, `Kollision bei ${v(F).toFixed(0)} m/s erkannt (${unfaelle})`);
  }
  // Boost macht nicht unverwundbar
  const F = testFahrt();
  autoVor(F, 12, 0, 'taxi', 10);
  for (let i = 0; i < 120; i++) F.schritt({ boost: true });
  ok(F.sp.zustand < 100, 'Unfall auch während Boost kostet Zustand');
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
  for (let i = 0; i < 30; i++) F.schritt({});
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
  G.w.druck = 60; G.sp.d = G.strecke.marken[0] - 0.5;
  for (let i = 0; i < 10; i++) G.schritt({});
  ok(G.w.druck < 60 - DRUCK.marke + 1, `Streckenmarke senkt den Druck (${G.w.druck.toFixed(1)})`);
}

// ------------------------------------------------------------------
abschnitt('Faire Verkehrserzeugung (reproduzierbare Seeds)');
const SEEDS = SCHNELL ? 6 : 16;
const zusammenfassung = {};
for (const id of ['training', ...AUFTRAG_LISTE]) {
  let waende = 0, proben = 0, zuNah = 0, blinkKurz = 0, wechsel = 0, ueberlapp = 0, polOhneWarnung = 0, polVorne = 0, polZuSchnell = 0, polImBild = 0, geschafft = 0, polizeiAnzahl = 0, tempoZuHoch = 0;
  let warnBisDa = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const F = erstelleFahrt(id, { seed });
    const bot = Testfahrer.erstelle(F);
    const gesehen = new Set(), blinkStart = new Map();
    let letzteWarnung = -1;
    const P = AUFTRAEGE[id].polizei;
    let n = 0;
    while (F.w.phase !== 'fertig' && n++ < 120 * 400) {
      F.schritt(bot());
      const w = F.w, sp = F.sp;
      if (sp.v > w.vGrund * BOOST.faktor + 1e-6) tempoZuHoch++;
      for (const e of w.ereignisse) {
        if (e.typ === 'polizeiWarnung') letzteWarnung = w.zeit;
        if (e.typ === 'polizeiDa') { polizeiAnzahl++; if (letzteWarnung < 0) polOhneWarnung++; else warnBisDa.push(w.zeit - letzteWarnung); }
      }
      w.ereignisse.length = 0;
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
        proben++;
        if (!F.pfadFrei([], w.vGrund, true)) waende++;
      }
    }
    if (F.w.grund === 'ziel') geschafft++;
  }
  zusammenfassung[id] = { geschafft, polizeiAnzahl };
  ok(waende === 0, `${id}: keine geschlossene Wand in ${proben} Stichproben (${waende})`);
  ok(zuNah === 0, `${id}: kein Auto taucht im Sichtbereich auf (${zuNah})`);
  ok(blinkKurz === 0, `${id}: jeder Spurwechsel ≥ 1,4 s vorher angekündigt (${wechsel} Wechsel)`);
  ok(tempoZuHoch === 0, `${id}: Tempo nie über Boost-Grenze`);
  if (AUFTRAEGE[id].polizei) {
    ok(polizeiAnzahl > 0, `${id}: Streifen kommen vor (${polizeiAnzahl})`);
    ok(polOhneWarnung === 0 && Math.min(...warnBisDa) >= 2.2, `${id}: jede Streife mit Vorwarnung ≥ 2,2 s (min ${Math.min(...warnBisDa).toFixed(2)} s)`);
    ok(polImBild === 0, `${id}: Streifen entstehen außerhalb des Bildes hinter dem Spieler`);
    ok(polZuSchnell === 0, `${id}: Streifen halten ihre Höchstgeschwindigkeit ein`);
    ok(polVorne === 0, `${id}: keine Streife setzt sich vor den Spieler (${polVorne})`);
    ok(ueberlapp === 0, `${id}: Streifen fahren nie durch andere Autos (${ueberlapp})`);
  } else ok(polizeiAnzahl === 0, `${id}: keine Streifen im Training`);
  ok(geschafft === SEEDS, `${id}: Testfahrer schafft alle ${SEEDS} Seeds (${geschafft})`);
}

abschnitt('Abschließbarkeit mit menschenähnlichen Fehlern');
for (const id of AUFTRAG_LISTE) {
  let ok2 = 0; const n = SCHNELL ? 4 : 8;
  for (let seed = 101; seed < 101 + n; seed++) {
    const F = erstelleFahrt(id, { seed });
    const bot = Testfahrer.erstelle(F, { boost: 'warnung', reaktion: 0.3, zittern: 0.8, horizont: 2.2, seed });
    let k = 0;
    while (F.w.phase !== 'fertig' && k++ < 120 * 400) F.schritt(bot());
    if (F.w.grund === 'ziel') ok2++;
  }
  ok(ok2 >= Math.ceil(n * 0.75), `${id}: Bot mit Reaktionszeit 0,3 s und Zittern schafft ${ok2}/${n}`);
}

abschnitt('Reproduzierbarkeit');
{
  const spur = seed => { const F = erstelleFahrt('neonviertel', { seed }); const b = Testfahrer.erstelle(F); for (let i = 0; i < 120 * 30; i++) F.schritt(b()); return F.w.autos.map(a => `${a.typ}${a.d.toFixed(3)}`).join(',') + F.summe(); };
  ok(spur(42) === spur(42), 'gleicher Seed → gleicher Verkehr und gleiche Punkte');
  ok(spur(42) !== spur(43), 'anderer Seed → anderer Verkehr');
}

console.log(`\n${geprueft} Prüfungen, ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
