import type { ComponentStatus, IncidentImpact } from "./types";

/** Wie viele Messungen hintereinander schiefgehen müssen, bevor ein Vorfall entsteht. */
export const FAIL_STREAK = 3;
/** Wie viele saubere Messungen es braucht, damit ein Vorfall automatisch schließt. */
export const RECOVER_STREAK = 3;

export type Messung = { ok: boolean; degraded: boolean };

export type Aktion =
  | "nichts"
  | "vorfall_anlegen"
  | "vorfall_verschaerfen"
  | "vorfall_schliessen";

export type Bewertung = {
  status: ComponentStatus;
  aktion: Aktion;
  /** Nur bei "vorfall_anlegen" gesetzt. */
  impact: IncidentImpact | null;
};

/**
 * Die eigentliche Entscheidung - bewusst ohne Datenbank, damit sie prüfbar ist.
 *
 * `messungen` kommt neueste zuerst. Solange weniger als FAIL_STREAK Messungen
 * vorliegen, passiert nichts: ein frisch angelegter Dienst soll nicht wegen
 * einer einzelnen Messung als Ausfall gelten.
 */
export function bewerte(input: {
  bisher: ComponentStatus;
  messungen: Messung[];
  /** Schweregrad eines bereits offenen, automatisch angelegten Vorfalls. */
  offenerVorfall: IncidentImpact | null;
}): Bewertung {
  const { bisher, messungen, offenerVorfall } = input;

  const ausfallFenster = messungen.slice(0, FAIL_STREAK);
  const erholungsFenster = messungen.slice(0, RECOVER_STREAK);

  const istAusfall =
    ausfallFenster.length === FAIL_STREAK && ausfallFenster.every((m) => !m.ok);

  const istLangsam =
    !istAusfall &&
    ausfallFenster.length === FAIL_STREAK &&
    ausfallFenster.every((m) => m.ok && m.degraded);

  const istGesund =
    erholungsFenster.length === RECOVER_STREAK &&
    erholungsFenster.every((m) => m.ok && !m.degraded);

  const status: ComponentStatus = istAusfall
    ? "major_outage"
    : istLangsam
      ? "degraded_performance"
      : istGesund
        ? "operational"
        : bisher;

  let aktion: Aktion = "nichts";
  let impact: IncidentImpact | null = null;

  if ((istAusfall || istLangsam) && offenerVorfall === null) {
    aktion = "vorfall_anlegen";
    impact = istAusfall ? "major" : "minor";
  } else if (istAusfall && offenerVorfall === "minor") {
    aktion = "vorfall_verschaerfen";
  } else if (istGesund && offenerVorfall !== null) {
    aktion = "vorfall_schliessen";
  }

  return { status, aktion, impact };
}
