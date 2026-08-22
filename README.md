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
| Schrift | Atlassian Sans (lizenziert) | Inter Variable, self-hosted - nächstliegender freier Ersatz |
| Wortmarke | "Claude Status" als Grafik | Scooly-Marke + Schriftzug |
| Sprache | Englisch | Deutsch |
| Statusband | Zeitstempelzeile bleibt leer | zeigt "Zuletzt geprüft vor X Minuten" (Band dadurch 8 px höher) |
| Balkenfarben | Originalformel unbekannt | aus den gerenderten `fill`-Werten rekonstruiert, siehe `src/lib/uptime.ts` |

## Stack

Next.js 16 · Tailwind 4 · shadcn/ui (Tooltip, Dialog) · motion · lenis · lucide-react ·
@fontsource-variable/inter · Supabase
