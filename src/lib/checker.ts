import { bewerte, FAIL_STREAK, RECOVER_STREAK, type Messung } from "./bewertung";
import { notifySubscribers } from "./mail";
import {
  bandFarbeFuer,
  betreffUndTitel,
  meldungsText,
  nochAktuell,
} from "./meldungen";
import { supabase } from "./supabase";
import { notifyTelegram } from "./telegram";
import { STATUS_LABEL } from "./uptime";
import { zeit } from "./zeit";
import type { ComponentStatus, IncidentImpact, IncidentStatus, Service } from "./types";

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

  // Zum Schluss alles verschicken, was offen ist - eigene Vorfälle wie
  // von Hand eingetragene.
  await verschickeOffeneMeldungen();

  return reports;
}

/**
 * Tagesbilanz neu rechnen.
 *
 * Die eigentliche Arbeit macht die Datenbankfunktion `rollup_day`. Hier
 * zeilenweise zu rechnen ginge schief, sobald ein Tag mehr als 1000
 * Messungen hat - so viele liefert Supabase nämlich höchstens zurück.
 */
async function rollUpDay(slug: string, day: string): Promise<void> {
  const db = supabase()!;
  const { error } = await db.rpc("rollup_day", {
    p_slug: slug,
    p_day: day,
    p_interval_minutes: INTERVAL_MINUTES,
  });
  if (error) console.error(`[waechter] Tagesbilanz für ${slug} nicht gerechnet:`, error);
}

/**
 * Übliche Antwortzeit eines Dienstes, gemittelt über die letzten Tage.
 * Dient als Vergleichswert in der Vorfallsbeschreibung - "8,4 s statt
 * üblicher 1,2 s" sagt mehr als "8,4 s".
 */
