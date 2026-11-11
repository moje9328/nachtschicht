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
            await pg.evaluate("document.getElementById('hinweis').hidden = true; document.getElementById('meldung').textContent = ''")
            png = ZIEL / f'{name}.png'
            await pg.screenshot(path=str(png))
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', str(png), '--out', str(ZIEL / f'{name}.jpg')], check=True, capture_output=True)
            png.unlink()
        # 1: Neonboulevard mit dichtem Verkehr und Boostfeld
        await pg.evaluate(f"{N}.starte('endlos', false)")
        await pg.evaluate(f'{N}.erstelleBot({{}})')
        await pg.wait_for_function(f"{N}.fahrt() && {N}.fahrt().sp.d > 1200 && {N}.fahrt().w.autos.filter(a => a.d > {N}.fahrt().sp.d && a.d < {N}.fahrt().sp.d + 45).length >= 4", polling='raf', timeout=90000)
        await pg.evaluate(f"(() => {{ const F = {N}.fahrt(); F.sp.d = 4400 * 2 + 300; }})()")
        await pg.wait_for_function(f"{N}.fahrt().w.autos.filter(a => a.d > {N}.fahrt().sp.d && a.d < {N}.fahrt().sp.d + 45).length >= 4 && {N}.fahrt().w.felder.some(f => f.status === 'offen' && f.d > {N}.fahrt().sp.d + 8 && f.d < {N}.fahrt().sp.d + 40)", polling='raf', timeout=120000)
        await foto('nachtschicht-neon')
        # 2: Verfolgung: Streife im Bild
        await pg.wait_for_function(f"{N}.fahrt().w.polizei.some(p => p.d > {N}.fahrt().sp.d - 11) && {N}.fahrt().w.autos.filter(a => a.d > {N}.fahrt().sp.d && a.d < {N}.fahrt().sp.d + 45).length >= 2", polling="raf", timeout=240000)
        await foto('nachtschicht-streife')
        # 3: Startbild
        await pg.evaluate(f'{N}.setzeBot(null); {N}.zeigeStart()')
        await pg.wait_for_timeout(300)
        await foto('nachtschicht-start')
        await b.close()
asyncio.run(main())
