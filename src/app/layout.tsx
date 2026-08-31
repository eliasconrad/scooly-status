import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

/*
 * ══ DIE STATUSSEITE IST AUCH EINE MARKEN-ADRESSE (01.09.2026) ═══════════════════════════════
 *
 * Sie war schon auf `index, follow` - was fehlte, war `metadataBase`. Ohne die bleiben alle
 * Adressen in den Metadaten relativ, und Open Graph wird damit unbrauchbar: Wer den Link
 * weitergibt, bekommt keine Vorschau.
 *
 * Der zweite Grund ist die Marke. `status.scooly.dev` ist eine eigene Adresse, und Google
 * erkennt eine Unteradresse nicht von selbst als dieselbe Marke wie `www.scooly.dev`. Dafür
 * braucht es Verweise (die stehen im Fussbereich der Hauptseite) UND übereinstimmende Angaben -
 * derselbe `siteName`, dieselbe Sprache, eine kanonische Adresse.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://status.scooly.dev"),
  title: "Scooly Status",
  description: "Aktueller Betriebszustand von Scooly - App, Anmeldung, KI-Aufgaben und Datenbank.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Scooly",
    title: "Scooly Status",
    description: "Aktueller Betriebszustand von Scooly - App, Anmeldung, KI-Aufgaben und Datenbank.",
    url: "/",
    locale: "de_DE"
  },
  alternates: {
    types: {
      "application/atom+xml": "/history.atom",
      "application/rss+xml": "/history.rss",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body
        className="min-h-full"
      >
        <TooltipProvider delayDuration={80}>
          <div className="sp-container">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}
