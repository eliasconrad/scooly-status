"use client";

import { useState } from "react";
import { IMPACT_COLOR } from "@/lib/uptime";
import type { Incident } from "@/lib/types";

/** So viele Vorfälle zeigt ein Monat, bevor der Aufklapper kommt. */
const SICHTBAR = 3;

/**
 * Ein Monatsblock im Verlauf. Gemessen: Überschrift 28px/500 mit Haarlinie
 * und 4px Innenabstand nach unten, danach 20px Luft; je Vorfall Titel 20px/500
 * in Schweregrad-Farbe, jüngste Meldung in 16px, Zeitspanne in 14px gedeckt.
 */
export function IncidentMonth({ label, incidents }: { label: string; incidents: Incident[] }) {
  const [offen, setOffen] = useState(false);
  const sichtbar = offen ? incidents : incidents.slice(0, SICHTBAR);
  const rest = incidents.length - sichtbar.length;

  return (
    <section className="mb-[40px]">
      <h3 className="mb-[20px] border-b border-[var(--sp-rule)] pb-[4px] text-[28px] font-medium leading-[38px]">
        {label}
      </h3>

      {incidents.length === 0 ? (
        <p className="text-[16px] leading-6 text-[var(--sp-muted)]">
          In diesem Monat wurden keine Vorfälle gemeldet.
        </p>
      ) : (
        <>
          {sichtbar.map((incident) => (
            <article key={incident.id} className="mb-[20px]">
              <h4
                className="text-[20px] font-medium leading-[29px]"
                style={{ color: IMPACT_COLOR[incident.impact] }}
              >
                {incident.title}
              </h4>
              <p className="text-[16px] leading-6">
                {incident.updates[0]?.body ?? "Keine weiteren Angaben."}
              </p>
              <p className="text-[14px] leading-[21px] text-[var(--sp-muted)]">
                {zeitspanne(incident)}
              </p>
            </article>
          ))}

          {rest > 0 && (
            <button
              type="button"
              onClick={() => setOffen(true)}
              className="w-full rounded-[3px] border border-[var(--sp-rule)] px-3 pt-2 pb-[6.4px] text-center text-[14px] leading-[21px] text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
            >
              + Alle {incidents.length} Vorfälle anzeigen
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** "20. Aug., 19:16 - 19:42 UTC" - offenes Ende bleibt offen. */
function zeitspanne(incident: Incident): string {
  const start = new Date(incident.started_at);
  const datum = start.toLocaleDateString("de-AT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const uhr = (d: Date) =>
    d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

  if (!incident.resolved_at) return `${datum}, seit ${uhr(start)} UTC`;
  return `${datum}, ${uhr(start)} - ${uhr(new Date(incident.resolved_at))} UTC`;
}
