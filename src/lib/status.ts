import { demoData, lastNDays } from "./demo";
import { hasDatabase, supabase } from "./supabase";
import { overallUptime } from "./uptime";
import type {
  ComponentStatus,
  Incident,
  Service,
  ServiceStatus,
  StatusPageData,
  UptimeDay,
} from "./types";

/** Wie viele Tage die Startseite an Vorfällen zeigt (Original: 15). */
export const INCIDENT_DAYS_ON_HOME = 15;

/**
 * Ohne Datenbank läuft die Seite mit Demodaten - aber nur lokal.
 * In der Produktion wäre eine grüne Seite ohne echte Messung eine Lüge,
 * deshalb fliegt dort lieber ein Fehler.
 */
function demoAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.STATUS_DEMO === "1";
}

export async function getStatusPageData(incidentDays = INCIDENT_DAYS_ON_HOME): Promise<StatusPageData> {
  const db = supabase();
  if (!db) {
    if (demoAllowed()) return demoData();
    throw new Error(
      "Keine Datenbank angebunden. SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen, " +
        "oder STATUS_DEMO=1 für Demodaten.",
    );
  }

  const days = lastNDays(90);
  const since = days[0];

  const [servicesRes, uptimeRes, incidentsRes, lastCheckRes] = await Promise.all([
    db.from("services").select("*").eq("active", true).order("sort_order"),
    db.from("daily_uptime").select("*").gte("day", since),
    db
      .from("incidents")
      .select("*, incident_updates(*)")
      .gte("started_at", isoDaysAgo(incidentDays))
      .order("started_at", { ascending: false }),
    db.from("checks").select("checked_at").order("checked_at", { ascending: false }).limit(1),
  ]);

  if (servicesRes.error) throw servicesRes.error;
  if (uptimeRes.error) throw uptimeRes.error;
  if (incidentsRes.error) throw incidentsRes.error;

  const uptimeBySlug = new Map<string, Map<string, UptimeDay>>();
  for (const row of uptimeRes.data ?? []) {
    const slug = row.service_slug as string;
    if (!uptimeBySlug.has(slug)) uptimeBySlug.set(slug, new Map());
    uptimeBySlug.get(slug)!.set(row.day as string, {
      day: row.day as string,
      uptime: row.uptime === null ? null : Number(row.uptime),
      checks: Number(row.checks ?? 0),
      downtime_minutes: Number(row.downtime_minutes ?? 0),
    });
  }

  const services: ServiceStatus[] = (servicesRes.data ?? []).map((row) => {
    const service = toService(row);
    const byDay = uptimeBySlug.get(service.slug);
    const dayRows: UptimeDay[] = days.map(
      (day) => byDay?.get(day) ?? { day, uptime: null, checks: 0, downtime_minutes: 0 },
    );
    return {
      service,
      status: (row.status ?? "operational") as ComponentStatus,
      days: dayRows,
      uptime90: overallUptime(dayRows),
    };
  });

  return {
    services,
    incidents: (incidentsRes.data ?? []).map(toIncident),
    last_checked_at: lastCheckRes.data?.[0]?.checked_at ?? null,
    demo: false,
  };
}

/** Für /history - alle Vorfälle eines Monats. */
export async function getIncidentHistory(months = 3): Promise<Incident[]> {
  const db = supabase();
  if (!db) {
    if (demoAllowed()) return demoData().incidents;
    throw new Error("Keine Datenbank angebunden.");
  }
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months);
  const { data, error } = await db
    .from("incidents")
    .select("*, incident_updates(*)")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toIncident);
}

export function hasRealData(): boolean {
  return hasDatabase();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

type Row = Record<string, unknown>;

function toService(row: Row): Service {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    probe_url: (row.probe_url as string | null) ?? null,
    degraded_ms: Number(row.degraded_ms ?? 3000),
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active ?? true),
  };
}

function toIncident(row: Row): Incident {
  const updates = ((row.incident_updates as Row[]) ?? [])
    .map((u) => ({
      id: String(u.id),
      status: u.status as Incident["status"],
      body: String(u.body),
      created_at: String(u.created_at),
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    id: String(row.id),
    title: String(row.title),
    impact: row.impact as Incident["impact"],
    status: row.status as Incident["status"],
    started_at: String(row.started_at),
    resolved_at: (row.resolved_at as string | null) ?? null,
    automatic: Boolean(row.automatic),
    service_slugs: (row.service_slugs as string[]) ?? [],
    updates,
  };
}
