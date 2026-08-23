import { IMPACT_COLOR, INCIDENT_STATUS_LABEL } from "@/lib/uptime";
import { aufzaehlung, dienstNamen, neuesteMeldung, offeneVorfaelle, seitText } from "@/lib/stoerung";
import type { Incident, ServiceStatus } from "@/lib/types";

/**
 * Was gerade läuft, direkt unter dem Banner.
 *
 * Ohne diesen Block müsste man sich die laufende Störung aus einer Farbe und
 * der Vorfallsliste weiter unten zusammenreimen. Hier steht in einem Satz,
 * was betroffen ist, seit wann, und was zuletzt gemeldet wurde.
 * Ist nichts offen, rendert der Block gar nichts.
 */
export function AktuelleStoerung({
  incidents,
  services,
}: {
  incidents: Incident[];
  services: ServiceStatus[];
}) {
  const offen = offeneVorfaelle(incidents);
  if (offen.length === 0) return null;

  return (
    <section className="mb-[40px] min-[651px]:mb-[56px]">
      <h2 className="mb-[10px] text-[14px] leading-6 font-medium text-[var(--sp-muted)]">
        {offen.length === 1 ? "Aktuelle Störung" : "Aktuelle Störungen"}
      </h2>

      <div className="overflow-hidden rounded-[4px] border border-[var(--sp-rule)]">
        {offen.map((vorfall, i) => {
          const meldung = neuesteMeldung(vorfall);
          const namen = dienstNamen(services, vorfall.service_slugs);
          return (
            <article
              key={vorfall.id}
              className={i > 0 ? "border-t border-[var(--sp-rule)]" : undefined}
              style={{ padding: "var(--sp-row-pad)" }}
            >
              <h3
                className="font-medium leading-[1.45]"
                style={{
                  color: IMPACT_COLOR[vorfall.impact],
                  fontSize: "var(--sp-incident-size)",
                }}
              >
                {vorfall.title}
              </h3>

              <p className="pt-[2px] text-[14px] leading-[21px] text-[var(--sp-muted)]">
                {namen.length > 0 ? `Betrifft ${aufzaehlung(namen)} · ` : ""}
                {seitText(vorfall.started_at)}
              </p>

              {meldung && (
                <p className="pt-[12px] text-[16px] leading-6">
                  <strong className="font-semibold">
                    {INCIDENT_STATUS_LABEL[meldung.status] ?? meldung.status}
                  </strong>
                  {" - "}
                  {meldung.body}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
