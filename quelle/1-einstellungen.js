// ===================================================================
// 1 · EINSTELLUNGEN
// Alle Zahlen des Spiels an einer Stelle. Einheiten: Meter und Sekunden.
// d = Strecke in Fahrtrichtung, x = seitlicher Abstand zur Straßenmitte
// (rechts positiv). Die Logik ist für alle Geräte gleich; nur das Bild wird
// an den Bildschirm angepasst.
//
// Runde 3 (Neon-Arcade-Racer): Draufsicht ohne perspektivische Verengung,
// ca. 1,6-fache Annäherung an den Verkehr, Verkehrsmuster in Wellen,
// Neon-Endlos als Hauptmodus, kompakte Missionen (60–90 s).
// ===================================================================

const DT = 1 / 120;                 // fester Simulationsschritt
const SPUR = 3.6;                   // Breite einer Fahrspur
const SPUREN = 4;                   // überall vier Spuren

// Sichtbereich: immer gleich viele Meter, egal wie groß der Bildschirm ist.
// Draufsicht: alle Entfernungen gleich groß (keine Verengung); längs etwas gestaucht,
// damit auf einem Hochformat-Handy genug Strecke voraus sichtbar ist.
const ANSICHT = {
  vorne: 50,        // Meter vor dem Spieler (bei ~19 m/s Annäherung ≈ 2,6 s Vorwarnung)
  hinten: 12,       // Meter hinter dem Spieler (verfolgende Streife bleibt sichtbar)
  breite: 22,       // Meter quer (Straße 14,4 m + Gehweg/Kulisse); breite Bildschirme sehen nicht mehr Straße
  seitenverhaeltnis: 0.6,  // Breite/Höhe des Sichtfensters
  einblenden: 5,    // die obersten Meter werden sanft eingeblendet
};

const SPIELER = {
  laenge: 4.75, breite: 2.0,          // sichtbare Karosserie
  trefferLaenge: 4.15, trefferBreite: 1.62, // etwas kleiner: Nähe allein ist kein Unfall
  seitMax: 12,                         // m/s seitlich (schnell und direkt)
  seitBeschl: 95,                      // m/s² seitliche Beschleunigung
  seitBremse: 180,                     // m/s² beim Loslassen/Gegenlenken: kein Nachrutschen
  zielFaktor: 12,                      // wie stark das Auto dem Fingerziel folgt
  beschl: 9,                           // m/s² bis zur Grundgeschwindigkeit
  boostBeschl: 10,                     // weicher Schub beim Boostfeld
  bremsen: 6,                          // m/s² zurück auf Grundtempo nach dem Boost
  neigungMax: 0.07,                    // rad, kleine Neigung beim Lenken
};

// Boostfelder: leuchtende Pfeilfelder auf einzelnen Spuren, lösen beim Überfahren
// automatisch einen zeitlich begrenzten Schub aus (kein Vorrat, kein Knopf).
const BOOST = {
  faktor: 1.25,         // +25 % gegenüber dem Grundtempo (nie mehr, auch nicht bei mehreren Feldern)
  dauer: 2.5,           // Sekunden volle Wirkung; ein weiteres Feld frischt auf, addiert aber nicht
  anstieg: 0.35,        // s bis zur vollen Wirkung (weicher Übergang)
  abklingen: 0.9,       // s sanfte Rückkehr zum Grundtempo
  feldLaenge: 7, feldBreite: 2.6,     // Feldgröße in Metern (Spurbreite 3,6)
  ersteBei: 260,        // erstes, leicht erreichbares Feld (Einführung)
  abstand: [300, 600],  // unregelmäßige Abstände danach (Meter)
  zielFrei: 200,        // vor dem Ziel keine Felder mehr
};

// Kollisionen: kosten Zustand, bremsen aber nur leicht – ein Fehler soll nicht die nächste Kollision erzwingen
const SCHADEN = {
  verkehr: 18, streifschuss: 10, polizei: 10, schutzzeit: 1.25,
  tempoNachUnfall: 0.82, tempoNachStreifen: 0.93, leitplanke: 0.99, stoss: 9,
};

const DRUCK = {
  max: 100, warnungDauer: 5, warnungEnde: 88,
  naheRadius: 16, fernRadius: 34,
  zerfallFrei: 8.5, zerfallFern: 3.2, sauberBonus: 2.2, sauberNach: 7,
  unfall: 10, polizeiKontakt: 15, marke: 25, ueberholen: 1.2, abgehaengt: 8,
};

const PUNKTE = {
  perfekt: 300, gut: 150, daneben: -50, beutel: 250,
  proMeter: 0.1, boostFaktor: 1.5, boostFeld: 100,
  ueberholen: 40, knapp: 75, knappAbstand: 0.75, serieMax: 10, serieStufe: 0.1,
  serieBonus: 250, serieSchritt: 10,          // „Saubere Serie!“ alle 10 sauberen Überholungen
  marke: 300, abschluss: 2500, proZustand: 20, abgehaengt: 150,
};

