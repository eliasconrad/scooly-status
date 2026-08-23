import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.CRON_SECRET = "geheim-fuer-den-test";
// Bewusst ohne SUPABASE_URL: so lässt sich prüfen, dass die Route bei
// fehlender Datenbank ehrlich scheitert statt still "alles grün" zu melden.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

let waechter: (r: Request) => Promise<Response>;
let abo: (r: Request) => Promise<Response>;

before(async () => {
  ({ GET: waechter } = await import("../src/app/api/check/route"));
  ({ POST: abo } = await import("../src/app/api/subscribe/route"));
});

const anfrage = (kopf?: Record<string, string>) =>
  new Request("http://localhost/api/check", { headers: kopf });

test("ohne Geheimnis wird der Wächter abgewiesen", async () => {
  const r = await waechter(anfrage());
  assert.equal(r.status, 401);
});

test("mit falschem Geheimnis wird der Wächter abgewiesen", async () => {
  const r = await waechter(anfrage({ authorization: "Bearer falsch" }));
  assert.equal(r.status, 401);
});

test("das Geheimnis wird vollständig geprüft, nicht nur der Anfang", async () => {
  const r = await waechter(anfrage({ authorization: "Bearer geheim" }));
  assert.equal(r.status, 401);
});

test("mit richtigem Geheimnis, aber ohne Datenbank, scheitert der Wächter laut", async () => {
  const r = await waechter(anfrage({ authorization: "Bearer geheim-fuer-den-test" }));
  assert.equal(r.status, 500, "still 200 zurückzugeben wäre das Schlimmste");
  const daten = await r.json();
  assert.match(daten.error, /Datenbank/);
});

async function abonnieren(koerper: unknown) {
  return abo(
    new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper),
    }),
  );
}

test("kaputte Adressen werden abgelehnt", async () => {
  for (const adresse of ["", "hallo", "hallo@", "@example.com", "hallo@example", "a b@c.de"]) {
    const r = await abonnieren({ email: adresse });
    assert.equal(r.status, 400, `"${adresse}" hätte abgelehnt werden müssen`);
  }
});

test("eine gültige Adresse kommt an der Prüfung vorbei", async () => {
  const r = await abonnieren({ email: "hallo@eliasconrad.eu" });
  assert.equal(r.status, 503, "ohne Datenbank 503 - aber eben nicht 400");
});

test("eine Anfrage ohne JSON stürzt nicht ab", async () => {
  const r = await abo(
    new Request("http://localhost/api/subscribe", { method: "POST", body: "kein json" }),
  );
  assert.equal(r.status, 400);
});

test("ohne eingerichtetes Geheimnis wird abgelehnt, nicht durchgelassen", async () => {
  // Vorher stand im Wächter `if (secret) { ... }`: Fehlte die Variable, war
  // der Endpunkt für jeden offen - und er schreibt in die Datenbank,
  // verschickt Mails und ruft sechs fremde Dienste auf.
  const vorher = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const r = await waechter(anfrage({}));
    assert.equal(r.status, 503, "ohne Geheimnis darf nicht gemessen werden");
  } finally {
    process.env.CRON_SECRET = vorher;
  }
});

test("der Vergleich bricht nicht beim ersten falschen Zeichen ab", async () => {
  // Ein Vergleich mit === verrät über die Dauer, wie viele Zeichen stimmten.
  const quelle = readFileSync(new URL("../src/app/api/check/route.ts", import.meta.url), "utf8");
  assert.match(quelle, /timingSafeEqual/);
  assert.doesNotMatch(quelle, /auth !== `Bearer/, "der alte, verratende Vergleich");
});
