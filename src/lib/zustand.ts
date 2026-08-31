import { getStatusPageData } from "./status";
import { SCHWEIGE_FARBE, SCHWEIGE_TEXT, schweigeHinweis, waechterSchweigt } from "./schweigen";
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
  /**
   * true, wenn seit zu langer Zeit nicht gemessen wurde.
   *
   * Dann sind `text` und `farbe` bereits die grauen - die App muss nichts
   * selbst entscheiden. Das Feld steht trotzdem dabei, damit sie den Fall
   * von einer echten Störung unterscheiden kann, falls sie das je will.
   */
  waechter_schweigt: boolean;
  dienste: { slug: string; name: string; status: ComponentStatus; text: string }[];
  stoerungen: {
    titel: string;
    impact: string;
    seit: string;
    betrifft: string[];
    meldung: string | null;
  }[];
};

/**
 * Der Takt, in dem gemessen wird - dieselbe Zahl wie in `checker.ts`.
 *
 * Steht hier nochmal, weil `checker.ts` beim Import den Wächter mitzieht
 * (Mail, Telegram, Supabase) und diese Datei auch dort gelesen wird, wo nur
 * die Kurzfassung gebraucht wird.
 */
export const TAKT_MINUTEN = Number(process.env.CHECK_INTERVAL_MINUTES ?? 10);

export function baueZustand(
  daten: StatusPageData,
  seite: string,
  jetzt = new Date(),
  taktMinuten = TAKT_MINUTEN,
): Zustand {
  const status = worstStatus(daten.services.map((s) => s.status));
  const namen = new Map(daten.services.map((s) => [s.service.slug, s.service.name]));

  /*
   * SCHWEIGEN SCHLÄGT ALLES ANDERE: Ohne frische Messung ist auch ein
   * gespeichertes "operational" nur eine Erinnerung. `alles_gut` muss dann
   * false sein - daran hängt in der App, ob das Banner überhaupt erscheint,
   * und "wir wissen es gerade nicht" gehört genauso ins Bild wie eine
   * Störung. Ein stiller Wächter darf nicht stiller sein als ein Ausfall.
   */
  const schweigt = waechterSchweigt(daten.last_checked_at, taktMinuten, jetzt);

  return {
    status,
    text: schweigt ? SCHWEIGE_TEXT : BANNER_LABEL[status],
    farbe: schweigt ? SCHWEIGE_FARBE : ZUSTAND_FARBE[status],
    alles_gut: !schweigt && status === "operational",
    seite,
    geprueft: daten.last_checked_at,
    waechter_schweigt: schweigt,
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
