import { DataError } from "@/components/data-error";
import { HistoryNav } from "@/components/history-nav";
import { Masthead } from "@/components/masthead";
import { QuarterPagination } from "@/components/quarter-pagination";
import { SiteFooter } from "@/components/site-footer";
import { UptimeCalendar } from "@/components/uptime-calendar";
import { getUptimeCalendar, monthsForPage, pageLabel, type UptimeCalendar as Daten } from "@/lib/calendar";

export const metadata = { title: "Verfügbarkeit · Scooly Status" };

export default async function UptimePage(props: PageProps<"/uptime">) {
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.seite ?? 1) || 1);
  const dienst = typeof params.dienst === "string" ? params.dienst : undefined;

  let daten: Daten | null = null;
  let fehler: string | null = null;
  try {
    daten = await getUptimeCalendar(dienst, page);
  } catch (err) {
    fehler = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  return (
    <>
      <Masthead />
      <HistoryNav current="verfuegbarkeit" />

      {daten ? (
        <>
          <div className="mb-[32px] flex flex-wrap items-center justify-end gap-4">
            <QuarterPagination
              basePath="/uptime"
              page={page}
              label={pageLabel(monthsForPage(page))}
              extraQuery={dienst ? { dienst } : undefined}
            />
          </div>
          <UptimeCalendar
            services={daten.services}
            selected={daten.selected}
            months={daten.months}
          />
        </>
      ) : (
        <DataError detail={fehler ?? ""} />
      )}

      <SiteFooter back={{ href: "/", label: "Zum aktuellen Status" }} />
    </>
  );
}
