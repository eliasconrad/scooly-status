import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
    .select("confirmed")
    .eq("email", email)
    .maybeSingle();

  if (vorhanden?.confirmed) {
    return NextResponse.json({ message: "Diese Adresse ist bereits eingetragen." });
  }

  const token = randomUUID();
  const { error } = await db
    .from("subscribers")
    .upsert({ email, token, confirmed: false }, { onConflict: "email" });

  if (error) {
    console.error("[abo] Eintrag fehlgeschlagen:", error);
    return NextResponse.json({ error: "Das hat nicht geklappt." }, { status: 500 });
  }

  const base = process.env.PUBLIC_URL ?? "https://status.scooly.at";
  const link = `${base}/api/confirm?token=${token}`;
  const sent = await sendConfirmation(email, link);

  return NextResponse.json({
    message: sent
      ? "Fast geschafft - bestätige die E-Mail in deinem Postfach."
      : "Eingetragen. Die Bestätigungsmail kommt, sobald der Versand eingerichtet ist.",
  });
}

async function sendConfirmation(email: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Scooly Status <status@scooly.at>",
        to: email,
        subject: "Scooly Status: Abo bestätigen",
        text: `Bestätige dein Abo für Störungsmeldungen von Scooly:\n\n${link}\n\nWenn du das nicht warst, ignoriere diese E-Mail einfach.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
