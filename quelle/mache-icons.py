#!/usr/bin/env python3
# Zeichnet die App-Icons (der Kombi aus dem Spiel). Aufruf: python3 quelle/mache-icons.py
import asyncio, pathlib, base64
from playwright.async_api import async_playwright
ORDNER = pathlib.Path(__file__).resolve().parent.parent
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto((ORDNER / 'index.html').as_uri()); await pg.wait_for_timeout(400)
        for groesse, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
            daten = await pg.evaluate('''(n) => { const cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d');
              const g = c.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#0B1030'); g.addColorStop(0.55, '#2A1850'); g.addColorStop(1, '#10243A');
              c.fillStyle = g; c.fillRect(0, 0, n, n);
              c.strokeStyle = 'rgba(255, 79, 216, 0.7)'; c.lineWidth = n * 0.012; c.beginPath(); c.moveTo(0, n * 0.3); c.lineTo(n, n * 0.3); c.stroke();
              c.strokeStyle = 'rgba(36, 214, 205, 0.4)';
              for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(n / 2 + i * n * 0.03, n * 0.3); c.lineTo(n / 2 + i * n * 0.28, n); c.stroke(); }
              c.save(); c.translate(n / 2, n * 0.56); const s = n * 0.42; c.scale(s, s); Grafik.malKombi(c, 1.15, { boost: true, zeit: 0.3 }); c.restore();
              return cv.toDataURL('image/png').split(',')[1]; }''', groesse)
            (ORDNER / 'icons' / name).write_bytes(base64.b64decode(daten))
        await b.close()
asyncio.run(main())
