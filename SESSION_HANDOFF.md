# Nachtschicht: Hafenflucht – Übergabe

(Bis Runde 2 hieß das Spiel „Nachtschicht: Hafenbande“. Ab Runde 3 ist es ein Neon-Arcade-Racer; die Abschnitte „Aufbau“ und „Entscheidungen“ unten gelten weiter, sind aber durch Runde 3 teilweise überholt.)

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

## Runde 2 (11.11.2026): Boostfelder statt Boostknopf, Musik, mehr Tempo und Verkehr

**Wunsch:** Manuellen Boost (Knopf, Leertaste, Vorrat, Ladebalken) komplett entfernen. Stattdessen leuchtende Pfeilfelder auf einzelnen Spuren, die beim Überfahren automatisch ~2,5 s +30 % geben. Faire gemeinsame Planung mit dem Verkehr. Außerdem: dichterer Verkehr, sichtbare Verfolgung, höheres Grundtempo, durchgehende Arcade-Hintergrundmusik.

**Änderungen:**
- `BOOST` in `1-einstellungen.js` ist jetzt die zentrale Feld-Konfiguration: faktor 1,3, dauer 2,5 s, anstieg 0,35 s, abklingen 0,9 s, Feld 7 × 2,6 m, erstes Feld bei 170 m (eigene Spur), danach alle 260–520 m, 200 m vor dem Ziel keine mehr.
- `3-fahrt.js`: `sp.boostRest`/`sp.boostAnteil` statt Vorrat. Überfahrt wird über die ganze Schrittstrecke geprüft (auch bei 120 m/s), die Wagenmitte muss über dem Feld liegen; jedes Feld genau einmal (`status` offen/genutzt/verpasst). Weiteres Feld frischt die Dauer auf, addiert nie Tempo.
- Faire Platzierung `planeFelder` + `feldWegFrei`: Weg bis zum Feld, „Tor“ über das Feld und danach volle Boostdauer mit +30 % muss frei sein (vom Spieler aus und von jeder Position). Kein Feld unter Autos, nicht im Bild. `fair()` schützt kommende Feldwege auch gegen später erzeugten Verkehr und Spurwechsel.
- Oberfläche: Boostknopf, Ladebalken, Tastenbelegung und alte Hinweise entfernt. Kompakte Anzeige `#boostWirkung` nur während der Wirkung. Steuerfläche kleiner (104–140 px) → größere Fahransicht. Neue Anleitung „Fahre über die leuchtenden Pfeilfelder für einen Temposchub!“. Punkte: +100 je Feld (Ergebniszeile „Boostfelder“).
- Sicht nach hinten 9 → 14 m (Streife sichtbar), Seitenverhältnis 0,6. Grundtempo +3 m/s je Auftrag (34/37/40, Training 35), Verkehrsdichte 3,0/5,2/6,0.
- `6-ton.js`: eigener Boostfeld-Sound; Hintergrundmusik als leiser Dur-Sequenzer (C–Am–F–G, 118 BPM) auf dem Musik-Regler, läuft im Coup und in der Fahrt ohne Neustart durch, Zusatz-Arpeggio bei hohem Druck. Endet mit dem Ergebnis (dort Abschlussjingle).

**Tests:** Logik 139/139 (neu: einmalig, seitlich vorbei, nur Rand, Stapeln/Auffrischen, 120 m/s, weich, Ende-Reset, Felder fair platziert, erstes Feld eigene Spur, keine Ketten, Aufträge ganz ohne Felder schaffbar). Browser Chromium 131/131, WebKit 124/124 (kein Boostknopf/-balken, Leertaste/Shift/↑/W ohne Boost, Feld im echten Loop genau einmal, Anzeige nur während Wirkung, Pause hält Wirkzeit an, Musik läuft/endet). Schritt p99,9 0,6 ms.

**Nicht geprüft:** Musik und Boost-Sound nicht angehört; Spielgefühl der neuen Werte nicht mit Menschen getestet (nur Bots); echtes Handy.

## Runde 3 (11.11.2026): Neon-Arcade-Racer – Ausweichen ist das Hauptspiel

