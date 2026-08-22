import { AlertTriangle } from "lucide-react";

/**
 * Wenn die Messdaten nicht erreichbar sind, zeigt die Seite das offen an.
 * Ein grünes Banner ohne Grundlage wäre schlimmer als gar keine Seite.
 */
export function DataError({ detail }: { detail: string }) {
  return (
    <div className="mb-[70px] rounded-[4px] bg-[var(--sp-ink)] px-5 py-3">
      <h2 className="flex items-center gap-2 text-[20px] font-medium leading-[29px] text-white">
        <AlertTriangle size={18} strokeWidth={2} />
        Status derzeit nicht abrufbar
      </h2>
      <span className="block text-[14px] leading-[21px] text-white/80">
        Diese Seite erreicht ihre eigenen Messdaten gerade nicht. Das sagt nichts darüber aus,
        ob Scooly läuft.
      </span>
      <span className="mt-2 block text-[12px] leading-[18px] text-white/50">{detail}</span>
    </div>
  );
}
