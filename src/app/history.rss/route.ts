import { rssFeed } from "@/lib/feed";

export const revalidate = 300;

export async function GET() {
  try {
    return new Response(await rssFeed(), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  } catch (err) {
    // Ohne Messdaten lieber ehrlich schweigen als einen leeren Feed als
    // "keine Vorfälle" ausliefern.
    console.error("[feed] nicht erzeugbar:", err);
    return new Response("Feed derzeit nicht verfügbar.", { status: 503 });
  }
}
