"use client";

import { motion, useReducedMotion } from "motion/react";
import { BANNER_LABEL, STATUS_COLOR } from "@/lib/uptime";
import type { ComponentStatus } from "@/lib/types";

/**
 * Das breite Statusband. Gemessen: Padding 12/20, Radius 4, Überschrift
 * 20px/500 in Weiß, darunter der Zeitstempel in 14px auf 80 % Weiß.
 */
export function StatusBanner({
  status,
  lastCheckedAt,
  betroffen,
  dicht = false,
}: {
  status: ComponentStatus;
  lastCheckedAt: string | null;
  /** "Betroffen: Anmeldung und Scooly KI" - null, wenn alles läuft. */
  betroffen?: string | null;
  /** true, wenn direkt darunter die laufende Störung steht - dann rückt sie näher. */
  dicht?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      role="status"
      className={`rounded-[4px] ${dicht ? "mb-[24px]" : "mb-[70px] min-[651px]:mb-[100px]"}`}
      style={{ backgroundColor: STATUS_COLOR[status], padding: "var(--sp-band-pad)" }}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2
        className="font-medium text-white"
        style={{ fontSize: "var(--sp-band-size)", lineHeight: "var(--sp-band-line)" }}
      >
        {BANNER_LABEL[status]}
      </h2>
      <span className="block text-[14px] leading-[21px] text-white/80">
        {[betroffen, lastCheckedAt ? `Zuletzt geprüft ${relativeTime(lastCheckedAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </motion.div>
  );
}

function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Minute${diffMin === 1 ? "" : "n"}`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `vor ${h} Stunde${h === 1 ? "" : "n"}`;
  const d = Math.round(h / 24);
  return `vor ${d} Tag${d === 1 ? "" : "en"}`;
}
