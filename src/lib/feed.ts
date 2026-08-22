import { getIncidentHistory } from "./status";
import { INCIDENT_STATUS_LABEL } from "./uptime";
import type { Incident } from "./types";

const BASIS = process.env.PUBLIC_URL ?? "https://status.scooly.at";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function beschreibung(incident: Incident): string {
  return incident.updates
    .map((u) => `${INCIDENT_STATUS_LABEL[u.status] ?? u.status} - ${u.body} (${u.created_at})`)
    .join("\n");
}

export async function atomFeed(): Promise<string> {
  const incidents = await getIncidentHistory(12);
  const aktualisiert = incidents[0]?.updates[0]?.created_at ?? new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Scooly Status - Vorfälle</title>
  <link href="${BASIS}/history.atom" rel="self"/>
  <link href="${BASIS}"/>
  <updated>${aktualisiert}</updated>
  <id>${BASIS}/</id>
${incidents
  .map(
    (i) => `  <entry>
    <id>${BASIS}/incidents/${i.id}</id>
    <title>${escape(i.title)}</title>
    <updated>${i.updates[0]?.created_at ?? i.started_at}</updated>
    <link href="${BASIS}/history"/>
    <content type="text">${escape(beschreibung(i))}</content>
  </entry>`,
  )
  .join("\n")}
</feed>`;
}

export async function rssFeed(): Promise<string> {
  const incidents = await getIncidentHistory(12);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Scooly Status - Vorfälle</title>
    <link>${BASIS}</link>
    <description>Störungen und Wartungen bei Scooly</description>
    <language>de</language>
${incidents
  .map(
    (i) => `    <item>
      <guid isPermaLink="false">${i.id}</guid>
      <title>${escape(i.title)}</title>
      <link>${BASIS}/history</link>
      <pubDate>${new Date(i.started_at).toUTCString()}</pubDate>
      <description>${escape(beschreibung(i))}</description>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;
}