**Wunsch:** Das Spiel war zu langsam und ereignisarm. Gewünscht war ein schneller Neon-Racer in der Draufsicht mit „Neon-Endlos“ als Hauptmodus, kompakten Missionen und optionalem Coup. Das Motorgeräusch sollte ganz weg, dafür eigene 80er-Musik. Name: „Nachtschicht: Hafenflucht“.

**Ursachen des langweiligen Gefühls (gemessen):**
- Die Annäherung an den Verkehr lag im Median nur bei 10–12 m/s. Das ergab 5–6 s Vorwarnzeit, also kaum echte Entscheidungen.
- Im Containerkai war 13 % der Zeit kein Auto im Bild, einmal 7 s am Stück.
- Weit entfernte Autos wirkten durch die Perspektive winzig.
- Die Aufträge dauerten 90–146 s, und vor jeder Fahrt kam der Coup.
- Ein Motor brummte dauernd.

**Änderungen:**
- **Darstellung:** echte Draufsicht ohne Verengung (`ANSICHT`: 50 m voraus, 12 m zurück, 22 m breit, längs gestaucht für Hochformat). Fahrzeuge, Fahrbahn, Felder und Kollisionen nutzen dieselben Weltkoordinaten.
- **Tempo:** Verkehr relativ langsamer (`TEMPO_BEZUG` 42). Die Annäherung liegt jetzt bei 17,6–18,5 m/s, das ist das 1,5- bis 1,7-Fache. Vorwarnzeit ca. 2,8 s.
  - Missionen: Grundtempo 43/44/46.
  - Endlos: steigt weich von 40 auf höchstens 48; Rampe 350–5200 m, danach Obergrenze.
- **Verkehr:**
  - Muster: Einzel, Paar, Versetzt, Lkw-Mix, Tor (3 Autos, 1 Lücke), Slalom. Sie kommen in Wellen (intensiv / kurze Entlastung), überall 4 Spuren.
  - Fairness-Prüfung zusätzlich für spätere Ankunft (Vorsprung −26/−13 m, z. B. nach Unfall).
  - Angestoßene Autos werden vorausberechnet.
- **Unfälle:** leicht bremsen (82 %), Schaden 18/10. Der Anstoß wird nicht mehr aufaddiert (Fehler gefunden: Dauerkontakt addierte jede 1/120 s +9 m/s).
- **Streifen:** schneller (14–19 % über Grundtempo), erscheinen knapp außerhalb des Bildes (mit Vorwarnung), wählen die Spur mit der größten Lücke, bremsen nach echtem Bremsweg, halten ~10 m zum Spieler. Abgehängt erst ab 75 m. Sie sind 5–11 % der Zeit im Bild und rammen nie.
- **Modi:**
  - „Spielen“ startet sofort Neon-Endlos; nach Game over „Sofort nochmal“ (Fokus, Enter).
  - Missionen haben die Checkbox „Mit Coup-Einstieg“ (Standard aus). Das Training ist entfallen.
- **Punkte:** neu „Saubere Serie!“ (+250 je 10 saubere Überholungen) und „Knapp vorbei!“. Das HUD zeigt den Druck nur, wenn eine Streife relevant ist, und die Beute nur nach einem Coup.
- **Kulisse:** fünf Abschnitte, Neonboulevard (Palmen, Neonhotels mit Fensterlichtern), Hafenautobahn (Wasser, Hallen, Leitplanken), Lichttunnel, Küstenstraße (Strand, Wasser, Palmen) und Lagerhafen (Container, Kräne). Glow nur als Doppellinie um scharfe Formen, kein Blur.
- **Audio:**
  - Motor und Dauersirene sind komplett entfernt.
  - Neu `6-musik.js` „Neonküste“: eigene Komposition, 136 BPM, a-Moll, 36 Takte = 63,5 s. Teile: Intro, A, B, A', Brücke, Überleitung. Pads, Achtel-Bass, Lead mit Vibrato, Arpeggios, Drums. Planung über die Audio-Uhr, Hüllkurven, nahtloser Loop.
  - Die Musik läuft nach der ersten Interaktion durchgehend, in genau einer Schleife; bei Ergebnissen wird sie gedämpft.
  - Zwei Regler: Musik und Effekte.
