# Scooly Status

Nachbau von [status.claude.com](https://status.claude.com) - Layout, Abstände, Farben und
Typo-Größen sind direkt aus der gerenderten Seite ausgemessen (22.08.2026). Das Original ist
eine gemietete **Atlassian Statuspage**; deshalb sieht es bei vielen Firmen gleich aus.

Bewusst ein **eigenes Projekt mit eigenem Deployment**: Eine Status-Page, die auf derselben
Infrastruktur liegt wie das, was sie überwacht, ist genau dann weg, wenn man sie braucht.

```
Start:  npm run dev     → http://localhost:3005
Bauen:  npm run build
Prüfen: npm test        → 89 Tests
DB:     npm run pruefe:datenbank
```

## Seiten und wie sie zusammenhängen

Genauso verdrahtet wie beim Original:

```
/                    aktueller Status, 90-Tage-Leisten, Vorfälle der letzten 15 Tage
  │  "Vollständige Verfügbarkeit ansehen."  →  /uptime
  └  Fußzeile "← Verlauf der Vorfälle"      →  /history

/history  ⇄  /uptime      über die Reiter  Vorfälle | Verfügbarkeit
  beide: Quartals-Blätterung (?seite=2 …), Fußzeile "← Zum aktuellen Status"

/uptime               Monatskalender, ein Feld je Tag, Dienst über Auswahlfeld (?dienst=…)
/history              Vorfälle nach Monaten, je Vorfall die jüngste Meldung
                      + "Alle N Vorfälle anzeigen", wenn ein Monat mehr als drei hat
/abo                  Rückmeldung nach Bestätigung oder Abmeldung
/history.atom
/history.rss          Feeds, wie sie das Original im <head> verlinkt
```

Gemessene Werte der Unterseiten: Reiterleiste 42 px mit Haarlinie und 32 px Abstand,
Monatsblock 260 × 260 mit 35 px Spalten- und 32 px Zeilenabstand, Tagesfeld 32 × 32 im
Raster 38 × 38,5, Blätterpfeile 34 × 34 mit 4 px Radius, Monatsüberschrift im Verlauf
28 px/500 mit 4 px Innenabstand und 20 px Luft darunter.

Ohne Datenbank läuft die Seite lokal mit Demodaten. In der Produktion zeigt sie stattdessen
offen "Status derzeit nicht abrufbar" - ein grünes Banner ohne Messgrundlage wäre schlimmer
als gar keine Seite.

## Wie Störungen automatisch auftauchen

```
GitHub Action (alle 5 Min)
        │
        ▼
GET /api/check  ──►  fetch() auf jede probe_url
        │
        ├── Messung in `checks`
        ├── Tagesbilanz in `daily_uptime`  (zeichnet die 90-Tage-Leiste)
        └── Bewertung:
             3× hintereinander keine Antwort   → Vorfall "Größerer Ausfall" anlegen
             3× hintereinander über Grenzwert  → Vorfall "Antwortet langsam" anlegen
             aus langsam wird Ausfall          → Vorfall verschärfen
             3× hintereinander sauber          → Vorfall automatisch schließen
                     │
                     └──► Telegram an Elias + E-Mail an Abonnenten
```

Die Schwellen stehen oben in `src/lib/checker.ts` (`FAIL_STREAK`, `RECOVER_STREAK`).
Drei Messungen à 5 Minuten heißt: eine echte Störung ist nach spätestens 15 Minuten auf
der Seite, ein einzelner Schluckauf löst nichts aus.

**Der Wächter läuft bei GitHub, nicht bei Vercel.** Vercel Cron in `vercel.json` ist nur die
Rückfallebene und im Hobby-Tarif ohnehin auf einen Lauf pro Tag begrenzt.

Vorfälle, die kein Ping sehen kann ("Karteikarten sind gerade inhaltlich schlecht"), trägt
man von Hand in `incidents` + `incident_updates` ein. `automatic = false` setzen, dann fasst
der Wächter sie nicht an.

## Popups an den Balken

Jeder Tagesbalken - in der 90-Tage-Leiste wie im Monatskalender - hat ein Popup mit
Datum, aufgezeichneter Ausfalldauer und den Vorfällen dieses Tages. Maße am Original
abgenommen: Kasten 325 breit, 15 Innenabstand, 1px Rahmen, 3px Radius,
Schatten `0 3px 6px rgba(0,0,0,.15)`.

Das Popup unterscheidet drei Fälle, und das ist wichtiger als es aussieht:

- **keine Messdaten** → „Für diesen Tag liegen keine Messdaten vor."
- **gemessen, nichts passiert** → „An diesem Tag wurde kein Ausfall aufgezeichnet."
- **Ausfall** → Feld mit Dauer, getrennt nach *Ausfall* (keine Antwort) und
  *Beeinträchtigt* (Antwort über dem Grenzwert)

Ein Tag ohne Messung sagt also nicht, es sei nichts passiert.

## Newsletter

Läuft über **Resend**. Ablauf: eintragen → Bestätigungsmail → erst nach Klick auf den
Link steht die Adresse auf `confirmed` und bekommt Meldungen.

Ohne `RESEND_API_KEY` lehnt das Formular offen ab, statt eine Mail zu versprechen, die
nie ankommt.

Jede Meldung trägt einen persönlichen Abmeldelink und die Kopfzeilen
`List-Unsubscribe` / `List-Unsubscribe-Post`, damit die Ein-Klick-Abmeldung in Gmail
und Outlook funktioniert. Die Abmeldung **löscht** die Adresse, sie merkt sie sich nicht.

Vor dem Scharfschalten in Resend nötig:

1. Domain `scooly.dev` als Absenderdomain anlegen
2. Die von Resend gezeigten **SPF-, DKIM- und DMARC-Einträge** im DNS setzen
3. Warten, bis Resend die Domain als verifiziert führt
4. `RESEND_API_KEY` und `RESEND_FROM` in den Vercel-Umgebungsvariablen setzen

Ohne verifizierte Domain landen die Mails im Spam oder werden abgewiesen.

## Was geprüft ist - und was nicht

`npm test` fährt 69 Tests. Die Tests wurden gegengeprüft, indem absichtlich Fehler
eingebaut wurden (Spaltenname vertippt, Schwelle von 3 auf 1 gesetzt, Aufrunden statt
Abschneiden, Gewichtung entfernt) - jeder davon wurde gefangen.

| Bereich | Wie geprüft |
|---|---|
| `probe()` | Gegen einen **echten HTTP-Server**: 200, 204, Umleitung, 500, 403, 404, langsame Antwort, hängende Verbindung, abgebrochene Verbindung, toter Port. Keine Attrappe der `fetch`-Funktion. |
| Mailversand | Gegen einen **echten HTTP-Server**, der sich als Resend ausgibt: Kopfzeilen, eine Anfrage je Adresse, persönlicher Abmeldelink, `List-Unsubscribe`, Verhalten bei Fehlern |
| Popups | Zuordnung Vorfall → Tag → Dienst, Mitternachtsüberläufe, offene Vorfälle, kaputte Zeitangaben |
| Entscheidungslogik (`bewerte`) | 16 Fälle: Serien, Unterbrechungen, Verschärfung, Schließen, zu wenig Messungen |
| Rechenwege | Gewichtung, Abschneiden, Farbskala, Balkengeometrie, schlechtester Status |
| Kalender | Monatsanfänge, Schaltjahr, Jahreswechsel beim Blättern, Zukunftstage |
| Schema | Jede Tabelle und **jede Spalte**, die der Code anfasst, muss in `schema.sql` stehen |
| Routen | Wächter weist ohne/mit falschem Geheimnis ab, scheitert ohne Datenbank laut; Adressprüfung |
| Aufbau | Jede gelesene Umgebungsvariable steht in `.env.example`; Messtakt im Code = Takt im Zeitplan; Zeitgrenze passt ins Zeitfenster |

**Die Supabase-Anbindung** lässt sich in der Testreihe nicht abdecken - dafür bräuchte es
eine laufende Postgres-Instanz. Dafür gibt es `npm run pruefe:datenbank`: das Skript
arbeitet gegen das echte Projekt, legt einen Prüfdienst `__pruefung` an, schreibt eine
Messung, überschreibt eine Tagesbilanz, legt einen Vorfall mit Meldung an, sucht ihn mit
**genau der Abfrage wieder, die auch der Wächter benutzt** - und räumt alles restlos weg,
auch wenn unterwegs etwas schiefgeht. Mit gesetztem `SUPABASE_ANON_KEY` weist es
zusätzlich nach, dass mit dem öffentlichen Schlüssel niemand an die Daten kommt.

Einmal laufen lassen, sobald das Projekt steht.

### Rauchtest, sobald die Datenbank steht

1. Einen Testdienst eintragen, dessen URL du an- und abschalten kannst.
2. `curl -H "Authorization: Bearer $CRON_SECRET" $STATUS_URL/api/check` - die Antwort
   listet je Dienst `ok`, `response_ms`, `status` und `action`.
3. URL abschalten, dreimal aufrufen. Nach dem dritten Mal muss `action` auf
   `vorfall_anlegen` springen, der Vorfall auf `/` stehen und die Telegram-Nachricht da sein.
4. URL wieder anschalten, dreimal aufrufen. Nach dem dritten Mal muss `action` auf
   `vorfall_schliessen` springen und der Vorfall als behoben dastehen.
5. In `daily_uptime` nachsehen, ob `checks`, `failed` und `uptime` zu dem passen, was
   wirklich passiert ist.

Wenn Schritt 3 oder 4 nicht so ausgeht, stimmt die Datenbankanbindung nicht - die
Entscheidungslogik dahinter ist durch die Tests abgedeckt.

## Einrichten

1. **Eigenes Supabase-Projekt anlegen** (nicht das von Scooly!) und
   `supabase/schema.sql` im SQL-Editor ausführen. Danach `npm run pruefe:datenbank`.

   Warum getrennt: Läge die Status-Seite auf Scoolys Datenbank, könnte sie bei einer
   Supabase-Störung ihre eigenen Messdaten nicht mehr lesen - sie würde also genau dann
   schweigen, wenn alle draufschauen. Dazu käme, dass der Service-Role-Key (der die
   Zugriffskontrolle komplett aushängt) dann in zwei Anwendungen läge.

   Einstellungen im Dashboard: **Data API an** - die braucht `supabase-js`. Die beiden
   anderen Haken sind egal, weil das Schema es selbst regelt: Es schaltet RLS auf allen
   sechs Tabellen ein, definiert bewusst keine Policy, entzieht `anon` und
   `authenticated` alle Rechte und setzt die Standardrechte so, dass auch später
   angelegte Tabellen nicht öffentlich lesbar sind.

   `npm run pruefe:datenbank` weist das mit gesetztem `SUPABASE_ANON_KEY` nach.
2. `.env.example` nach `.env.local` kopieren und ausfüllen.
3. Bei Vercel deployen (Repo: `eliasconrad/scooly-status`), Domain `status.scooly.dev`
   verbinden.
4. In den GitHub-Secrets `CRON_SECRET` und `STATUS_URL` hinterlegen -
   dann läuft `.github/workflows/waechter.yml` von selbst.

### Noch offen: die Health-Endpunkte in Scooly

Die Seed-Daten in `supabase/schema.sql` zeigen auf `https://scooly.dev/api/health/*`.
**Diese Endpunkte gibt es in ScoolyAi noch nicht** - solange sie fehlen, meldet der Wächter
alles außer der Startseite als Ausfall. Pro Dienst reicht eine kleine Route, die genau das
prüft, wofür der Dienst steht:

```ts
// app/api/health/db/route.ts in ScoolyAi
export async function GET() {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200 });
}
```

Wichtig: Ein Health-Endpunkt darf nur melden, was er wirklich geprüft hat. Eine Route, die
immer 200 zurückgibt, macht die ganze Status-Page wertlos.

## Was bewusst anders ist als beim Original

| | Original | Hier |
|---|---|---|
| Wortmarke | "Claude Status" als Grafik | Scooly-Marke + Schriftzug |
| Sprache | Englisch | Deutsch |
| Statusband | Zeitstempelzeile bleibt leer | zeigt "Zuletzt geprüft vor X Minuten" (Band dadurch 8 px höher) |
| Kalenderwoche | beginnt Sonntag | beginnt Montag |
| Balkenfarben | Originalformel unbekannt | aus den gerenderten `fill`-Werten rekonstruiert, siehe `src/lib/uptime.ts` |

### Zur Schrift

Die Originalseite lädt **keine eigene Schrift**. Ihr Stack ist
`"Atlassian Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`, und Atlassian Sans ist
weder installiert noch als `@font-face` eingebunden - der einzige geladene Webfont ist
FontAwesome für die Statussymbole. Gemessen: derselbe Text ist mit und ohne Atlassian Sans
im Stack exakt 220,84 px breit. Was man dort sieht, ist also **Helvetica Neue**.

Deshalb steht hier derselbe Stack statt eines Ersatz-Webfonts. Das ist nicht "so ähnlich",
das ist dieselbe Darstellung - und ganz ohne Schrift-Download.

## Favicon

`src/app/icon.svg` - das kleine `s` aus dem `scooly`-Schriftzug, auf drei Querbalken und
zwei Verbinder heruntergebrochen. Kantig, keine Rundungen. Dieselbe Zeichnung sitzt als
Kachel in der Kopfzeile, damit Reiter und Seite zusammenpassen.

## Stack

Next.js 16 · Tailwind 4 · shadcn/ui (Tooltip, Dialog) · motion · lenis · lucide-react ·
@fontsource-variable/inter · Supabase
