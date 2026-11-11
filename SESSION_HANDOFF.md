# Nachtschicht: Hafenbande – Übergabe

Stand: 11. November 2026. Erste Fassung, **nicht veröffentlicht** (kein GitHub-Repo angelegt, nichts gepusht).
Geplante Adresse: https://moje9328.github.io/nachtschicht/ (Karte auf der Pixelhafen-Seite ist lokal eingetragen und lokal committet).

## Wunsch

Fiktives, überzeichnetes Arcade-Spiel in zwei Phasen: kurzer Tresor-Coup als abstraktes Timing-Minispiel, danach Verfolgungsfahrt über eine erfundene Autobahn. Drei Aufträge (Containerkai, Neonviertel, Nachthafen), Training ohne Coup/Polizei, Handy/Tablet/Desktop. Eigener Spielerwagen (dunkelvioletter Arcade-Kombi, türkise Akzente, eigenes Leuchtband), keine echten Marken, Orte, Tätergruppen oder Methoden.

Namensfrage: Die Anfrage nannte das Spiel „Nachtschicht: Hafenbande“, für den Startbildschirm aber „Nachtschicht: Hafenflucht“. Umgesetzt ist durchgehend **Nachtschicht: Hafenbande**. Für eine Änderung reichen `kopf.html` (Titel, h1) und `manifest.webmanifest`.

## Bauen und prüfen

```
python3 quelle/baue.py                  # baut index.html aus quelle/ (index.html nie direkt bearbeiten)
node quelle/test-logik.js               # 109 Prüfungen, ~3 min (Argument "schnell": weniger Seeds)
python3 quelle/test-browser.py          # Chromium, 119 Prüfungen, ~2 min, echter Game Loop
python3 quelle/test-browser.py webkit   # Safari-Motor, 112 Prüfungen (ohne CDP-Touch und CPU-Drossel)
python3 quelle/mache-icons.py           # App-Icons
python3 quelle/mache-bilder.py          # 3 Bilder für ~/spiele-seite/bilder (500×820)
```

Lokal spielen: `cd ~/nachtschicht-app && python3 -m http.server 8000` → http://localhost:8000/ (oder `index.html` direkt öffnen).
Nur für Tests: `?seed=123` (fester Verkehr), `?tempo=6` (Zeitraffer).

## Aufbau (`quelle/`)

| Datei | Inhalt |
|---|---|
| `1-einstellungen.js` | Alle Zahlen: Sicht (`ANSICHT`), Spieler, Boost, Schaden, Druck, Punkte, Fahrzeugtypen, Abschnittsarten, `AUFTRAEGE`, Strecke mit Kurven (nur im Bild), Seed-Zufall |
| `3-coup.js` | Phase 1 ohne DOM: Zeiger, Zielfeld, 3 Treffer, Öffnen, Beutetaschen fangen |
| `3-fahrt.js` | Phase 2 ohne DOM: Spieler, Verkehr, Spurwechsel, Streifen, Kollisionen, Druck/Warnung, Punkte; `pfadFrei` = Fairness-Prüfung |
| `5-speicher.js` | `pixelhafen.nachtschicht` Version 1: Ton/Lautstärken, Steuerung, Bestleistungen je Auftrag; try/catch |
| `6-ton.js` | Web Audio: Motor, Sirene (max. 0,07), Effekte (max. 8 gleichzeitig), kurze Musik; 3 Lautstärken |
| `7-grafik.js` | Projektion (leichte Schrägsicht), Straße/Kulisse je Abschnitt, Fahrzeugdesigns, Partikel (max. 140), Coup-Szene |
| `8-eingabe.js` | Relatives Ziehen mit Pointer Capture/pointercancel, Halte-Knöpfe, Tastatur |
| `9-app.js` | Zustände menue/coup/fahrt/pause/ergebnis, ein Game Loop (fester Schritt 1/120 s), Layout, HUD, Fenster, `window.__nacht` für Tests |
| `test-bot.js` | Testfahrer (nicht im Spiel), auch mit „menschlichen“ Fehlern |

## Wichtige Entscheidungen

