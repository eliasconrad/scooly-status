/**
 * Kurze Nachricht an Elias, wenn sich der Zustand ändert.
 * Ohne gesetzte Umgebungsvariablen passiert schlicht nichts.
 */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error("[telegram] Nachricht nicht zugestellt:", err);
  }
}
