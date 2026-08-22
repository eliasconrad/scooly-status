import type { IncidentImpact, IncidentStatus } from "./types";
import { INCIDENT_STATUS_LABEL } from "./uptime";

/**
 * Meldungen, die älter als dieses Fenster sind, werden nicht mehr
 * verschickt - nur als erledigt abgehakt.
 *
 * Schutz gegen den Fall, dass der Wächter länger stillstand: Sonst käme
 * beim ersten Lauf danach ein Schwall alter Nachrichten, von denen die
 * meisten längst überholt sind.
 */
export const MELDE_FENSTER_MINUTEN = Number(process.env.MELDE_FENSTER_MINUTEN ?? 180);

const ABGESCHLOSSEN: IncidentStatus[] = ["resolved", "completed"];

/** 🔴 großer Ausfall · 🟡 kleinere Störung · 🟢 behoben · 🔵 Wartung */
export function zeichen(impact: IncidentImpact, status: IncidentStatus): string {
  if (ABGESCHLOSSEN.includes(status)) return "🟢";
  if (impact === "maintenance") return "🔵";
  if (impact === "major" || impact === "critical") return "🔴";
  return "🟡";
}

/**
 * Betreff und Überschrift einer Meldung.
 *
 * Der Betreff sagt schon in der Postfachliste, worum es geht und ob es
 * gute oder schlechte Nachrichten sind.
 */
export function betreffUndTitel(
  vorfallTitel: string,
  impact: IncidentImpact,
  status: IncidentStatus,
): { betreff: string; titel: string } {
  const erledigt = ABGESCHLOSSEN.includes(status);
  const titel = erledigt ? `${vorfallTitel} - behoben` : vorfallTitel;
  return { betreff: `${zeichen(impact, status)} ${titel}`, titel };
}

/** Der Zustand als Vorspann vor dem eigentlichen Text - wie auf der Seite. */
export function meldungsText(status: IncidentStatus, body: string): string {
  const label = INCIDENT_STATUS_LABEL[status];
  return label ? `${label} - ${body}` : body;
}

/** Behobene Vorfälle bekommen das grüne Band, alles andere die Schweregradfarbe. */
export function bandFarbeFuer(impact: IncidentImpact, status: IncidentStatus): IncidentImpact {
  return ABGESCHLOSSEN.includes(status) ? "none" : impact;
}

/** Ist die Meldung noch frisch genug, um sie zu verschicken? */
export function nochAktuell(createdAt: string, jetzt = new Date()): boolean {
  const alter = (jetzt.getTime() - new Date(createdAt).getTime()) / 60000;
  return Number.isFinite(alter) && alter <= MELDE_FENSTER_MINUTEN;
}
