import { UptimeBar } from "./uptime-bar";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/uptime";
import type { ServiceStatus } from "@/lib/types";

/**
 * Die Dienstliste. Beim Original sind die Zeilen ein einziger Rahmen mit
 * geteilten Trennlinien - nur oben und unten je 4px Radius.
 */
/**
 * Was der Zustand für die Leute bedeutet.
 *
 * Steht nur da, wenn wirklich etwas ist - bei "Betriebsbereit" wäre der
 * Satz Lärm. Fehlt der Text in der Datenbank, steht auch nichts da; erfunden
 * wird nichts.
 */
function wirkung(s: ServiceStatus): string | null {
  if (s.status === "operational") return null;
  if (s.status === "degraded_performance") return s.service.wirkung_langsam ?? null;
  return s.service.wirkung_ausfall ?? null;
}

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
            {wirkung(s) && (
              <p className="pt-[2px] text-[14px] leading-[20px] text-[var(--sp-muted)]">
                {wirkung(s)}
              </p>
            )}

            <UptimeBar days={s.days} uptime90={s.uptime90} />
          </div>
        ))}
      </div>
    </section>
  );
}
