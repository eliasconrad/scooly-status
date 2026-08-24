import { AktuelleStoerung } from "@/components/aktuelle-stoerung";
import { DataError } from "@/components/data-error";
import { Masthead } from "@/components/masthead";
import { PastIncidents } from "@/components/past-incidents";
import { ServiceList } from "@/components/service-list";
import { SiteFooter } from "@/components/site-footer";
import { StatusBanner } from "@/components/status-banner";
import { lastNDays } from "@/lib/demo";
import { getStatusPageData, INCIDENT_DAYS_ON_HOME } from "@/lib/status";
import type { StatusPageData } from "@/lib/types";
import { bannerBetroffen, offeneVorfaelle } from "@/lib/stoerung";
import { waechterSchweigt } from "@/lib/schweigen";
import { TAKT_MINUTEN } from "@/lib/zustand";
import { worstStatus } from "@/lib/uptime";

/** Alle 60 Sekunden neu bauen - der Wächter misst alle 5 Minuten. */
export const revalidate = 60;

export default async function Page() {
  let data: StatusPageData | null = null;
  let failure: string | null = null;

  try {
    data = await getStatusPageData();
    if (data.services.length === 0) {
      // Keine Dienste heißt: nichts gemessen. Ein grünes Banner wäre erfunden.
      throw new Error("Es sind keine Dienste eingetragen, die überwacht werden.");
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  const days = lastNDays(INCIDENT_DAYS_ON_HOME).reverse();

  return (
    <>
      <Masthead />
      {data?.demo && (
        <p className="mb-[16px] rounded-[4px] border border-dashed border-[var(--sp-rule)] px-[12px] py-[8px] text-[14px] leading-6 text-[var(--sp-muted)]">
          Demodaten - es hängt keine Datenbank dran. Nichts davon ist gemessen.
        </p>
      )}
      {data ? (
        <>
          <StatusBanner
            status={worstStatus(data.services.map((s) => s.status))}
            lastCheckedAt={data.last_checked_at}
            betroffen={bannerBetroffen(data.services)}
            dicht={offeneVorfaelle(data.incidents).length > 0}
            schweigt={waechterSchweigt(data.last_checked_at, TAKT_MINUTEN)}
          />
          <AktuelleStoerung incidents={data.incidents} services={data.services} />
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
