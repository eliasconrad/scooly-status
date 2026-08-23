import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bremse gegen massenhaftes Eintragen fremder Adressen.
 *
 * WARUM ÜBERHAUPT: `/api/subscribe` muss offen sein, sonst kann sich niemand
 * eintragen. Die Sperrfrist in der Route gilt je ADRESSE - sie verhindert
 * zwanzig Mails an dieselbe Adresse, nicht zwanzigtausend Adressen. Jede
 * davon wäre eine echte Mail von status@scooly.dev; das verbrennt das
 * Resend-Kontingent und den Ruf der Absenderdomain, bis auch Scoolys übrige
 * Post im Spam landet.
 *
 * WARUM NUR EIN HASH: Die IP selbst wird nie gebraucht, nur die Frage "schon
 * wieder derselbe?". Gespeichert wird sha256(IP + Salz). Ohne Salz wäre der
 * Hash zurückzurechnen - IPv4 hat vier Milliarden Möglichkeiten, das ist
 * Sekundenarbeit.
 */

/** So viele Anmeldeversuche pro Absender und Stunde. */
export const GRENZE_PRO_STUNDE = Number(process.env.ABO_GRENZE_PRO_STUNDE ?? 5);

/**
 * Die Adresse des Anfragenden. Auf Vercel steht sie in `x-forwarded-for`,
 * das eine Kette sein kann - der erste Eintrag ist der ursprüngliche Absender.
 */
export function absenderIp(request: Request): string | null {
  const kette = request.headers.get("x-forwarded-for");
  if (kette) return kette.split(",")[0]!.trim() || null;
  return request.headers.get("x-real-ip");
}

/**
 * Hash mit Salz. Ohne gesetztes Salz wird nicht gehasht, sondern gebremst:
 * Eine Sicherung, die im Zweifel durchlässt, ist keine - und ein ungesalzener
 * Hash wäre nur die Illusion von Datensparsamkeit.
 */
export function ipHash(ip: string, salz: string): string {
  return createHash("sha256").update(`${salz}:${ip}`).digest("hex");
}

export type Bremsurteil = { darf: boolean; versuch: number };

export async function abosBremse(
  db: SupabaseClient,
  request: Request,
): Promise<Bremsurteil> {
  const salz = process.env.IP_SALT;
  const ip = absenderIp(request);

  // Kein Salz oder keine erkennbare Adresse: durchlassen, aber laut sein.
  // Beides ist ein Fehler in der Einrichtung, kein Angriff - und ein
  // Formular, das niemanden mehr einträgt, wäre die schlechtere Störung.
  if (!salz || !ip) {
    console.warn(`[abo] Bremse ohne Wirkung: ${!salz ? "IP_SALT fehlt" : "keine Absenderadresse"}`);
    return { darf: true, versuch: 0 };
  }

  const { data, error } = await db.rpc("abo_kontingent", {
    p_ip_hash: ipHash(ip, salz),
    p_grenze: GRENZE_PRO_STUNDE,
  });

  // Fehlt die Funktion noch (Schritt 14 nicht ausgeführt), nicht das ganze
  // Abo lahmlegen - aber sichtbar meckern.
  if (error) {
    console.error("[abo] Bremse nicht abfragbar:", error.message);
    return { darf: true, versuch: 0 };
  }

  const versuch = Number(data ?? 0);
  return { darf: versuch > 0, versuch };
}