- **Speicher:** Version 2. Die Einstellungen aus Version 1 werden übernommen, alte Bestleistungen unter `alt` archiviert (Anzeige „vor der Überarbeitung“).

**Tests:**
- Logik: 172 Prüfungen, darunter Abnahme-Messungen zu Annäherung, Vorwarnzeit, Leerlauf und Pflicht zum Ausweichen (ohne Lenken Unfall nach < 14 s), Obergrenzen, Muster, Missionsdauer, sanftes Bremsen, Serienbonus und Regressionstest Anstoß.
- Browser: Chromium 136/136, WebKit 129/129. Unter anderem keine Audioquelle ohne geplantes Ende, genau ein Musikstart nach mehreren Neustarts, Migration v1→v2, Endlos-Game-over mit Enter-Neustart.
- 40 zusätzliche Seeds je Modus: 0 vom Planer erzeugte Wände (die übrigen Stichproben nur direkt nach eigenen Unfällen).
- Musik offline gerendert: 63,5 s, Spitze 0,44, keine stillen Viertelsekunden, Pegel vor und nach dem Loop gleich (0,0535), kein Klick.
- Browser-Langlauf: 648 s Endlos ohne Fehler, max. 12 Autos und 14 Partikel.

**Nicht geprüft:** Ich habe die Musik nicht angehört, nur gemessen. Kein echtes Handy und keine echten Touch-Gesten, nur CDP-Emulation. Schwierigkeit und Gefühl wurden nur mit Bots abgestimmt, nicht mit Menschen.

## Runde 4 (11.11.2026): Spurwechsel per Klick, viel mehr Verkehr, Endlos wird immer schneller

**Wunsch:** Noch viel mehr Verkehr. Ein Klick links/rechts wechselt direkt die Spur. Hauptaufgabe ist das Ausweichen, und es soll immer schwieriger und schneller werden.

**Änderungen:**
- **Steuerung** (`8-eingabe.js`, Speicher `steuerart`, Standard `spur`):
  - Ein Tipp oder Klick links bzw. rechts (Steuerfläche oder Straße), ←/→ oder A/D wechselt genau eine Spur. Mehrere Drücke ergeben mehrere Spuren.
  - Halten wiederholt nicht.
  - Ein Spurwechsel dauert ca. 0,2 s (`SPIELER.spurMax` 24 m/s, `spurBeschl` 320) und endet genau in der Spurmitte.
  - „Frei ziehen“ ist in „Steuerung“ wählbar und ebenfalls schneller (16 m/s).
- **Verkehr:**
  - Die Dichte bezieht sich jetzt auf die Strecke bis zur Spawnzone.
  - Missionen 17/20/23, Endlos startet bei 11.
  - Mindestlücke in einer Spur 10 m, Spawnversuche alle 0,15 s auf allen Spuren.
  - Gruppentempo wird im erlaubten Bereich gewählt, damit niemand später aufholt (Fehler gefunden: Gruppen konnten schneller als ein Auto davor sein).
  - Im Bild sind jetzt im Schnitt 5,4–6,0 Autos (vorher 2,5–2,9).
- **Endlos:** Tempo, Dichte und Spurwechsel-Häufigkeit steigen ohne feste Grenze, aber abflachend (`steigerung`, Halbwert 9 km). Grob: 144 km/h am Start, ~180 bei 5 km, ~230 bei 15 km. Technische Sicherheitsgrenze 78 m/s. Meldung „TEMPO … KM/H!“ alle 20 km/h.
- **Kein Dauerrempeln:** Klebt der Kombi am Heck eines Autos, beschleunigt er nicht weiter hinein (Fehler gefunden: über 80 s Dauerberührung hinter einem blockierten Auto).
- **Streifen:** bauen weniger Druck auf (4,5–6), weil Ausweichen die Hauptaufgabe ist.

