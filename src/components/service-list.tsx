import { UptimeBar } from "./uptime-bar";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/uptime";
import type { ServiceStatus } from "@/lib/types";

/**
 * Die Dienstliste. Beim Original sind die Zeilen ein einziger Rahmen mit
 * geteilten Trennlinien - nur oben und unten je 4px Radius.
 */
export function ServiceList({ services }: { services: ServiceStatus[] }) {
  return (
    <section>
      <p className="mb-px text-right text-[14px] leading-6 text-[var(--sp-muted)]">
        Verfügbarkeit der letzten 90 Tage.{" "}
        <a href="/history" className="text-[var(--sp-ink)] underline-offset-2 hover:underline">
          Vollständigen Verlauf ansehen.
        </a>
      </p>

      <div className="overflow-hidden rounded-[4px] border border-[var(--sp-rule)]">
        {services.map((s, i) => (
          <div
            key={s.service.slug}
            className={
              "px-5 pt-[17.6px] pb-4" +
              (i > 0 ? " border-t border-[var(--sp-rule)]" : "")
            }
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[16px] font-medium leading-6">{s.service.name}</span>
              <span
                className="shrink-0 text-[14px] leading-6"
                style={{ color: STATUS_COLOR[s.status] }}
              >
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            <UptimeBar days={s.days} uptime90={s.uptime90} />
          </div>
        ))}
      </div>
    </section>
  );
}