async function ueblicheAntwortzeit(slug: string): Promise<number | null> {
  const db = supabase()!;
  const seit = new Date();
  seit.setUTCDate(seit.getUTCDate() - 8);

  const { data } = await db
    .from("daily_uptime")
    .select("avg_response_ms")
    .eq("service_slug", slug)
    .gte("day", seit.toISOString().slice(0, 10))
    .not("avg_response_ms", "is", null)
    .order("day", { ascending: false })
    .limit(7);

  const werte = (data ?? []).map((r) => Number(r.avg_response_ms)).filter((n) => n > 0);
  if (werte.length === 0) return null;
  return Math.round(werte.reduce((a, b) => a + b, 0) / werte.length);
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
    .select("ok, degraded, response_ms, status_code, error")
    .eq("service_slug", service.slug)
    .order("checked_at", { ascending: false })
    .limit(Math.max(FAIL_STREAK, RECOVER_STREAK));

  const fenster = recent ?? [];
  const messungen: Messung[] = fenster.map((c) => ({
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
      const ueblich = await ueblicheAntwortzeit(service.slug);
      const title = ausfall
        ? `${service.name} ist nicht erreichbar`
        : `${service.name} antwortet langsam`;
      const body = ausfall
        ? beschreibungAusfall(service, fenster, latest)
        : beschreibungLangsam(service, fenster, ueblich);

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
      break;
    }

    case "vorfall_verschaerfen": {
      await db.from("incidents").update({ impact: "major", status: "identified" }).eq("id", open.id);
      const body = `Aus der Verzögerung ist ein Ausfall geworden. ${beschreibungAusfall(
        service,
        fenster,
        latest,
      )}`;
      await db
        .from("incident_updates")
        .insert({ incident_id: open.id, status: "identified", body });
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

type Messwert = {
  ok?: boolean | null;
  degraded?: boolean | null;
  response_ms?: number | null;
  status_code?: number | null;
  error?: string | null;
};

/**
 * Was genau kaputt ist - mit den Zahlen, die dazu geführt haben.
 *
 * Es steht ausschließlich drin, was auch gemessen wurde. Keine Vermutung
 * über die Ursache, keine Beschwichtigung.
 */
export function beschreibungAusfall(
  service: Pick<Service, "name" | "wirkung_ausfall">,
  fenster: Messwert[],
  latest: Pick<Probe, "error" | "status_code" | "response_ms">,
): string {
  const teile: string[] = [];

  // Zuerst, was das für die Leute heißt. Wer gerade lernen will, kann mit
  // "HTTP 502" nichts anfangen - der will wissen, was jetzt nicht geht.
  if (service.wirkung_ausfall) teile.push(service.wirkung_ausfall);

  teile.push(
    latest.status_code
      ? `${service.name} antwortet mit HTTP ${latest.status_code}.`
      : `${service.name} antwortet gar nicht${latest.error ? ` (${latest.error})` : ""}.`,
  );

  const codes = [...new Set(fenster.map((m) => m.status_code).filter(Boolean))];
  const fehler = [...new Set(fenster.map((m) => m.error).filter(Boolean))];
  if (codes.length > 1) teile.push(`Gesehene Antworten: HTTP ${codes.join(", ")}.`);
  else if (fehler.length > 1) teile.push(`Gesehene Fehler: ${fehler.join(" · ")}.`);

  teile.push(
    `${FAIL_STREAK} Messungen hintereinander ohne Erfolg, zuletzt nach ${zeit(
      latest.response_ms ?? 0,
    )}.`,
  );
  return teile.join(" ");
}

/** Wie langsam genau - gemessen, mit Grenzwert und üblichem Wert daneben. */
export function beschreibungLangsam(
  service: Pick<Service, "name" | "degraded_ms" | "wirkung_langsam">,
  fenster: Messwert[],
  ueblich: number | null,
): string {
  const zeiten = fenster
    .map((m) => m.response_ms)
    .filter((n): n is number => typeof n === "number" && n > 0);

  const schnitt = zeiten.length
    ? Math.round(zeiten.reduce((a, b) => a + b, 0) / zeiten.length)
    : 0;

  const teile: string[] = [];
  if (service.wirkung_langsam) teile.push(service.wirkung_langsam);
  teile.push(
    `${service.name} ist erreichbar, braucht aber ${zeit(schnitt)} pro Anfrage.`,
    `Grenzwert sind ${zeit(service.degraded_ms)}.`,
  );

  if (ueblich && ueblich > 0) {
    const faktor = schnitt / ueblich;
    teile.push(
      `Üblich sind ${zeit(ueblich)}${faktor >= 1.5 ? ` - also rund ${faktor.toFixed(1).replace(".", ",")}-mal so lang` : ""}.`,
    );
  }
  if (zeiten.length > 1) {
    teile.push(`Einzelmessungen: ${zeiten.map(zeit).join(", ")}.`);
  }
  return teile.join(" ");
}

/**
 * Verschickt alles, was noch nicht draußen ist.
 *
 * Führend ist `incident_updates.notified_at`. Das hat drei Vorteile
 * gegenüber dem früheren Verschicken direkt an der Stelle, an der ein
 * Vorfall entsteht:
 *
 *   - Von Hand eingetragene Vorfälle gehen genauso raus wie die des
 *     Wächters. Vorher blieben sie stumm.
 *   - Bricht der Versand ab, steht die Meldung beim nächsten Lauf noch
 *     offen und wird nachgeholt, statt verloren zu gehen.
 *   - Doppelt kann nichts rausgehen, weil der Vermerk in der Datenbank
 *     steht und nicht im Ablauf.
 */
export async function verschickeOffeneMeldungen(): Promise<{
  verschickt: number;
  uebergangen: number;
}> {
  const db = supabase();
  if (!db) return { verschickt: 0, uebergangen: 0 };

  const { data, error } = await db
    .from("incident_updates")
    .select("id, status, body, created_at, incidents(title, impact, status)")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[waechter] Offene Meldungen nicht abrufbar:", error);
    return { verschickt: 0, uebergangen: 0 };
  }

  let verschickt = 0;
  let uebergangen = 0;

  for (const zeile of data ?? []) {
    const vorfall = zeile.incidents as unknown as {
      title: string;
      impact: IncidentImpact;
    } | null;
    if (!vorfall) continue;

    const status = zeile.status as IncidentStatus;

    // Zu alte Meldungen nur abhaken, nicht mehr verschicken.
    if (!nochAktuell(String(zeile.created_at))) {
      uebergangen++;
    } else {
      const { betreff, titel } = betreffUndTitel(vorfall.title, vorfall.impact, status);
      const text = meldungsText(status, String(zeile.body));

      await notifyTelegram(`<b>${betreff}</b>\n${text}`);
      const post = await notifySubscribers(
        betreff,
        text,
        bandFarbeFuer(vorfall.impact, status),
        titel,
      );
      if (!post.eingerichtet) {
        console.warn("[waechter] Kein Mailversand eingerichtet - Abonnenten hörten nichts.");
      } else {
        console.log(
          `[waechter] "${betreff}": ${post.gesendet} verschickt, ` +
            `${post.uebersprungen} über Kontingent, ${post.fehlgeschlagen} Fehlschläge.`,
        );
      }
      verschickt++;
    }

    // Erst nach dem Versand abhaken - bricht es vorher ab, wird es
    // beim nächsten Lauf nachgeholt.
    const { error: vermerk } = await db
      .from("incident_updates")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", zeile.id);
    if (vermerk) console.error("[waechter] Vermerk nicht gesetzt:", vermerk);
  }

  if (uebergangen > 0) {
    console.log(`[waechter] ${uebergangen} Meldungen waren zu alt und wurden nur abgehakt.`);
  }
  return { verschickt, uebergangen };
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
    wirkung_ausfall: (row.wirkung_ausfall as string | null) ?? null,
    wirkung_langsam: (row.wirkung_langsam as string | null) ?? null,
  };
}