**Tests:**
- Logik 180/180. Neu: Spurwechsel in ≤ 0,28 s ohne Überschwingen, Endlos immer schneller, kein langes Hängen hinter Autos (< 12 % der Zeit, < 12 s am Stück). Der Fairness-Test zählt keine Lagen direkt nach eigenen Unfällen oder beim freiwilligen Hinterherfahren.
- Browser Chromium 143/143, WebKit 136/136. Neu: Tipp links/rechts, zwei Tipps, Tipp auf die Straße, Pfeiltaste einmal/halten/zweimal, Mausklick, Ziehen-Modus.
- Bots mit Spurwechsel-Tipps:
  - menschenähnlich: Missionen 6/6, 6/6, 6/6; Endlos 2,5–4,5 min.
  - schwächer: 6/6, 4/6, 5/6; Endlos 1,2–3,3 min.

**Nicht geprüft:** echtes Handy; Gefühl des Spurwechsels mit echten Fingern; ob die Dichte für Menschen zu hoch ist (bisher nur Bots).

## Runde 5 (11.11.2026): reines Endlos-Spiel, ein Kontakt = Ende, schneller schwerer

**Wunsch:** Das Spiel soll ein Endlos-Spiel sein: Man fährt, bis man ein anderes Auto berührt. Schwierigkeit und Tempo sollen schneller steigen.

**Änderungen:**
- `AUFTRAEGE.endlos`:
  - `einTreffer`: Jede Berührung mit Verkehr oder Streife beendet die Fahrt (`grund: 'crash'`, kurzer Abspann von 1,3 s). Danach „Sofort nochmal“ mit Fokus, Enter startet sofort.
  - `ohneDruck`: kein Verfolgungsdruck; Streifen sind nur noch verfolgende Hindernisse.
  - Halbwert der Steigerung 3,5 km (vorher 9 km). Tempo 42 → Ziel 90 m/s, Sicherheitsgrenze 84 m/s.
  - Ungefähre Tempi: 1 km ≈ 176 km/h, 2 km ≈ 203 km/h, 5 km ≈ 256 km/h. Dichte 10 → 28, Muster ab 200 m und voll bei 2,2 km.
- **Abspann:** Nach dem Crash werden die Autos weiter physisch getrennt, der Kombi übernimmt das Tempo des getroffenen Autos. Gefundener Fehler: Vorher rollte er im Abspann durch das Auto hindurch.
- **Menü/HUD:**
  - Der Knopf „Missionen“ ist ausgeblendet (Missionen und Coup bleiben im Code und in den Logik-Tests, sind aber nicht mehr erreichbar).
  - HUD zeigt TEMPO in km/h statt Zustand und keinen Druckbalken.
  - Das Ergebnis nennt „Crash nach X km bei Y km/h“. „Freunde herausfordern“ vergleicht nur Endlos-Punkte.

**Tests:**
- Logik 186/186. Neu: Nähe ist kein Crash, eine Berührung beendet sofort mit genau einem Crash, kein Durchrollen, kein Druck, Tempo steigt schnell, Vorwarnzeit bei 20 km ≥ 0,9 s.
- Browser Chromium 103/103, WebKit 98/98; die Suite ist neu für das reine Endlos-Spiel geschrieben.
- Bots (Spurwechsel per Tipp), Median bis zum Crash: perfekt 47 s (2,4 km, 212 km/h), menschenähnlich 36 s, schwach 21 s. Keine vom Planer erzeugten Wände.

**Nicht geprüft:** echtes Handy; ob Menschen den Einstieg als fair empfinden.

## Runde 6 (11.11.2026): Suchtfaktor – Kombo, Rekordlinie, Aufgaben, Garage

**Wunsch:** Das Spiel soll ein richtiger Klassiker mit Suchtfaktor werden.

