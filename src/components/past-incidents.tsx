import { IMPACT_COLOR, INCIDENT_STATUS_LABEL } from "@/lib/uptime";
import type { Incident } from "@/lib/types";

/**
 * "Vergangene Vorfälle": pro Tag eine Überschrift mit Haarlinie, darunter
 * entweder "Keine Vorfälle gemeldet." oder die Vorfälle dieses Tages mit
 * allen Updates in umgekehrter Reihenfolge.
 */
export function PastIncidents({
  incidents,
  days,
  heading = "Vergangene Vorfälle",
}: {
  incidents: Incident[];
  days: string[];
  heading?: string;
}) {
  const byDay = new Map<string, Incident[]>();
  for (const incident of incidents) {
    const day = incident.started_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(incident);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mt-[70px]">
      <h2 className="mb-[30px] text-[28px] font-medium leading-[38px]">{heading}</h2>

      {days.map((day) => {
        const dayIncidents = byDay.get(day) ?? [];
        return (
          <div key={day} className="mb-[38px]">
            <h3 className="border-b border-[var(--sp-rule)] pb-[10px] text-[20px] font-medium leading-[29px]">
              {longDate(day)}
            </h3>

            {dayIncidents.length === 0 ? (
              <p className="pt-[14px] text-[16px] leading-6 text-[var(--sp-muted)]">
                {day === today ? "Heute keine Vorfälle gemeldet." : "Keine Vorfälle gemeldet."}
              </p>
            ) : (
              dayIncidents.map((incident) => (
                <IncidentBlock key={incident.id} incident={incident} />
              ))
            )}
          </div>
        );
      })}
    </section>
  );
}

function IncidentBlock({ incident }: { incident: Incident }) {
  return (
    <article className="pt-[18px]">
      <h4
        className="text-[20px] font-medium leading-[29px]"
        style={{ color: IMPACT_COLOR[incident.impact] }}
      >
        {incident.title}
      </h4>

      {incident.updates.map((update) => (
        <div key={update.id} className="pt-[14px]">
          <p className="text-[16px] leading-6">
            <strong className="font-semibold">
              {INCIDENT_STATUS_LABEL[update.status] ?? update.status}
            </strong>
            {" - "}
            {update.body}
          </p>
          <p className="pt-[2px] text-[14px] leading-[21px] text-[var(--sp-muted)]">
            {timestamp(update.created_at)}
          </p>
        </div>
      ))}
    </article>
  );
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-AT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function timestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("de-AT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}
