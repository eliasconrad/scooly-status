/**
 * Prüft die Supabase-Anbindung gegen die echte Datenbank.
 *
 * Das ist der Teil, den die Testreihe nicht abdecken kann - dafür bräuchte es
 * ein laufendes Postgres. Hier wird stattdessen gegen das echte Projekt
 * gearbeitet: schreiben, lesen, vergleichen, wieder aufräumen.
 *
 *   npm run pruefe:datenbank
 *
 * Angefasst wird ausschließlich ein Prüfdienst mit dem Kürzel `__pruefung`.
 * Am Ende wird er restlos gelöscht, auch wenn unterwegs etwas schiefgeht.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PRUEFDIENST = "__pruefung";

function umgebungLaden() {
  // .env.local einlesen, damit das Skript ohne weiteres Werkzeug läuft.
  try {
    const roh = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const zeile of roh.split("\n")) {
      const m = zeile.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const wert = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = wert;
    }
  } catch {
    // Keine .env.local - dann müssen die Werte aus der Umgebung kommen.
  }
}

let fehler = 0;
const ok = (text: string) => console.log(`  \x1b[32m✔\x1b[0m ${text}`);
const nein = (text: string, detail?: unknown) => {
  fehler++;
  console.log(`  \x1b[31m✖\x1b[0m ${text}`);
  if (detail) console.log(`     ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
};

async function main() {
  umgebungLaden();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("\n\x1b[1mSupabase-Anbindung prüfen\x1b[0m\n");

  if (!url || !key) {
    console.log(
      "  Es fehlen SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY.\n" +
        "  Leg .env.local an (Vorlage: .env.example) und trag beides ein.\n",
    );
    process.exit(1);
  }
  if (key.length < 60) {
    nein("Der Schlüssel sieht zu kurz aus - ist das wirklich der service_role-Key?");
  }
  console.log(`  Projekt: ${url}\n`);

  const db = createClient(url, key, { auth: { persistSession: false } });

  // ---- 1. Tabellen erreichbar? -------------------------------------------
  console.log("\x1b[1m1. Tabellen\x1b[0m");
  const tabellen = [
    "services",
    "checks",
    "daily_uptime",
    "incidents",
    "incident_updates",
    "subscribers",
  ];
  for (const t of tabellen) {
    const { error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) nein(`${t} nicht lesbar`, error.message);
    else ok(`${t} erreichbar`);
  }
  if (fehler > 0) {
    console.log(
      "\n  Sieht so aus, als wäre supabase/schema.sql noch nicht gelaufen.\n" +
        "  Im SQL-Editor des Projekts einmal komplett ausführen.\n",
    );
    process.exit(1);
  }

  // ---- 2. Spalten vollständig? -------------------------------------------
  console.log("\n\x1b[1m2. Spalten\x1b[0m");
  const erwartet: Record<string, string[]> = {
    services: ["id", "slug", "name", "probe_url", "degraded_ms", "sort_order", "active", "status"],
    checks: ["service_slug", "checked_at", "ok", "degraded", "status_code", "response_ms", "error"],
    daily_uptime: [
      "service_slug", "day", "checks", "failed", "degraded",
      "uptime", "downtime_minutes", "degraded_minutes",
      "avg_response_ms", "max_response_ms", "top_error",
    ],
    incidents: ["id", "title", "impact", "status", "started_at", "resolved_at", "automatic", "service_slugs"],
    incident_updates: ["id", "incident_id", "status", "body", "created_at"],
    subscribers: ["id", "email", "token", "unsubscribe", "confirmed", "confirmed_at"],
  };
  for (const [tabelle, spalten] of Object.entries(erwartet)) {
    const { error } = await db.from(tabelle).select(spalten.join(",")).limit(1);
    if (error) nein(`${tabelle}: ${error.message}`);
    else ok(`${tabelle} hat alle ${spalten.length} Spalten`);
  }

  // ---- 3. Echter Durchlauf ------------------------------------------------
  console.log("\n\x1b[1m3. Schreiben und Lesen\x1b[0m");
  try {
    await aufraeumen(db);

    const { error: e1 } = await db.from("services").insert({
      slug: PRUEFDIENST,
      name: "Prüfdienst (wird gleich gelöscht)",
      probe_url: null,
      active: false,
      sort_order: 999,
    });
    if (e1) throw new Error(`Dienst anlegen: ${e1.message}`);
    ok("Dienst angelegt");

    const jetzt = new Date().toISOString();
    const { error: e2 } = await db.from("checks").insert({
      service_slug: PRUEFDIENST,
      checked_at: jetzt,
      ok: false,
      degraded: false,
      status_code: 503,
      response_ms: 1234,
      error: "Prüflauf",
    });
    if (e2) throw new Error(`Messung schreiben: ${e2.message}`);
    ok("Messung geschrieben");

    const { count, error: e3 } = await db
      .from("checks")
      .select("*", { count: "exact", head: true })
      .eq("service_slug", PRUEFDIENST);
    if (e3) throw new Error(`Zählabfrage: ${e3.message}`);
    if (count !== 1) throw new Error(`Zählabfrage lieferte ${count}, erwartet 1`);
    ok("Zählabfrage stimmt (die braucht die Tagesbilanz)");

    // Zweite Messung: geglückt, aber langsam - dann lässt sich prüfen, ob
    // die Datenbank Schnitt, Maximum und Fehlertext richtig zusammenrechnet.
    const { error: e2b } = await db.from("checks").insert({
      service_slug: PRUEFDIENST,
      checked_at: jetzt,
      ok: true,
      degraded: true,
      status_code: 200,
      response_ms: 4000,
      error: null,
    });
    if (e2b) throw new Error(`Zweite Messung: ${e2b.message}`);

    const tag = jetzt.slice(0, 10);
    const { error: e4 } = await db.rpc("rollup_day", {
      p_slug: PRUEFDIENST, p_day: tag, p_interval_minutes: 5,
    });
    if (e4) throw new Error(`rollup_day: ${e4.message}`);

    const { data: bilanz, error: e5 } = await db
      .from("daily_uptime").select("*").eq("service_slug", PRUEFDIENST).single();
    if (e5) throw new Error(`Tagesbilanz lesen: ${e5.message}`);

    // 2 Messungen: eine fehlgeschlagen, eine langsam -> (2 - 1 - 0.5) / 2 = 0.25
    if (Number(bilanz?.uptime) !== 0.25) {
      throw new Error(`Verfügbarkeit ${bilanz?.uptime}, erwartet 0.25`);
    }
    if (Number(bilanz?.checks) !== 2 || Number(bilanz?.failed) !== 1) {
      throw new Error(`Zählung stimmt nicht: ${bilanz?.checks} Messungen, ${bilanz?.failed} Fehler`);
    }
    ok("rollup_day rechnet Verfügbarkeit und Zählung richtig");

    // Nur die geglückte Messung darf in den Schnitt eingehen.
    if (Number(bilanz?.avg_response_ms) !== 4000) {
      throw new Error(`Schnitt ${bilanz?.avg_response_ms} ms, erwartet 4000 (nur die geglückte Messung)`);
    }
    if (bilanz?.top_error !== "Prüflauf") {
      throw new Error(`häufigster Fehler "${bilanz?.top_error}", erwartet "Prüflauf"`);
    }
    ok("rollup_day liefert Antwortzeit und Fehlertext für die Diagnose");

    // Noch einmal aufrufen - der Wächter macht das alle fünf Minuten.
    const { error: e5b } = await db.rpc("rollup_day", {
      p_slug: PRUEFDIENST, p_day: tag, p_interval_minutes: 5,
    });
    if (e5b) throw new Error(`rollup_day erneut: ${e5b.message}`);
    const { count: zeilen } = await db
      .from("daily_uptime")
      .select("*", { count: "exact", head: true })
      .eq("service_slug", PRUEFDIENST);
    if (zeilen !== 1) throw new Error(`${zeilen} Tagesbilanzen statt einer - onConflict greift nicht`);
    ok("mehrfacher Aufruf legt keine zweite Zeile an");

    const { data: vorfall, error: e6 } = await db
      .from("incidents")
      .insert({
        title: "Prüfvorfall", impact: "minor", status: "investigating",
        automatic: true, service_slugs: [PRUEFDIENST],
      })
      .select().single();
    if (e6) throw new Error(`Vorfall anlegen: ${e6.message}`);
    ok("Vorfall angelegt");

    const { error: e7 } = await db
      .from("incident_updates")
      .insert({ incident_id: vorfall.id, status: "investigating", body: "Prüflauf" });
    if (e7) throw new Error(`Meldung anhängen: ${e7.message}`);
    ok("Meldung angehängt");

    const { data: offen, error: e8 } = await db
      .from("incidents").select("*, incident_updates(*)")
      .is("resolved_at", null).eq("automatic", true)
      .contains("service_slugs", [PRUEFDIENST]);
    if (e8) throw new Error(`Suche nach offenen Vorfällen: ${e8.message}`);
    if (offen?.length !== 1) throw new Error(`${offen?.length} offene Vorfälle, erwartet 1`);
    if (!offen[0].incident_updates?.length) throw new Error("Die Meldungen kamen nicht mit");
    ok("Offener Vorfall samt Meldungen gefunden (genau diese Abfrage nutzt der Wächter)");
  } catch (err) {
    nein("Durchlauf abgebrochen", err instanceof Error ? err.message : String(err));
  } finally {
    const rest = await aufraeumen(db);
    if (rest) nein("Aufräumen unvollständig", rest);
    else ok("Prüfdaten restlos gelöscht");
  }

  // ---- 4. Fremdzugriff gesperrt? -----------------------------------------
  console.log("\n\x1b[1m4. Zugriffsschutz\x1b[0m");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.log("  \x1b[33m•\x1b[0m Übersprungen - für diese Prüfung SUPABASE_ANON_KEY setzen.");
  } else {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anon.from("subscribers").select("email").limit(1);
    if (!error && data && data.length > 0) {
      nein("Mit dem öffentlichen Schlüssel sind E-Mail-Adressen lesbar - RLS greift nicht!");
    } else {
      ok("Mit dem öffentlichen Schlüssel kommt niemand an die Daten");
    }
  }

  console.log(
    fehler === 0
      ? "\n\x1b[32mAlles in Ordnung.\x1b[0m Die Datenbank ist so, wie der Code sie erwartet.\n"
      : `\n\x1b[31m${fehler} Punkt(e) stimmen nicht.\x1b[0m Siehe oben.\n`,
  );
  process.exit(fehler === 0 ? 0 : 1);
}

/** Löscht alles, was der Prüflauf angelegt hat. Gibt eine Meldung zurück, wenn etwas übrig bleibt. */
async function aufraeumen(db: SupabaseClient): Promise<string | null> {
  await db.from("incidents").delete().contains("service_slugs", [PRUEFDIENST]);
  await db.from("daily_uptime").delete().eq("service_slug", PRUEFDIENST);
  await db.from("checks").delete().eq("service_slug", PRUEFDIENST);
  await db.from("services").delete().eq("slug", PRUEFDIENST);

  const { count } = await db
    .from("services").select("*", { count: "exact", head: true }).eq("slug", PRUEFDIENST);
  return count ? `${count} Prüfdienst(e) übrig` : null;
}

main().catch((err) => {
  console.error("\nUnerwarteter Fehler:", err);
  process.exit(1);
});
