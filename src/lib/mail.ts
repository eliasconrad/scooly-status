import { supabase } from "./supabase";

/**
 * Benachrichtigt alle bestätigten Abonnenten über Resend.
 * Ohne RESEND_API_KEY wird nichts verschickt - die Anmeldung selbst
 * funktioniert trotzdem, die Adressen liegen dann nur in der Datenbank.
 */
export async function notifySubscribers(subject: string, body: string): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Scooly Status <status@scooly.at>";
  const db = supabase();
  if (!key || !db) return 0;

  const { data, error } = await db.from("subscribers").select("email").eq("confirmed", true);
  if (error || !data?.length) return 0;

  let sent = 0;
  for (const row of data) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: row.email,
          subject,
          text: `${body}\n\n-- \nScooly Status · ${process.env.PUBLIC_URL ?? "https://status.scooly.at"}`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) sent++;
    } catch (err) {
      console.error("[mail] Versand fehlgeschlagen:", err);
    }
  }
  return sent;
}
