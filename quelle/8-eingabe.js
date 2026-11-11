// ===================================================================
// 8 · EINGABE
// Pointer Events und Tastatur → Fahrbefehle. Das Ziehen auf der Steuerfläche
// lenkt RELATIV zur Fingerbewegung: Beim Aufsetzen springt das Auto nicht
// zum Finger, erst die Bewegung danach verschiebt das Ziel. Loslassen hält
// das Auto in der aktuellen Lage (kein automatischer Spurwechsel).
// Knöpfe stoppen ihre Ereignisse, damit sie nie zusätzlich lenken.
// ===================================================================

const Eingabe = (() => {
  const st = {
    links: new Set(), rechts: new Set(), boost: new Set(),
    zug: null,                 // { id, startX, x0, mPerPx, letzteX }
    aktiv: () => null,         // liefert 'fahrt' | 'coup' | null
    spieler: () => ({ x: 0, min: -5, max: 5, breite: 12 }),
    beiAktion: () => {}, beiPause: () => {}, beiTon: () => {}, beiErsterBeruehrung: () => {},
    empfindlich: 1,
    zuege: 0,                  // für Tests: Anzahl begonnener Ziehbewegungen
  };

  function leeren() {
    st.links.clear(); st.rechts.clear(); st.boost.clear();
    st.zug = null;
  }

  function lesen() {
    const r = (st.rechts.size ? 1 : 0) - (st.links.size ? 1 : 0);
    let ziel = null;
    if (st.zug && st.zug.ziel != null) ziel = st.zug.ziel;
    return { ziel: r ? null : ziel, richtung: r, boost: st.boost.size > 0 };
  }

  // Bewegung des Fingers → Ziel in Metern. Am Straßenrand wird der Bezug nachgeführt,
  // damit eine Gegenbewegung sofort wirkt (keine tote Zone).
  function ziehe(e) {
    const z = st.zug; if (!z || e.pointerId !== z.id) return;
    const s = st.spieler();
    let ziel = z.x0 + (e.clientX - z.startX) * z.mPerPx;
    if (ziel < s.min) { ziel = s.min; z.x0 = s.min; z.startX = e.clientX; }
    if (ziel > s.max) { ziel = s.max; z.x0 = s.max; z.startX = e.clientX; }
    z.ziel = ziel; z.letzteX = e.clientX;
  }
  // Nach einem Unfall (Auto wurde verschoben): Bezug neu setzen, sonst lenkt das alte Ziel zurück in das Hindernis
  function neuBasis() {
    const z = st.zug; if (!z) return;
    const s = st.spieler();
    z.x0 = s.x; z.startX = z.letzteX; z.ziel = s.x;
  }

  function verbindeFlaeche(el) {
    el.addEventListener('pointerdown', e => {
      st.beiErsterBeruehrung(e);
      const modus = st.aktiv();
      if (!modus) return;
      e.preventDefault();
      if (modus === 'coup') { st.beiAktion(); return; }
      if (st.zug) return;                       // ein Finger lenkt, weitere Finger ignorieren
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
      const s = st.spieler();
      const breitePx = Math.max(220, Math.min(el.clientWidth * 0.75, 460));
      st.zug = { id: e.pointerId, startX: e.clientX, x0: s.x, ziel: s.x, letzteX: e.clientX, mPerPx: (s.breite / breitePx) * st.empfindlich };
      st.zuege++;
    });
    el.addEventListener('pointermove', e => { if (st.zug && e.pointerId === st.zug.id) { e.preventDefault(); ziehe(e); } });
    const ende = e => { if (st.zug && e.pointerId === st.zug.id) st.zug = null; };
    el.addEventListener('pointerup', ende);
    el.addEventListener('pointercancel', ende);
    el.addEventListener('lostpointercapture', ende);
  }

  // Halte-Knöpfe (links, rechts, Boost): eigene Pointer, gehen nie an die Fläche weiter
  function verbindeKnopf(el, menge) {
    const weg = e => { menge.delete(e.pointerId); el.classList.remove('gedrueckt'); };
    el.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      st.beiErsterBeruehrung(e);
      if (st.aktiv() !== 'fahrt') return;
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
      menge.add(e.pointerId); el.classList.add('gedrueckt');
    });
    el.addEventListener('pointerup', e => { e.stopPropagation(); weg(e); });
    el.addEventListener('pointercancel', weg);
    el.addEventListener('lostpointercapture', weg);
    el.addEventListener('contextmenu', e => e.preventDefault());
    // Tastatur-Bedienung des Knopfs (Enter/Leertaste mit Fokus) nicht doppelt auslösen
    el.addEventListener('click', e => e.preventDefault());
  }

  // Tastatur
  const LINKS = ['ArrowLeft', 'KeyA'], RECHTS = ['ArrowRight', 'KeyD'];
  function inFormular(e) {
    const t = e.target;
    return t && t.closest && t.closest('#fenster, .pxd') && /^(BUTTON|INPUT|SELECT|A|TEXTAREA)$/.test(t.tagName);
  }
  window.addEventListener('keydown', e => {
    if (inFormular(e)) return;
    const modus = st.aktiv();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) st.beiPause(); return; }
    if (e.code === 'KeyM') { if (!e.repeat) st.beiTon(); return; }
    if (!modus) return;
    if (modus === 'coup') {
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); st.beiAktion(); }
      return;
    }
    if (LINKS.includes(e.code)) { e.preventDefault(); st.links.add(e.code); }
    else if (RECHTS.includes(e.code)) { e.preventDefault(); st.rechts.add(e.code); }
    else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); st.boost.add(e.code); }
  });
  window.addEventListener('keyup', e => {
    st.links.delete(e.code); st.rechts.delete(e.code); st.boost.delete(e.code);
  });
  // Fokusverlust: alle gedrückten Tasten und Finger vergessen
  window.addEventListener('blur', leeren);

  return {
    st, lesen, leeren, neuBasis, verbindeFlaeche,
    verbindeKnoepfe(links, rechts, boost) { verbindeKnopf(links, st.links); verbindeKnopf(rechts, st.rechts); verbindeKnopf(boost, st.boost); },
  };
})();
