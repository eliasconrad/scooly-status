import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  title: "Scooly Status",
  description: "Aktueller Betriebszustand von Scooly - App, Anmeldung, KI-Aufgaben und Datenbank.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body
        className="min-h-full"
        style={{ fontFamily: "'Inter Variable', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        <SmoothScroll />
        <TooltipProvider delayDuration={80}>
          <div className="mx-auto w-full max-w-[850px] px-5 min-[890px]:px-0">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}
