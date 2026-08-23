import { holeZustand } from "@/lib/zustand";

/**
 * Öffentliche Kurzfassung des Zustands, für Scooly selbst.
 *
 * Offen für alle und ohne Schlüssel: Der Zustand steht ohnehin für jeden
 * lesbar auf der Startseite. Ein Schlüssel hier hieße nur, ihn in die App
 * zu bauen, wo ihn jeder wieder herausholen kann.
 *
 * Eine Minute Zwischenspeicher am Rand: Der Wächter misst alle fünf
 * Minuten, häufiger fragen bringt nichts. Fällt die Statusseite selbst
 * aus, kommt 503 - dann soll die App ihren eigenen Hinweis zeigen und
 * nicht behaupten, alles sei in Ordnung.
 */
export const revalidate = 60;

const KOPFZEILEN = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  // Scooly läuft auf einer anderen Adresse und muss von dort lesen dürfen.
  "Access-Control-Allow-Origin": "*",
};

export async function GET() {
  try {
    const zustand = await holeZustand(process.env.PUBLIC_URL ?? "https://status.scooly.dev");
    return Response.json(zustand, { headers: KOPFZEILEN });
  } catch {
    // Bewusst ohne Einzelheiten: Wer den Zustand abfragt, kann mit dem
    // Innenleben der Statusseite nichts anfangen.
    return Response.json(
      { fehler: "Der Zustand ist gerade nicht abrufbar." },
      { status: 503, headers: KOPFZEILEN },
    );
  }
}
