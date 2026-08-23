/**
 * Kurze Nachricht an Elias, wenn sich der Zustand ändert.
 * Ohne gesetzte Umgebungsvariablen passiert schlicht nichts.
 */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const antwort = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(8000),
    });

    // Telegram antwortet auf einen falschen Chat oder einen blockierten Bot
    // mit 400 und nicht mit einem Fehler. Ohne diese Prüfung stürbe der
    // Meldeweg lautlos - und das ist der schlimmste Zustand für einen
    // Alarmkanal: Man verlässt sich darauf und merkt erst nichts.
    if (!antwort.ok) {
      const grund = await antwort.json().catch(() => null);
      console.error(
        `[telegram] Abgelehnt (HTTP ${antwort.status}): ${grund?.description ?? "kein Grund genannt"}`,
      );
    }
  } catch (err) {
    console.error("[telegram] Nachricht nicht zugestellt:", err);
  }
}
