import { DataError } from "@/components/data-error";
import { Masthead } from "@/components/masthead";
import { PastIncidents } from "@/components/past-incidents";
import { ServiceList } from "@/components/service-list";
import { SiteFooter } from "@/components/site-footer";
import { StatusBanner } from "@/components/status-banner";
import { lastNDays } from "@/lib/demo";
import { getStatusPageData, INCIDENT_DAYS_ON_HOME } from "@/lib/status";
import type { StatusPageData } from "@/lib/types";
import { worstStatus } from "@/lib/uptime";

/** Alle 60 Sekunden neu bauen - der Wächter misst alle 5 Minuten. */
export const revalidate = 60;

export default async function Page() {
  let data: StatusPageData | null = null;
  let failure: string | null = null;

  try {
    data = await getStatusPageData();
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  const days = lastNDays(INCIDENT_DAYS_ON_HOME).reverse();

  return (
    <>
      <Masthead />
      {data ? (
        <>
          <StatusBanner
            status={worstStatus(data.services.map((s) => s.status))}
            lastCheckedAt={data.last_checked_at}
          />
          <ServiceList services={data.services} />
          <PastIncidents incidents={data.incidents} days={days} />
        </>
      ) : (
        <DataError detail={failure ?? ""} />
      )}
      <SiteFooter back={{ href: "/history", label: "Verlauf der Vorfälle" }} />
    </>
  );
}
