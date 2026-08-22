import { bewerte, FAIL_STREAK, RECOVER_STREAK, type Messung } from "./bewertung";
import { notifySubscribers } from "./mail";
import { supabase } from "./supabase";
import { notifyTelegram } from "./telegram";
import { STATUS_LABEL } from "./uptime";
import type { ComponentStatus, IncidentImpact, Service } from "./types";

/** Abstand zwischen zwei Messungen in Minuten - bestimmt die Ausfallminuten. */
const INTERVAL_MINUTES = Number(process.env.CHECK_INTERVAL_MINUTES ?? 5);
/** Nach dieser Zeit gilt eine Messung als fehlgeschlagen. */
const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS ?? 15000);

export type Probe = {
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
  action: string;
};

/**
 * Einen Dienst anpingen. Alles außer 2xx/3xx zählt als Ausfall,
 * eine Antwort über dem Grenzwert des Dienstes als beeinträchtigt.
 */
export async function probe(service: Service): Promise<Probe> {
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
    // Antwortkörper verwerfen, aber die Verbindung sauber schließen.
    await res.arrayBuffer().catch(() => undefined);

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
      error: fehlertext(err),
    };
  }
}

function fehlertext(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError") return `Keine Antwort nach ${TIMEOUT_MS} ms`;
    return err.message;
  }
  return "Unbekannter Fehler";
}

/**
 * Ein kompletter Durchlauf: messen, wegschreiben, Tagesbilanz nachziehen,
 * und den Zustand jedes Dienstes neu bewerten.
 *
 * Gemessen wird parallel. Sequenziell würden sechs Dienste im schlechtesten
 * Fall 6 x TIMEOUT_MS brauchen und die Serverfunktion vorher abgebrochen.
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

  // Dienste ohne Probe-URL pflegt nur ein Mensch - die fasst der Wächter nicht an.
  const services = (rows ?? [])
    .map((row) => ({
      service: toService(row),
      statusBefore: (row.status ?? "operational") as ComponentStatus,
    }))
    .filter((s) => s.service.probe_url);

  const probes = await Promise.all(services.map((s) => probe(s.service)));
  const now = new Date().toISOString();
  const reports: CheckReport[] = [];

  for (let i = 0; i < services.length; i++) {
    const { service, statusBefore } = services[i];
    const result = probes[i];

    const { error: insertError } = await db.from("checks").insert({
      service_slug: service.slug,
      checked_at: now,
      ok: result.ok,
      degraded: result.degraded,
      status_code: result.status_code,
      response_ms: result.response_ms,
      error: result.error,
    });
    if (insertError) {
      // Ohne gespeicherte Messung darf nichts weiter passieren - sonst würde
      // auf einem veralteten Stand entschieden.
      console.error(`[waechter] Messung für ${service.slug} nicht gespeichert:`, insertError);
      continue;
    }

    await rollUpDay(service.slug, now.slice(0, 10));
    const { statusAfter, action } = await entscheiden(service, statusBefore, result);
    reports.push({ slug: service.slug, probe: result, statusBefore, statusAfter, action });
  }

  return reports;
}

/**
 * Tagesbilanz aus den Rohmessungen neu rechnen.
 *
 * Bewusst über Zählabfragen statt über die Zeilen selbst: Supabase liefert
 * standardmäßig höchstens 1000 Zeilen zurück. Bei einem Minutentakt wären das
 * 1440 Messungen am Tag - die Bilanz wäre still falsch.
 */
async function rollUpDay(slug: string, day: string): Promise<void> {
  const db = supabase()!;
  const from = `${day}T00:00:00.000Z`;
  const to = `${day}T23:59:59.999Z`;

  const basis = () =>
    db
      .from("checks")
      .select("*", { count: "exact", head: true })
      .eq("service_slug", slug)
      .gte("checked_at", from)
      .lte("checked_at", to);

  const zaehle = async (filter: (q: ReturnType<typeof basis>) => ReturnType<typeof basis>) => {
    const { count, error } = await filter(basis());
    if (error) throw error;
    return count ?? 0;
  };

  const checks = await zaehle((q) => q);
  const failed = await zaehle((q) => q.eq("ok", false));
  const degraded = await zaehle((q) => q.eq("ok", true).eq("degraded", true));

  // Beeinträchtigte Messungen zählen halb - die Seite war erreichbar, nur zäh.
  const uptime = checks === 0 ? 1 : (checks - failed - degraded * 0.5) / checks;

  const { error } = await db.from("daily_uptime").upsert(
    {
      service_slug: slug,
      day,
      checks,
      failed,
      degraded,
      uptime: Number(uptime.toFixed(6)),
      downtime_minutes: failed * INTERVAL_MINUTES,
      degraded_minutes: degraded * INTERVAL_MINUTES,
    },
    { onConflict: "service_slug,day" },
  );
  if (error) console.error(`[waechter] Tagesbilanz für ${slug} nicht gespeichert:`, error);
}

