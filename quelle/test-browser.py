#!/usr/bin/env python3
# Browser-Test mit Playwright. Aufruf: python3 quelle/test-browser.py [webkit]
# Startet einen kleinen Webserver und prüft das fertige index.html im echten Game Loop:
# Coup mit echten Tipps, Touch-/Maus-/Tastatursteuerung, Boostfelder und Kollisionen, Pause,
# Tabwechsel, Neustart, alle drei Aufträge bis zum Ziel, Speicher, Layouts.
import asyncio, http.server, json, pathlib, socketserver, sys, threading, time
from playwright.async_api import async_playwright

ORDNER = pathlib.Path(__file__).resolve().parent.parent
BILDER = ORDNER / 'quelle' / 'testbilder'
BILDER.mkdir(parents=True, exist_ok=True)
BOT = (ORDNER / 'quelle' / 'test-bot.js').read_text()
MOTOR = 'webkit' if 'webkit' in sys.argv[1:] else 'chromium'

class Leise(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ORDNER), **k)
    def log_message(self, *a): pass
server = socketserver.TCPServer(('127.0.0.1', 0), Leise)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_address[1]}/index.html'

fehler, geprueft = [], 0
def ok(bed, text):
    global geprueft
    geprueft += 1
    if not bed: fehler.append(text); print('  FEHLER:', text)

async def warte(pg, ausdruck, ms=20000):
    try:
        await pg.wait_for_function(ausdruck, timeout=ms, polling='raf'); return True
    except Exception:
        return False

async def neue_seite(b, w, h, touch=False, dpr=1, init=None, bewegung=None, query=''):
    o = dict(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=touch)
    if MOTOR == 'chromium': o['is_mobile'] = touch
    if bewegung: o['reduced_motion'] = bewegung
    ctx = await b.new_context(**o)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.fehler = []
    pg.on('console', lambda m: pg.fehler.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.fehler.append(str(e)))
    await pg.goto(URL + query)
    await pg.wait_for_timeout(300)
    await pg.add_script_tag(content=BOT)
    return ctx, pg


# Zählt Audioquellen ohne geplantes Ende (Dauerschleifen wie ein Motorgeräusch)
AUDIO_ZAEHLER = """(() => { window.__audio = { gestartet: 0, ohneEnde: 0 }; const P = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype; if (!P) return;
  const st = P.start, sp = P.stop;
  P.start = function (...a) { window.__audio.gestartet++; this.__offen = true; window.__audio.ohneEnde++; const q = this; queueMicrotask(() => {}); return st.apply(this, a); };
  P.stop = function (...a) { if (this.__offen) { this.__offen = false; window.__audio.ohneEnde--; } return sp.apply(this, a); }; })();"""

N = 'window.__nacht'
F = f'{N}.fahrt()'

async def wert(pg, js): return await pg.evaluate(js)

async def spiele_coup(pg, tippen, schlecht=0):
    """Spielt den Coup mit echten Eingaben. tippen(pg) löst einen Tipp aus. schlecht = Anzahl absichtlicher Fehlversuche."""
    fehl = 0
    for _ in range(80):
        if await wert(pg, f'!{N}.coup()'): return True
        await warte(pg, f'''(() => {{ const c = {N}.coup(); if (!c) return true; const k = c.c;
            if (k.phase === 'laden') return k.sperre <= 0 && ({fehl} < {schlecht} ? Math.abs(k.zeiger - k.zone.mitte) > 0.35 : Math.abs(k.zeiger - k.zone.mitte) < k.zone.breite * 0.15);
            if (k.phase === 'beute') return c.fangbar();
            return false; }})()''', 25000)
        ph = await wert(pg, f'{N}.coup() ? {N}.coup().c.phase : "weg"')
        if ph == 'weg': return True
        if ph == 'laden':
            if fehl < schlecht: fehl += 1
            await tippen(pg)
        elif ph == 'beute':
            await tippen(pg)
        await pg.wait_for_timeout(40)
    return await wert(pg, f'!{N}.coup()')

async def tippe_knopf(pg): await pg.tap('#aktionKnopf')
async def taste_leer(pg): await pg.keyboard.press('Space')

async def warte_fahrt(pg):
    return await warte(pg, f"{N}.zustand() === 'fahrt' && {F} && {N}.lauf().startUhr <= 0", 15000)

