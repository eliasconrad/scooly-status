import { DataError } from "@/components/data-error";
import { HistoryNav } from "@/components/history-nav";
import { Masthead } from "@/components/masthead";
import { QuarterPagination } from "@/components/quarter-pagination";
import { SiteFooter } from "@/components/site-footer";
import { DienstAuswahl } from "@/components/dienst-auswahl";
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
          {/* Kopfzeile wie im Original: Auswahl links, Blätterung rechts -
              auf schmalen Geräten untereinander, Auswahl zuerst. */}
          <div className="mb-[32px] flex flex-col gap-4 min-[651px]:h-[48px] min-[651px]:flex-row min-[651px]:items-center min-[651px]:justify-between">
            <DienstAuswahl services={daten.services} selected={daten.selected} />
            <QuarterPagination
              basePath="/uptime"
              page={page}
              label={pageLabel(monthsForPage(page))}
              extraQuery={dienst ? { dienst } : undefined}
            />
          </div>
          <UptimeCalendar months={daten.months} />
        </>
      ) : (
        <DataError detail={fehler ?? ""} />
      )}

      <SiteFooter back={{ href: "/", label: "Zum aktuellen Status" }} />
    </>
  );
}