**Änderungen:**
- **Risiko-Kombo** (`PUNKTE.komboMax` 8, `komboZeit` 5 s):
  - Jedes „knapp vorbei“ erhöht den Multiplikator um 1 und frischt die Zeit auf. Normales Überholen hält die Kombo nicht am Leben.
  - Die Kombo multipliziert Überhol-, Knapp- und Boostfeld-Punkte; die Streckenpunkte steigen um +25 % je Stufe.
  - HUD: „KOMBO ×n“ mit ablaufendem Balken. Die Tonhöhe steigt mit der Kombo, beim Verfallen gibt es ein kurzes Signal.
- **Rekordlinie:**
  - Eine Neonlinie „DEIN REKORD“ liegt auf der Straße bei der bisher weitesten Strecke.
  - 200 m vorher erscheint der Hinweis „NOCH 200 M BIS ZUM REKORD!“. Beim Überfahren gibt es „NEUER REKORD!“, Konfetti und eine Fanfare.
  - Das Ergebnis zeigt „Noch X m bis zu deinem Rekord!“ bzw. wie viel weiter als der alte Rekord.
- **Aufgaben** (`4-aufgaben.js`):
  - Immer drei sind aktiv. 21 feste Aufgaben (z. B. 1 km, Kombo ×3, 190 km/h, insgesamt 10 km), danach endlos wachsende Ziele.
  - Jede erfüllte Aufgabe gibt einen Stern; mitten im Lauf erscheint „★ AUFGABE ERFÜLLT!“.
  - Neue Aufgaben zählen erst ab dem nächsten Lauf (keine Sternenketten), also höchstens drei Sterne pro Lauf.
- **Garage:** 6 eigene Lackierungen für den Kombi (Nachtviolett, Sonnenuntergang 3★, Eisblau 6★, Neongrün 10★, Goldrausch 14★, Chrom-Magenta 18★). Rein kosmetisch.
- **Ergebnisbildschirm neu geordnet:**
  - Oben stehen große Punktzahl, Rekord und Rekordabstand, direkt darunter „Sofort nochmal“, ohne Scrollen.
  - Danach folgen die Aufgaben; die Punkteaufschlüsselung ist aufklappbar.
- **Punkte neu gewichtet:** Strecke 1 Punkt/m (vorher 0,1), Überholen 20 (vorher 40), Seriensteigerung 5 % (vorher 10 %), Knapp 100 (vorher 75).
- **Speicher:** Version 2 mit neuen Feldern `aufgaben`, `gesamt`, `lack` (fehlen sie, gelten Standardwerte).

**Tests:**
- Logik 197/197. Neu: Kombo ×2/×3 und Multiplikation, Verfallen, Rekordereignis genau einmal, Aufgaben ohne Kette, Gesamt-Aufgaben, wachsende Endlos-Aufgaben, Lackierungs-Schwellen.
- Browser Chromium 111/111, WebKit 106/106. Neu: Start mit 3 Aufgaben und Sternzähler, Garage mit 5 gesperrten Lackierungen, Kombo-Anzeige an/aus, Rekordstrecke im neuen Lauf, „Sofort nochmal“ ohne Scrollen sichtbar, Gesamtwerte gespeichert.

**Nicht geprüft:** echtes Handy; ob das Belohnungstempo für Menschen passt (nur Bots).

## Runde 7 (11.11.2026): Tagesfahrt und Vibration

- **Tagesfahrt** (Startbildschirm):
  - Der Startwert ist das Datum (JJJJMMTT), also jeden Tag dieselbe Strecke mit demselben Verkehr, für alle Spieler gleich.
  - Eigener Tagesbestwert (`Speicher.tages`) mit Versuchszähler und Rekordlinie für den Tag. „Sofort nochmal“ bleibt auf der Tagesstrecke.
  - Läufe zählen auch für den Endlos-Rekord und die Aufgaben.
- **Vibration** (`navigator.vibrate`, wo vorhanden): 15 ms bei knapp vorbei, 140 ms beim Crash, Muster beim Rekord. Abschaltbar unter „Sound“, gespeichert.
- **Tests:** Browser Chromium 119/119, WebKit 114/114 (Prüfung „Audio angehalten“ wartet jetzt auf das asynchrone suspend()), Logik 197/197.
- **Nicht geprüft:** echte Vibration auf einem Gerät (nur abgefangener Aufruf).
