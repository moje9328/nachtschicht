// ===================================================================
// TESTFAHRER (nur für Tests, nicht im Spiel)
// Fährt mit derselben Eingabe wie ein Mensch (Fingerziel + Boost) und
// schaut nur nach vorne, was im Sichtbereich liegt. Wählt alle 0,1 s das
// seitliche Ziel mit dem größten Sicherheitsabstand über ~4 Sekunden.
// ===================================================================
const Testfahrer = {
  erstelle(F, opt = {}) {
    const { w, sp } = F;
    let uhr = 0, ziel = sp.x, boost = false;
    const zufallBot = zufall(opt.seed || 7);
    const sicht = opt.sicht || ANSICHT.vorne;
    const horizont = opt.horizont || 4;
    function abstand(px, pd, b, bx, bd) {
      const gx = Math.abs(px - bx) - (SPIELER.trefferBreite + b.breite * 0.9) / 2;
      const gd = Math.abs(pd - bd) - (SPIELER.trefferLaenge + b.laenge * 0.92) / 2;
      if (gx < 0.3 && gd < 0.4) return -1;
      return Math.max(gx, gd / 4);
    }
    function bewerte(X, v) {
      let x = sp.x, vx = sp.vx, min = 4;
      const hind = w.autos.filter(a => a.d - sp.d < sicht && a.d > sp.d - 12).concat(w.polizei);
      for (let t = 0.05; t <= horizont + 0.0001; t += 0.05) {
        const vxw = Math.max(-SPIELER.seitMax, Math.min(SPIELER.seitMax, (X - x) * SPIELER.zielFaktor));
        vx += Math.max(-SPIELER.seitBeschl * 0.05, Math.min(SPIELER.seitBeschl * 0.05, vxw - vx));
        x += vx * 0.05;
        const pd = sp.d + v * t;
        for (const b of hind) {
          const a = abstand(x, pd, b, F.autoX(b, t), b.d + b.v * t);
          const g = t < 1 ? 1 : 0.85;
          if (a < 0) return -10 + t;
          min = Math.min(min, a * g + (t > 2.5 ? 0.3 : 0));
        }
      }
      return min - Math.abs(X - sp.x) * 0.03;
    }
    return function eingabe() {
      uhr -= DT;
      if (uhr <= 0) {
        uhr = opt.reaktion || 0.1;
        const kand = [sp.x];
        for (let s = 0; s < w.SP; s++) { const c = spurX(s, w.SP); kand.push(c, c - 0.9, c + 0.9); }
        let best = sp.x, bw = -1e9;
        const v = sp.boostAn ? Math.max(sp.v, w.vGrund * BOOST.faktor) : Math.max(sp.v, w.vGrund);
        for (const X of kand) {
          const xx = Math.max(F.X_MIN, Math.min(F.X_MAX, X));
          const b = bewerte(xx, v) + (Math.abs(xx - ziel) < 0.2 ? 0.25 : 0);
          if (b > bw) { bw = b; best = xx; }
        }
        ziel = best + (opt.zittern ? (zufallBot() - 0.5) * opt.zittern : 0);
        // Boost, wenn eine Streife nah ist und der Weg mit Boost frei bleibt
        const polNah = w.polizei.some(p => Math.abs(p.d - sp.d) < 22);
        boost = opt.boost === 'warnung' ? (w.warnung >= 0 || w.druck > 85) && bewerte(ziel, w.vGrund * BOOST.faktor) > 0.3 : opt.boost !== false && (polNah || w.warnung >= 0 || (opt.boost === 'oft' && sp.boost > 60)) && bewerte(ziel, w.vGrund * BOOST.faktor) > 0.6;
      }
      return { ziel: opt.tasten ? null : ziel, richtung: opt.tasten ? Math.sign(Math.round((ziel - sp.x) * 3)) : 0, boost };
    };
  },
};
