import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Blätterung über Quartale. Gemessen: Pfeilfelder 34x34, 1px Rahmen,
 * Radius 4, Beschriftung dazwischen in 16px.
 */
export function QuarterPagination({
  basePath,
  page,
  label,
  extraQuery,
}: {
  basePath: string;
  page: number;
  label: string;
  extraQuery?: Record<string, string>;
}) {
  const href = (p: number) => {
    const params = new URLSearchParams(extraQuery);
    if (p > 1) params.set("seite", String(p));
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  // Weiter (jüngere Quartale) gibt es nur, wenn man schon zurückgeblättert hat.
  const canForward = page > 1;

  return (
    <div className="flex items-center gap-[10px]">
      <Link
        href={href(page + 1)}
        aria-label="Vorheriges Quartal"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[4px] border border-[var(--sp-rule)] text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </Link>

      <span className="text-[16px] leading-6">{label}</span>

      {canForward ? (
        <Link
          href={href(page - 1)}
          aria-label="Nächstes Quartal"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[4px] border border-[var(--sp-rule)] text-[var(--sp-muted)] hover:text-[var(--sp-ink)]"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </Link>
      ) : (
        <span
          aria-hidden
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[4px] border border-[var(--sp-rule)] text-[var(--sp-rule)]"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </span>
      )}
    </div>
  );
}
