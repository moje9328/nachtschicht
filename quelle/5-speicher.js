// ===================================================================
// 5 · SPEICHER
// Einstellungen und Bestleistungen lokal unter pixelhafen.nachtschicht.
// Version 2 (Neon-Arcade-Überarbeitung): Einstellungen aus Version 1 werden
// übernommen; alte Bestleistungen sind wegen anderer Schwierigkeit nicht
// vergleichbar und bleiben unter „alt“ erhalten. Ohne localStorage läuft
// alles weiter, es wird dann nur nichts gemerkt.
// ===================================================================

const Speicher = (() => {
  const SCHLUESSEL = 'pixelhafen.nachtschicht';
  const VERSION = 2;
  const leer = () => ({ punkte: 0, beutel: 0, zeit: 0, strecke: 0, geschafft: 0, versuche: 0 });
  const STANDARD = () => ({
    v: VERSION,
    ton: true, effekte: 0.8, musik: 0.45,
    knoepfe: false, empfindlich: 1, steuerart: 'spur',
    coupEinstieg: false,
    auftrag: 'containerkai',
    beste: { endlos: leer(), containerkai: leer(), neonviertel: leer(), nachthafen: leer() },
    alt: null,
  });
  let daten = STANDARD();
  let verfuegbar = false;

  function lager() { try { return window.localStorage || null; } catch (e) { return null; } }
  const zahl = (x, min, max, std) => { const n = Number(x); return Number.isFinite(n) ? klemme(n, min, max) : std; };
  function einstellungenAus(d) {
    const s = STANDARD();
    daten.ton = typeof d.ton === 'boolean' ? d.ton : s.ton;
    daten.effekte = zahl(d.effekte, 0, 1, s.effekte);
    daten.musik = zahl(d.musik, 0, 1, s.musik);
    daten.knoepfe = typeof d.knoepfe === 'boolean' ? d.knoepfe : s.knoepfe;
    daten.empfindlich = [0.7, 1, 1.35].includes(d.empfindlich) ? d.empfindlich : 1;
    daten.steuerart = d.steuerart === 'ziehen' ? 'ziehen' : 'spur';
    daten.auftrag = AUFTRAG_LISTE.includes(d.auftrag) ? d.auftrag : s.auftrag;
  }
  function bestwerteAus(q) {
    const b = leer();
    if (!q) return b;
    b.punkte = Math.floor(zahl(q.punkte, 0, 1e9, 0)); b.beutel = Math.floor(zahl(q.beutel, 0, 99, 0));
    b.zeit = zahl(q.zeit, 0, 99999, 0); b.strecke = zahl(q.strecke, 0, 1e7, 0);
    b.geschafft = Math.floor(zahl(q.geschafft, 0, 1e6, 0)); b.versuche = Math.floor(zahl(q.versuche, 0, 1e6, 0));
    return b;
  }
  function lade() {
    daten = STANDARD();
    try {
      const l = lager();
      verfuegbar = !!l;
      const roh = l && l.getItem(SCHLUESSEL);
      if (!roh) return;
      const d = JSON.parse(roh);
      if (!d || typeof d !== 'object') return;
      if (d.v === 1) {
        // Übernahme: Einstellungen ja, alte Bestleistungen nur archiviert
        einstellungenAus(d);
        daten.alt = {};
        for (const id of AUFTRAG_LISTE) if (d.beste && d.beste[id]) daten.alt[id] = bestwerteAus(d.beste[id]);
        sichere();
        return;
      }
      if (d.v !== VERSION) return;   // unbekannte Version: sauber neu anfangen
      einstellungenAus(d);
      daten.coupEinstieg = !!d.coupEinstieg;
      for (const id of MODI) daten.beste[id] = bestwerteAus(d.beste && d.beste[id]);
      if (d.alt && typeof d.alt === 'object') { daten.alt = {}; for (const id of AUFTRAG_LISTE) if (d.alt[id]) daten.alt[id] = bestwerteAus(d.alt[id]); }
    } catch (e) { daten = STANDARD(); }
  }
  function sichere() {
    try { const l = lager(); if (l) l.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch (e) { /* voll oder gesperrt: egal */ }
  }
  lade();

  const einstellung = name => ({ get: () => daten[name], set: w => { daten[name] = w; sichere(); } });
  const api = {
    beste: id => daten.beste[id] || leer(),
    alt: id => (daten.alt && daten.alt[id]) || null,
    // Ergebnis eintragen; gibt zurück, was neu ist
    trageEin(id, erg) {
      const b = daten.beste[id];
      if (!b) return {};
      const neu = { punkte: false, beutel: false, zeit: false, strecke: false };
      b.versuche++;
      const zaehlt = id === 'endlos' || erg.geschafft;
      if (erg.geschafft) b.geschafft++;
      if (zaehlt) {
        if (erg.punkte > b.punkte) { b.punkte = erg.punkte; neu.punkte = true; }
        if (erg.strecke > b.strecke) { b.strecke = Math.round(erg.strecke); neu.strecke = true; }
        if (erg.beutel > b.beutel) { b.beutel = erg.beutel; neu.beutel = true; }
        if (id !== 'endlos' && (!b.zeit || erg.zeit < b.zeit)) { b.zeit = Math.round(erg.zeit * 10) / 10; neu.zeit = true; }
      }
      sichere();
      return neu;
    },
    verfuegbar: () => verfuegbar,
    neuLaden: lade,
  };
  for (const n of ['ton', 'effekte', 'musik', 'knoepfe', 'empfindlich', 'steuerart', 'coupEinstieg', 'auftrag']) Object.defineProperty(api, n, einstellung(n));
  return api;
})();
