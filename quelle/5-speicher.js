// ===================================================================
// 5 · SPEICHER
// Einstellungen und Bestleistungen lokal unter pixelhafen.nachtschicht
// (Version 1). Ohne localStorage (privates Fenster, gesperrt) läuft alles
// weiter, es wird dann nur nichts gemerkt.
// ===================================================================

const Speicher = (() => {
  const SCHLUESSEL = 'pixelhafen.nachtschicht';
  const VERSION = 1;
  const leereBestwerte = () => ({ punkte: 0, beutel: 0, zeit: 0, geschafft: 0, versuche: 0 });
  const STANDARD = () => ({
    v: VERSION,
    ton: true, effekte: 0.8, fahrt: 0.55, musik: 0.35,
    knoepfe: false, empfindlich: 1,
    coupUeberspringen: false,
    auftrag: 'containerkai',
    beste: { containerkai: leereBestwerte(), neonviertel: leereBestwerte(), nachthafen: leereBestwerte() },
    training: { geschafft: 0 },
  });
  let daten = STANDARD();
  let verfuegbar = false;

  function lager() { try { return window.localStorage || null; } catch (e) { return null; } }
  const zahl = (x, min, max, std) => { const n = Number(x); return Number.isFinite(n) ? klemme(n, min, max) : std; };
  function lade() {
    daten = STANDARD();
    try {
      const l = lager();
      verfuegbar = !!l;
      const roh = l && l.getItem(SCHLUESSEL);
      if (!roh) return;
      const d = JSON.parse(roh);
      if (!d || d.v !== VERSION) return;   // andere Version: sauber neu anfangen
      const s = STANDARD();
      daten.ton = typeof d.ton === 'boolean' ? d.ton : s.ton;
      daten.effekte = zahl(d.effekte, 0, 1, s.effekte);
      daten.fahrt = zahl(d.fahrt, 0, 1, s.fahrt);
      daten.musik = zahl(d.musik, 0, 1, s.musik);
      daten.knoepfe = typeof d.knoepfe === 'boolean' ? d.knoepfe : s.knoepfe;
      daten.empfindlich = [0.7, 1, 1.35].includes(d.empfindlich) ? d.empfindlich : 1;
      daten.coupUeberspringen = !!d.coupUeberspringen;
      daten.auftrag = AUFTRAG_LISTE.includes(d.auftrag) ? d.auftrag : s.auftrag;
      for (const id of AUFTRAG_LISTE) {
        const b = d.beste && d.beste[id];
        if (!b) continue;
        daten.beste[id] = {
          punkte: Math.floor(zahl(b.punkte, 0, 1e8, 0)), beutel: Math.floor(zahl(b.beutel, 0, 99, 0)),
          zeit: zahl(b.zeit, 0, 9999, 0), geschafft: Math.floor(zahl(b.geschafft, 0, 1e6, 0)), versuche: Math.floor(zahl(b.versuche, 0, 1e6, 0)),
        };
      }
      daten.training.geschafft = Math.floor(zahl(d.training && d.training.geschafft, 0, 1e6, 0));
    } catch (e) { daten = STANDARD(); }
  }
  function sichere() {
    try { const l = lager(); if (l) l.setItem(SCHLUESSEL, JSON.stringify(daten)); } catch (e) { /* voll oder gesperrt: egal */ }
  }
  lade();

  const einstellung = name => ({ get: () => daten[name], set: w => { daten[name] = w; sichere(); } });
  const api = {
    beste: id => daten.beste[id] || leereBestwerte(),
    // Ergebnis eintragen; gibt zurück, was neu ist
    trageEin(id, erg) {
      if (id === 'training') { if (erg.geschafft) { daten.training.geschafft++; sichere(); } return {}; }
      const b = daten.beste[id];
      const neu = { punkte: false, beutel: false, zeit: false };
      b.versuche++;
      if (erg.geschafft) {
        b.geschafft++;
        if (erg.punkte > b.punkte) { b.punkte = erg.punkte; neu.punkte = true; }
        if (erg.beutel > b.beutel) { b.beutel = erg.beutel; neu.beutel = true; }
        if (!b.zeit || erg.zeit < b.zeit) { b.zeit = Math.round(erg.zeit * 10) / 10; neu.zeit = true; }
      }
      sichere();
      return neu;
    },
    darfUeberspringen: id => (daten.beste[id] ? daten.beste[id].geschafft > 0 : false),
    verfuegbar: () => verfuegbar,
    neuLaden: lade,
  };
  for (const n of ['ton', 'effekte', 'fahrt', 'musik', 'knoepfe', 'empfindlich', 'coupUeberspringen', 'auftrag']) Object.defineProperty(api, n, einstellung(n));
  return api;
})();
