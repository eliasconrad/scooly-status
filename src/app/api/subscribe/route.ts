import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { sendeBestaetigung, versandEingerichtet } from "@/lib/mail";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Diese Adresse sieht nicht richtig aus." }, { status: 400 });
  }

  const db = supabase();
  if (!db) {
    return NextResponse.json({ error: "Das Abo ist gerade nicht verfügbar." }, { status: 503 });
  }

  // Wer schon bestätigt hat, bleibt bestätigt. Sonst könnte jeder durch
  // erneutes Eintragen einer fremden Adresse deren Abo stilllegen.
  const { data: vorhanden } = await db
    .from("subscribers")
    .select("confirmed, unsubscribe")
    .eq("email", email)
    .maybeSingle();

  if (vorhanden?.confirmed) {
    return NextResponse.json({ message: "Diese Adresse ist bereits eingetragen." });
  }

  const token = randomUUID();
  const { error } = await db.from("subscribers").upsert(
    {
      email,
      token,
      unsubscribe: (vorhanden?.unsubscribe as string | undefined) ?? randomUUID(),
      confirmed: false,
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
