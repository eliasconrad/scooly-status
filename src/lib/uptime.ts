import type { ComponentStatus, IncidentImpact, UptimeDay } from "./types";

/**
 * Farbverlauf der Tagesbalken.
 *
 * Gemessen wird in **Ausfallminuten**, nicht in Prozent. Die Prozentskala
 * davor war an beiden Enden falsch: Eine einzige zähe Antwort (5 von 1440
 * Minuten) färbte den Tag gelb, ein Tag mit einer zähen Stunde wurde rot -
 * und ab 95 % war alles gleich rot, egal ob halbe Stunde oder halber Tag.
 *
 * Zähe Minuten zählen zu einem Viertel: Eine Stunde Wartezeit nervt, ist
 * aber nicht dasselbe wie eine Viertelstunde gar nichts.
 */
const ZAEH_GEWICHT = 0.25;

const SKALA: Array<[minuten: number, rgb: [number, number, number]]> = [
  [0, [118, 173, 42]],     // nichts war
  [5, [188, 176, 42]],     // ein Aussetzer
  [30, [250, 167, 42]],    // eine halbe Stunde
  [120, [232, 98, 53]],    // zwei Stunden
  [480, [224, 67, 67]],    // ein halber Arbeitstag
];

/** Balken ohne Messdaten - beim Original ein neutrales Grau. */
export const NO_DATA_FILL = "#d8d5cb";

/** Wie schlimm der Tag war, in Minuten. */
export function tagesSchwere(tag: Pick<UptimeDay, "uptime" | "downtime_minutes" | "degraded_minutes">): number {
  const aus = tag.downtime_minutes ?? 0;
  const zaeh = tag.degraded_minutes ?? 0;

  // Rückfall für Tage aus der Zeit vor den Minutenspalten: dann bleibt nur
  // der Prozentwert, aus dem sich die Minuten zurückrechnen lassen.
  if (aus === 0 && zaeh === 0 && tag.uptime !== null && tag.uptime < 1) {
    return (1 - tag.uptime) * 24 * 60;
  }
  return aus + zaeh * ZAEH_GEWICHT;
}

export function tagesFarbe(tag: Pick<UptimeDay, "uptime" | "checks" | "downtime_minutes" | "degraded_minutes">): string {
  if (tag.uptime === null || tag.checks === 0) return NO_DATA_FILL;
  return farbeFuerMinuten(tagesSchwere(tag));
}

export function farbeFuerMinuten(minuten: number): string {
  const m = Math.max(0, minuten);
  if (m <= SKALA[0][0]) return rgb(SKALA[0][1]);

  const letzte = SKALA[SKALA.length - 1];
  if (m >= letzte[0]) return rgb(letzte[1]);

  for (let i = 0; i < SKALA.length - 1; i++) {
    const [von, vonRgb] = SKALA[i];
    const [bis, bisRgb] = SKALA[i + 1];
    if (m >= von && m <= bis) {
      const t = (m - von) / (bis - von);
      return rgb([
        Math.round(vonRgb[0] + (bisRgb[0] - vonRgb[0]) * t),
        Math.round(vonRgb[1] + (bisRgb[1] - vonRgb[1]) * t),
        Math.round(vonRgb[2] + (bisRgb[2] - vonRgb[2]) * t),
      ]);
    }
  }
  return rgb(letzte[1]);
}

function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Geometrie der 90-Tage-Leiste, 1:1 vom Original übernommen. */
export const BAR = {
  days: 90,
  viewBoxWidth: 448,
  viewBoxHeight: 34,
  width: 3,
  get pitch() {
    return this.viewBoxWidth / this.days;
  },
} as const;

/**
 * Verfügbarkeit über mehrere Tage.
 *
 * Gewichtet nach Anzahl der Messungen: Der laufende Tag hat morgens erst
 * ein paar Messungen. Zählte er wie ein voller Tag, würde ein einzelner
 * Ausfall am Morgen den 90-Tage-Wert massiv verzerren.
 */
export function overallUptime(days: UptimeDay[]): number | null {
  const measured = days.filter((d) => d.uptime !== null);
  if (measured.length === 0) return null;

  const gewicht = measured.reduce((acc, d) => acc + Math.max(1, d.checks), 0);
  const summe = measured.reduce(
    (acc, d) => acc + (d.uptime as number) * Math.max(1, d.checks),
    0,
  );
  return summe / gewicht;
}

/**
 * "99.37 %" - zwei Nachkommastellen mit Leerzeichen vor dem Prozentzeichen,
 * wie im Original.
 *
 * Abgeschnitten statt gerundet: 99,996 % würde gerundet als "100.00 %"
 * dastehen, obwohl es an dem Tag einen Ausfall gab. Glatte 100 % soll nur
 * sehen, wer wirklich keinen einzigen Aussetzer hatte.
 */
export function formatUptime(uptime: number | null): string {
  if (uptime === null) return "-";
  const prozent = Math.floor(Math.min(1, Math.max(0, uptime)) * 10000) / 100;
  return `${prozent.toFixed(2)} %`;
}

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "Betriebsbereit",
  degraded_performance: "Beeinträchtigte Leistung",
  partial_outage: "Teilweiser Ausfall",
  major_outage: "Größerer Ausfall",
  under_maintenance: "Wartung",
};

export const STATUS_COLOR: Record<ComponentStatus, string> = {
  operational: "var(--sp-green)",
  degraded_performance: "var(--sp-yellow)",
  partial_outage: "var(--sp-orange)",
  major_outage: "var(--sp-red)",
  under_maintenance: "var(--sp-blue)",
};

const STATUS_RANK: Record<ComponentStatus, number> = {
  operational: 0,
  under_maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
};

/** Schlechtester Einzelstatus bestimmt das Banner oben. */
export function worstStatus(statuses: ComponentStatus[]): ComponentStatus {
  return statuses.reduce<ComponentStatus>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    "operational",
  );
}

export const BANNER_LABEL: Record<ComponentStatus, string> = {
  operational: "Alle Systeme betriebsbereit",
  degraded_performance: "Beeinträchtigte Leistung",
  partial_outage: "Teilweiser Systemausfall",
  major_outage: "Größerer Systemausfall",
  under_maintenance: "Wartungsarbeiten laufen",
};

export const IMPACT_COLOR: Record<IncidentImpact, string> = {
  none: "var(--sp-ink)",
  maintenance: "var(--sp-blue)",
  minor: "var(--sp-yellow)",
  major: "var(--sp-orange)",
  critical: "var(--sp-red)",
};

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  investigating: "Wird untersucht",
  identified: "Ursache gefunden",
  monitoring: "Wird beobachtet",
  resolved: "Behoben",
  scheduled: "Geplant",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
};
