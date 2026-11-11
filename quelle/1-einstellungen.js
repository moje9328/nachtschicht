// ===================================================================
// 1 · EINSTELLUNGEN
// Alle Zahlen des Spiels an einer Stelle. Einheiten: Meter und Sekunden.
// d = Strecke in Fahrtrichtung, x = seitlicher Abstand zur Straßenmitte
// (rechts positiv). Die Logik ist für alle Geräte gleich; nur das Bild wird
// an den Bildschirm angepasst.
// ===================================================================

const DT = 1 / 120;                 // fester Simulationsschritt
const SPUR = 3.6;                   // Breite einer Fahrspur

// Sichtbereich: immer gleich viele Meter voraus, egal wie groß der Bildschirm ist
const ANSICHT = {
  vorne: 62,        // Meter vor dem Spieler, die man sieht
  hinten: 9,        // Meter hinter dem Spieler
  breite: 19.5,     // Meter quer (unten im Bild); breite Bildschirme sehen nicht mehr Straße
  schraeg: 0.36,    // leichte Schrägsicht: oben ist alles um so viel kleiner
  himmel: 0.075,    // Anteil oben für Horizont und Skyline
  seitenverhaeltnis: 0.62, // Breite/Höhe des Sichtfensters
  einblenden: 8,    // die letzten Meter oben werden sanft eingeblendet
};

const SPIELER = {
  laenge: 4.75, breite: 2.0,          // sichtbare Karosserie
  trefferLaenge: 4.15, trefferBreite: 1.62, // etwas kleiner: Nähe allein ist kein Unfall
  seitMax: 10.5,                       // m/s seitlich
  seitBeschl: 75,                      // m/s² seitliche Beschleunigung (direkt, aber nicht ruckartig)
  seitBremse: 150,                     // m/s² beim Loslassen/Gegenlenken: kein Nachrutschen
  zielFaktor: 11,                      // wie stark das Auto dem Fingerziel folgt
  beschl: 7.5,                         // m/s² bis zur Grundgeschwindigkeit
  boostBeschl: 11,
  bremsen: 6,                          // m/s² zurück auf Grundtempo nach dem Boost
  neigungMax: 0.075,                   // rad, kleine Neigung beim Lenken
};

const BOOST = {
  max: 100, verbrauch: 32, laden: 9, mindestStart: 18, faktor: 1.34, nachlauf: 0.25,
};

const SCHADEN = {
  verkehr: 20, streifschuss: 12, polizei: 10, schutzzeit: 1.25,
  tempoNachUnfall: 0.62, tempoNachStreifen: 0.85, leitplanke: 0.985,
};

const DRUCK = {
  max: 100, warnungDauer: 5, warnungEnde: 88,
  naheRadius: 16, fernRadius: 34,
  zerfallFrei: 8.5, zerfallFern: 3.2, sauberBonus: 2.2, sauberNach: 7,
  unfall: 10, polizeiKontakt: 15, marke: 25, ueberholen: 1.2, abgehaengt: 8,
};

const PUNKTE = {
  perfekt: 300, gut: 150, daneben: -50, beutel: 250,
  proMeter: 0.12, boostFaktor: 1.5,
  ueberholen: 40, knapp: 75, knappAbstand: 0.75, serieMax: 10, serieStufe: 0.1,
  marke: 400, abschluss: 2500, proZustand: 20, abgehaengt: 150,
};

// Verkehr: eigene, erfundene Fahrzeugformen
const FAHRZEUGE = {
  kugel:   { name: 'Kugelflitzer', laenge: 3.7, breite: 1.75, tempo: [22, 27], anteil: 3 },
  taxi:    { name: 'Hafentaxi',    laenge: 4.6, breite: 1.85, tempo: [21, 26], anteil: 3 },
  kasten:  { name: 'Kastenwagen',  laenge: 5.4, breite: 2.05, tempo: [19, 24], anteil: 2 },
  laster:  { name: 'Containerlaster', laenge: 11.5, breite: 2.5, tempo: [16, 20], anteil: 1.4 },
  bus:     { name: 'Nachtbus',     laenge: 12, breite: 2.55, tempo: [17, 20], anteil: 0.8 },
};
const POLIZEI_AUTO = { laenge: 4.8, breite: 1.95 };

// Abschnittsarten: Aussehen, Kurven (nur im Bild), Verkehrsdichte, Spurwechsel
const ABSCHNITTE = {
  zubringer: { name: 'Hafenzubringer',  dichte: 0.85, kurve: 5,   welle: 520, wechsel: 0.035, laster: 1.6, licht: 'hafen' },
  autobahn:  { name: 'Breite Autobahn', dichte: 1.0,  kurve: 3,   welle: 900, wechsel: 0.06,  laster: 1.0, licht: 'autobahn' },
  tunnel:    { name: 'Lichttunnel',     dichte: 0.9,  kurve: 1.5, welle: 700, wechsel: 0.02,  laster: 0.8, licht: 'tunnel' },
  bruecke:   { name: 'Brücke',          dichte: 0.95, kurve: 2.5, welle: 1100, wechsel: 0.045, laster: 1.2, licht: 'bruecke' },
  industrie: { name: 'Neon-Industriezone', dichte: 1.1, kurve: 4, welle: 650, wechsel: 0.07, laster: 1.3, licht: 'neon' },
};

