import { TriangleAlert } from "lucide-react";
import { IMPACT_COLOR } from "@/lib/uptime";
import type { UptimeDay } from "@/lib/types";

/**
 * Der Inhalt des Popups über einem Tagesbalken.
 *
 * Alle Maße am Original abgenommen: Kasten 325 breit mit 15 Innenabstand,
 * Datum 14/500, Ausfallfeld auf rgba(222,220,209,.3) mit 9/14/8 Innenabstand,
 * "Zugehörig" in 13/450 Versalien mit 0,6px Laufweite.
 *
 * Wichtig: Hier wird nur gezeigt, was auch gemessen wurde. Steht in der
 * Tagesbilanz nichts, sagt das Popup genau das - und behauptet nicht,
 * es habe keine Ausfälle gegeben.
 */
export function TagPopup({ tag }: { tag: UptimeDay }) {
  const felder: { label: string; farbe: string; minuten: number }[] = [];
  if (tag.downtime_minutes > 0) {
    felder.push({ label: "Ausfall", farbe: "#de350b", minuten: tag.downtime_minutes });
  }
  if (tag.degraded_minutes > 0) {
    felder.push({
      label: "Beeinträchtigt",
      farbe: "#ffab00",
      minuten: tag.degraded_minutes,
    });
  }

  const ohneMessung = tag.uptime === null || tag.checks === 0;

  return (
    <div className="w-[325px] p-[15px] text-left">
      <div className="text-[14px] font-medium leading-[21px] text-[var(--sp-ink)]">
        {datum(tag.day)}
      </div>

      {ohneMessung ? (
        <p className="mt-[10px] text-[16px] leading-6 text-[var(--sp-muted)]">
          Für diesen Tag liegen keine Messdaten vor.
        </p>
      ) : felder.length === 0 ? (
        <p className="mt-[10px] text-[16px] leading-6">
          An diesem Tag wurde kein Ausfall aufgezeichnet.
        </p>
      ) : (
        <div>
          {felder.map((feld) => (
            <div
              key={feld.label}
              className="my-[10px] flex items-center rounded-[2px] bg-[rgba(222,220,209,0.3)] px-[14px] pt-[9px] pb-[8px] text-[16px] font-medium leading-6"
            >
              <span className="mr-4 flex items-center">
                <TriangleAlert
                  size={16}
                  strokeWidth={2}
                  className="mr-2 shrink-0"
                  style={{ color: feld.farbe }}
                />
                {feld.label}
              </span>
              <span className="ml-auto whitespace-nowrap">{dauer(feld.minuten)}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mt-[19px] mb-[10px] text-[13px] font-medium uppercase leading-5 tracking-[0.6px] text-[var(--sp-muted)]">
          Zugehörig
        </h3>
        {tag.incidents.length === 0 ? (
          <p className="text-[16px] leading-[18px] text-[var(--sp-muted)]">
            Kein Vorfall und keine Wartung zu diesem Tag.
          </p>
        ) : (
          <ul>
            {tag.incidents.map((vorfall) => (
              <li
                key={vorfall.id}
                className="mb-[2px] text-[16px] leading-[18px]"
                style={{ color: IMPACT_COLOR[vorfall.impact] }}
              >
                {vorfall.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** "1 Std. 37 Min." - volle Stunden nur, wenn es welche gibt. */
export function dauer(minuten: number): string {
  const std = Math.floor(minuten / 60);
  const min = minuten % 60;
  if (std === 0) return `${min} Min.`;
  if (min === 0) return `${std} Std.`;
  return `${std} Std. ${min} Min.`;
}

function datum(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-AT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
