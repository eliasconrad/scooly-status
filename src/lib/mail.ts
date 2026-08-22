import { baueHtml, baueText, type Meldung } from "./mail-vorlage";
import { supabase } from "./supabase";
import type { IncidentImpact } from "./types";

const BASIS = process.env.PUBLIC_URL ?? "https://status.scooly.dev";
const ABSENDER = process.env.RESEND_FROM ?? "Scooly Status <status@scooly.dev>";
/** Nur für Tests umstellbar - im Betrieb immer Resend. */
const RESEND_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export type MailErgebnis = {
  gesendet: number;
  fehlgeschlagen: number;
  /** false, wenn gar kein Versand eingerichtet ist. */
  eingerichtet: boolean;
};

export function versandEingerichtet(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

type MailEingang = {
  an: string;
  betreff: string;
  /** Überschrift im farbigen Band. Ohne Angabe wird der Betreff genommen. */
  titel?: string;
  text: string;
  impact?: IncidentImpact;
  /** Abmeldeschlüssel - landet im Link und im List-Unsubscribe-Kopf. */
  abmelden?: string;
};

/**
 * Eine einzelne Mail über Resend.
 *
 * Jede Empfängeradresse geht in einer eigenen Anfrage raus. Alle zusammen in
 * ein `to` zu packen wäre bequemer, würde aber sämtliche Adressen an alle
 * verteilen.
 */
async function senden({ an, betreff, titel, text, impact, abmelden }: MailEingang): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const abmeldeLink = abmelden ? `${BASIS}/api/abmelden?schluessel=${abmelden}` : null;

  const meldung: Meldung = {
    titel: titel ?? betreff,
    text,
    impact: impact ?? "minor",
    basis: BASIS,
    abmeldeLink,
  };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ABSENDER,
        to: an,
        subject: betreff,
        // Beides mitschicken: HTML für die Ansicht, Text für Postfächer
        // ohne HTML und für die Vorschauzeile.
        html: baueHtml(meldung),
        text: baueText(meldung),
        // Ein-Klick-Abmeldung, wie es die Postfächer erwarten.
        headers: abmeldeLink
          ? {
              "List-Unsubscribe": `<${abmeldeLink}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[mail] Resend antwortete mit ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] Versand fehlgeschlagen:", err);
    return false;
  }
}

/** Bestätigungsmail nach dem Eintragen. */
export async function sendeBestaetigung(email: string, token: string): Promise<boolean> {
  return senden({
    an: email,
    betreff: "Scooly Status: Bitte bestätigen",
    titel: "Noch ein Klick",
    impact: "none",
    text:
      `Du möchtest benachrichtigt werden, wenn es bei Scooly eine Störung gibt.\n\n` +
      `Bestätige das hier: ${BASIS}/api/confirm?token=${token}\n\n` +
      `Wenn du das nicht warst, ignorier diese Mail einfach - ohne Bestätigung ` +
      `bekommst du nichts von uns.`,
  });
}

export type Empfaenger = { email: string; unsubscribe: string };

/**
 * Verteilt eine Meldung an eine Empfängerliste.
 *
 * Bewusst eine Anfrage je Adresse: Alle in ein `to` zu packen wäre schneller,
 * würde aber jedem Empfänger sämtliche Adressen der anderen zeigen.
 * Ein Fehlschlag bei einem Empfänger stoppt die übrigen nicht.
 */
export async function sendeAnEmpfaenger(
  empfaenger: Empfaenger[],
  betreff: string,
  text: string,
  impact: IncidentImpact = "minor",
  titel?: string,
): Promise<MailErgebnis> {
  if (!versandEingerichtet()) {
    return { gesendet: 0, fehlgeschlagen: 0, eingerichtet: false };
  }

  let gesendet = 0;
  let fehlgeschlagen = 0;
  for (const e of empfaenger) {
    const ok = await senden({ an: e.email, betreff, titel, text, impact, abmelden: e.unsubscribe });
    if (ok) gesendet++;
    else fehlgeschlagen++;
  }

  if (fehlgeschlagen > 0) {
    console.error(`[mail] ${fehlgeschlagen} von ${empfaenger.length} Meldungen kamen nicht raus.`);
  }
  return { gesendet, fehlgeschlagen, eingerichtet: true };
}

/** Meldung an alle bestätigten Abonnenten. */
export async function notifySubscribers(
  betreff: string,
  text: string,
  impact: IncidentImpact = "minor",
  titel?: string,
): Promise<MailErgebnis> {
  const db = supabase();
  if (!versandEingerichtet() || !db) {
    return { gesendet: 0, fehlgeschlagen: 0, eingerichtet: versandEingerichtet() && Boolean(db) };
  }

  const { data, error } = await db
    .from("subscribers")
    .select("email, unsubscribe")
    .eq("confirmed", true);

  if (error) {
    console.error("[mail] Abonnenten nicht abrufbar:", error);
    return { gesendet: 0, fehlgeschlagen: 0, eingerichtet: true };
  }

  return sendeAnEmpfaenger(
    (data ?? []).map((row) => ({
      email: row.email as string,
      unsubscribe: row.unsubscribe as string,
    })),
    betreff,
    text,
    impact,
    titel,
  );
}