async def im_bild(pg, sel):
    return await pg.evaluate(f'''(() => {{ const e = document.querySelector('{sel}'); if (!e || e.hidden) return false; const r = e.getBoundingClientRect();
      return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }})()''')

async def main():
    async with async_playwright() as p:
        b = await getattr(p, MOTOR).launch()
        print(f'Motor: {MOTOR}')

        # ---------------------------------------------------------------
        print('\n# Start und Menü (Handy)')
        ctx, pg = await neue_seite(b, 390, 844, touch=True, dpr=2, query='?seed=11')
        ok(await wert(pg, f"{N}.zustand()") == 'menue', 'startet im Menü')
        for t in ['Spielen', 'Missionen', 'Sound', 'Steuerung']:
            ok(await pg.locator('#fStart button', has_text=t).count() >= 1, f'Startknopf „{t}“ vorhanden')
        ok('NACHTSCHICHT' in (await pg.inner_text('#fStartTitel')), 'Titel sichtbar')
        ok(await wert(pg, 'document.documentElement.scrollWidth <= innerWidth'), 'kein waagrechtes Scrollen')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-start.png'))
        zuege0 = await wert(pg, f'{N}.eingabeSt.zuege')
        await pg.tap('#steuerungKnopf'); await pg.tap('#fSteuerung .js-zurueck')
        await pg.tap('#soundKnopf')
        await pg.locator('#pegelEffekte').fill('40')
        ok(abs(await wert(pg, f'{N}.speicher.effekte') - 0.4) < 1e-9, 'Effekt-Lautstärke wird gespeichert')
        await pg.tap('#fSound .js-ton')
        ok(await wert(pg, f'{N}.speicher.ton') is False and (await wert(pg, f'{N}.ton()'))['an'] is False, 'Ton-aus-Schalter wirkt')
        await pg.tap('#fSound .js-ton')
        await pg.tap('#fSound .js-zurueck')
        ok(await pg.locator('#pegelFahrt').count() == 0 and await pg.locator('#pegelMusik').count() == 1, 'nur noch Regler für Musik und Effekte (kein Motor-Regler)')
        await pg.tap('#auftragWahlKnopf')
        ok(await pg.locator('.auftrag').count() == 3, 'drei Missionen wählbar')
        ok(not await wert(pg, 'document.querySelector("#coupWahl").checked'), 'Coup-Einstieg ist optional und standardmäßig aus')
        await pg.tap('#coupWahl')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-auftraege.png'))
        await pg.tap('[data-auftrag="containerkai"]')
        ok(await wert(pg, f'{N}.eingabeSt.zuege') == zuege0, 'Menüklicks lösen keine Lenkung aus')
        ok(await wert(pg, f"{N}.zustand()") == 'coup', 'Auftrag startet mit dem Coup')
        ok(not await wert(pg, 'document.querySelector("#ueberspringenKnopf").hidden'), 'Coup jederzeit überspringbar')

        # ---------------------------------------------------------------
        print('\n# Coup: schlechte und gute Treffer mit echten Tipps')
        t0 = await wert(pg, f'{N}.coup().c.zeit')
        await warte(pg, f"{N}.coup().c.phase === 'laden'")
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-coup.png'))
        fertig = await spiele_coup(pg, tippe_knopf, schlecht=2)
        ok(fertig, 'Coup abgeschlossen')
        erg = await wert(pg, f'{N}.lauf().coupErgebnis')
        ok(erg and erg['daneben'] >= 2, f'Fehlversuche gezählt ({erg and erg["daneben"]})')
        ok(erg and erg['perfekte'] + erg['gute'] == 3, 'drei Treffer laden den Impulsschlüssel')
        ok(erg and erg['beutel'] >= 2, f'Beutetaschen gefangen ({erg and erg["beutel"]})')
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt', 'Übergang zur Fahrt')
        ok(await wert(pg, f'{N}.lauf().fahrt.w.zeit') == 0, 'Fahrt beginnt erst nach kurzer Bereit-Phase')
        await warte_fahrt(pg)
        await pg.wait_for_timeout(500)
        ok(await wert(pg, f'{F}.w.zeit') > 0.2, 'Fahrt läuft')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-fahrt.png'))

        # ---------------------------------------------------------------
        print('\n# Touch-Steuerung')
        box = await pg.locator('#lenkflaeche').bounding_box()
        ok(box and box['height'] >= 120 and box['y'] + box['height'] <= 844 + 1, f'Steuerfläche unten, groß genug ({box and round(box["height"])} px)')
        ok(await pg.locator('#boostKnopf').count() == 0 and await pg.locator('#boostBalken').count() == 0, 'kein Boostknopf und kein Boost-Ladebalken mehr')
        ok(not await im_bild(pg, '#boostWirkung'), 'Boost-Wirkzeit nur während eines Boosts sichtbar')
        ok(box['height'] <= 145, f'Steuerfläche kompakter, Fahransicht größer ({round(box["height"])} px)')
        if MOTOR == 'chromium':
            cdp = await ctx.new_cdp_session(pg)
            async def touch(typ, x=0, y=0, ident=1, punkte=None):
                pts = punkte if punkte is not None else ([] if typ in ('touchEnd', 'touchCancel') else [{'x': x, 'y': y, 'id': ident}])
                await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': pts})
            # Weg für die Messung frei machen
            await pg.evaluate(f'{F}.w.autos.length = 0; {F}.w.felder.length = 0; {F}.w.spawnUhr = 1e9; {F}.w.polizeiUhr = 1e9; {F}.w.polizei.length = 0; {F}.w.anmeldungen.length = 0')
            x0 = await wert(pg, f'{F}.sp.x')
            sx, sy = box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.35
            await touch('touchStart', sx, sy)
            await pg.wait_for_timeout(300)
            x1 = await wert(pg, f'{F}.sp.x')
            ok(abs(x1 - x0) < 0.02, f'Aufsetzen springt nicht zum Finger ({x0:.2f} → {x1:.2f})')
            for i in range(1, 9):
                await touch('touchMove', sx + i * 10, sy); await pg.wait_for_timeout(16)
            await pg.wait_for_timeout(500)
            x2 = await wert(pg, f'{F}.sp.x')
            mpp = await wert(pg, f'{N}.eingabeSt.zug && {N}.eingabeSt.zug.mPerPx')
            ok(mpp and abs((x2 - x0) - 80 * mpp) < 0.15, f'Auto folgt der Fingerbewegung relativ ({x2 - x0:.2f} m für 80 px)')
            await touch('touchEnd')
            await pg.wait_for_timeout(120)
            x3 = await wert(pg, f'{F}.sp.x')
            await pg.wait_for_timeout(900)
            x4 = await wert(pg, f'{F}.sp.x')
            ok(abs(x4 - x3) < 0.05 and await wert(pg, f'{N}.eingabeSt.zug') is None, f'Loslassen: Auto bleibt (kein Spurwechsel, {x3:.2f} → {x4:.2f})')
            # Finger setzt auf, zweiter Finger wird ignoriert, pointercancel räumt auf
            await touch('touchStart', sx, sy)
            await touch('touchMove', punkte=[{'x': sx + 5, 'y': sy, 'id': 1}, {'x': sx + 200, 'y': sy, 'id': 2}])
            ok(await wert(pg, f'{N}.eingabeSt.zug && {N}.eingabeSt.zug.id') is not None, 'erster Finger lenkt')
            await touch('touchCancel')
            await pg.wait_for_timeout(100)
            ok(await wert(pg, f'{N}.eingabeSt.zug') is None, 'pointercancel beendet das Lenken sauber')
            # Ziehen über den Straßenrand hinaus: Gegenbewegung wirkt sofort
            await touch('touchStart', sx, sy)
            for i in range(1, 30): await touch('touchMove', sx + i * 15, sy); await pg.wait_for_timeout(8)
            await pg.wait_for_timeout(700)
            xr = await wert(pg, f'{F}.sp.x')
            await touch('touchMove', sx + 29 * 15 - 40, sy)
            await pg.wait_for_timeout(400)
            ok(await wert(pg, f'{F}.sp.x') < xr - 0.5, 'am Straßenrand keine tote Zone: Zurückziehen wirkt sofort')
            await touch('touchEnd')
        # Boostfeld im echten Loop: genau einmal, Anzeige nur während der Wirkung, Pause hält die Wirkzeit an
        await pg.evaluate(f'{F}.w.autos.length = 0; {F}.w.felder.length = 0; {F}.w.spawnUhr = 1e9; {F}.w.polizeiUhr = 1e9; {F}.w.polizei.length = 0; {F}.w.anmeldungen.length = 0')
        b0 = await wert(pg, f'{F}.w.statistik.boostFelder')
        await pg.evaluate(f"{F}.w.ereignisse.length = 0; window.__felder = 0; {F}.w.felder.push({{ id: 4242, d: {F}.sp.d + 30, spur: 0, x: {F}.sp.x, laenge: 7, breite: 2.6, status: 'offen' }})")
        await pg.evaluate(f'''(() => {{ const f = () => {{ const F = {F}; if (!F) return; for (const e of F.w.ereignisse) if (e.typ === 'boostFeld') window.__felder++; requestAnimationFrame(f); }}; f(); }})()''')
        ok(await warte(pg, f'{F}.sp.boostAn', 4000), 'Überfahren des Feldes löst Boost aus')
        await pg.wait_for_timeout(300)
        ok(await im_bild(pg, '#boostWirkung'), 'kompakte Wirkzeit-Anzeige während des Boosts')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-boostfeld.png'))
        await pg.tap('#pauseKnopf')
        r0 = await wert(pg, f'{F}.sp.boostRest'); await pg.wait_for_timeout(700)
        ok(r0 > 0 and await wert(pg, f'{F}.sp.boostRest') == r0, 'Pause stoppt die verbleibende Boostdauer')
        await pg.tap('#weiterKnopf'); await warte_fahrt(pg)
        ok(await warte(pg, f'!{F}.sp.boostAn', 6000), 'Boost endet von selbst')
        ok(not await im_bild(pg, '#boostWirkung'), 'Anzeige verschwindet nach dem Boost')
        bf = await wert(pg, f'{F}.w.statistik.boostFelder') - b0
        ok(bf == 1, f'Feld genau einmal ausgelöst ({bf}, Ereignisse {await wert(pg, "window.__felder")})')
        await warte(pg, f'Math.abs({F}.sp.v - {F}.w.vGrund) < 0.2', 3000)
        ok(abs(await wert(pg, f'{F}.sp.v') - await wert(pg, f'{F}.w.vGrund')) < 0.2, f'zurück auf Grundtempo ({await wert(pg, f"{F}.sp.v"):.2f})')
        ok((await wert(pg, f'{N}.ton()'))['musik'], 'Hintergrundmusik läuft in der Fahrt')

        # ---------------------------------------------------------------
        print('\n# Pause, Tabwechsel, Neustart')
        await pg.tap('#pauseKnopf')
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'Pause-Knopf pausiert')
        z0 = await wert(pg, f'{F}.w.zeit'); await pg.wait_for_timeout(600)
        ok(await wert(pg, f'{F}.w.zeit') == z0, 'in der Pause steht die Simulation')
        await pg.tap('#weiterKnopf')
        await warte_fahrt(pg)
        z1 = await wert(pg, f'{F}.w.zeit'); await pg.wait_for_timeout(1000)
        dz = await wert(pg, f'{F}.w.zeit') - z1
        ok(0.6 < dz < 1.3, f'nach „Weiter“ läuft die Zeit normal weiter, ein einziger Loop ({dz:.2f} s pro Sekunde)')
        await pg.evaluate('''Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));''')
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'Tabwechsel pausiert automatisch')
        ton = await wert(pg, f'{N}.ton()')
        ok(ton['kontext'] in ('suspended', 'keiner', 'closed', 'interrupted'), f'Audio angehalten ({ton["kontext"]})')
        await pg.evaluate('''Object.defineProperty(document, 'hidden', { value: false, configurable: true });
          Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));''')
        await pg.wait_for_timeout(400)
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'nach Rückkehr bleibt es pausiert, bis man bewusst fortsetzt')
        # Neustart aus der Pause: alles frisch
        await pg.evaluate(f'{N}.eingabeSt.links.add("test")')
        await pg.tap('#neustartKnopf')
        ok(await wert(pg, f"{N}.zustand()") == 'coup', 'Neustart beginnt den Auftrag neu (Coup)')
        frisch = await wert(pg, f'({{ fahrt: {N}.lauf().fahrt, boost: {N}.eingabeSt.links.size, zug: {N}.eingabeSt.zug, partikel: {N}.partikel(), treffer: {N}.coup().c.treffer }})')
        ok(frisch['fahrt'] is None and frisch['boost'] == 0 and frisch['zug'] is None and frisch['partikel'] == 0 and frisch['treffer'] == 0, f'Neustart entfernt alte Objekte und Eingaben {frisch}')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Tastatur, Maus, Kollision bei Boosttempo (Desktop)')
        ctx, pg = await neue_seite(b, 1440, 900, query='?seed=12', init=AUDIO_ZAEHLER)
        lay = await wert(pg, f'{N}.lay()')
        ok(abs(lay['sicht']['w'] / lay['sicht']['h'] - 0.6) < 0.01 and lay['sicht']['w'] < 700, f'Desktop: zentrierte Sicht mit festem Seitenverhältnis ({lay["sicht"]["w"]:.0f}×{lay["sicht"]["h"]:.0f})')
        await pg.click('#spielenKnopf')
        ok(await wert(pg, f'{N}.lauf().id') == 'endlos' and await wert(pg, f"{N}.zustand()") == 'fahrt', '„Spielen“ startet sofort Neon-Endlos, ohne Coup')
        await warte_fahrt(pg)
        await pg.evaluate(f'{F}.w.autos.length = 0; {F}.w.felder.length = 0; {F}.w.spawnUhr = 1e9; {F}.w.polizeiUhr = 1e9')
        x0 = await wert(pg, f'{F}.sp.x')
        await pg.keyboard.down('ArrowLeft'); await pg.wait_for_timeout(250); await pg.keyboard.up('ArrowLeft')
        await pg.wait_for_timeout(300)
        x1 = await wert(pg, f'{F}.sp.x')
        ok(x1 < x0 - 0.8, f'Pfeil links lenkt ({x0:.2f} → {x1:.2f})')
        await pg.wait_for_timeout(400)
        ok(abs(await wert(pg, f'{F}.sp.x') - x1) < 0.05, 'Taste los: Auto bleibt')
        await pg.keyboard.down('KeyD'); await pg.wait_for_timeout(200); await pg.keyboard.up('KeyD')
        ok(await wert(pg, f'{F}.sp.x') > x1 + 0.5, 'D lenkt nach rechts')
        # Maus ziehen auf der Straße: kein Sprung beim Drücken
        s = lay['sicht']
        mx, my = s['x'] + s['w'] * 0.2, s['y'] + s['h'] * 0.6
        await pg.wait_for_timeout(300)
        xm0 = await wert(pg, f'{F}.sp.x')
        await pg.mouse.move(mx, my); await pg.mouse.down(); await pg.wait_for_timeout(250)
        ok(abs(await wert(pg, f'{F}.sp.x') - xm0) < 0.02, 'Maus drücken springt nicht')
        await pg.mouse.move(mx + 120, my, steps=6); await pg.wait_for_timeout(500)
        ok(await wert(pg, f'{F}.sp.x') > xm0 + 1.5, 'Maus ziehen lenkt')
        await pg.mouse.up()
        # Leertaste hat in der Fahrt keine Boostfunktion mehr
        vg = await wert(pg, f'{F}.w.vGrund')
        await pg.keyboard.down('Space'); await pg.wait_for_timeout(800); await pg.keyboard.up('Space')
        ok(abs(await wert(pg, f'{F}.sp.v') - vg) < 0.1 and not await wert(pg, f'{F}.sp.boostAn'), 'Leertaste löst keinen Boost aus')
        for taste in ['ShiftLeft', 'ArrowUp', 'KeyW']:
            await pg.keyboard.down(taste); await pg.wait_for_timeout(150); await pg.keyboard.up(taste)
        ok(not await wert(pg, f'{F}.sp.boostAn'), 'keine alte Boost-Taste mehr belegt')
        # Boostfeld nehmen, dann bei Boosttempo auffahren: genau ein Schaden, kein Durchfahren
        await pg.evaluate(f"{F}.w.felder.push({{ id: 4343, d: {F}.sp.d + 25, spur: 0, x: {F}.sp.x, laenge: 7, breite: 2.6, status: 'offen' }})")
        ok(await warte(pg, f'{F}.sp.v > {F}.w.vGrund * 1.23', 5000), 'Boostfeld bringt +25 % Tempo')
        await pg.evaluate(f'''(() => {{ const f = {F}; const sp = f.sp; f.w.autos.push({{ id: 9999, typ: 'laster', spur: f.spurVon(sp.x), x: sp.x, d: sp.d + 30, v: 10, vSoll: 10, stoss: 0, laenge: 11.5, breite: 2.5, wechsel: null, wechselSperre: 99, vorbei: false, getroffen: false, knappMin: 99, knappFertig: false, kontaktBis: -1, wackel: 0, farbe: 0, geboren: 0 }}); }})()''')
        await warte(pg, f'{F}.sp.zustand < 100', 4000)
        await pg.wait_for_timeout(600)
        ok(await wert(pg, f'{F}.sp.zustand') == 82, f'Auffahren bei Boosttempo: genau ein Schaden ({await wert(pg, f"{F}.sp.zustand")})')
        ok(await wert(pg, f'{F}.w.autos.find(a => a.id === 9999).d - {F}.sp.d') > 0, 'kein Durchfahren des Lasters bei Höchsttempo')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-desktop-unfall.png'))
        # Leertaste auf fokussiertem Menüknopf: setzt fort, boostet aber nicht
        await pg.keyboard.press('KeyP')
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'P pausiert')
        await pg.focus('#weiterKnopf'); await pg.keyboard.press('Space')
        await pg.wait_for_timeout(100)
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt' and await wert(pg, f'{N}.eingabeSt.zug') is None, 'Leertaste auf „Weiter“ setzt fort, ohne zu lenken')
        await pg.keyboard.press('KeyM')
        ok(await wert(pg, f'{N}.speicher.ton') is False, 'M schaltet den Ton aus')
        await pg.keyboard.press('KeyM')
        # Neustart-Knopf im Endlosmodus; Game over → sofortiger Neustart; nur eine Musikschleife
        await warte_fahrt(pg); await pg.wait_for_timeout(300)
        await pg.click('#neustartSchnell')
        ok(await wert(pg, f'{F}.w.zeit') == 0 and await wert(pg, f'{F}.sp.d') == 0, 'Endlos per Knopf sofort neu startbar')
        await warte_fahrt(pg); await pg.wait_for_timeout(400)
        await pg.evaluate(f'{F}.sp.zustand = 1; {F}.w.autos.push({{ id: 8888, typ: "taxi", spur: 0, x: {F}.sp.x, d: {F}.sp.d + 9, v: 5, vSoll: 5, stoss: 0, laenge: 4.6, breite: 1.85, wechsel: null, wechselSperre: 99, vorbei: false, getroffen: false, knappMin: 99, knappFertig: false, kontaktBis: -1, wackel: 0, farbe: 0, geboren: 0 }})')
        ok(await warte(pg, f"{N}.zustand() === 'ergebnis'", 8000), 'leerer Zustand beendet den Lauf')
        ok(await pg.inner_text('#fErgebnisTitel') in ('Lauf beendet', 'Neuer Rekord!') and await pg.inner_text('#nochmalKnopf') == 'Sofort nochmal', 'Endlos-Ergebnis mit „Sofort nochmal“')
        ok(await wert(pg, 'document.activeElement && document.activeElement.id') == 'nochmalKnopf', '„Sofort nochmal“ hat den Fokus (Enter/Leertaste)')
        await pg.keyboard.press('Enter')
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt' and await wert(pg, f'{F}.w.zeit') < 1, 'Enter startet sofort einen neuen Lauf')
        gesp = json.loads(await wert(pg, "localStorage.getItem('pixelhafen.nachtschicht')"))
        ok(gesp['v'] == 2 and gesp['beste']['endlos']['versuche'] >= 1, 'Endlos-Rekord versioniert gespeichert (Version 2)')
        await pg.wait_for_timeout(500)
        ton = await wert(pg, f'{N}.ton()')
        ok(ton['musik'] and ton['musikStarts'] == 1, f'nach mehreren Neustarts genau eine Musikschleife ({ton["musikStarts"]} Start)')
        ok(await wert(pg, 'window.__audio.ohneEnde') == 0 and await wert(pg, 'window.__audio.gestartet') > 50, f'keine dauerhafte Audioquelle (Motor/Sirene): {await wert(pg, "window.__audio.ohneEnde")} ohne geplantes Ende von {await wert(pg, "window.__audio.gestartet")}')
        ok(not pg.fehler, f'keine Fehler in der Konsole: {pg.fehler[:3]}')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Alle Aufträge bis zum Ziel (Testfahrer, Zeitraffer)')
        ctx, pg = await neue_seite(b, 430, 900, touch=True, dpr=1, query='?tempo=6&seed=21')
        for auftrag in ['containerkai', 'neonviertel', 'nachthafen']:
            await pg.evaluate(f"{N}.starte('{auftrag}', false)")
            # Coup im Zeitraffer über die Spiellogik (die echte Coup-Bedienung ist oben geprüft)
            await pg.evaluate(f'''(() => {{ const f = () => {{ const c = {N}.coup(); if (!c) return; const k = c.c;
                if ((k.phase === 'laden' && k.sperre <= 0 && Math.abs(k.zeiger - k.zone.mitte) < k.zone.breite * 0.2) || c.fangbar()) c.aktion();
                requestAnimationFrame(f); }}; f(); }})()''')
            ok(await warte(pg, f"{N}.zustand() === 'fahrt'", 30000), f'{auftrag}: Coup → Fahrt')
            await pg.evaluate(f'{N}.erstelleBot({{}})')
            fertig = await warte(pg, f"{N}.zustand() === 'ergebnis'", 120000)
            titel = await pg.inner_text('#fErgebnisTitel') if fertig else '–'
            ok(fertig and titel == 'Mission geschafft!', f'{auftrag}: Mission geschafft ({titel})')
            if auftrag == 'nachthafen': await pg.screenshot(path=str(BILDER / f'{MOTOR}-ergebnis.png'))
            await pg.evaluate(f'{N}.setzeBot(null)')
        gespeichert = json.loads(await wert(pg, "localStorage.getItem('pixelhafen.nachtschicht')"))
        ok(gespeichert['v'] == 2 and all(gespeichert['beste'][a]['geschafft'] == 1 and gespeichert['beste'][a]['punkte'] > 0 for a in ['containerkai', 'neonviertel', 'nachthafen']), 'Bestleistungen getrennt und versioniert gespeichert')
        # Mission ohne Coup startet direkt mit der Fahrt
        await pg.click('#ergebnisAuftraegeKnopf')
        if await wert(pg, 'document.querySelector("#coupWahl").checked'): await pg.click('#coupWahl')
        await pg.click('[data-auftrag="containerkai"]')
        ce = await wert(pg, f'{N}.lauf().coupErgebnis')
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt' and not ce['gespielt'] and ce['beutel'] == 0, 'Mission ohne Coup: sofort Fahrt, keine Coup-Punkte')
        ok(not pg.fehler, f'keine Fehler in der Konsole: {pg.fehler[:3]}')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Ohne localStorage und mit kaputtem Speicher')
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="Object.defineProperty(window, 'localStorage', { get() { throw new Error('gesperrt'); } });")
        await pg.tap('#spielenKnopf')
        ok(await warte_fahrt(pg), 'ohne localStorage spielbar')
        await pg.wait_for_timeout(800)
        ok(await wert(pg, f'{F}.w.zeit') > 0.3 and not pg.fehler, f'läuft ohne Fehler {pg.fehler[:2]}')
        await ctx.close()
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="try { localStorage.setItem('pixelhafen.nachtschicht', '{kaputt'); } catch (e) {}")
        ok(await wert(pg, f"{N}.zustand()") == 'menue' and not pg.fehler, 'kaputter Speicher wird ignoriert')
        await ctx.close()
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="try { localStorage.setItem('pixelhafen.nachtschicht', JSON.stringify({ v: 1, ton: true, effekte: 0.3, musik: 0.2, knoepfe: true, empfindlich: 1.35, beste: { containerkai: { punkte: 12345, beutel: 4, zeit: 99, geschafft: 2, versuche: 3 } } })); } catch (e) {}")
        alt = json.loads(await wert(pg, "localStorage.getItem('pixelhafen.nachtschicht')"))
        ok(alt['v'] == 2 and alt['effekte'] == 0.3 and alt['musik'] == 0.2 and alt['knoepfe'] is True and alt['empfindlich'] == 1.35, 'Version 1 → 2: Einstellungen übernommen')
        ok(alt['beste']['containerkai']['punkte'] == 0 and alt['alt']['containerkai']['punkte'] == 12345, 'alte Bestleistung archiviert, neue Rekordtabelle')
        await pg.tap('#auftragWahlKnopf')
        ok('vor der Überarbeitung: 12.345' in await pg.inner_text('[data-auftrag="containerkai"]'), 'alte Bestleistung wird bei der Mission angezeigt')
        await ctx.close()
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="try { localStorage.setItem('pixelhafen.nachtschicht', JSON.stringify({ v: 99, ton: false })); } catch (e) {}")
        ok(await wert(pg, f'{N}.speicher.ton') is True, 'fremde Speicherversion wird nicht übernommen')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Bildschirmgrößen: gleiche logische Straße, Bedienelemente im Bild')
        geraete = [('handy-klein', 360, 640, True, 2), ('handy', 390, 844, True, 3), ('tablet-hoch', 820, 1180, True, 2),
                   ('tablet-quer', 1180, 820, True, 2), ('desktop', 1440, 900, False, 1), ('breit', 2560, 1080, False, 1)]
        for name, w, h, touch, dpr in geraete:
            ctx, pg = await neue_seite(b, w, h, touch=touch, dpr=dpr, query='?seed=5')
            if touch: await pg.tap('#spielenKnopf')
            else: await pg.click('#spielenKnopf')
            await warte_fahrt(pg); await pg.wait_for_timeout(1200)
            lay = await wert(pg, f'{N}.lay()')
            s = lay['sicht']
            ok(abs(s['w'] / s['h'] - 0.6) < 0.01, f'{name}: Sicht im festen Seitenverhältnis')
            ok(s['x'] >= -0.5 and s['x'] + s['w'] <= w + 0.5, f'{name}: Sicht passt in die Breite')
            ok(await wert(pg, 'document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight'), f'{name}: kein Scrollen')
            ok(await im_bild(pg, '#hud') and await pg.locator('#boostKnopf').count() == 0, f'{name}: HUD im Bild, kein Boostknopf')
            hud = await pg.locator('#hud').bounding_box()
            ok(hud['y'] + hud['height'] <= s['y'] + s['h'] * ANSICHT_HIMMEL + 4, f'{name}: HUD verdeckt die Straße nicht')
            if touch and h > w:
                lf = await pg.locator('#lenkflaeche').bounding_box()
                ok(lf['y'] >= s['y'] + s['h'] - 2, f'{name}: Steuerfläche unter der Straße')
            pk = await pg.locator('#pauseKnopf').bounding_box()
            ok(pk['width'] >= 44 and pk['height'] >= 44, f'{name}: Pause-Knopf groß genug')
            await pg.screenshot(path=str(BILDER / f'{MOTOR}-{name}.png'))
            ok(not pg.fehler, f'{name}: keine Fehler {pg.fehler[:2]}')
            await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Weniger Bewegung und Bildrate')
        ctx, pg = await neue_seite(b, 390, 844, touch=True, dpr=2, bewegung='reduce', query='?seed=8')
        ok(await wert(pg, "matchMedia('(prefers-reduced-motion: reduce)').matches"), 'reduced motion aktiv')
        await pg.tap('#spielenKnopf'); await warte_fahrt(pg)
        await pg.wait_for_timeout(1500)
        ok(not pg.fehler, 'läuft mit „weniger Bewegung“')
        if MOTOR == 'chromium':
            cdp = await ctx.new_cdp_session(pg)
            await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
            zeiten = await pg.evaluate('''() => new Promise(r => { const z = []; let l = performance.now(); const f = t => { z.push(t - l); l = t; if (z.length < 180) requestAnimationFrame(f); else r(z); }; requestAnimationFrame(f); })''')
            zeiten.sort()
            med = zeiten[len(zeiten) // 2]
            ok(med < 20, f'Bildzeit mit 4-fach gedrosselter CPU: Median {med:.1f} ms')
            await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        await ctx.close()

        await b.close()
    print(f'\n{geprueft} Prüfungen, {len(fehler)} Fehler')
    sys.exit(1 if fehler else 0)

ANSICHT_HIMMEL = 0.075
asyncio.run(main())
