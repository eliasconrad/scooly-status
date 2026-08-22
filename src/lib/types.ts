/** Status eines einzelnen Dienstes - gleiche Stufen wie Atlassian Statuspage. */
export type ComponentStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";

/** Schweregrad eines Vorfalls. */
export type IncidentImpact = "none" | "maintenance" | "minor" | "major" | "critical";

/** Lebenszyklus eines Vorfalls - bestimmt die Überschrift jedes Updates. */
export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "scheduled"
  | "in_progress"
  | "completed";

export type Service = {
  id: string;
  slug: string;
  name: string;
  /** URL, die der Wächter anpingt. Null = wird nur von Hand gepflegt. */
  probe_url: string | null;
  /** Antwortzeit in ms, ab der als "beeinträchtigt" gewertet wird. */
  degraded_ms: number;
  sort_order: number;
  active: boolean;
};

/** Ein Tag in der 90-Tage-Leiste. */
export type UptimeDay = {
  /** ISO-Datum, YYYY-MM-DD */
  day: string;
  /** 0..1, null = keine Daten (grauer Balken) */
  uptime: number | null;
  /** Anzahl Messungen an diesem Tag */
  checks: number;
  /** Ausfallminuten an diesem Tag, gerundet */
  downtime_minutes: number;
};

export type ServiceStatus = {
  service: Service;
  status: ComponentStatus;
  days: UptimeDay[];
  /** Uptime über die gesamten 90 Tage, 0..1 */
  uptime90: number | null;
};

export type IncidentUpdate = {
  id: string;
  status: IncidentStatus;
  body: string;
  created_at: string;
};

export type Incident = {
  id: string;
  title: string;
  impact: IncidentImpact;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  /** true = vom Wächter selbst angelegt, nicht von Hand */
  automatic: boolean;
  service_slugs: string[];
  updates: IncidentUpdate[];
};

export type StatusPageData = {
  services: ServiceStatus[];
  incidents: Incident[];
  /** Zeitpunkt der letzten Messung, ISO */
  last_checked_at: string | null;
  /** true, wenn keine Datenbank angebunden ist und Demodaten gezeigt werden */
  demo: boolean;
};
