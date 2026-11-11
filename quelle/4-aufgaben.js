// ===================================================================
// 4 · AUFGABEN & GARAGE (Langzeitmotivation)
// Immer drei Aufgaben sind aktiv. Eine erfüllte Aufgabe gibt einen Stern
// und wird sofort durch die nächste ersetzt. Sterne schalten Lackierungen
// für den Kombi frei (rein kosmetisch). Nach der festen Liste geht es mit
// wachsenden Zielen endlos weiter. Ohne DOM, testbar in Node.
// ===================================================================

const AUFGABEN = (() => {
  // art 'lauf' = in einem einzigen Lauf, 'gesamt' = über alle Läufe zusammen
  const L = (wert, ziel, text) => ({ art: 'lauf', wert, ziel, text });
  const G = (wert, ziel, text) => ({ art: 'gesamt', wert, ziel, text });
  const liste = [
    L('strecke', 1000, 'Fahre 1 km in einem Lauf'),
    L('knapp', 3, '3× knapp vorbei in einem Lauf'),
    L('felder', 2, 'Nimm 2 Boostfelder in einem Lauf'),
    L('tempo', 190, 'Erreiche 190 km/h'),
    L('ueberholt', 40, 'Überhole 40 Autos in einem Lauf'),
    L('kombo', 3, 'Erreiche Kombo ×3'),
    G('strecke', 10000, 'Fahre insgesamt 10 km'),
    L('strecke', 2500, 'Fahre 2,5 km in einem Lauf'),
    L('punkte', 15000, 'Schaffe 15.000 Punkte in einem Lauf'),
    L('serie', 20, 'Saubere Serie von 20 Überholungen'),
    L('kombo', 5, 'Erreiche Kombo ×5'),
    L('tempo', 230, 'Erreiche 230 km/h'),
    G('knapp', 50, 'Insgesamt 50× knapp vorbei'),
    L('felder', 5, 'Nimm 5 Boostfelder in einem Lauf'),
    L('strecke', 4000, 'Fahre 4 km in einem Lauf'),
    L('punkte', 40000, 'Schaffe 40.000 Punkte in einem Lauf'),
    G('strecke', 50000, 'Fahre insgesamt 50 km'),
    L('kombo', 8, 'Erreiche die volle Kombo ×8'),
    L('strecke', 6000, 'Fahre 6 km in einem Lauf'),
    L('tempo', 260, 'Erreiche 260 km/h'),
    G('felder', 100, 'Insgesamt 100 Boostfelder'),
  ];
  // Danach: wachsende Ziele, abwechselnd
  function nr(n) {
    // Ersatzaufgaben (an das Können angepasst): id = 100000 + Typ · 10000 + Wert
    if (n >= 100000) {
      const t = Math.floor((n - 100000) / 10000), v = (n - 100000) % 10000;
      const e = [
        () => G('strecke', v * 1000, `Fahre insgesamt ${v.toLocaleString('de-DE')} km`),
        () => L('knapp', v, `${v}× knapp vorbei in einem Lauf`),
        () => L('felder', v, `Nimm ${v} Boostfelder in einem Lauf`),
        () => L('ueberholt', v * 10, `Überhole ${v * 10} Autos in einem Lauf`),
      ][t % 4]();
      return { id: n, ersatz: true, ...e };
    }
    if (n < liste.length) return { id: n, ...liste[n] };
    const k = n - liste.length, stufe = Math.floor(k / 4) + 1;
    // langsam wachsend, damit keine Aufgabe dauerhaft unschaffbar wird
    // Lauf-Aufgaben haben eine Obergrenze (dort wiederholen sie sich), Gesamt-Aufgaben wachsen weiter
    const km = Math.min(10, 6 + stufe * 0.5), pkt = Math.min(120000, 40000 + stufe * 10000), kn = Math.min(30, 10 + stufe * 2);
    const vorlagen = [
      () => L('strecke', km * 1000, `Fahre ${km.toLocaleString('de-DE')} km in einem Lauf`),
      () => L('punkte', pkt, `Schaffe ${pkt.toLocaleString('de-DE')} Punkte in einem Lauf`),
      () => L('knapp', kn, `${kn}× knapp vorbei in einem Lauf`),
      () => G('strecke', 50000 + stufe * 50000, `Fahre insgesamt ${50 + stufe * 50} km`),
    ];
    return { id: n, ...vorlagen[k % 4]() };
  }
  return { anzahlFest: liste.length, nr };
})();

