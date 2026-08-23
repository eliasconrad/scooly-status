import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sendeBestaetigung, versandEingerichtet } from "@/lib/mail";
import { supabase } from "@/lib/supabase";
import { abosBremse } from "@/lib/abo-bremse";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  // 254 ist das Maximum, das der Mailstandard erlaubt (RFC 5321). Ohne diese
  // Grenze landete am 23.08. beim Prüfen eine 5012 Zeichen lange "Adresse" in
  // der Datenbank - die Musterprüfung allein hält sie nicht auf.
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Diese Adresse sieht nicht richtig aus." }, { status: 400 });
  }

  const db = supabase();
  if (!db) {
    return NextResponse.json({ error: "Das Abo ist gerade nicht verfügbar." }, { status: 503 });
  }

  // Bremse je Absender. Die Sperrfrist weiter unten gilt je ADRESSE und
  // verhindert, dass jemand einer fremden Adresse zwanzig Mails schickt.
  // Sie verhindert nicht, dass jemand zwanzigtausend VERSCHIEDENE Adressen
  // einträgt - jede davon eine echte Mail von unserer Domain, bis Resend
  // dichtmacht und Scoolys Post im Spam landet.
  const { darf, versuch } = await abosBremse(db, request);
  if (!darf) {
    console.warn(`[abo] Bremse gegriffen, Versuch ${versuch} in dieser Stunde`);
    return NextResponse.json(
      { error: "Zu viele Anmeldungen von hier. Versuch es in einer Stunde noch einmal." },
      { status: 429 },
    );
  }

  // Wer schon bestätigt hat, bleibt bestätigt. Sonst könnte jeder durch
  // erneutes Eintragen einer fremden Adresse deren Abo stilllegen.
  const { data: vorhanden } = await db
    .from("subscribers")
    .select("confirmed, unsubscribe, created_at")
    .eq("email", email)
    .maybeSingle();

  if (vorhanden?.confirmed) {
    return NextResponse.json({ message: "Diese Adresse ist bereits eingetragen." });
  }

  // Sperrfrist gegen wiederholtes Eintragen fremder Adressen: Sonst könnte
  // jemand durch mehrfaches Absenden beliebig viele Bestätigungsmails an
  // eine Adresse schicken lassen. Die Antwort bleibt dieselbe, damit sich
  // daran nicht ablesen lässt, ob eine Adresse schon eingetragen ist.
  const SPERRFRIST_MINUTEN = 10;
  if (vorhanden?.created_at) {
    const alter = (Date.now() - new Date(vorhanden.created_at as string).getTime()) / 60000;
    if (alter < SPERRFRIST_MINUTEN) {
      return NextResponse.json({
        message: "Fast geschafft - bestätige die Mail in deinem Postfach.",
      });
    }
  }

  const token = randomUUID();
  const { error } = await db.from("subscribers").upsert(
    {
      email,
      token,
      unsubscribe: (vorhanden?.unsubscribe as string | undefined) ?? randomUUID(),
      confirmed: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  if (error) {
    console.error("[abo] Eintrag fehlgeschlagen:", error);
    return NextResponse.json({ error: "Das hat nicht geklappt." }, { status: 500 });
  }

  // Ohne eingerichteten Versand nichts versprechen, was nicht passiert.
  if (!versandEingerichtet()) {
    console.warn("[abo] RESEND_API_KEY fehlt - es wurde keine Bestätigungsmail verschickt.");
    return NextResponse.json(
      { error: "Der Mailversand ist noch nicht eingerichtet. Bitte später noch einmal." },
      { status: 503 },
    );
  }

  const verschickt = await sendeBestaetigung(email, token);
  if (!verschickt) {
    return NextResponse.json(
      { error: "Die Bestätigungsmail ließ sich nicht verschicken. Bitte später noch einmal." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    message: "Fast geschafft - bestätige die Mail in deinem Postfach.",
  });
}