// Verkehr: eigene, erfundene Fahrzeugformen. Tempo-Bereiche gelten für Grundtempo 40 m/s und
// werden mit dem aktuellen Grundtempo skaliert (Annäherung bleibt verhältnisgleich).
const FAHRZEUGE = {
  kugel:   { name: 'Kugelflitzer', laenge: 3.7, breite: 1.75, tempo: [22, 27], anteil: 3 },
  taxi:    { name: 'Hafentaxi',    laenge: 4.6, breite: 1.85, tempo: [21, 26], anteil: 3 },
  kasten:  { name: 'Kastenwagen',  laenge: 5.4, breite: 2.05, tempo: [19, 24], anteil: 2 },
  laster:  { name: 'Containerlaster', laenge: 11.5, breite: 2.5, tempo: [16, 20], anteil: 1.2 },
  bus:     { name: 'Nachtbus',     laenge: 12, breite: 2.55, tempo: [17, 20], anteil: 0.7 },
};
const TEMPO_BEZUG = 42;
const POLIZEI_AUTO = { laenge: 4.8, breite: 1.95 };

// Abschnitte einer erfundenen nächtlichen Küstenmetropole. Kurven nur im Bild, sanft.
const ABSCHNITTE = {
  boulevard: { name: 'Neonboulevard',   dichte: 1.0,  kurve: 2.2, welle: 700, wechsel: 0.05, laster: 0.5, licht: 'boulevard' },
  autobahn:  { name: 'Hafenautobahn',   dichte: 1.05, kurve: 1.8, welle: 900, wechsel: 0.06, laster: 1.4, licht: 'autobahn' },
  tunnel:    { name: 'Lichttunnel',     dichte: 0.95, kurve: 1.0, welle: 800, wechsel: 0.03, laster: 0.9, licht: 'tunnel' },
  kueste:    { name: 'Küstenstraße',    dichte: 0.95, kurve: 2.6, welle: 650, wechsel: 0.05, laster: 0.6, licht: 'kueste' },
  lager:     { name: 'Lagerhafen',      dichte: 1.0,  kurve: 1.6, welle: 750, wechsel: 0.05, laster: 1.6, licht: 'lager' },
};

// Modi. „endlos“ ist der Hauptmodus; die Missionen sind kompakte Fahrten mit Ziel.
// Verkehrsmuster: Gewichte je Muster (siehe 3-fahrt.js). Wellen: intensiv / Entlastung (Meter).
const AUFTRAEGE = {
  endlos: {
    nr: 0, name: 'Neon-Endlos', kurz: 'So weit du kommst',
    text: 'Sofort losfahren: erst ruhig, dann immer dichtere Verkehrsmuster bis zu einer festen Obergrenze.',
    endlos: true, tempo: 40, tempoMax: 48, dichte: 3.0, dichteMax: 5.6, wechselFaktor: 0.25, wechselMax: 0.75,
    rampe: [350, 5200],            // ab hier steigt die Schwierigkeit, hier ist die Obergrenze erreicht
    mindestLuecke: 20, welle: [420, 110],
    muster: { einzel: 5, paar: 1, versetzt: 2, lkwMix: 1, tor: 0, slalom: 0 },
    musterMax: { einzel: 2, paar: 2, versetzt: 2.5, lkwMix: 1.5, tor: 1.2, slalom: 1.5 },
    polizei: { max: 1, maxSpaet: 2, erste: 30, pause: 14, tempo: 1.19, seit: 5.5, druck: 8 },
    abschnitte: [['boulevard', 900], ['autobahn', 1000], ['kueste', 900], ['tunnel', 700], ['lager', 900]],
    coup: { tempo: 0.6, zone: 0.2 }, erklaeren: true, farbe: '#FF4FD8',
  },
  containerkai: {
    nr: 1, name: 'Containerkai', kurz: 'Einstieg, ca. 65 s',
    text: 'Vom Lagerhafen über die Hafenautobahn: großzügige Lücken, erste Verkehrsmuster.',
    tempo: 43, dichte: 4.6, wechselFaktor: 0.35, mindestLuecke: 22, welle: [430, 80],
    muster: { einzel: 4, paar: 1, versetzt: 2, lkwMix: 1.2, tor: 0.3, slalom: 0.4 },
    polizei: { max: 1, erste: 18, pause: 14, tempo: 1.18, seit: 5.5, druck: 7 },
    abschnitte: [['lager', 900], ['autobahn', 1050], ['boulevard', 750]],
    coup: { tempo: 0.5, zone: 0.22 }, erklaeren: true, farbe: '#24D6CD',
  },
  neonviertel: {
    nr: 2, name: 'Neonviertel', kurz: 'Dichter Verkehr, ca. 75 s',
    text: 'Neonboulevard und Lichttunnel: dichtere Gruppen, wechselnde Ausweichrichtung.',
    tempo: 44, dichte: 4.8, wechselFaktor: 0.55, mindestLuecke: 20, welle: [420, 100],
    muster: { einzel: 3, paar: 1.5, versetzt: 2.5, lkwMix: 1.2, tor: 0.9, slalom: 1.2 },
    polizei: { max: 2, erste: 16, pause: 13, tempo: 1.16, seit: 5.5, druck: 9 },
    abschnitte: [['boulevard', 950], ['tunnel', 800], ['boulevard', 700], ['autobahn', 800]],
    coup: { tempo: 0.66, zone: 0.19 }, erklaeren: false, farbe: '#FF4FD8',
  },
  nachthafen: {
    nr: 3, name: 'Nachthafen', kurz: 'Fordernd, ca. 85 s',
    text: 'Küstenstraße, Tunnel, Lagerhafen: anspruchsvolle Muster bei hohem Tempo.',
    tempo: 46, dichte: 5.2, wechselFaktor: 0.7, mindestLuecke: 19, welle: [450, 100],
    muster: { einzel: 2, paar: 1.5, versetzt: 2.5, lkwMix: 1.5, tor: 1.2, slalom: 1.5 },
    polizei: { max: 2, erste: 14, pause: 10, tempo: 1.19, seit: 6, druck: 10 },
    abschnitte: [['kueste', 900], ['tunnel', 750], ['lager', 900], ['boulevard', 900], ['autobahn', 500]],
    coup: { tempo: 0.8, zone: 0.17 }, erklaeren: false, farbe: '#FF9A3D',
  },
};
const AUFTRAG_LISTE = ['containerkai', 'neonviertel', 'nachthafen'];
const MODI = ['endlos', ...AUFTRAG_LISTE];

