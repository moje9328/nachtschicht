#!/usr/bin/env python3
# Bilder für die Pixelhafen-Übersicht (500×820 JPG). Aufruf: python3 quelle/mache-bilder.py
import asyncio, pathlib, subprocess
from playwright.async_api import async_playwright
ORDNER = pathlib.Path(__file__).resolve().parent.parent
ZIEL = pathlib.Path.home() / 'spiele-seite' / 'bilder'
BOT = (ORDNER / 'quelle' / 'test-bot.js').read_text()
N = 'window.__nacht'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 375, 'height': 615}, device_scale_factor=4 / 3, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); await pg.goto((ORDNER / 'index.html').as_uri() + '?seed=31'); await pg.wait_for_timeout(700)
        await pg.add_script_tag(content=BOT)
        async def foto(name):
            png = ZIEL / f'{name}.png'
            await pg.screenshot(path=str(png))
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', str(png), '--out', str(ZIEL / f'{name}.jpg')], check=True, capture_output=True)
            png.unlink()
        # 1: Coup – Taschen fliegen
        await pg.evaluate(f"{N}.starte('neonviertel', false)")
        await pg.evaluate(f'''(() => {{ const f = () => {{ const c = {N}.coup(); if (!c) return; const k = c.c;
            if (k.phase === 'laden' && k.sperre <= 0 && Math.abs(k.zeiger - k.zone.mitte) < 0.01) c.aktion();
            if (k.phase === 'beute' && k.beutel.some(x => x.status === 'fliegt' && Math.abs(x.u - 0.72) < 0.03)) c.aktion();
            requestAnimationFrame(f); }}; f(); }})()''')
        await pg.wait_for_function(f"{N}.coup() && {N}.coup().c.phase === 'beute' && {N}.coup().c.beutel.filter(x => x.status === 'fliegt').length >= 2", polling='raf', timeout=30000)
        await pg.evaluate("document.getElementById('hinweis').hidden = true")
        await foto('nachtschicht-coup')
        # 2: Fahrt mit Verkehr und Streife
        await pg.wait_for_function(f"{N}.zustand() === 'fahrt'", timeout=30000)
        await pg.evaluate(f'{N}.erstelleBot({{ boost: false }})')
        await pg.wait_for_function(f"{N}.fahrt() && {N}.fahrt().w.zeit > 8 && {N}.fahrt().w.polizei.some(p => p.d > {N}.fahrt().sp.d - 7) && {N}.fahrt().w.autos.filter(a => a.d > {N}.fahrt().sp.d && a.d < {N}.fahrt().sp.d + 55).length >= 3", polling='raf', timeout=90000)
        await pg.evaluate("document.getElementById('hinweis').hidden = true; document.getElementById('meldung').textContent = ''")
        await foto('nachtschicht-streife')
        # 3: Startbild
        await pg.evaluate(f'{N}.setzeBot(null); {N}.zeigeStart()')
        await pg.wait_for_timeout(300)
        await foto('nachtschicht-start')
        await b.close()
asyncio.run(main())
