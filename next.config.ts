import type { NextConfig } from "next";

/**
 * Sicherheits-Kopfzeilen.
 *
 * Vercel liefert von sich aus nur HSTS. Die drei hier kosten nichts und
 * schliessen die Lücken, die bei einer öffentlichen Seite mit einem
 * Formular übrig bleiben:
 *
 *   nosniff        Der Browser soll Dateien nicht nach eigenem Gutdünken
 *                  als etwas anderes deuten, als der Content-Type sagt.
 *   frame-ancestors  Niemand darf die Seite in einen Rahmen legen und das
 *                  Abo-Formular unter einer eigenen Oberfläche verstecken.
 *                  X-Frame-Options steht daneben für ältere Browser.
 *   Referrer-Policy  Beim Klick auf einen fremden Link soll nicht die
 *                  volle Adresse mitgehen - die trägt bei uns Bestätigungs-
 *                  und Abmeldeschlüssel in der Abfrage.
 *
 * Bewusst KEINE vollständige CSP für Skripte: Next spielt eigene Inline-
 * Skripte aus, die dafür Nonces bräuchten. Eine CSP, die man mit
 * 'unsafe-inline' aufweichen muss, ist eine Behauptung und kein Schutz.
 */
const kopfzeilen = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:pfad*", headers: kopfzeilen }];
  },
};

export default nextConfig;
