import type { Service } from "./types";

/**
 * Die überwachten Dienste.
 *
 * Führend ist die Tabelle `services` in der Datenbank - diese Liste hier ist
 * der Seed dafür und gleichzeitig die Grundlage der Demodaten. Die Probe-URLs
 * kommen aus der Umgebung, damit derselbe Code gegen Vorschau und Produktion
 * laufen kann.
 */
export const DEFAULT_SERVICES: Service[] = [
  {
    id: "scooly-web",
    slug: "scooly-web",
    name: "Scooly (scooly.at)",
    probe_url: process.env.PROBE_SCOOLY_WEB ?? null,
    degraded_ms: 2500,
    sort_order: 1,
    active: true,
  },
  {
    id: "scooly-anmeldung",
    slug: "scooly-anmeldung",
    name: "Anmeldung & Konten",
    probe_url: process.env.PROBE_SCOOLY_AUTH ?? null,
    degraded_ms: 2500,
    sort_order: 2,
    active: true,
  },
  {
    id: "scooly-app",
    slug: "scooly-app",
    name: "Scooly App (iPhone & iPad)",
    probe_url: process.env.PROBE_SCOOLY_APP ?? null,
    degraded_ms: 3000,
    sort_order: 3,
    active: true,
  },
  {
    id: "scooly-ki",
    slug: "scooly-ki",
    name: "Aufgaben, Quiz & Karteikarten",
    probe_url: process.env.PROBE_SCOOLY_KI ?? null,
    degraded_ms: 12000,
    sort_order: 4,
    active: true,
  },
  {
    id: "scooly-handschrift",
    slug: "scooly-handschrift",
    name: "Handschrift-Erkennung",
    probe_url: process.env.PROBE_SCOOLY_OCR ?? null,
    degraded_ms: 15000,
    sort_order: 5,
    active: true,
  },
  {
    id: "scooly-daten",
    slug: "scooly-daten",
    name: "Datenbank & Dateien",
    probe_url: process.env.PROBE_SCOOLY_DB ?? null,
    degraded_ms: 2000,
    sort_order: 6,
    active: true,
  },
];
