import type { MetadataRoute } from "next";

const BASIS = "https://status.scooly.dev";

/**
 * Drei Seiten. Die Startseite ändert sich laufend (sie zeigt den aktuellen Zustand), der Verlauf
 * täglich, die Verfügbarkeitszahlen ebenso. `/abo` ist eine Einstellung und ändert sich nie.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const jetzt = new Date();
  return [
    { url: `${BASIS}/`, lastModified: jetzt, changeFrequency: "hourly", priority: 1 },
    { url: `${BASIS}/history`, lastModified: jetzt, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASIS}/uptime`, lastModified: jetzt, changeFrequency: "daily", priority: 0.5 }
  ];
}