// Lackierungen: selbst entworfen, nur Farben (Silhouette bleibt der eigene Kombi)
const LACKE = [
  { id: 'nacht', name: 'Nachtviolett', sterne: 0, basis: '#3B1C6B', glanz: '#6A3BB8', dach: '#4A2585', dunkel: '#26113F', akzent: '#24D6CD', akzent2: '#FF4FD8' },
  { id: 'sonne', name: 'Sonnenuntergang', sterne: 3, basis: '#7A2440', glanz: '#C8466A', dach: '#94305A', dunkel: '#4A1428', akzent: '#FF9A3D', akzent2: '#FFD35A' },
  { id: 'eis', name: 'Eisblau', sterne: 6, basis: '#1D4E7A', glanz: '#3D86C0', dach: '#2A6396', dunkel: '#102E4A', akzent: '#BDF4FF', akzent2: '#7FD8FF' },
  { id: 'gift', name: 'Neongrün', sterne: 10, basis: '#173F2A', glanz: '#2E7A4E', dach: '#225C3B', dunkel: '#0C2618', akzent: '#7CFF6B', akzent2: '#24D6CD' },
  { id: 'gold', name: 'Goldrausch', sterne: 14, basis: '#5A4214', glanz: '#A67C22', dach: '#7A5A1A', dunkel: '#33250A', akzent: '#FFD35A', akzent2: '#FF805B' },
  { id: 'chrom', name: 'Chrom-Magenta', sterne: 18, basis: '#4A4F63', glanz: '#8C93AE', dach: '#606780', dunkel: '#2A2D3A', akzent: '#FF4FD8', akzent2: '#BDF4FF' },
  // Langzeitziele
  { id: 'mitternacht', name: 'Mitternachtsblau', sterne: 24, basis: '#141B4A', glanz: '#2E3C9E', dach: '#1E2A72', dunkel: '#0A0F2C', akzent: '#7FD8FF', akzent2: '#FFD35A' },
  { id: 'koralle', name: 'Korallenriff', sterne: 30, basis: '#8A3A3A', glanz: '#E0705E', dach: '#B04E48', dunkel: '#4E1E1E', akzent: '#5FE3EE', akzent2: '#FFF4DC' },
  { id: 'lava', name: 'Lavarot', sterne: 38, basis: '#5A0E14', glanz: '#B8242E', dach: '#801820', dunkel: '#2E060A', akzent: '#FF9A3D', akzent2: '#FFD35A' },
  { id: 'aurora', name: 'Polarlicht', sterne: 46, basis: '#123A3E', glanz: '#2A8A84', dach: '#1C5E5E', dunkel: '#08201F', akzent: '#7CFF6B', akzent2: '#C9A7FF' },
  { id: 'tiefsee', name: 'Tiefseeleuchten', sterne: 56, basis: '#06243A', glanz: '#0F5F8A', dach: '#0A3E5E', dunkel: '#02121E', akzent: '#24D6CD', akzent2: '#FF4FD8' },
  { id: 'glut', name: 'Neonglut', sterne: 68, basis: '#2A1030', glanz: '#7A2A8A', dach: '#4E1A5A', dunkel: '#150818', akzent: '#FF805B', akzent2: '#FF4FD8' },
  { id: 'prisma', name: 'Prisma', sterne: 82, basis: '#E8E4F2', glanz: '#FFFFFF', dach: '#C9C2DE', dunkel: '#8E86A8', akzent: '#FF4FD8', akzent2: '#24D6CD' },
  { id: 'legende', name: 'Hafenlegende', sterne: 100, basis: '#0E0E12', glanz: '#3A3A44', dach: '#22222A', dunkel: '#050507', akzent: '#FFD35A', akzent2: '#FFD35A' },
];

// Fahrerränge nach Sternen (Langzeitmotivation)
const RAENGE = [
  [0, 'Neuling'], [5, 'Kurierfahrer'], [12, 'Nachtfahrer'], [20, 'Spurwechsel-Profi'], [30, 'Neonpilot'],
  [45, 'Hafenschreck'], [65, 'Straßenlegende'], [100, 'Nachtschicht-Legende'],
];
function rangVon(sterne) { let r = RAENGE[0][1]; for (const [ab, name] of RAENGE) if (sterne >= ab) r = name; return r; }

// Festgefahrene Aufgaben tauschen: Nach `grenze` Läufen ohne Erfolg wird eine Aufgabe durch eine an das
// bisherige Können angepasste ersetzt (aus den Durchschnittswerten). So stockt der Fortschritt nie lange.
function tauscheFestgefahrene(stand, gesamt, grenze = 8) {
  stand.versuche = stand.versuche || {};
  const getauscht = [];
  const laeufe = Math.max(1, gesamt.laeufe || 0);
  for (let i = 0; i < stand.aktiv.length; i++) {
    const id = stand.aktiv[i];
    stand.versuche[id] = (stand.versuche[id] || 0) + 1;
    if (stand.versuche[id] < grenze) continue;
    const typ = (stand.tausch = (stand.tausch || 0) + 1) % 4;
    let wert = [
      Math.ceil((gesamt.strecke || 0) / 1000) + 5,
      klemme(Math.round((gesamt.knapp || 0) / laeufe * 1.3) + 1, 2, 30),
      klemme(Math.round((gesamt.felder || 0) / laeufe * 1.3) + 1, 2, 15),
      klemme(Math.round((gesamt.ueberholt || 0) / laeufe * 1.2 / 10) + 1, 3, 40),
    ][typ];
    let neu = 100000 + typ * 10000 + Math.min(9999, wert);
    while (stand.aktiv.includes(neu)) neu++;
    getauscht.push({ alt: AUFGABEN.nr(id), neu: AUFGABEN.nr(neu) });
    delete stand.versuche[id];
    stand.aktiv[i] = neu;
  }
  return getauscht;
}

// Fortschritt einer Aufgabe aus Lauf-Statistik und Gesamtwerten
function aufgabeWert(a, lauf, gesamt) {
  return a.art === 'gesamt' ? (gesamt[a.wert] || 0) + (lauf[a.wert] || 0) : (lauf[a.wert] || 0);
}
// Prüft die aktiven Aufgaben; erfüllte werden ersetzt. Neue Aufgaben zählen erst ab dem nächsten Lauf
// (ausnahmen = ids, die in diesem Lauf neu dazugekommen sind). Gibt die erfüllten zurück.
function pruefeAufgaben(stand, lauf, gesamt, ausnahmen = new Set()) {
  const erfuellt = [];
  for (let i = 0; i < stand.aktiv.length; i++) {
    if (ausnahmen.has(stand.aktiv[i])) continue;
    const a = AUFGABEN.nr(stand.aktiv[i]);
    if (aufgabeWert(a, lauf, gesamt) >= a.ziel) {
      erfuellt.push(a);
      stand.sterne++;
      if (stand.versuche) delete stand.versuche[a.id];
      stand.aktiv[i] = stand.naechste++;
      ausnahmen.add(stand.aktiv[i]);
    }
  }
  return erfuellt;
}
