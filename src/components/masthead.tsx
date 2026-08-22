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

function ScoolyMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="4" y="4" width="56" height="56" fill="#f5f1e8" />
      <path d="M18 22H46" stroke="#141413" strokeWidth="4" />
      <path d="M18 32H37" stroke="#141413" strokeWidth="4" />
      <path d="M18 42H42" stroke="#141413" strokeWidth="4" />
      <path d="M12 12H52V52H12V12Z" stroke="#141413" strokeWidth="3" />
    </svg>
  );
}
