import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Abmeldung. Zwei Wege, weil die Postfächer beides nutzen:
 * GET, wenn jemand auf den Link in der Mail klickt, und POST für die
 * Ein-Klick-Abmeldung über den List-Unsubscribe-Kopf.
 */
async function abmelden(schluessel: string | null): Promise<boolean> {
  const db = supabase();
  if (!db || !schluessel) return false;
  const { data } = await db
    .from("subscribers")
    .delete()
    .eq("unsubscribe", schluessel)
    .select("email");
  return Boolean(data?.length);
}

export async function GET(request: Request) {
  const schluessel = new URL(request.url).searchParams.get("schluessel");
  const ok = await abmelden(schluessel);
  const url = new URL("/abo", request.url);
  url.searchParams.set("status", ok ? "abgemeldet" : "ungueltig");
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const schluessel = new URL(request.url).searchParams.get("schluessel");
  await abmelden(schluessel);
  // Postfächer erwarten hier schlicht ein OK, egal wie es ausging.
  return new NextResponse(null, { status: 200 });
}
