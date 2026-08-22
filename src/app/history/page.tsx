import { DataError } from "@/components/data-error";
import { Masthead } from "@/components/masthead";
import { PastIncidents } from "@/components/past-incidents";
import { SiteFooter } from "@/components/site-footer";
import { lastNDays } from "@/lib/demo";
import { getIncidentHistory } from "@/lib/status";
import type { Incident } from "@/lib/types";

export const revalidate = 300;

export const metadata = { title: "Verlauf · Scooly Status" };

export default async function HistoryPage() {
  let incidents: Incident[] | null = null;
  let failure: string | null = null;

  try {
    incidents = await getIncidentHistory(3);
  } catch (err) {
    failure = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  return (
    <>
      <Masthead />
      {incidents ? (
        <PastIncidents
          incidents={incidents}
          days={lastNDays(90).reverse()}
          heading="Verlauf der Vorfälle"
        />
      ) : (
        <DataError detail={failure ?? ""} />
      )}
      <SiteFooter back={{ href: "/", label: "Zurück zum Status" }} />
    </>
  );
}
