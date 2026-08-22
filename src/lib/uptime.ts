import type { ComponentStatus, IncidentImpact, UptimeDay } from "./types";

/**
 * Farbverlauf der Tagesbalken.
 *
 * Die Stützstellen sind aus den gerenderten <rect fill="…"> auf
 * status.claude.com abgelesen (22.08.2026). Zwischen den Stützstellen wird
 * linear in RGB interpoliert - das ist eine Rekonstruktion, nicht die
 * Originalformel von Atlassian, trifft die Optik aber sehr genau.
 */
const SCALE: Array<[uptime: number, rgb: [number, number, number]]> = [
  [1.0, [118, 173, 42]],
  [0.999, [185, 170, 42]],
  [0.998, [229, 168, 42]],
  [0.995, [248, 167, 42]],
  [0.99, [242, 135, 47]],
  [0.98, [231, 95, 54]],
  [0.95, [224, 67, 67]],
];

/** Balken ohne Messdaten - beim Original ein neutrales Grau. */
export const NO_DATA_FILL = "#d8d5cb";

export function uptimeColor(uptime: number | null): string {
  if (uptime === null) return NO_DATA_FILL;
  const u = Math.min(1, Math.max(0, uptime));

  if (u >= SCALE[0][0]) return rgb(SCALE[0][1]);
  const last = SCALE[SCALE.length - 1];
  if (u <= last[0]) return rgb(last[1]);

  for (let i = 0; i < SCALE.length - 1; i++) {
    const [hi, hiRgb] = SCALE[i];
    const [lo, loRgb] = SCALE[i + 1];
    if (u <= hi && u >= lo) {
      const t = (hi - u) / (hi - lo);
      return rgb([
        Math.round(hiRgb[0] + (loRgb[0] - hiRgb[0]) * t),
        Math.round(hiRgb[1] + (loRgb[1] - hiRgb[1]) * t),
        Math.round(hiRgb[2] + (loRgb[2] - hiRgb[2]) * t),
      ]);
    }
  }
  return rgb(last[1]);
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
