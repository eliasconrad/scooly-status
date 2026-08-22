import type { Service } from "./types";

/**
 * Rückfallliste der Dienste.
 *
 * **Führend ist die Tabelle `services` in der Datenbank** - dort stehen auch
 * die Probe-URLs, und nur von dort liest der Wächter. Diese Liste hier dient
 * ausschließlich den Demodaten und dem Fall, dass die Tabelle noch leer ist.
 *
 * Bewusst ohne Probe-URLs: Zwei Orte für dieselbe Einstellung wären eine
 * Falle - man setzt eine Umgebungsvariable, es ändert sich nichts, und
 * niemand versteht warum.
 */
export const DEFAULT_SERVICES: Service[] = [
  {
    slug: "scooly-web", name: "Scooly (scooly.dev)", degraded_ms: 2500, sort_order: 1,
    wirkung_ausfall: "Scooly lässt sich gerade nicht öffnen.",
    wirkung_langsam: "Scooly lädt gerade langsam.",
  },
  {
    slug: "scooly-anmeldung", name: "Anmeldung & Konten", degraded_ms: 2500, sort_order: 2,
    wirkung_ausfall:
      "Anmelden und Registrieren geht gerade nicht. Wer schon angemeldet ist, kann normal weiterarbeiten.",
    wirkung_langsam: "Das Anmelden dauert gerade länger als sonst.",
  },
  {
    slug: "scooly-app", name: "Scooly App (iPhone & iPad)", degraded_ms: 3000, sort_order: 3,
    wirkung_ausfall:
      "Die App auf iPhone und iPad kann gerade nichts laden. Bereits geladene Inhalte bleiben sichtbar.",
    wirkung_langsam: "Die App auf iPhone und iPad reagiert gerade träge.",
  },
  {
    slug: "scooly-ki", name: "Scooly KI (Aufgaben, Quiz, Karteikarten)", degraded_ms: 12000, sort_order: 4,
    wirkung_ausfall:
      "Neue Aufgaben, Quizze und Karteikarten lassen sich gerade nicht erstellen. Was schon da ist, kannst du weiter lernen.",
    wirkung_langsam: "Neue Aufgaben, Quizze und Karteikarten brauchen gerade deutlich länger.",
  },
  {
    slug: "scooly-handschrift", name: "Handschrift-Erkennung", degraded_ms: 15000, sort_order: 5,
    wirkung_ausfall:
      "Fotos und Handschrift werden gerade nicht erkannt. Hochladen kannst du trotzdem, die Erkennung holt es nach.",
    wirkung_langsam: "Die Handschrift-Erkennung braucht gerade länger als sonst.",
  },
  {
    slug: "scooly-daten", name: "Datenbank & Dateien", degraded_ms: 2000, sort_order: 6,
    wirkung_ausfall: "Speichern und Laden geht gerade nicht. Schreib nichts Wichtiges, es könnte verlorengehen.",
    wirkung_langsam: "Speichern und Laden dauert gerade länger.",
  },
].map((s) => ({ ...s, id: s.slug, probe_url: null, active: true }));