- **Gleiche Sicht überall:** 62 m voraus, 19,5 m quer, festes Seitenverhältnis 0,62. Breite Bildschirme bekommen nur abgedunkelte Kulisse, hohe mehr Himmel.
- **Fairness (`pfadFrei`):** Vor jedem neuen Auto und jedem Spurwechsel wird gerechnet, ob der Spieler mit Grund- und Boost-Tempo und begrenzter Seitengeschwindigkeit einen Weg an allen Autos vorbei hat – mit zusätzlicher Reserve (+3 m längs, +0,35 m quer). Zusätzlich darf für keinen Ankunftszeitpunkt (Vorsprung 0–80 m, z. B. nach Boost) eine geschlossene Wand entstehen. Neue Autos entstehen ≥ 82 m voraus (außerhalb des Bildes, oben eingeblendet). Spurwechsel blinken 1,45 s vorher und brechen ab, wenn der Spieler in die Zielspur fährt.
- **Gefundene und behobene Fehler beim Testen:** Streife fuhr dauerhaft neben dem Spieler und klemmte ihn hinter einem Auto ein (jetzt seitlich hinten, weicht zurück, wenn vorne belegt). Neue Autos übernahmen das Tempo einer Streife (große Tempounterschiede → Wände). Knappe „Treppen“ aus Laster/Bus waren rechnerisch passierbar, praktisch nicht (deshalb die Reserve). Fehlversuche am Coup-Anfang kosteten wegen Untergrenze 0 nichts. Beim Tunnelübergang brach das Zeichnen ab (fehlende Wandfarbe).
- **Schaden:** höchstens einer pro Schritt, Schutzzeit 1,25 s, dasselbe Auto frühestens nach 3,5 s erneut.
- **Punkte:** Überholen und knapp vorbei je Auto genau einmal (Flags), Nebenherfahren zählt nicht.
- **Coup überspringen:** erst nach dem ersten geschafften Abschluss des jeweiligen Auftrags; dann 3 Grundtaschen, keine Timing-Punkte. Bestleistung zählt nur bei geschafftem Auftrag.
- **Rechenzeit:** Wegsuche mit direkt berechneten Überlappungsfenstern; Schritt im Median 0,01 ms, p99,9 0,6 ms (Mac, Node).

## Testergebnisse (11.11.2026)

- Logik 109/109: Coup gut/schlecht/Dauertippen, Steuerung, Boost, Kollision bei 90 m/s, einmaliger Schaden/Punkte, Druck/Warnphase, Fairness über 16 Seeds je Auftrag, Streifen (Vorwarnung ≥ 2,2 s, außerhalb des Bildes, Höchsttempo, nie vor dem Spieler, nie durch Autos), Abschließbarkeit (perfekter und „menschlicher“ Bot), Reproduzierbarkeit.
- Zusätzlich 40 Seeds je Auftrag: 0 Wände in ~59 000 Stichproben, 120/120 geschafft.
- Browser Chromium 119/119, WebKit 112/112: echte Tipps im Coup, Touch (CDP), Maus, Tastatur, Pause/Tabwechsel/Neustart, alle drei Aufträge bis „Auftrag geschafft“, Speicher (gesperrt/kaputt/fremde Version), 6 Bildschirmgrößen, reduced motion, Bildzeit bei 4-fach gedrosselter CPU.

## Nicht geprüft

- Echtes Handy/Tablet (nur Emulation), echte Notch-Ränder, 120-Hz-Bildschirme.
- Ob die Geräusche gut klingen (nur erzeugt, nicht angehört).
- Spielgefühl und Schwierigkeit mit echten Menschen (nur Bots).
- Teilen über das echte Handy-Teilen-Menü.
- Keine rechtliche Prüfung (Marken/Designs sind selbst entworfen, aber nicht juristisch geprüft).

## Veröffentlichen (erst nach OK des Nutzers)

GitHub-Repo `moje9328/nachtschicht` anlegen, Pages aus main /, pushen; in `~/spiele-seite` den Karten-Commit pushen (dort nur gezielt stagen).
