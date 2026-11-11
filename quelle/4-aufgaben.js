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
    if (n < liste.length) return { id: n, ...liste[n] };
    const k = n - liste.length, stufe = Math.floor(k / 4) + 1;
    const vorlagen = [
      () => L('strecke', 6000 + stufe * 1000, `Fahre ${(6 + stufe).toLocaleString('de-DE')} km in einem Lauf`),
      () => L('punkte', 40000 + stufe * 20000, `Schaffe ${(40000 + stufe * 20000).toLocaleString('de-DE')} Punkte in einem Lauf`),
      () => L('knapp', 10 + stufe * 3, `${10 + stufe * 3}× knapp vorbei in einem Lauf`),
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
];

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
      stand.aktiv[i] = stand.naechste++;
      ausnahmen.add(stand.aktiv[i]);
    }
  }
  return erfuellt;
}
