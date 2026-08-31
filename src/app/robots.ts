import type { MetadataRoute } from "next";

/**
 * Bis zum 01.09.2026 gab es hier keine robots.txt - der Abruf lieferte die HTML-Seite. Ein
 * Crawler liest daraus keine Regeln und nimmt „alles erlaubt" an; das Ergebnis stimmte also
 * zufällig, aber der Verweis auf die Sitemap fehlte.
 *
 * `/api` liefert kein Dokument und ist gesperrt. Die beiden Nachrichtenkanäle (`/history.atom`,
 * `/history.rss`) bleiben offen - sie sind für Lesegeräte gedacht, und ein Crawler, der sie
 * kennt, schadet nicht.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: "https://status.scooly.dev/sitemap.xml",
    host: "https://status.scooly.dev"
  };
}
