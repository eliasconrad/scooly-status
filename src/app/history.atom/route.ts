import { atomFeed } from "@/lib/feed";

export const revalidate = 300;

export async function GET() {
  try {
    return new Response(await atomFeed(), {
      headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
    });
  } catch (err) {
    // Ohne Messdaten lieber ehrlich schweigen als einen leeren Feed als
    // "keine Vorfälle" ausliefern.
    console.error("[feed] nicht erzeugbar:", err);
    return new Response("Feed derzeit nicht verfügbar.", { status: 503 });
  }
}
