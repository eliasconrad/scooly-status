import { test } from "node:test";
import assert from "node:assert/strict";
import { absenderIp, ipHash, GRENZE_PRO_STUNDE } from "../src/lib/abo-bremse";

function anfrage(kopf: Record<string, string>): Request {
  return new Request("https://status.scooly.dev/api/subscribe", { headers: kopf });
}

test("die Grenze steht standardmäßig auf fünf Versuchen je Stunde", () => {
  assert.equal(GRENZE_PRO_STUNDE, 5);
});

test("aus der Weiterleitungskette wird der ursprüngliche Absender gelesen", () => {
  // Vercel hängt hinten die eigenen Zwischenstationen an - der erste Eintrag
  // ist der Anfragende. Nähme man den letzten, hätten alle denselben Hash
  // und die Bremse träfe entweder niemanden oder alle.
  assert.equal(absenderIp(anfrage({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })), "203.0.113.7");
  assert.equal(absenderIp(anfrage({ "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
  assert.equal(absenderIp(anfrage({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
  assert.equal(absenderIp(anfrage({})), null);
});

test("Leerzeichen und leere Ketten führen nicht zu einem Scheinabsender", () => {
  assert.equal(absenderIp(anfrage({ "x-forwarded-for": "  203.0.113.7  , 70.41.3.18" })), "203.0.113.7");
  assert.equal(absenderIp(anfrage({ "x-forwarded-for": "" })), null);
  assert.equal(absenderIp(anfrage({ "x-forwarded-for": " , 70.41.3.18" })), null);
});

test("der Hash ist gesalzen - ohne Salz wäre er zurückzurechnen", () => {
  const a = ipHash("203.0.113.7", "salz-eins");
  const b = ipHash("203.0.113.7", "salz-zwei");
  assert.notEqual(a, b, "verschiedenes Salz muss verschiedene Hashes ergeben");
  assert.equal(a, ipHash("203.0.113.7", "salz-eins"), "gleiche Eingabe, gleicher Hash");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(a, /203\.0\.113\.7/, "die Adresse selbst darf nirgends auftauchen");
});

test("verschiedene Absender bekommen verschiedene Hashes", () => {
  assert.notEqual(ipHash("203.0.113.7", "salz"), ipHash("203.0.113.8", "salz"));
});