// Hilfen für alle Teile
const klemme = (v, a, b) => (v < a ? a : v > b ? b : v);
const mische = (a, b, t) => a + (b - a) * t;
const glatt = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function spurX(spur, spuren) { return (spur - (spuren - 1) / 2) * SPUR; }
function strassenHalbe(spuren) { return spuren * SPUR / 2; }

// Reproduzierbarer Zufall (Mulberry32). Gleicher Startwert → gleicher Verkehr.
function zufall(startwert) {
  let a = (startwert >>> 0) || 1;
  const f = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.zwischen = (x, y) => x + (y - x) * f();
  f.ganz = n => Math.floor(f() * n);
  f.wahl = liste => liste[Math.floor(f() * liste.length)];
  return f;
}

// Strecke: Abschnitte mit Anfang/Ende, Streckenmarken, Ziel. Im Endlosmodus wiederholen sich
// die Abschnitte ohne Ende (Abschnitt Nr. n beginnt bei n · Zykluslänge / …).
function baueStrecke(auftrag) {
  const vorlage = auftrag.abschnitte;
  const zyklus = vorlage.reduce((s, [, l]) => s + l, 0);
  const endlos = !!auftrag.endlos;
  const teil = n => {
    const runde = Math.floor(n / vorlage.length), i = n % vorlage.length;
    let von = runde * zyklus;
    for (let k = 0; k < i; k++) von += vorlage[k][1];
    const [art, laenge] = vorlage[i];
    return { art, nr: n, von, bis: von + laenge, ...ABSCHNITTE[art] };
  };
  const teile = vorlage.map((_, i) => teil(i));
  const laenge = endlos ? Infinity : zyklus;
  function nrBei(dd) {
    if (dd < 0) return 0;
    if (!endlos) { for (const t of teile) if (dd < t.bis) return t.nr; return teile.length - 1; }
    const runde = Math.floor(dd / zyklus);
    let rest = dd - runde * zyklus, i = 0;
    while (i < vorlage.length - 1 && rest >= vorlage[i][1]) { rest -= vorlage[i][1]; i++; }
    return runde * vorlage.length + i;
  }
  const cache = new Map();
  const teilNr = n => { if (!endlos) return teile[klemme(n, 0, teile.length - 1)]; if (!cache.has(n)) { if (cache.size > 40) cache.clear(); cache.set(n, teil(n)); } return cache.get(n); };
  return {
    teile, laenge, endlos,
    zielVon: endlos ? Infinity : zyklus - 26,          // markierter Zielbereich (Missionen)
    teilNr,
    abschnittBei: dd => teilNr(nrBei(dd)),
    // i-te Streckenmarke (Anfang des Abschnitts i+1); Infinity, wenn es keine gibt
    marke: i => (endlos || i + 1 < teile.length ? teilNr(i + 1).von : Infinity),
    anzahlMarken: endlos ? Infinity : teile.length - 1,
    // Kurven nur fürs Bild: Mittellinie seitlich sanft verschoben
    kurve(dd) {
      const n = nrBei(dd);
      let summe = 0;
      for (let k = Math.max(0, n - 1); k <= n + 1; k++) {
        if (!endlos && k >= teile.length) break;
        const t = teilNr(k);
        const rein = glatt((dd - t.von + 120) / 240) * glatt((t.bis + 120 - dd) / 240);
        if (rein <= 0) continue;
        summe += rein * t.kurve * Math.sin((dd + t.nr * 333) / t.welle * Math.PI * 2);
      }
      return summe;
    },
  };
}

// Schwierigkeit 0…1 im Endlosmodus (weich ansteigend, mit Obergrenze); Missionen: konstant
function schwierigkeit(auftrag, d) {
  if (!auftrag.endlos) return 1;
  return glatt((d - auftrag.rampe[0]) / (auftrag.rampe[1] - auftrag.rampe[0]));
}