// Aufträge. Alle Orte und Namen sind erfunden.
const AUFTRAEGE = {
  containerkai: {
    nr: 1, name: 'Containerkai', kurz: 'Einfacher Einstieg',
    text: 'Der Auftakt: ein Wertterminal am stillen Kai, danach eine kurze Fahrt mit viel Platz. Hier lernst du Lenken und Boost.',
    spuren: 3, tempo: 31, dichte: 2.6, wechselFaktor: 0.6, mindestLuecke: 30,
    polizei: { max: 1, erste: 32, pause: 18, tempo: 1.05, seit: 4.2, druck: 7 },
    abschnitte: [['zubringer', 900], ['autobahn', 1300], ['bruecke', 1000]],
    coup: { tempo: 0.5, zone: 0.22 },
    erklaeren: true, farbe: '#24D6CD',
  },
  neonviertel: {
    nr: 2, name: 'Neonviertel', kurz: 'Dichterer Verkehr',
    text: 'Zwischen Leuchtreklamen wird es voller. Wähle Lücken bewusst, nutze den Boost mit Köpfchen.',
    spuren: 4, tempo: 34, dichte: 4.6, wechselFaktor: 1, mindestLuecke: 24,
    polizei: { max: 2, erste: 22, pause: 13, tempo: 1.09, seit: 4.8, druck: 10 },
    abschnitte: [['zubringer', 600], ['industrie', 1200], ['tunnel', 900], ['autobahn', 1400]],
    coup: { tempo: 0.66, zone: 0.19 },
    erklaeren: false, farbe: '#FF4FD8',
  },
  nachthafen: {
    nr: 3, name: 'Nachthafen', kurz: 'Lange, fordernde Fahrt',
    text: 'Die große Runde über den ganzen Nachthafen: Tunnel, Brücke, Industriezone. Längere Fahrt, anspruchsvoller Verkehr.',
    spuren: 4, tempo: 37, dichte: 5.4, wechselFaktor: 1.2, mindestLuecke: 22,
    polizei: { max: 3, erste: 18, pause: 11, tempo: 1.1, seit: 5, druck: 11 },
    abschnitte: [['zubringer', 500], ['autobahn', 1200], ['tunnel', 900], ['bruecke', 1200], ['industrie', 1300], ['autobahn', 1000]],
    coup: { tempo: 0.8, zone: 0.17 },
    erklaeren: false, farbe: '#FF9A3D',
  },
  training: {
    nr: 0, name: 'Training', kurz: 'Fahren üben',
    text: 'Ohne Coup und ohne Streife. Wenig Verkehr, alle Abschnitte einmal.',
    spuren: 4, tempo: 32, dichte: 1.8, wechselFaktor: 0.4, mindestLuecke: 34,
    polizei: null,
    abschnitte: [['zubringer', 500], ['autobahn', 500], ['tunnel', 500], ['bruecke', 500], ['industrie', 500]],
    coup: null, erklaeren: true, farbe: '#FFD35A',
  },
};
const AUFTRAG_LISTE = ['containerkai', 'neonviertel', 'nachthafen'];

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

// Strecke eines Auftrags: Abschnitte mit Anfang/Ende, Streckenmarken, Ziel
function baueStrecke(auftrag) {
  let d = 0;
  const teile = auftrag.abschnitte.map(([art, laenge], i) => {
    const t = { art, nr: i, von: d, bis: d + laenge, ...ABSCHNITTE[art] };
    d += laenge;
    return t;
  });
  return {
    teile, laenge: d,
    marken: teile.slice(1).map(t => t.von),       // Streckenmarke an jedem Abschnittswechsel
    zielVon: d - 26,                                // markierter Zielbereich
    abschnittBei(dd) { for (const t of teile) if (dd < t.bis) return t; return teile[teile.length - 1]; },
    // Kurven nur fürs Bild: Mittellinie seitlich verschoben, weich zwischen Abschnitten
    kurve(dd) {
      let summe = 0;
      for (const t of teile) {
        const rein = glatt((dd - t.von + 120) / 240) * glatt((t.bis + 120 - dd) / 240);
        if (rein <= 0) continue;
        summe += rein * t.kurve * Math.sin((dd + t.nr * 333) / t.welle * Math.PI * 2);
      }
      return summe;
    },
  };
}
