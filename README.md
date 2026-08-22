# Scooly Status

Nachbau von [status.claude.com](https://status.claude.com) - Layout, Abstände, Farben und
Typo-Größen sind direkt aus der gerenderten Seite ausgemessen (22.08.2026). Das Original ist
eine gemietete **Atlassian Statuspage**; deshalb sieht es bei vielen Firmen gleich aus.

Bewusst ein **eigenes Projekt mit eigenem Deployment**: Eine Status-Page, die auf derselben
Infrastruktur liegt wie das, was sie überwacht, ist genau dann weg, wenn man sie braucht.

```
Start:  npm run dev     → http://localhost:3005
Bauen:  npm run build
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
/abo                  Rückmeldung nach dem Bestätigungslink aus der E-Mail
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

## Einrichten

1. **Eigenes Supabase-Projekt anlegen** (nicht das von Scooly!) und
   `supabase/schema.sql` im SQL-Editor ausführen.
2. `.env.example` nach `.env.local` kopieren und ausfüllen.
3. Bei Vercel deployen, Domain `status.scooly.at` verbinden.
4. In den GitHub-Secrets `CRON_SECRET` und `STATUS_URL` hinterlegen -
   dann läuft `.github/workflows/waechter.yml` von selbst.

### Noch offen: die Health-Endpunkte in Scooly

Die Seed-Daten in `supabase/schema.sql` zeigen auf `https://scooly.at/api/health/*`.
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

## Stack

Next.js 16 · Tailwind 4 · shadcn/ui (Tooltip, Dialog) · motion · lenis · lucide-react ·
@fontsource-variable/inter · Supabase
