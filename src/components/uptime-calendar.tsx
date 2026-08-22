"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TagPopup } from "./tag-popup";
import { useTagAuswahl } from "@/lib/use-tag-auswahl";
import { formatUptime, uptimeColor } from "@/lib/uptime";
import type { CalendarMonth } from "@/lib/calendar";

/** Farbe für Tage ohne Messung - beim Original #EAEAEA. */
const KEINE_DATEN = "#eaeaea";

/**
 * Der Verfügbarkeits-Kalender. Gemessen: Monatsblock 260 breit, Tagesfelder
 * 32x32 im Raster 38, Kopfzeile 16px/500 links und 14px gedeckt rechts.
 */
export function UptimeCalendar({ months }: { months: CalendarMonth[] }) {
  const { aktiv, griffe } = useTagAuswahl();

  return (
    <div className="grid grid-cols-1 justify-items-center gap-x-[35px] gap-y-[32px] min-[560px]:grid-cols-2 min-[890px]:grid-cols-3 min-[890px]:justify-items-stretch">
      {months.map((month) => (
        <section
          key={month.label}
          className="w-full max-w-[260px] min-[890px]:max-w-none"
        >
          <div className="flex h-[29px] items-baseline justify-between">
            <h3 className="text-[16px] font-medium leading-[29px]">
              {month.label}
            </h3>
            <small className="text-[14px] leading-[21px] text-[var(--sp-muted)]">
              {formatUptime(month.uptime)}
            </small>
          </div>

          <div className="grid grid-cols-7 gap-x-[6px] gap-y-[6.5px]">
            {month.cells.map((cell, i) =>
              cell === null ? (
                <div key={`leer-${i}`} className="aspect-square" />
              ) : cell.future ? (
                <div key={cell.tag.day} className="aspect-square" />
              ) : (
                <Tooltip key={cell.tag.day} open={aktiv === cell.tag.day}>
                  <TooltipTrigger asChild>
                    <div
                      tabIndex={0}
                      {...griffe(cell.tag.day)}
                      className="aspect-square cursor-pointer outline-none transition-[filter] hover:brightness-75 focus-visible:ring-2 focus-visible:ring-[var(--sp-ink)]"
                      style={{
                        backgroundColor:
                          cell.tag.uptime === null
                            ? KEINE_DATEN
                            : uptimeColor(cell.tag.uptime),
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    className="sp-popup"
                    arrowClassName="sp-popup-arrow"
                    sideOffset={6}
                    collisionPadding={12}
                  >
                    <TagPopup tag={cell.tag} />
                  </TooltipContent>
                </Tooltip>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
