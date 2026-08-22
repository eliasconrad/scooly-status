"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BAR, formatUptime, uptimeColor } from "@/lib/uptime";
import type { UptimeDay } from "@/lib/types";

/**
 * Die 90-Tage-Leiste.
 *
 * Geometrie 1:1 vom Original: viewBox 0 0 448 34, 90 Balken à 3 Einheiten
 * Breite im Raster 4,978. Die SVG skaliert auf die volle Zeilenbreite,
 * die Balken bleiben dadurch überall gleich proportioniert.
 */
export function UptimeBar({ days, uptime90 }: { days: UptimeDay[]; uptime90: number | null }) {
  return (
    <div className="pt-[5px] -mb-[2px]">
      <svg
        className="block w-full"
        height={BAR.viewBoxHeight}
        viewBox={`0 0 ${BAR.viewBoxWidth} ${BAR.viewBoxHeight}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Verfügbarkeit der letzten 90 Tage: ${formatUptime(uptime90)}`}
      >
        {days.map((day, i) => (
          <Tooltip key={day.day}>
            <TooltipTrigger asChild>
              <rect
                x={i * BAR.pitch}
                y={0}
                width={BAR.width}
                height={BAR.viewBoxHeight}
                fill={uptimeColor(day.uptime)}
                className="cursor-default"
              />
            </TooltipTrigger>
            <TooltipContent className="sp-tooltip flex-col items-start gap-0 border-0">
              <div className="font-medium">{germanDate(day.day)}</div>
              <div>
                {day.uptime === null
                  ? "Keine Messdaten"
                  : day.downtime_minutes === 0
                    ? "Keine Ausfälle"
                    : `${day.downtime_minutes} Min. Ausfall · ${formatUptime(day.uptime)}`}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </svg>

      <div className="mt-[6px] flex items-center gap-[10px] text-[14px] leading-6 text-[var(--sp-muted)]">
        <span className="shrink-0">vor 90 Tagen</span>
        <span className="h-px flex-1 bg-[var(--sp-rule)]" />
        <span className="shrink-0">{formatUptime(uptime90)} Verfügbarkeit</span>
        <span className="h-px flex-1 bg-[var(--sp-rule)]" />
        <span className="shrink-0">Heute</span>
      </div>
    </div>
  );
}

function germanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-AT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
