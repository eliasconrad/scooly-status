import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runChecks } from "@/lib/checker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Der Wächter. Wird alle 10 Minuten von außen aufgerufen (GitHub Action)
 * und zusätzlich von Vercel Cron als Rückfallebene.
 *
 * Absichtlich von außen getriggert: ein Wächter, der auf derselben Plattform
 * läuft wie das Überwachte, schweigt genau dann, wenn es darauf ankommt.
 */
/**
 * Vergleicht zwei Zeichenketten, ohne beim ersten Unterschied abzubrechen.
 *
 * `a !== b` verrät über die Dauer, wie viele Zeichen am Anfang stimmten -
 * daraus lässt sich ein Geheimnis Zeichen für Zeichen erraten. Über das
 * offene Netz ist das schwer messbar, aber der richtige Vergleich kostet
 * nichts, und der falsche steht in einem öffentlichen Repo zum Nachlesen.
 */
function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual verlangt gleiche Länge - die Länge selbst ist kein
  // Geheimnis, sie steht in der Einrichtungsanleitung.
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // OHNE GEHEIMNIS WIRD NICHT GEMESSEN, sondern abgelehnt. Vorher stand hier
  // `if (secret)`: Fehlte die Variable, war der Endpunkt für jeden offen -
  // und er schreibt in die Datenbank, verschickt Mails und ruft sechs fremde
  // Dienste auf. Eine Sicherung, die bei fehlender Einrichtung aufgeht, ist
  // die gefährlichste Sorte, weil niemand es merkt.
  if (!secret) {
    console.error("[waechter] CRON_SECRET fehlt - Messlauf abgelehnt.");
    return NextResponse.json({ error: "Nicht eingerichtet." }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!gleich(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  try {
    const reports = await runChecks();
    revalidatePath("/");
    revalidatePath("/history");

    return NextResponse.json({
      checked_at: new Date().toISOString(),
      services: reports.map((r) => ({
        slug: r.slug,
        ok: r.probe.ok,
        degraded: r.probe.degraded,
        response_ms: r.probe.response_ms,
        status: r.statusAfter,
        action: r.action,
      })),
    });
  } catch (err) {
    console.error("[waechter] Durchlauf fehlgeschlagen:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
