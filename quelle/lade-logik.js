// Lädt Einstellungen, Coup und Fahrt in Node – exakt dieselben Dateien wie im Spiel.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function ladeLogik() {
  const ctx = { console, Math, Object, Array, Set, Map, Uint8Array, Infinity, Number, JSON };
  vm.createContext(ctx);
  ctx.globalThis = ctx;
  const teile = ['1-einstellungen.js', '3-coup.js', '3-fahrt.js', 'test-bot.js'];
  const code = teile.map(n => fs.readFileSync(path.join(__dirname, n), 'utf8')).join('\n;\n')
    + '\n;globalThis.__ = { DT, SPUR, SPUREN, MODI, schwierigkeit, steigerung, TEMPO_BEZUG, ANSICHT, SPIELER, BOOST, SCHADEN, DRUCK, PUNKTE, FAHRZEUGE, ABSCHNITTE, AUFTRAEGE, AUFTRAG_LISTE, zufall, baueStrecke, spurX, erstelleCoup, erstelleFahrt, Testfahrer };';
  vm.runInContext(code, ctx, { filename: 'nachtschicht-logik.js' });
  return ctx.__;
};
