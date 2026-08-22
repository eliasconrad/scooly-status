import { supabase } from "./supabase";
import { overallUptime } from "./uptime";
import { incidentsByDay } from "./vorfaelle";
import type { Incident, RelatedIncident, Service, UptimeDay } from "./types";

/** Ein Blatt zeigt drei Monate - wie beim Original. */
export const MONTHS_PER_PAGE = 3;

const MONAT = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export type MonthRef = { year: number; month: number };

/**
 * Blatt 1 endet mit dem laufenden Monat, Blatt 2 mit dem Monat davor usw.
 * Zurückgegeben wird chronologisch aufsteigend.
 */
export function monthsForPage(page: number, today = new Date()): MonthRef[] {
  const end = today.getUTCMonth() - (page - 1) * MONTHS_PER_PAGE;
  const out: MonthRef[] = [];
  for (let i = MONTHS_PER_PAGE - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), end - i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }
  return out;
}

export function monthName(ref: MonthRef): string {
  return `${MONAT[ref.month]} ${ref.year}`;
}

/** "Juni 2026 bis August 2026" für die Blätterung. */
export function pageLabel(months: MonthRef[]): string {
  if (months.length === 0) return "";
  return `${monthName(months[0])} bis ${monthName(months[months.length - 1])}`;
}

export type CalendarCell = { tag: UptimeDay; future: boolean } | null;

export type CalendarMonth = {
  ref: MonthRef;
  label: string;
  uptime: number | null;
  /** Erste Zellen können null sein - Platzhalter bis zum ersten Wochentag. */
  cells: CalendarCell[];
};

/**
 * Baut ein Monatsgitter. Anders als beim Original beginnt die Woche am
 * Montag - eine deutsche Seite mit Sonntag-Start wäre schlicht falsch.
 */
export function buildMonth(
  ref: MonthRef,
  byDay: Map<string, UptimeDay>,
  today = new Date(),
  vorfaelleProTag: Map<string, RelatedIncident[]> = new Map(),
  slug = "",
): CalendarMonth {
  const first = new Date(Date.UTC(ref.year, ref.month, 1));
  const daysInMonth = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();

  // getUTCDay(): 0 = Sonntag. Auf Montag-erst umrechnen.
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: CalendarCell[] = Array.from({ length: lead }, () => null);

  const todayIso = today.toISOString().slice(0, 10);
  const measured: UptimeDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${ref.year}-${String(ref.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const row = byDay.get(iso);
    if (row) measured.push(row);
    const tag: UptimeDay = row ?? {
      day: iso,
      uptime: null,
      checks: 0,
      downtime_minutes: 0,
      degraded_minutes: 0,
      avg_response_ms: null,
      max_response_ms: null,
      top_error: null,
      incidents: [],
    };
    cells.push({
      tag: { ...tag, incidents: vorfaelleProTag.get(`${slug}:${iso}`) ?? tag.incidents },
      future: iso > todayIso,
    });
  }

  return { ref, label: monthName(ref), uptime: overallUptime(measured), cells };
}

export type UptimeCalendar = {
  services: Service[];
  selected: Service;
  months: CalendarMonth[];
  page: number;
  demo: boolean;
};

export async function getUptimeCalendar(slug: string | undefined, page: number): Promise<UptimeCalendar> {
  const months = monthsForPage(page);
  const from = `${months[0].year}-${String(months[0].month + 1).padStart(2, "0")}-01`;
  const last = months[months.length - 1];
  const to = new Date(Date.UTC(last.year, last.month + 1, 0)).toISOString().slice(0, 10);

  const db = supabase();

  if (!db) {
    if (process.env.NODE_ENV === "production" && process.env.STATUS_DEMO !== "1") {
      throw new Error("Keine Datenbank angebunden.");
    }
    const { demoData } = await import("./demo");
    const data = demoData();
    const services = data.services.map((s) => s.service);
    const selected = services.find((s) => s.slug === slug) ?? services[0];
    const byDay = new Map<string, UptimeDay>(
      (data.services.find((s) => s.service.slug === selected.slug)?.days ?? []).map((d) => [d.day, d]),
    );
    const proTag = incidentsByDay(data.incidents);
    return {
      services,
      selected,
      months: months.map((m) => buildMonth(m, byDay, new Date(), proTag, selected.slug)),
      page,
      demo: true,
    };
  }

  const { data: serviceRows, error } = await db
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;

  const services: Service[] = (serviceRows ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    probe_url: (row.probe_url as string | null) ?? null,
    degraded_ms: Number(row.degraded_ms ?? 3000),
    sort_order: Number(row.sort_order ?? 0),
    active: true,
  }));
  // Keine eingetragenen Dienste bedeutet: nichts wird gemessen. Ein Kalender
  // mit erfundenen Diensten wäre schlimmer als eine ehrliche Fehlermeldung.
  if (services.length === 0) {
    throw new Error("Es sind keine Dienste eingetragen, die überwacht werden.");
  }

  const selected = services.find((s) => s.slug === slug) ?? services[0];

  const { data: uptimeRows } = await db
    .from("daily_uptime")
    .select("*")
    .eq("service_slug", selected.slug)
    .gte("day", from)
    .lte("day", to);

  const { data: incidentRows } = await db
    .from("incidents")
    .select("id, title, impact, started_at, resolved_at, service_slugs")
    .lte("started_at", `${to}T23:59:59.999Z`)
    .or(`resolved_at.is.null,resolved_at.gte.${from}T00:00:00.000Z`);

  const proTag = incidentsByDay(
    (incidentRows ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      impact: row.impact as Incident["impact"],
      status: "resolved" as const,
      started_at: String(row.started_at),
      resolved_at: (row.resolved_at as string | null) ?? null,
      automatic: false,
      service_slugs: (row.service_slugs as string[]) ?? [],
      updates: [],
    })),
  );

  const byDay = new Map<string, UptimeDay>(
    (uptimeRows ?? []).map((row) => [
      row.day as string,
      {
        day: row.day as string,
        uptime: row.uptime === null ? null : Number(row.uptime),
        checks: Number(row.checks ?? 0),
        downtime_minutes: Number(row.downtime_minutes ?? 0),
        degraded_minutes: Number(row.degraded_minutes ?? 0),
        avg_response_ms: row.avg_response_ms === null ? null : Number(row.avg_response_ms),
        max_response_ms: row.max_response_ms === null ? null : Number(row.max_response_ms),
        top_error: (row.top_error as string | null) ?? null,
        incidents: [],
      },
    ]),
  );

  return {
    services,
    selected,
    months: months.map((m) => buildMonth(m, byDay, new Date(), proTag, selected.slug)),
    page,
    demo: false,
  };
}
