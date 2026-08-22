import type { Incident, RelatedIncident } from "./types";

/**
 * Ordnet jedem Tag die Vorfälle zu, die an diesem Tag diesen Dienst betrafen.
 *
 * Ein Vorfall zählt für jeden Tag zwischen Beginn und Behebung - ein Ausfall
 * über Mitternacht taucht deshalb an beiden Tagen auf, so wie beim Original.
 * Schlüssel ist `slug:YYYY-MM-DD`.
 */
export function incidentsByDay(
  incidents: Incident[],
  jetzt = new Date(),
): Map<string, RelatedIncident[]> {
  const map = new Map<string, RelatedIncident[]>();

  for (const incident of incidents) {
    const von = new Date(incident.started_at);
    if (Number.isNaN(von.getTime())) continue;

    const roh = incident.resolved_at ? new Date(incident.resolved_at) : jetzt;
    // Ein Vorfall, der vor seinem Beginn behoben wurde, ist ein Datenfehler -
    // dann zählt nur der Starttag.
    const bis = Number.isNaN(roh.getTime()) || roh < von ? von : roh;

    const kurz: RelatedIncident = {
      id: incident.id,
      title: incident.title,
      impact: incident.impact,
    };

    const tag = new Date(Date.UTC(von.getUTCFullYear(), von.getUTCMonth(), von.getUTCDate()));
    // Sicherheitsnetz: ein Vorfall, der nie geschlossen wurde, soll die
    // Schleife nicht endlos laufen lassen.
    for (let i = 0; i < 400 && tag.getTime() <= bis.getTime(); i++) {
      const datum = tag.toISOString().slice(0, 10);
      for (const slug of incident.service_slugs) {
        const key = `${slug}:${datum}`;
        const liste = map.get(key);
        if (liste) {
          if (!liste.some((v) => v.id === kurz.id)) liste.push(kurz);
        } else {
          map.set(key, [kurz]);
        }
      }
      tag.setUTCDate(tag.getUTCDate() + 1);
    }
  }
  return map;
}
