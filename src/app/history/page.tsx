import { DataError } from "@/components/data-error";
import { HistoryNav } from "@/components/history-nav";
import { IncidentMonth } from "@/components/incident-month";
import { Masthead } from "@/components/masthead";
import { QuarterPagination } from "@/components/quarter-pagination";
import { SiteFooter } from "@/components/site-footer";
import { monthName, monthsForPage, pageLabel } from "@/lib/calendar";
import { getIncidentsForMonths } from "@/lib/status";
import type { Incident } from "@/lib/types";

export const metadata = { title: "Vorfälle · Scooly Status" };

export default async function HistoryPage(props: PageProps<"/history">) {
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.seite ?? 1) || 1);
  const months = monthsForPage(page);

  let grouped: Map<string, Incident[]> | null = null;
  let fehler: string | null = null;
  try {
    grouped = await getIncidentsForMonths(months);
  } catch (err) {
    fehler = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  return (
    <>
      <Masthead />
      <HistoryNav current="vorfaelle" />

      {grouped ? (
        <>
          <div className="mb-[32px] flex justify-end">
            <QuarterPagination basePath="/history" page={page} label={pageLabel(months)} />
          </div>

          {[...months].reverse().map((m) => (
            <IncidentMonth
              key={`${m.year}-${m.month}`}
              label={monthName(m)}
              incidents={grouped.get(`${m.year}-${m.month}`) ?? []}
            />
          ))}
        </>
      ) : (
        <DataError detail={fehler ?? ""} />
      )}

      <SiteFooter back={{ href: "/", label: "Zum aktuellen Status" }} />
    </>
  );
}
