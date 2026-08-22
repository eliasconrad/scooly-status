"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TagPopup } from "./tag-popup";
import { useTagAuswahl } from "@/lib/use-tag-auswahl";
import { BAR, formatUptime, overallUptime, uptimeColor } from "@/lib/uptime";
import type { UptimeDay } from "@/lib/types";

/**
 * Die 90-Tage-Leiste.
 *
 * Geometrie 1:1 vom Original: viewBox 0 0 448 34, 90 Balken à 3 Einheiten
 * Breite im Raster 4,978.
 *
 * Auf schmalen Geräten zeigt das Original nur die letzten 30 bzw. 60 Tage.
 * Die Auswahl macht hier `.sp-bar-fenster` in globals.css - rein über CSS,
 * damit Server und Browser dasselbe ausliefern und beim Laden nichts springt.
 * Aus demselben Grund stehen alle drei Prozentwerte im Text; sichtbar ist
 * immer nur der, der zum Ausschnitt passt.
 */
export function UptimeBar({ days, uptime90 }: { days: UptimeDay[]; uptime90: number | null }) {
  const { aktiv, griffe } = useTagAuswahl();

  const zeitraeume = [
    { klasse: "sp-zeitraum-30", tage: 30, wert: overallUptime(days.slice(-30)) },
    { klasse: "sp-zeitraum-60", tage: 60, wert: overallUptime(days.slice(-60)) },
    { klasse: "sp-zeitraum-90", tage: 90, wert: uptime90 },
  ];

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
        <g className="sp-bar-fenster">
          {days.map((day, i) => (
            <Tooltip key={day.day} open={aktiv === day.day}>
              <TooltipTrigger asChild>
                <rect
                  tabIndex={0}
                  x={i * BAR.pitch}
                  y={0}
                  width={BAR.width}
                  height={BAR.viewBoxHeight}
                  fill={uptimeColor(day.uptime)}
                  className="sp-tag cursor-pointer outline-none"
                  {...griffe(day.day)}
                />
              </TooltipTrigger>
              <TooltipContent
                className="sp-popup"
                arrowClassName="sp-popup-arrow"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
              >
                <TagPopup tag={day} />
              </TooltipContent>
            </Tooltip>
          ))}
        </g>
      </svg>

      <div className="mt-[6px] flex items-center gap-[10px] text-[14px] leading-6 text-[var(--sp-muted)]">
        <span className="shrink-0">
          {zeitraeume.map((z) => (
            <span key={z.tage} className={z.klasse}>
              vor {z.tage} Tagen
            </span>
          ))}
        </span>
        <span className="h-px flex-1 bg-[var(--sp-rule)]" />
        <span className="shrink-0 whitespace-nowrap">
          {zeitraeume.map((z) => (
            <span key={z.tage} className={z.klasse}>
              {formatUptime(z.wert)} Verfügbarkeit
            </span>
          ))}
        </span>
        <span className="h-px flex-1 bg-[var(--sp-rule)]" />
        <span className="shrink-0">Heute</span>
      </div>
    </div>
  );
}
