import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

/**
 * Legt eine deutlich als Test erkennbare Störung an - und räumt sie wieder weg.
 *
 * WOZU: Der Störungsdialog in der App lässt sich sonst nicht ausprobieren.
 * Er hängt an /api/zustand, und der sagt nur dann etwas, wenn wirklich eine
 * Störung offen ist. Ohne dieses Skript müsste man auf einen echten Ausfall
 * warten - also genau dann üben, wenn es zählt.
 *
 * WARUM DER TITEL SO DEUTLICH IST: Die Statusseite ist öffentlich. Solange
 * der Test läuft, sieht ein Fremder diesen Vorfall. Dann soll unmissver-
 * ständlich dastehen, dass niemand betroffen ist.
 *
 *   npm run stoerung an     # anlegen
 *   npm run stoerung aus    # wegräumen
 *   npm run stoerung stand  # nachsehen
 */

const TITEL = "TEST - bitte ignorieren: Störungsanzeige wird geprüft";
const SLUG = "scooly-handschrift";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function an() {
  await aus(true);
  const { data: vorfall, error } = await db
    .from("incidents")
    .insert({
      title: TITEL,
      impact: "major",
      status: "identified",
      started_at: new Date().toISOString(),
      automatic: false,
      service_slugs: [SLUG],
    })
    .select()
    .single();
  if (error || !vorfall) return console.error("  Fehler:", error?.message);

  await db.from("incident_updates").insert({
    incident_id: vorfall.id,
    status: "identified",
    body:
      "Dies ist ein Test der Störungsanzeige und betrifft niemanden. " +
      "Scooly läuft normal weiter. Der Eintrag verschwindet gleich wieder.",
    // Schon als verschickt markiert: Der Test soll keine Mails auslösen.
    notified_at: new Date().toISOString(),
  });

  await db.from("services").update({ status: "major_outage" }).eq("slug", SLUG);
  console.log(`  Störung angelegt: "${TITEL}"`);
  console.log("  /api/zustand meldet jetzt alles_gut=false. Zum Wegräumen: npm run stoerung aus");
}

async function aus(still = false) {
  const { data: alte } = await db.from("incidents").select("id").eq("title", TITEL);
  for (const v of alte ?? []) await db.from("incident_updates").delete().eq("incident_id", v.id);
  await db.from("incidents").delete().eq("title", TITEL);
  await db.from("services").update({ status: "operational" }).eq("slug", SLUG);
  if (!still) console.log("  Störung weggeräumt, Dienst wieder betriebsbereit.");
}

async function stand() {
  const { data } = await db.from("incidents").select("title, status, resolved_at").is("resolved_at", null);
  console.log(data?.length ? `  offene Vorfälle: ${data.map((v) => v.title).join(", ")}` : "  keine offenen Vorfälle");
  const { data: d } = await db.from("services").select("slug, status").neq("status", "operational");
  console.log(d?.length ? `  nicht betriebsbereit: ${d.map((x) => `${x.slug}=${x.status}`).join(", ")}` : "  alle Dienste betriebsbereit");
}

const befehl = process.argv[2];
if (befehl === "an") void an();
else if (befehl === "aus") void aus();
else if (befehl === "stand") void stand();
else console.log("  Aufruf: npm run stoerung an | aus | stand");
