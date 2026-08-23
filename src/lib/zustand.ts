import { getStatusPageData } from "./status";
import { neuesteMeldung, offeneVorfaelle, seitText } from "./stoerung";
import { BANNER_LABEL, STATUS_LABEL, worstStatus } from "./uptime";
import type { ComponentStatus, StatusPageData } from "./types";

/**
 * Die Kurzfassung des Zustands - für alles, was nicht diese Seite ist.
 *
 * Scooly selbst soll den Zustand anzeigen können, ohne die Statusseite zu
 * öffnen. Dafür braucht es eine Antwort, die klein genug für einen Aufruf
 * beim App-Start ist und fertige Texte mitbringt: Die App soll `text`
 * hinschreiben und `farbe` verwenden, nicht selbst Regeln nachbauen. Zwei
 * Orte, die dieselbe Einstufung berechnen, laufen unweigerlich auseinander.
 *
 * Farben als Hex und nicht als CSS-Variable: Auf der anderen Seite steht
 * eine native App, die keine Stylesheets dieser Seite kennt.
 */

export const ZUSTAND_FARBE: Record<ComponentStatus, string> = {
  operational: "#76ad2a",
  degraded_performance: "#faa72a",
  partial_outage: "#e86235",
  major_outage: "#e04343",
  under_maintenance: "#3498db",
};

export type Zustand = {
  /** Schlechtester Einzelstatus - das, wonach sich die Farbe richtet. */
  status: ComponentStatus;
  /** Fertiger Satz: "Alle Systeme betriebsbereit". */
  text: string;
  farbe: string;
  /** true = alles läuft. Spart der App die Fallunterscheidung. */
  alles_gut: boolean;
  /** Adresse der ausführlichen Seite. */
  seite: string;
  /** Wann zuletzt gemessen wurde, ISO - null, wenn noch nie. */
  geprueft: string | null;
  dienste: { slug: string; name: string; status: ComponentStatus; text: string }[];
  stoerungen: {
    titel: string;
    impact: string;
    seit: string;
    betrifft: string[];
    meldung: string | null;
  }[];
};

export function baueZustand(daten: StatusPageData, seite: string, jetzt = new Date()): Zustand {
  const status = worstStatus(daten.services.map((s) => s.status));
  const namen = new Map(daten.services.map((s) => [s.service.slug, s.service.name]));

  return {
    status,
    text: BANNER_LABEL[status],
    farbe: ZUSTAND_FARBE[status],
    alles_gut: status === "operational",
    seite,
    geprueft: daten.last_checked_at,
    dienste: daten.services.map((s) => ({
      slug: s.service.slug,
      name: s.service.name,
      status: s.status,
      text: STATUS_LABEL[s.status],
    })),
    stoerungen: offeneVorfaelle(daten.incidents).map((vorfall) => ({
      titel: vorfall.title,
      impact: vorfall.impact,
      seit: seitText(vorfall.started_at, jetzt),
      betrifft: vorfall.service_slugs.map((slug) => namen.get(slug) ?? slug),
      meldung: neuesteMeldung(vorfall)?.body ?? null,
    })),
  };
}

export async function holeZustand(seite: string): Promise<Zustand> {
  return baueZustand(await getStatusPageData(), seite);
}
