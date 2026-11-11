#!/usr/bin/env python3
# Browser-Test mit Playwright. Aufruf: python3 quelle/test-browser.py [webkit]
# Startet einen kleinen Webserver und prüft das fertige index.html im echten Game Loop:
# Endlosfahrt: Spurwechsel per Tipp/Taste/Klick, Ziehen, Boostfelder, Crash bei Berührung, Pause,
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

async def warte_fahrt(pg):
    return await warte(pg, f"{N}.zustand() === 'fahrt' && {F} && {N}.lauf().startUhr <= 0", 15000)

async def im_bild(pg, sel):
    return await pg.evaluate(f'''(() => {{ const e = document.querySelector('{sel}'); if (!e || e.hidden) return false; const r = e.getBoundingClientRect();
      return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }})()''')

async def main():
    async with async_playwright() as p:
        b = await getattr(p, MOTOR).launch()
        print(f'Motor: {MOTOR}')
        LEER = f'{F}.w.autos.length = 0; {F}.w.felder.length = 0; {F}.w.spawnUhr = 1e9; {F}.w.polizeiUhr = 1e9; {F}.w.polizei.length = 0; {F}.w.anmeldungen.length = 0'
        def auto_js(dabstand, dx=0, typ='taxi', v=10, aid=9999):
            return f"(() => {{ const f = {F}; const sp = f.sp; f.w.autos.push({{ id: {aid}, typ: '{typ}', spur: f.spurVon(sp.x + {dx}), x: sp.x + {dx}, d: sp.d + {dabstand}, v: {v}, vSoll: {v}, stoss: 0, laenge: 4.6, breite: 1.85, wechsel: null, wechselSperre: 99, vorbei: false, getroffen: false, knappMin: 99, knappFertig: false, kontaktBis: -1, wackel: 0, farbe: 0, geboren: 0 }}); }})()"

        # ---------------------------------------------------------------
        print('\n# Start und Menü (Handy)')
        ctx, pg = await neue_seite(b, 390, 844, touch=True, dpr=2, query='?seed=11', init=AUDIO_ZAEHLER)
        ok(await wert(pg, f"{N}.zustand()") == 'menue', 'startet im Menü')
        for t in ['Spielen', 'Sound', 'Steuerung']:
            ok(await pg.locator('#fStart button', has_text=t).count() >= 1, f'Startknopf „{t}“ vorhanden')
        ok(not await im_bild(pg, '#auftragWahlKnopf'), 'reines Endlos-Spiel: keine Missionen im Menü')
        ok('HAFENFLUCHT' in (await pg.inner_text('#fStartTitel')), 'Titel sichtbar')
        ok(await wert(pg, 'document.documentElement.scrollWidth <= innerWidth'), 'kein waagrechtes Scrollen')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-start.png'))
        zuege0 = await wert(pg, f'{N}.eingabeSt.spurwechsel')
        ok(await pg.locator('#startAufgaben li').count() == 3 and '★ 0' in await pg.inner_text('#startSterne'), 'Startbildschirm: drei Aufgaben und Sternzähler')
        await pg.tap('#garageKnopf')
        ok(await pg.locator('.lack').count() == 6 and await pg.locator('.lack:disabled').count() == 5, 'Garage: 6 Lackierungen, 5 noch gesperrt')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-garage.png'))
        await pg.tap('#fGarage .js-zurueck')
        await pg.tap('#steuerungKnopf'); await pg.tap('#fSteuerung .js-zurueck')
        await pg.tap('#soundKnopf')
        ok(await pg.locator('#pegelFahrt').count() == 0 and await pg.locator('#pegelMusik').count() == 1, 'nur Regler für Musik und Effekte (kein Motor)')
        await pg.locator('#pegelEffekte').fill('40')
        ok(abs(await wert(pg, f'{N}.speicher.effekte') - 0.4) < 1e-9, 'Effekt-Lautstärke wird gespeichert')
        await pg.tap('#fSound .js-ton')
        ok(await wert(pg, f'{N}.speicher.ton') is False and (await wert(pg, f'{N}.ton()'))['an'] is False, 'Ton-aus-Schalter wirkt')
        await pg.tap('#fSound .js-ton'); await pg.tap('#fSound .js-zurueck')
        await pg.tap('#spielenKnopf')
        ok(await wert(pg, f'{N}.eingabeSt.spurwechsel') == zuege0, 'Menüklicks lösen keinen Spurwechsel aus')
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt' and await wert(pg, f'{N}.lauf().id') == 'endlos', '„Spielen“ startet sofort die Endlosfahrt')
        ok(await warte_fahrt(pg), 'Fahrt läuft nach kurzer Bereit-Phase')
        ok(await im_bild(pg, '#tempoFeld') and not await im_bild(pg, '#zustandBalken') and not await im_bild(pg, '#druckBalken'), 'HUD: Tempo statt Zustand, kein Druckbalken')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-handy-fahrt.png'))

        # ---------------------------------------------------------------
        print('\n# Spurwechsel per Tipp und freies Ziehen (Touch)')
        box = await pg.locator('#lenkflaeche').bounding_box()
        ok(box and box['height'] >= 100 and box['y'] + box['height'] <= 844 + 1, f'Steuerfläche unten, groß genug ({box and round(box["height"])} px)')
        await pg.evaluate(LEER)
        ok(await wert(pg, f'{N}.speicher.steuerart') == 'spur', 'Standard-Steuerart: Spurwechsel per Tipp')
        x0 = await wert(pg, f'{F}.sp.x')
        await pg.tap('#lenkflaeche', position={'x': 30, 'y': box['height'] * 0.5})
        ok(await warte(pg, f'Math.abs({F}.sp.x - ({x0} - 3.6)) < 0.05', 2000), 'Tipp links = genau eine Spur nach links')
        t0 = await wert(pg, f'{F}.w.zeit')
        await pg.tap('#lenkflaeche', position={'x': box['width'] - 30, 'y': box['height'] * 0.5})
        await warte(pg, f'Math.abs({F}.sp.x - {x0}) < 0.05', 2000)
        dt = await wert(pg, f'{F}.w.zeit') - t0
        ok(dt < 0.45, f'Spurwechsel zügig ({dt:.2f} s inkl. Eingabeverzögerung)')
        for _ in range(2): await pg.tap('#lenkflaeche', position={'x': box['width'] - 30, 'y': box['height'] * 0.5})
        await pg.wait_for_timeout(600)
        ok(abs(await wert(pg, f'{F}.sp.x') - (x0 + 3.6)) < 0.05, 'zwei Tipps rechts: bis zur rechten Spur, nicht darüber hinaus')
        sv = (await wert(pg, f'{N}.lay()'))['sicht']
        await pg.tap('#bild', position={'x': sv['x'] + sv['w'] * 0.2, 'y': sv['y'] + sv['h'] * 0.5})
        ok(await warte(pg, f'Math.abs({F}.sp.x - {x0}) < 0.05', 2000), 'Tipp links auf die Straße wechselt ebenfalls die Spur')
        await pg.evaluate(f"{N}.speicher.steuerart = 'ziehen'; {N}.eingabeSt.steuerart = 'ziehen'")
        if MOTOR == 'chromium':
            cdp = await ctx.new_cdp_session(pg)
            async def touch(typ, x=0, y=0, ident=1, punkte=None):
                pts = punkte if punkte is not None else ([] if typ in ('touchEnd', 'touchCancel') else [{'x': x, 'y': y, 'id': ident}])
                await cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': pts})
            x0 = await wert(pg, f'{F}.sp.x')
            sx, sy = box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.35
            await touch('touchStart', sx, sy); await pg.wait_for_timeout(300)
            ok(abs(await wert(pg, f'{F}.sp.x') - x0) < 0.02, 'Ziehen: Aufsetzen springt nicht zum Finger')
            for i in range(1, 9): await touch('touchMove', sx + i * 10, sy); await pg.wait_for_timeout(16)
            await pg.wait_for_timeout(500)
            mpp = await wert(pg, f'{N}.eingabeSt.zug && {N}.eingabeSt.zug.mPerPx')
            x2 = await wert(pg, f'{F}.sp.x')
            ok(mpp and abs((x2 - x0) - 80 * mpp) < 0.15, f'Ziehen: folgt der Fingerbewegung relativ ({x2 - x0:.2f} m)')
            await touch('touchEnd'); await pg.wait_for_timeout(150)
            x3 = await wert(pg, f'{F}.sp.x'); await pg.wait_for_timeout(700)
            ok(abs(await wert(pg, f'{F}.sp.x') - x3) < 0.05, 'Ziehen: Loslassen hält die Lage')
            await touch('touchStart', sx, sy); await touch('touchCancel'); await pg.wait_for_timeout(100)
            ok(await wert(pg, f'{N}.eingabeSt.zug') is None, 'pointercancel beendet das Lenken sauber')
        await pg.evaluate(f"{N}.speicher.steuerart = 'spur'; {N}.eingabeSt.steuerart = 'spur'; {N}.eingabeSt.zielSpur = null")

        # ---------------------------------------------------------------
        print('\n# Boostfeld, Pause, Tabwechsel, Neustart')
        await pg.evaluate(LEER)
        b0 = await wert(pg, f'{F}.w.statistik.boostFelder')
        await pg.evaluate(f"{F}.w.felder.push({{ id: 4242, d: {F}.sp.d + 30, spur: 0, x: {F}.sp.x, laenge: 7, breite: 2.6, status: 'offen' }})")
        ok(await warte(pg, f'{F}.sp.boostAn', 4000), 'Überfahren des Feldes löst Boost aus')
        await pg.wait_for_timeout(300)
        ok(await im_bild(pg, '#boostWirkung'), 'Wirkzeit-Anzeige während des Boosts')
        await pg.tap('#pauseKnopf')
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'Pause-Knopf pausiert')
        r0 = await wert(pg, f'{F}.sp.boostRest'); z0 = await wert(pg, f'{F}.w.zeit'); await pg.wait_for_timeout(700)
        ok(await wert(pg, f'{F}.w.zeit') == z0 and await wert(pg, f'{F}.sp.boostRest') == r0, 'Pause hält Simulation und Boostdauer an')
        await pg.tap('#weiterKnopf'); await warte_fahrt(pg)
        ok(await warte(pg, f'!{F}.sp.boostAn', 6000) and await wert(pg, f'{F}.w.statistik.boostFelder') - b0 == 1, 'Boost endet von selbst, Feld genau einmal')
        z1 = await wert(pg, f'{F}.w.zeit'); await pg.wait_for_timeout(1000)
        dz = await wert(pg, f'{F}.w.zeit') - z1
        ok(0.6 < dz < 1.3, f'ein einziger Loop ({dz:.2f} s Spielzeit pro Sekunde)')
        await pg.evaluate("""Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));""")
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'Tabwechsel pausiert automatisch')
        ton = await wert(pg, f'{N}.ton()')
        ok(ton['kontext'] in ('suspended', 'keiner', 'closed', 'interrupted'), f'Audio angehalten ({ton["kontext"]})')
        await pg.evaluate("""Object.defineProperty(document, 'hidden', { value: false, configurable: true });
          Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));""")
        await pg.wait_for_timeout(400)
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'nach Rückkehr bleibt es pausiert, bis man bewusst fortsetzt')
        await pg.evaluate(f'{N}.eingabeSt.links.add("test")')
        await pg.tap('#neustartKnopf')
        frisch = await wert(pg, f'({{ z: {N}.zustand(), t: {F}.w.zeit, d: {F}.sp.d, autos: {F}.w.autos.length, links: {N}.eingabeSt.links.size, ziel: {N}.eingabeSt.zielSpur, partikel: {N}.partikel() }})')
        ok(frisch['z'] == 'fahrt' and frisch['t'] == 0 and frisch['d'] == 0 and frisch['autos'] == 0 and frisch['links'] == 0 and frisch['ziel'] is None and frisch['partikel'] == 0, f'Neustart setzt alles zurück {frisch}')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Tastatur, Maus, Crash bei Berührung (Desktop)')
        ctx, pg = await neue_seite(b, 1440, 900, query='?seed=12', init=AUDIO_ZAEHLER)
        lay = await wert(pg, f'{N}.lay()')
        ok(abs(lay['sicht']['w'] / lay['sicht']['h'] - 0.6) < 0.01 and lay['sicht']['w'] < 700, f'Desktop: zentrierte Sicht mit festem Seitenverhältnis ({lay["sicht"]["w"]:.0f}×{lay["sicht"]["h"]:.0f})')
        await pg.click('#spielenKnopf'); await warte_fahrt(pg)
        await pg.evaluate(LEER)
        x0 = await wert(pg, f'{F}.sp.x')
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(400)
        x1 = await wert(pg, f'{F}.sp.x')
        ok(abs(x1 - (x0 - 3.6)) < 0.05, f'Pfeil links: genau eine Spur ({x0:.2f} → {x1:.2f})')
        await pg.keyboard.down('ArrowLeft'); await pg.wait_for_timeout(700); await pg.keyboard.up('ArrowLeft'); await pg.wait_for_timeout(300)
        ok(abs(await wert(pg, f'{F}.sp.x') - (x1 - 3.6)) < 0.05, 'Taste halten wiederholt nicht')
        await pg.keyboard.press('KeyD'); await pg.keyboard.press('KeyD'); await pg.wait_for_timeout(500)
        ok(abs(await wert(pg, f'{F}.sp.x') - (x1 + 3.6)) < 0.05, 'D zweimal: zwei Spuren nach rechts')
        sv = lay['sicht']; xk = await wert(pg, f'{F}.sp.x')
        await pg.mouse.click(sv['x'] + sv['w'] * 0.15, sv['y'] + sv['h'] * 0.5); await pg.wait_for_timeout(400)
        ok(abs(await wert(pg, f'{F}.sp.x') - (xk - 3.6)) < 0.05, 'Mausklick links auf die Straße: eine Spur nach links')
        vg = await wert(pg, f'{F}.w.vGrund')
        await pg.keyboard.down('Space'); await pg.wait_for_timeout(600); await pg.keyboard.up('Space')
        ok(abs(await wert(pg, f'{F}.sp.v') - vg) < 0.5 and not await wert(pg, f'{F}.sp.boostAn'), 'kein manueller Boost auf der Leertaste')
        sw0 = await wert(pg, f'{N}.eingabeSt.spurwechsel')
        await pg.keyboard.press('KeyP')
        ok(await wert(pg, f"{N}.zustand()") == 'pause', 'P pausiert')
        await pg.focus('#weiterKnopf'); await pg.keyboard.press('Space'); await pg.wait_for_timeout(100)
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt' and await wert(pg, f'{N}.eingabeSt.spurwechsel') == sw0, 'Leertaste auf „Weiter“ setzt fort, ohne Spurwechsel')
        await pg.keyboard.press('KeyM')
        ok(await wert(pg, f'{N}.speicher.ton') is False, 'M schaltet den Ton aus')
        await pg.keyboard.press('KeyM')
        await warte_fahrt(pg); await pg.wait_for_timeout(200)
        # Berührung: Auto direkt voraus in der eigenen Spur, mit Boosttempo hinein → Fahrt endet sofort
        await pg.evaluate(f"{F}.w.felder.push({{ id: 4343, d: {F}.sp.d + 12, spur: 0, x: {F}.sp.x, laenge: 7, breite: 2.6, status: 'offen' }})")
        await pg.evaluate(auto_js(45, 0, 'taxi', 10))
        ok(await warte(pg, f"{N}.zustand() === 'ergebnis'", 8000), 'eine Berührung beendet die Fahrt')
        ok(await wert(pg, f'{F}.w.grund') == 'crash' and await wert(pg, f'{F}.w.statistik.unfaelle') == 1, 'genau ein Crash gezählt')
        ok(await wert(pg, f'(() => {{ const a = {F}.w.autos.find(a => a.id === 9999); return !!a && a.d - {F}.sp.d > 0; }})()'), 'kein Durchfahren bei hohem Tempo, auch nicht im Abspann')
        txt = await pg.inner_text('#ergebnisGrund')
        ok('Crash nach' in txt and 'km/h' in txt, f'Ergebnis nennt Strecke und Tempo ({txt})')
        ok(await pg.inner_text('#nochmalKnopf') == 'Sofort nochmal' and await wert(pg, 'document.activeElement && document.activeElement.id') == 'nochmalKnopf', '„Sofort nochmal“ mit Fokus')
        ok(await im_bild(pg, '#nochmalKnopf'), '„Sofort nochmal“ ohne Scrollen sichtbar')
        ok(await pg.locator('#ergebnisAufgaben li').count() >= 3 and len(await pg.inner_text('#ergebnisRekord')) > 5, 'Ergebnis zeigt Rekordabstand und Aufgaben')
        gesp0 = json.loads(await wert(pg, "localStorage.getItem('pixelhafen.nachtschicht')"))
        ok(gesp0['gesamt']['laeufe'] == 1 and gesp0['gesamt']['strecke'] > 0, 'Gesamtwerte für Aufgaben gespeichert')
        await pg.screenshot(path=str(BILDER / f'{MOTOR}-desktop-ergebnis.png'))
        await pg.keyboard.press('Enter')
        ok(await wert(pg, f"{N}.zustand()") == 'fahrt' and await wert(pg, f'{F}.w.zeit') < 1, 'Enter startet sofort neu')
        gesp = json.loads(await wert(pg, "localStorage.getItem('pixelhafen.nachtschicht')"))
        ok(gesp['v'] == 2 and gesp['beste']['endlos']['versuche'] >= 1 and gesp['beste']['endlos']['strecke'] > 0, 'Rekord (Strecke, Punkte) versioniert gespeichert')
        # Kombo-Anzeige und Rekordlinie
        await warte_fahrt(pg); await pg.evaluate(LEER)
        ok(await wert(pg, f'{F}.w.rekordD') > 0, 'neuer Lauf kennt die Rekordstrecke (Rekordlinie)')
        await pg.evaluate(f'{F}.w.kombo = 4; {F}.w.komboRest = 3')
        await pg.wait_for_timeout(200)
        ok(await im_bild(pg, '#komboAnzeige') and 'KOMBO ×4' in await pg.inner_text('#komboText'), 'Kombo-Anzeige im HUD')
        await pg.evaluate(f'{F}.w.komboRest = 0.05'); await pg.wait_for_timeout(300)
        ok(not await im_bild(pg, '#komboAnzeige'), 'Kombo-Anzeige verschwindet nach Ablauf')
        # Streife berühren beendet die Fahrt ebenfalls
        await warte_fahrt(pg); await pg.evaluate(LEER)
        await pg.evaluate(f"(() => {{ const f = {F}; f.w.polizei.push({{ id: 777, d: f.sp.d + 10, x: f.sp.x, vx: 0, v: 5, spur: 0, zielSpur: f.spurVon(f.sp.x), planUhr: 99, laenge: 4.8, breite: 1.95, kontaktBis: -1, wackel: 0, stoss: 0, geboren: 0, fragend: 0 }}); }})()")
        ok(await warte(pg, f"{N}.zustand() === 'ergebnis'", 6000) and await wert(pg, f'{F}.w.statistik.polizeiKontakt') == 1, 'Berührung mit einer Streife beendet die Fahrt')
        await pg.click('#nochmalKnopf'); await warte_fahrt(pg); await pg.wait_for_timeout(400)
        ton = await wert(pg, f'{N}.ton()')
        ok(ton['musik'] and ton['musikStarts'] == 1, f'nach mehreren Neustarts genau eine Musikschleife ({ton["musikStarts"]})')
        ok(await wert(pg, 'window.__audio.ohneEnde') == 0 and await wert(pg, 'window.__audio.gestartet') > 50, 'keine dauerhafte Audioquelle (kein Motor)')
        ok(not pg.fehler, f'keine Fehler in der Konsole: {pg.fehler[:3]}')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Lange Endlosfahrt im echten Loop (Testfahrer, Zeitraffer)')
        ctx, pg = await neue_seite(b, 430, 900, touch=True, dpr=1, query='?tempo=6&seed=21')
        await pg.tap('#spielenKnopf'); await warte_fahrt(pg)
        await pg.evaluate(f'{N}.erstelleBot({{ spur: true }})')
        laeufe = 0
        for _ in range(4):   # mehrere Läufe hintereinander (mit sofortigem Neustart)
            await warte(pg, f"{N}.zustand() === 'ergebnis' || {F}.sp.d > 3000", 120000)
            laeufe += 1
            if await wert(pg, f"{N}.zustand()") != 'ergebnis': break
            await pg.keyboard.press('Enter'); await warte_fahrt(pg); await pg.evaluate(f'{N}.erstelleBot({{ spur: true }})')
        ok(laeufe >= 1 and not pg.fehler, f'{laeufe} Endlosläufe im echten Loop ohne Fehler')
        # Tempoanstieg im echten Loop (ohne Verkehr, damit kein Crash dazwischenkommt)
        await pg.evaluate(f'{N}.setzeBot(null)'); await pg.keyboard.press('KeyP'); await pg.click('#neustartKnopf'); await warte_fahrt(pg)
        await pg.evaluate(LEER)
        v0 = await wert(pg, f'{F}.w.vGrund')
        await warte(pg, f'{F}.sp.d > 2500', 120000)
        d = await wert(pg, f'{F}.sp.d'); v1 = await wert(pg, f'{F}.w.vGrund')
        ok(v1 > v0 + 12, f'wird schnell schneller ({v0 * 3.6:.0f} → {v1 * 3.6:.0f} km/h nach {d / 1000:.1f} km)')
        ok(await wert(pg, f'{N}.partikel()') <= 140 and await wert(pg, f'{F}.w.autos.length') <= 40, 'Objekt- und Partikelzahl begrenzt')
        ok(not pg.fehler, f'keine Fehler in der Konsole: {pg.fehler[:3]}')
        await ctx.close()

        # ---------------------------------------------------------------
        print('\n# Ohne localStorage, kaputter Speicher, Übernahme Version 1')
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="Object.defineProperty(window, 'localStorage', { get() { throw new Error('gesperrt'); } });")
        await pg.tap('#spielenKnopf')
        ok(await warte_fahrt(pg), 'ohne localStorage spielbar')
        await pg.wait_for_timeout(800)
        ok(await wert(pg, f'{F}.w.zeit') > 0.3 and not pg.fehler, f'läuft ohne Fehler {pg.fehler[:2]}')
        await ctx.close()
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="try { localStorage.setItem('pixelhafen.nachtschicht', '{kaputt'); } catch (e) {}")
        ok(await wert(pg, f"{N}.zustand()") == 'menue' and not pg.fehler, 'kaputter Speicher wird ignoriert')
        await ctx.close()
        ctx, pg = await neue_seite(b, 390, 844, touch=True, init="try { localStorage.setItem('pixelhafen.nachtschicht', JSON.stringify({ v: 1, ton: true, effekte: 0.3, musik: 0.2, knoepfe: true, empfindlich: 1.35, beste: { containerkai: { punkte: 12345, geschafft: 2, versuche: 3 } } })); } catch (e) {}")
        alt = json.loads(await wert(pg, "localStorage.getItem('pixelhafen.nachtschicht')"))
        ok(alt['v'] == 2 and alt['effekte'] == 0.3 and alt['musik'] == 0.2 and alt['knoepfe'] is True and alt['empfindlich'] == 1.35, 'Version 1 → 2: Einstellungen übernommen')
        ok(alt['alt']['containerkai']['punkte'] == 12345 and alt['beste']['endlos']['punkte'] == 0, 'alte Bestleistungen archiviert, neue Rekordtabelle')
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
            s = (await wert(pg, f'{N}.lay()'))['sicht']
            ok(abs(s['w'] / s['h'] - 0.6) < 0.01, f'{name}: Sicht im festen Seitenverhältnis')
            ok(s['x'] >= -0.5 and s['x'] + s['w'] <= w + 0.5, f'{name}: Sicht passt in die Breite')
            ok(await wert(pg, 'document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight'), f'{name}: kein Scrollen')
            ok(await im_bild(pg, '#hud') and await im_bild(pg, '#tempoFeld'), f'{name}: HUD mit Tempo im Bild')
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
            zeiten = await pg.evaluate("""() => new Promise(r => { const z = []; let l = performance.now(); const f = t => { z.push(t - l); l = t; if (z.length < 180) requestAnimationFrame(f); else r(z); }; requestAnimationFrame(f); })""")
            zeiten.sort()
            ok(zeiten[len(zeiten) // 2] < 20, f'Bildzeit mit 4-fach gedrosselter CPU: Median {zeiten[len(zeiten) // 2]:.1f} ms')
            await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        await ctx.close()

        await b.close()
    print(f'\n{geprueft} Prüfungen, {len(fehler)} Fehler')
    sys.exit(1 if fehler else 0)

asyncio.run(main())
