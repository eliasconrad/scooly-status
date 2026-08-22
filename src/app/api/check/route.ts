import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runChecks } from "@/lib/checker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Der Wächter. Wird alle 5 Minuten von außen aufgerufen (GitHub Action)
 * und zusätzlich von Vercel Cron als Rückfallebene.
 *
 * Absichtlich von außen getriggert: ein Wächter, der auf derselben Plattform
 * läuft wie das Überwachte, schweigt genau dann, wenn es darauf ankommt.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
    }
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