/** Holt den Kontext, lässt `bewerte()` entscheiden und schreibt das Ergebnis. */
async function entscheiden(
  service: Service,
  statusBefore: ComponentStatus,
  latest: Probe,
): Promise<{ statusAfter: ComponentStatus; action: string }> {
  const db = supabase()!;

  const { data: recent } = await db
    .from("checks")
    .select("ok, degraded")
    .eq("service_slug", service.slug)
    .order("checked_at", { ascending: false })
    .limit(Math.max(FAIL_STREAK, RECOVER_STREAK));

  const messungen: Messung[] = (recent ?? []).map((c) => ({
    ok: Boolean(c.ok),
    degraded: Boolean(c.degraded),
  }));

  const { data: openIncidents } = await db
    .from("incidents")
    .select("*")
    .is("resolved_at", null)
    .eq("automatic", true)
    .contains("service_slugs", [service.slug])
    .order("started_at", { ascending: false })
    .limit(1);
  const open = openIncidents?.[0] ?? null;

  const urteil = bewerte({
    bisher: statusBefore,
    messungen,
    offenerVorfall: open ? (open.impact as IncidentImpact) : null,
  });

  switch (urteil.aktion) {
    case "vorfall_anlegen": {
      const ausfall = urteil.impact === "major";
      const title = ausfall
        ? `${service.name} ist nicht erreichbar`
        : `${service.name} antwortet langsam`;
      const body = ausfall
        ? `Der Wächter hat ${FAIL_STREAK} Messungen hintereinander ohne Antwort gesehen${
            latest.error ? ` (${latest.error})` : ""
          }. Wir schauen uns das an.`
        : `Der Wächter hat ${FAIL_STREAK} Messungen hintereinander über ${service.degraded_ms} ms gesehen. Die Funktion ist erreichbar, aber langsam.`;

      const { data: inserted, error } = await db
        .from("incidents")
        .insert({
          title,
          impact: urteil.impact,
          status: "investigating",
          started_at: new Date().toISOString(),
          automatic: true,
          service_slugs: [service.slug],
        })
        .select()
        .single();

      if (error || !inserted) {
        console.error(`[waechter] Vorfall für ${service.slug} nicht angelegt:`, error);
        break;
      }
      await db
        .from("incident_updates")
        .insert({ incident_id: inserted.id, status: "investigating", body });
      await melden(`${ausfall ? "🔴" : "🟡"} ${title}`, body);
      break;
    }

    case "vorfall_verschaerfen": {
      await db.from("incidents").update({ impact: "major", status: "identified" }).eq("id", open.id);
      const body = `${service.name} antwortet inzwischen gar nicht mehr${
        latest.error ? ` (${latest.error})` : ""
      }.`;
      await db
        .from("incident_updates")
        .insert({ incident_id: open.id, status: "identified", body });
      await melden(`🔴 ${open.title as string}`, body);
      break;
    }

    case "vorfall_schliessen": {
      const startedAt = new Date(open.started_at as string);
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000));
      const body = `Der Vorfall ist behoben. ${service.name} läuft seit ${RECOVER_STREAK} Messungen wieder normal. Dauer: rund ${minutes} Minuten.`;

      await db
        .from("incidents")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", open.id);
      await db.from("incident_updates").insert({ incident_id: open.id, status: "resolved", body });
      await melden(`🟢 ${open.title as string} - behoben`, body);
      break;
    }
  }

  if (urteil.status !== statusBefore) {
    const { error } = await db
      .from("services")
      .update({ status: urteil.status })
      .eq("slug", service.slug);
    if (error) console.error(`[waechter] Status für ${service.slug} nicht gespeichert:`, error);

    if (urteil.aktion === "nichts") {
      await notifyTelegram(
        `<b>${service.name}</b>\n${STATUS_LABEL[statusBefore]} → ${STATUS_LABEL[urteil.status]}`,
      );
    }
  }

  return { statusAfter: urteil.status, action: urteil.aktion };
}

async function melden(betreff: string, text: string): Promise<void> {
  await notifyTelegram(`<b>${betreff}</b>${text ? `\n${text}` : ""}`);
  const post = await notifySubscribers(betreff, text || betreff);
  if (!post.eingerichtet) {
    console.warn("[waechter] Kein Mailversand eingerichtet - Abonnenten wurden nicht benachrichtigt.");
  } else {
    console.log(`[waechter] Meldung an ${post.gesendet} Abonnenten, ${post.fehlgeschlagen} Fehlschläge.`);
  }
}

function toService(row: Record<string, unknown>): Service {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    probe_url: (row.probe_url as string | null) ?? null,
    degraded_ms: Number(row.degraded_ms ?? 3000),
    sort_order: Number(row.sort_order ?? 0),
    active: true,
  };
}
