import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerteKontingent, hinweisLetzteMeldung, MAIL_GRENZE } from "../src/lib/kontingent";

test("die Grenze steht standardmäßig auf zwei", () => {
  assert.equal(MAIL_GRENZE, 2);
});

test("null heißt aufgebraucht - dann geht nichts mehr raus", () => {
  assert.deepEqual(bewerteKontingent(0), { darf: false, letzte: false });
  assert.deepEqual(bewerteKontingent(-1), { darf: false, letzte: false });
});

test("die erste Meldung des Tages geht raus und ist nicht die letzte", () => {
  assert.deepEqual(bewerteKontingent(1), { darf: true, letzte: false });
});

test("die zweite geht raus und ist die letzte", () => {
  assert.deepEqual(bewerteKontingent(2), { darf: true, letzte: true });
});

test("eine höhere Grenze verschiebt beides mit", () => {
  assert.deepEqual(bewerteKontingent(2, 4), { darf: true, letzte: false });
  assert.deepEqual(bewerteKontingent(4, 4), { darf: true, letzte: true });
  assert.deepEqual(bewerteKontingent(0, 4), { darf: false, letzte: false });
});

test("der Hinweis nennt die Seite, damit niemand im Ungewissen bleibt", () => {
  const t = hinweisLetzteMeldung("https://status.scooly.dev");
  assert.match(t, /letzte Meldung für heute/);
  assert.match(t, /status\.scooly\.dev/);
});

test("der Hinweis passt sich einer anderen Grenze an", () => {
  assert.match(hinweisLetzteMeldung("https://x.test", 2), /zweite und letzte/);
  assert.match(hinweisLetzteMeldung("https://x.test", 5), /5\. und letzte/);
});

test("die Bestätigungsmail zählt nicht gegen das Kontingent", async () => {
  const quelle = (await import("node:fs")).readFileSync("src/lib/mail.ts", "utf8");
  const stelle = quelle.indexOf("export async function sendeBestaetigung");
  const block = quelle.slice(stelle, stelle + 700);
  assert.doesNotMatch(block, /mail_kontingent|bewerteKontingent/,
    "wer sich anmeldet, muss den Bestätigungslink bekommen");
});

test("gegen wiederholtes Eintragen fremder Adressen gibt es eine Sperrfrist", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync("src/app/api/subscribe/route.ts", "utf8");
  assert.match(route, /SPERRFRIST_MINUTEN/);
  // Die Antwort muss gleich bleiben, sonst verrät sie, wer eingetragen ist.
  const treffer = route.match(/Fast geschafft - bestätige die Mail in deinem Postfach\./g) ?? [];
  assert.ok(treffer.length >= 2, "die Antwort muss in beiden Fällen dieselbe sein");
});
