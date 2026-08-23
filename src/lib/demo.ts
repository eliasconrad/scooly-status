import { DEFAULT_SERVICES } from "./services";
import { overallUptime } from "./uptime";
import { incidentsByDay } from "./vorfaelle";
import type {
  ComponentStatus,
  Incident,
  RelatedIncident,
  StatusPageData,
  UptimeDay,
} from "./types";

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
    const grund = Math.round(hash(`e${slug}${day}`) * 3);
    const schnitt = 320 + Math.round(hash(`m${slug}${day}`) * 900);
    return {
      day,
      uptime,
      checks: 288,
      downtime_minutes: Math.round(fehlminuten * anteilAusfall),
      degraded_minutes: Math.round(fehlminuten * (1 - anteilAusfall) * 2),
      avg_response_ms: schnitt,
      max_response_ms: schnitt + Math.round(hash(`x${slug}${day}`) * 4000),
      top_error:
        fehlminuten === 0
          ? null
          : ["HTTP 502", "HTTP 500", "Keine Antwort nach 15000 ms", "fetch failed"][grund],
      incidents: proTag.get(`${slug}:${day}`) ?? [],
    };
  });
}

/**
 * Zwei laufende Störungen - eine zähe, eine ausgefallene.
 *
 * Die Demodaten zeigen bewusst den interessanten Zustand: den grünen Fall
 * sieht man ohnehin, sobald man `STATUS_DEMO_GRUEN=1` setzt. So lässt sich
 * lokal prüfen, ob wirklich dasteht, *was* schlechter läuft.
 */
const DEMO_INCIDENTS: Incident[] = [
  {
    id: "demo-offen-1",
    title: "Handschrift-Erkennung antwortet nicht",
    impact: "major",
    status: "identified",
    started_at: minutenHer(38),
    resolved_at: null,
    automatic: true,
    service_slugs: ["scooly-handschrift"],
    updates: [
      {
        id: "demo-offen-1-b",
        status: "identified",
        body:
          "Fotos und Handschrift werden gerade nicht erkannt. Hochladen kannst du trotzdem, " +
          "die Erkennung holt es nach. Die Ursache liegt beim Anbieter der Erkennung, " +
          "der auf jede Anfrage mit HTTP 502 antwortet.",
        created_at: minutenHer(21),
      },
      {
        id: "demo-offen-1-a",
        status: "investigating",
        body:
          "Der Wächter hat drei Messungen hintereinander ohne Antwort gesehen. Wir schauen uns das an.",
        created_at: minutenHer(38),
      },
    ],
  },
  {
    id: "demo-offen-2",
    title: "Neue Aufgaben und Quizze brauchen länger",
    impact: "minor",
    status: "monitoring",
    started_at: minutenHer(96),
    resolved_at: null,
    automatic: true,
    service_slugs: ["scooly-ki"],
    updates: [
      {
        id: "demo-offen-2-a",
        status: "monitoring",
        body:
          "Neue Aufgaben, Quizze und Karteikarten brauchen gerade deutlich länger. " +
          "Gemessen werden 18 Sekunden statt sonst unter 12. Erstellen funktioniert, " +
          "es dauert nur. Wir beobachten das.",
        created_at: minutenHer(74),
      },
    ],
  },
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

function minutenHer(minuten: number): string {
  return new Date(Date.now() - minuten * 60000).toISOString();
}

function daysAgo(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Wer in den Demodaten gerade Ärger hat - passend zu den offenen Vorfällen. */
const DEMO_ZUSTAND: Record<string, ComponentStatus> = {
  "scooly-handschrift": "major_outage",
  "scooly-ki": "degraded_performance",
};

/**
 * Die heutige Zeile so setzen, dass die Zahlen zur Störung passen.
 * Sonst stünde "Größerer Ausfall" über einem makellosen Messwert - genau
 * die Ratelücke, die diese Seite schließen soll.
 */
function heuteZurStoerung(zeile: UptimeDay, status: ComponentStatus, degradedMs: number): UptimeDay {
  if (status === "major_outage" || status === "partial_outage") {
    return {
      ...zeile,
      uptime: 0.974,
      downtime_minutes: 38,
      degraded_minutes: 0,
      top_error: "HTTP 502",
    };
  }
  if (status === "degraded_performance") {
    return {
      ...zeile,
      uptime: 1,
      downtime_minutes: 0,
      degraded_minutes: 96,
      avg_response_ms: Math.round(degradedMs * 1.5),
      max_response_ms: Math.round(degradedMs * 2.3),
      top_error: null,
    };
  }
  return zeile;
}

export function demoData(): StatusPageData {
  const alleGruen = process.env.STATUS_DEMO_GRUEN === "1";
  const days = lastNDays(90);
  const proTag = incidentsByDay(DEMO_INCIDENTS);
  return {
    services: DEFAULT_SERVICES.map((service) => {
      const d = demoDays(service.slug, days, proTag);
      const status = alleGruen
        ? ("operational" as ComponentStatus)
        : (DEMO_ZUSTAND[service.slug] ?? "operational");
      if (status !== "operational") {
        d[d.length - 1] = heuteZurStoerung(d[d.length - 1], status, service.degraded_ms);
      }
      return { service, status, days: d, uptime90: overallUptime(d) };
    }),
    incidents: alleGruen ? DEMO_INCIDENTS.filter((i) => i.resolved_at !== null) : DEMO_INCIDENTS,
    last_checked_at: new Date().toISOString(),
    demo: true,
  };
}
