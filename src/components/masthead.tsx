import Link from "next/link";
import { SubscribeButton } from "./subscribe-button";

/**
 * Kopfzeile. Beim Original ist die Wortmarke eine 340x48-Grafik links,
 * rechts der schwarze Abo-Knopf.
 */
export function Masthead() {
  return (
    <header className="flex items-center justify-between pt-[75px] pb-[74px]">
      <Link href="/" className="inline-flex items-center gap-[14px]">
        <ScoolyMark />
        <span className="text-[34px] font-medium leading-none tracking-[-0.02em]">
          Scooly Status
        </span>
      </Link>
      <SubscribeButton />
    </header>
  );
}

/**
 * Das kleine s aus dem scooly-Schriftzug als Kachel - dieselbe Zeichnung
 * wie das Favicon, damit Reiter und Kopfzeile zusammenpassen.
 */
function ScoolyMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" fill="#141413" />
      <g fill="#f5f1e8">
        <rect x="6" y="4.5" width="20" height="5" />
        <rect x="6" y="9.5" width="5" height="4" />
        <rect x="6" y="13.5" width="20" height="5" />
        <rect x="21" y="18.5" width="5" height="4" />
        <rect x="6" y="22.5" width="20" height="5" />
      </g>
    </svg>
  );
}
