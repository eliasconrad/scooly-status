import { DEFAULT_SERVICES } from "./services";
import { overallUptime } from "./uptime";
import { incidentsByDay } from "./vorfaelle";
import type { Incident, RelatedIncident, StatusPageData, UptimeDay } from "./types";

/**
 * Demodaten für die lokale Entwicklung, solange keine Datenbank hängt.
 * Deterministisch, damit Server und Browser dasselbe rendern und die Balken
 * beim Neuladen nicht springen.
 */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function lastNDays(n: number, today = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

function demoDays(slug: string, days: string[], proTag: Map<string, RelatedIncident[]>): UptimeDay[] {
  return days.map((day) => {
    const r = hash(`${slug}:${day}`);
    let uptime = 1;
    let anteilAusfall = 1; // wie viel davon war echter Ausfall statt nur zäh
    if (r > 0.93) uptime = 0.94 + hash(`a${slug}${day}`) * 0.05;
    else if (r > 0.84) {
      uptime = 0.985 + hash(`b${slug}${day}`) * 0.012;
      anteilAusfall = 0;
    } else if (r > 0.7) {
      uptime = 0.9975 + hash(`c${slug}${day}`) * 0.0024;
      anteilAusfall = 0;
    }
    const fehlminuten = Math.round((1 - uptime) * 24 * 60);
    return {
      day,
      uptime,
      checks: 288,
      downtime_minutes: Math.round(fehlminuten * anteilAusfall),
      degraded_minutes: Math.round(fehlminuten * (1 - anteilAusfall) * 2),
      incidents: proTag.get(`${slug}:${day}`) ?? [],
    };
  });
}

const DEMO_INCIDENTS: Incident[] = [
  {
    id: "demo-1",
    title: "Karteikarten wurden langsamer erstellt",
    impact: "minor",
    status: "resolved",
    started_at: daysAgo(2, 9, 12),
    resolved_at: daysAgo(2, 11, 4),
    automatic: true,
    service_slugs: ["scooly-ki"],
    updates: [
      {
        id: "demo-1-c",
        status: "resolved",
        body: "Der Vorfall ist behoben. Die Erstellung läuft wieder in der gewohnten Zeit.",
        created_at: daysAgo(2, 11, 4),
      },
      {
        id: "demo-1-b",
        status: "monitoring",
        body: "Eine Lösung ist eingespielt, wir beobachten das Ergebnis.",
        created_at: daysAgo(2, 10, 20),
      },
      {
        id: "demo-1-a",
        status: "investigating",
        body: "Der Wächter hat drei Messungen hintereinander über dem Grenzwert gesehen. Wir schauen uns das an.",
        created_at: daysAgo(2, 9, 12),
      },
    ],
  },
  {
    id: "demo-2",
    title: "Anmeldung zeitweise nicht erreichbar",
    impact: "major",
    status: "resolved",
    started_at: daysAgo(6, 16, 41),
    resolved_at: daysAgo(6, 17, 8),
    automatic: true,
    service_slugs: ["scooly-anmeldung", "scooly-web"],
    updates: [
      {
        id: "demo-2-b",
        status: "resolved",
        body: "Die Anmeldung ist wieder erreichbar. Betroffener Zeitraum: 16:41 bis 17:08 UTC.",
        created_at: daysAgo(6, 17, 8),
      },
      {
        id: "demo-2-a",
        status: "investigating",
        body: "Wir untersuchen Fehler bei der Anmeldung. Bereits angemeldete Konten sind nicht betroffen.",
        created_at: daysAgo(6, 16, 41),
      },
    ],
  },
];

function daysAgo(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function demoData(): StatusPageData {
  const days = lastNDays(90);
  const proTag = incidentsByDay(DEMO_INCIDENTS);
  return {
    services: DEFAULT_SERVICES.map((service) => {
      const d = demoDays(service.slug, days, proTag);
      return {
        service,
        status: "operational" as const,
        days: d,
        uptime90: overallUptime(d),
      };
    }),
    incidents: DEMO_INCIDENTS,
    last_checked_at: new Date().toISOString(),
    demo: true,
  };
}
