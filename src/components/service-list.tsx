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
        Verfügbarkeit der letzten <span className="sp-zeitraum-30">30</span>
        <span className="sp-zeitraum-60">60</span>
        <span className="sp-zeitraum-90">90</span> Tage.{" "}
        <a href="/uptime" className="text-[var(--sp-ink)] underline-offset-2 hover:underline">
          Vollständige Verfügbarkeit ansehen.
        </a>
      </p>

      <div className="overflow-hidden rounded-[4px] border border-[var(--sp-rule)]">
        {services.map((s, i) => (
          <div
            key={s.service.slug}
            className={i > 0 ? "border-t border-[var(--sp-rule)]" : undefined}
            style={{ padding: "var(--sp-row-pad)" }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span
                className="font-medium leading-6"
                style={{ fontSize: "var(--sp-name-size)" }}
              >
                {s.service.name}
              </span>
              <span
                className="shrink-0 leading-6"
                style={{ color: STATUS_COLOR[s.status], fontSize: "var(--sp-name-size)" }}
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
