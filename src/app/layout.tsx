import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Scooly Status",
  description: "Aktueller Betriebszustand von Scooly - App, Anmeldung, KI-Aufgaben und Datenbank.",
  robots: { index: true, follow: true },
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
