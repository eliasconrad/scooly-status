import type { ComponentStatus, Incident, IncidentUpdate, ServiceStatus, UptimeDay } from "./types";

/**
 * Was gerade nicht geht - in Worten, die jemand ohne Serverkenntnisse versteht.
 *
 * Die Seite hat nur einen Zweck: dass man **sieht**, was schlechter läuft,
 * statt es aus einer Farbe zu erraten. Alles hier ist aus echten Messwerten
 * abgeleitet (Tageszeile aus `daily_uptime`, Vorfallstexte vom Wächter).
 * Wo kein Messwert vorliegt, steht lieber nichts als eine Vermutung.
 */

const ERLEDIGT: ReadonlySet<string> = new Set(["resolved", "completed"]);

/** Offen heißt: kein Abschlussstatus und kein Abschlusszeitpunkt. */
export function istOffen(vorfall: Incident): boolean {
  return !ERLEDIGT.has(vorfall.status) && !vorfall.resolved_at;
}

/** Offene Vorfälle, jüngster zuerst. */
export function offeneVorfaelle(vorfaelle: Incident[]): Incident[] {
  return vorfaelle.filter(istOffen).sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/** Die jüngste Meldung eines Vorfalls - die Liste kommt bereits absteigend. */
export function neuesteMeldung(vorfall: Incident): IncidentUpdate | null {
  return vorfall.updates[0] ?? null;
}

/** Dienste, bei denen gerade etwas ist - schlechtester zuerst. */
export function betroffeneDienste(services: ServiceStatus[]): ServiceStatus[] {
  return services.filter((s) => s.status !== "operational");
}

/** Aus Slugs lesbare Namen machen; unbekannte Slugs fallen raus. */
export function dienstNamen(services: ServiceStatus[], slugs: string[]): string[] {
  const nachSlug = new Map(services.map((s) => [s.service.slug, s.service.name]));
  return slugs.map((slug) => nachSlug.get(slug)).filter((n): n is string => Boolean(n));
}

/** "Anmeldung, Scooly KI und Datenbank" - deutsche Aufzählung mit "und". */
export function aufzaehlung(teile: string[]): string {
  if (teile.length === 0) return "";
  if (teile.length === 1) return teile[0];
  return `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}

/** Millisekunden so, wie man sie ausspricht: 820 ms, 4,2 s, 15 s. */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return `${s < 10 ? s.toFixed(1).replace(".", ",") : Math.round(s)} s`;
}

/** Minuten als Dauer: 12 Minuten, 1 Stunde 5 Minuten, 3 Stunden. */
export function formatDauer(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  if (m < 60) return `${m} Minute${m === 1 ? "" : "n"}`;
  const std = Math.floor(m / 60);
  const rest = m % 60;
  const stdText = `${std} Stunde${std === 1 ? "" : "n"}`;
  return rest === 0 ? stdText : `${stdText} ${rest} Minute${rest === 1 ? "" : "n"}`;
}

/** "seit 14:05 UTC (vor 22 Minuten)" - beides, weil beides gefragt wird. */
export function seitText(iso: string, jetzt: Date = new Date()): string {
  const start = new Date(iso);
  const uhr = start.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const minuten = Math.max(0, Math.round((jetzt.getTime() - start.getTime()) / 60000));
  if (minuten < 1) return `seit ${uhr} UTC (gerade eben)`;
  const tage = Math.floor(minuten / 1440);
  if (tage >= 1) return `seit ${uhr} UTC (vor ${tage} Tag${tage === 1 ? "" : "en"})`;
  return `seit ${uhr} UTC (vor ${formatDauer(minuten)})`;
}

/**
 * Der harte Messwert zu einer Dienstzeile - das, was man sonst raten müsste.
 *
 * Bei Ausfall: wie lange heute keine Antwort kam und welcher Fehler.
 * Bei Zähigkeit: wie langsam heute gemessen wurde, gegen den Grenzwert.
 * Ohne Messung: null, damit nichts erfunden wird.
 */
export function messwertZeile(
  status: ComponentStatus,
  heute: UptimeDay | undefined,
  degradedMs: number,
): string | null {
  if (status === "operational" || status === "under_maintenance") return null;
  if (!heute || heute.checks === 0) return null;

  if (status === "degraded_performance") {
    if (heute.avg_response_ms === null) return null;
    const teile = [`Antwortzeit heute im Schnitt ${formatMs(heute.avg_response_ms)}`];
    if (heute.max_response_ms !== null && heute.max_response_ms > heute.avg_response_ms) {
      teile.push(`Spitze ${formatMs(heute.max_response_ms)}`);
    }
    return `${teile.join(", ")} - normal sind unter ${formatMs(degradedMs)}.`;
  }

  // Ausfall, ganz oder teilweise
  if (heute.downtime_minutes <= 0) {
    return heute.top_error ? `Letzter Fehler: ${heute.top_error}.` : null;
  }
  const dauer = `Heute ${formatDauer(heute.downtime_minutes)} ohne Antwort`;
  return heute.top_error ? `${dauer}, zuletzt ${heute.top_error}.` : `${dauer}.`;
}

/** Die Zeile unter der Banner-Überschrift: wer betroffen ist. */
export function bannerBetroffen(services: ServiceStatus[]): string | null {
  const betroffen = betroffeneDienste(services);
  if (betroffen.length === 0) return null;
  return `Betroffen: ${aufzaehlung(betroffen.map((s) => s.service.name))}`;
}
