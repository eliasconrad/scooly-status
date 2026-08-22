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
  { slug: "scooly-web", name: "Scooly (scooly.dev)", degraded_ms: 2500, sort_order: 1 },
  { slug: "scooly-anmeldung", name: "Anmeldung & Konten", degraded_ms: 2500, sort_order: 2 },
  { slug: "scooly-app", name: "Scooly App (iPhone & iPad)", degraded_ms: 3000, sort_order: 3 },
  { slug: "scooly-ki", name: "Aufgaben, Quiz & Karteikarten", degraded_ms: 12000, sort_order: 4 },
  { slug: "scooly-handschrift", name: "Handschrift-Erkennung", degraded_ms: 15000, sort_order: 5 },
  { slug: "scooly-daten", name: "Datenbank & Dateien", degraded_ms: 2000, sort_order: 6 },
].map((s) => ({ ...s, id: s.slug, probe_url: null, active: true }));
