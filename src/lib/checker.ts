import { notifySubscribers } from "./mail";
import { supabase } from "./supabase";
import { notifyTelegram } from "./telegram";
import { STATUS_LABEL } from "./uptime";
import type { ComponentStatus, IncidentImpact, Service } from "./types";

/** Wie viele Messungen hintereinander schiefgehen müssen, bevor ein Vorfall entsteht. */
const FAIL_STREAK = 3;
/** Wie viele saubere Messungen es braucht, damit ein Vorfall automatisch schließt. */
const RECOVER_STREAK = 3;
/** Abstand zwischen zwei Messungen in Minuten - bestimmt die Ausfallminuten. */
const INTERVAL_MINUTES = Number(process.env.CHECK_INTERVAL_MINUTES ?? 5);
/** Nach dieser Zeit gilt eine Messung als fehlgeschlagen. */
const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS ?? 20000);

type Probe = {
  ok: boolean;
  degraded: boolean;
  status_code: number | null;
  response_ms: number;
  error: string | null;
};

export type CheckReport = {
  slug: string;
  probe: Probe;
  statusBefore: ComponentStatus;
  statusAfter: ComponentStatus;
  action: "none" | "incident_opened" | "incident_resolved" | "incident_escalated";
};

/** Einen Dienst anpingen. Alles außer 2xx/3xx zählt als Ausfall. */
async function probe(service: Service): Promise<Probe> {
  if (!service.probe_url) {
    return { ok: true, degraded: false, status_code: null, response_ms: 0, error: null };
  }

  const started = Date.now();
  try {
    const res = await fetch(service.probe_url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "scooly-status-waechter/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const response_ms = Date.now() - started;
    const ok = res.status < 400;
    return {
      ok,
      degraded: ok && response_ms > service.degraded_ms,
      status_code: res.status,
      response_ms,
      error: ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      degraded: false,
      status_code: null,
      response_ms: Date.now() - started,
      error: err instanceof Error ? err.message : "Unbekannter Fehler",
    };
  }
}

/**
 * Ein kompletter Durchlauf: messen, wegschreiben, Tagesbilanz nachziehen,
 * und den Zustand jedes Dienstes neu bewerten.
 */
export async function runChecks(): Promise<CheckReport[]> {
  const db = supabase();
  if (!db) throw new Error("Keine Datenbank angebunden.");

  const { data: rows, error } = await db
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;

  const reports: CheckReport[] = [];

  for (const row of rows ?? []) {
    const service: Service = {
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      probe_url: (row.probe_url as string | null) ?? null,
      degraded_ms: Number(row.degraded_ms ?? 3000),
      sort_order: Number(row.sort_order ?? 0),
      active: true,
    };
    const statusBefore = (row.status ?? "operational") as ComponentStatus;

    // Dienste ohne Probe-URL pflegt nur ein Mensch - die fasst der Wächter nicht an.
    if (!service.probe_url) continue;

    const result = await probe(service);
    const now = new Date();

    await db.from("checks").insert({
      service_slug: service.slug,
      checked_at: now.toISOString(),
      ok: result.ok,
      degraded: result.degraded,
      status_code: result.status_code,
      response_ms: result.response_ms,
      error: result.error,
    });

    await rollUpDay(service.slug, now);

    const { statusAfter, action } = await evaluate(service, statusBefore, result);
    reports.push({ slug: service.slug, probe: result, statusBefore, statusAfter, action });
  }

  return reports;
}

/** Tagesbilanz aus den Rohmessungen neu rechnen und speichern. */
async function rollUpDay(slug: string, when: Date): Promise<void> {
  const db = supabase()!;
  const day = when.toISOString().slice(0, 10);
  const from = `${day}T00:00:00.000Z`;
  const to = `${day}T23:59:59.999Z`;

  const { data, error } = await db
    .from("checks")
    .select("ok, degraded")
    .eq("service_slug", slug)
    .gte("checked_at", from)
    .lte("checked_at", to);
  if (error || !data) return;

  const checks = data.length;
  const failed = data.filter((c) => !c.ok).length;
  const degraded = data.filter((c) => c.ok && c.degraded).length;

  // Beeinträchtigte Messungen zählen halb - die Seite war erreichbar, nur zäh.
  const uptime = checks === 0 ? 1 : (checks - failed - degraded * 0.5) / checks;

  await db.from("daily_uptime").upsert(
    {
      service_slug: slug,
      day,
      checks,
      failed,
      degraded,
      uptime: Number(uptime.toFixed(6)),
      downtime_minutes: failed * INTERVAL_MINUTES,
    },
    { onConflict: "service_slug,day" },
  );
}

/**
 * Kernstück: aus den letzten Messungen einen Zustand ableiten und daraus
 * Vorfälle öffnen, verschärfen oder schließen.
 */
async function evaluate(
  service: Service,
  statusBefore: ComponentStatus,
  latest: Probe,
): Promise<{ statusAfter: ComponentStatus; action: CheckReport["action"] }> {
  const db = supabase()!;

  const { data: recent } = await db
    .from("checks")
    .select("ok, degraded, error")
    .eq("service_slug", service.slug)
    .order("checked_at", { ascending: false })
    .limit(Math.max(FAIL_STREAK, RECOVER_STREAK));

  const window = recent ?? [];
  const downStreak = window.slice(0, FAIL_STREAK);
  const isDown = downStreak.length === FAIL_STREAK && downStreak.every((c) => !c.ok);
  const isSlow =
    !isDown &&
    downStreak.length === FAIL_STREAK &&
    downStreak.every((c) => c.ok && c.degraded);

  const recoverWindow = window.slice(0, RECOVER_STREAK);
  const isHealthy =
    recoverWindow.length === RECOVER_STREAK && recoverWindow.every((c) => c.ok && !c.degraded);

  const statusAfter: ComponentStatus = isDown
    ? "major_outage"
    : isSlow
      ? "degraded_performance"
      : isHealthy
        ? "operational"
        : statusBefore;

  // Offener, automatisch angelegter Vorfall für diesen Dienst?
  const { data: openIncidents } = await db
    .from("incidents")
    .select("*")
    .is("resolved_at", null)
    .eq("automatic", true)
    .contains("service_slugs", [service.slug])
    .order("started_at", { ascending: false })
    .limit(1);
  const open = openIncidents?.[0] ?? null;

  let action: CheckReport["action"] = "none";

  if ((isDown || isSlow) && !open) {
    const impact: IncidentImpact = isDown ? "major" : "minor";
    const title = isDown
      ? `${service.name} ist nicht erreichbar`
      : `${service.name} antwortet langsam`;
    const body = isDown
      ? `Der Wächter hat ${FAIL_STREAK} Messungen hintereinander ohne Antwort gesehen${
          latest.error ? ` (${latest.error})` : ""
        }. Wir schauen uns das an.`
      : `Der Wächter hat ${FAIL_STREAK} Messungen hintereinander über ${service.degraded_ms} ms gesehen. Die Funktion ist erreichbar, aber langsam.`;

    const { data: inserted } = await db
      .from("incidents")
      .insert({
        title,
        impact,
        status: "investigating",
        started_at: new Date().toISOString(),
        automatic: true,
        service_slugs: [service.slug],
      })
      .select()
      .single();

    if (inserted) {
      await db
        .from("incident_updates")
        .insert({ incident_id: inserted.id, status: "investigating", body });
      action = "incident_opened";
      await announce(`🔴 ${title}`, body);
    }
  } else if (isDown && open && open.impact === "minor") {
    // Aus "langsam" ist ein echter Ausfall geworden.
    await db.from("incidents").update({ impact: "major", status: "identified" }).eq("id", open.id);
    await db.from("incident_updates").insert({
      incident_id: open.id,
      status: "identified",
      body: `${service.name} antwortet inzwischen gar nicht mehr${
        latest.error ? ` (${latest.error})` : ""
      }.`,
    });
    action = "incident_escalated";
    await announce(`🔴 ${service.name}: aus langsam wurde ein Ausfall`, "");
  } else if (isHealthy && open) {
    const startedAt = new Date(open.started_at as string);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000));
    const body = `Der Vorfall ist behoben. ${service.name} läuft seit ${RECOVER_STREAK} Messungen wieder normal. Dauer: rund ${minutes} Minuten.`;

    await db
      .from("incidents")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", open.id);
    await db.from("incident_updates").insert({
      incident_id: open.id,
      status: "resolved",
      body,
    });
    action = "incident_resolved";
    await announce(`🟢 ${open.title as string} - behoben`, body);
  }

  if (statusAfter !== statusBefore) {
    await db.from("services").update({ status: statusAfter }).eq("slug", service.slug);
    if (action === "none") {
      await notifyTelegram(
        `<b>${service.name}</b>\n${STATUS_LABEL[statusBefore]} → ${STATUS_LABEL[statusAfter]}`,
      );
    }
  }

  return { statusAfter, action };
}

async function announce(subject: string, body: string): Promise<void> {
  await notifyTelegram(`<b>${subject}</b>${body ? `\n${body}` : ""}`);
  await notifySubscribers(subject, body || subject);
}
