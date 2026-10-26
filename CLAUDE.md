@AGENTS.md

# Scooly Status

> Projektbriefing für Claude Code und den Aufgaben-Bot, angelegt am 26.10.2026 aus dem Code und den
> Projektdateien. Was nicht belegt ist, steht als „unklar“. Vor dem Handeln Behauptungen mit `grep`/`ls`
> prüfen - Dateien ändern sich schneller als dieses Briefing.

## Zweck, Nutzer, Status

- **Zweck:** Status-Seite für Scooly (Nachbau von status.claude.com) mit eigenem Wächter, der alle 5 Minuten per GitHub Action prüft.
- **Zielnutzer:** Nutzer von Scooly bei Störungen; Elias über Telegram/Mail-Meldungen.
- **Status:** gebaut, Ziel-Domain status.scooly.dev (ob live: unklar)
- **Live/Vorschau:** status.scooly.dev (Ziel)
- **Deploy:** Vercel-Projekt `scooly-status`; Wächter `.github/workflows/waechter.yml`.
- **Git:** Branch `main`, Remote `github.com/eliasconrad/scooly-status`. Neue Arbeit immer auf eigenem Branch, nie direkt auf `main`.

## Zuerst lesen

- README.md

## Stack

- Next.js 16.3.2, React 19.2.8
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui (Bausteine als eigener Code)
- Supabase (JS 2.112.3)
- außerdem motion, lucide-react

## Befehle (Prüfstand 26.10.2026)

| Wofür | Befehl | Ergebnis beim Prüflauf |
|---|---|---|
| Entwicklungsserver | `npm run dev` → `next dev -p 3005` | - |
| Produktions-Build | `npm run build` → `next build` | ⚠ in der Claude-Sandbox nicht prüfbar (Port/Prozess gesperrt) - außerhalb erneut prüfen |
| Lint | `npm run lint` | ✓ (3 s) |
| Tests | `npm run test` → `tsx --test tests/*.test.ts` | ⚠ in der Claude-Sandbox nicht prüfbar (Port/Prozess gesperrt) - außerhalb erneut prüfen |

Ports: 3005.

## Struktur

- `public/` - statische Dateien (Bilder, Schriften, robots.txt)
- `scripts/` - Hilfsskripte - vor dem Ausführen lesen
- `src/app/` - Seiten und API-Routen (Next.js App Router)
- `src/components/` - Bausteine
- `src/lib/` - Logik, Hilfsfunktionen
- `supabase/` - Datenbank: Migrationen, Funktionen
- `tests/` - Tests

## Umgebungsvariablen (nur Namen)

Quelle: `.env.example`. Werte stehen lokal in `.env*`/`.dev.vars` oder bei Elias - nie ausgeben, nie committen.

`CHECK_INTERVAL_MINUTES`, `CHECK_TIMEOUT_MS`, `CRON_SECRET`, `IP_SALT`, `MAIL_MAX_PRO_TAG`, `MELDE_FENSTER_MINUTEN`, `PROBE_ZUGANG`, `PUBLIC_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## Design-Regeln

- Schriftstack wie das Original (Helvetica Neue), kein Webfont.
- Kein Lila/Violett/Indigo als Marken- oder Signalfarbe (Fachfarben ausgenommen), keine Schrift ohne Entscheidung - für Scooly ist die Systemschrift SF Pro entschieden.

## Scooly-Marke - einheitlich halten

- **Quelle der Wahrheit:** `~/Downloads/Scooly/scooly-neue-oberflaeche/Quellen/Design/` (Farben, Maße, Bewegung, Textstile) und die Figma-Bibliothek „Scooly Design System“; für das Web gespiegelt in `~/Downloads/Scooly/ScoolyAi/app/marke.css`.
- **Stand dieses Repos:** Bewusst der Look von status.claude.com (`--sp-*` in `src/app/globals.css`, Helvetica-Stapel) - nicht die App-Marke.
- **Regel:** Neue oder geänderte Oberflächen nehmen die Werte der Quelle. Bestehende Abweichungen nicht weiter ausbauen, sondern im Bericht melden; das Angleichen ist ein eigener Auftrag.

## Nicht anfassen ohne Rückfrage

- Eigene Supabase-Instanz bewusst getrennt von ScoolyAi - nicht zusammenlegen.
- Wächter-Takt und Schwellen (3 Fehlmessungen) nicht ändern ohne Rückfrage.
- Kein `git push`, kein Deploy (`vercel`, `wrangler deploy`, `eas`, TestFlight), kein Merge auf `main` - nur nach ausdrücklichem Ja von Elias.
- Keine echten Schlüssel in Dateien, Commits oder Chat; `.env*` nie anzeigen oder committen.
- Keine echten Nutzer- oder Kundendaten anlegen, ändern oder löschen; nur Testkonten und Testdaten.
- Nie `git add -A` oder `git add .` - Elias arbeitet oft mit einer zweiten Sitzung im selben Repo.

## Tests - was abgedeckt ist und was nicht

- Abgedeckt: 18 Testdateien in `tests/` (Bewertung, Störung, Versand, Kontingent, Schema, Routen, Zugang …); laut Notiz 145 Tests, gegen absichtliche Fehler gegengeprüft.
- Nicht abgedeckt: der Wächter-Lauf als GitHub Action und echte Mail-/Telegram-Zustellung.
- Prüflauf 26.10.2026: lint ✓ · test und build ⚠ in der Sandbox nicht prüfbar (tsx/Turbopack brauchen Ports).

## Testvorgehen

1. `npm run lint` → `npm run test` → `npm run build` (alle grün, sonst nicht fertig; `npm run build` zählt, nicht der Typecheck allein).
2. Nutzerwege durchklicken:
   - /, /uptime, /history, /abo, /history.atom
3. Größen: 390, 768, 1280 und 1440 px; kein waagerechtes Scrollen.
4. Bericht: geänderte Dateien, Befehle mit Ergebnis, Bildschirmfotos, was nicht ging und warum.
