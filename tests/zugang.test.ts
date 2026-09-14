import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { Service } from "../src/lib/types";

// Muss vor dem Laden des Wächters stehen - er liest die Werte beim Import.
process.env.CHECK_TIMEOUT_MS = "600";
process.env.PROBE_ZUGANG = "elias:elias";

type Checker = typeof import("../src/lib/checker");
let probe: Checker["probe"];
let zugangFuer: Checker["zugangFuer"];

let server: http.Server;
let port = 0;
/** Was der letzte Aufruf an Authorization mitgebracht hat. */
let gesehen: string | undefined;

/**
 * Ein echter Server, der sich wie der Türsteher verhält: ohne gültigen Kopf 401
 * mit `WWW-Authenticate`, mit gültigem Kopf die Seite.
 */
before(async () => {
  ({ probe, zugangFuer } = await import("../src/lib/checker"));

  const erwartet = `Basic ${Buffer.from("elias:elias", "utf8").toString("base64")}`;

  server = http.createServer((req, res) => {
    gesehen = req.headers.authorization;
    const pfad = (req.url ?? "/").split("?")[0];

    if (pfad === "/offen") return res.writeHead(200).end("Impressum");

    if (gesehen === erwartet) return res.writeHead(200).end("die echte Seite");
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Scooly", charset="UTF-8"' }).end("zu");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});

after(() => {
  server.close();
});

function dienst(pfad: string, ueberschreibung?: Partial<Service>): Service {
  return {
    id: "t",
    slug: "test",
    name: "Test",
    degraded_ms: 5000,
    sort_order: 1,
    active: true,
    probe_url: `http://127.0.0.1:${port}${pfad}`,
    wirkung_ausfall: "",
    wirkung_langsam: "",
    ...ueberschreibung,
  } as Service;
}

test("ohne Zugang ist ein Türsteher ein Ausfall - und der Text sagt warum", async () => {
  // 127.0.0.1 steht nicht auf der Namensliste, also geht kein Kopf raus.
  const p = await probe(dienst("/"));
  assert.equal(p.ok, false);
  assert.equal(p.status_code, 401);
  assert.match(p.error ?? "", /PROBE_ZUGANG setzen/);
  assert.equal(gesehen, undefined, "an einen fremden Host darf kein Passwort gehen");
});

test("der Zugang geht nur an die eigenen Adressen", () => {
  const kopf = `Basic ${Buffer.from("elias:elias", "utf8").toString("base64")}`;
  assert.equal(zugangFuer("https://www.scooly.dev/"), kopf);
  assert.equal(zugangFuer("https://scooly.dev/"), kopf);
  // Alles andere bekommt nichts - auch nicht, was nur so aussieht.
  assert.equal(zugangFuer("https://scooly.dev.boese.example/"), null);
  assert.equal(zugangFuer("https://fremde.example/"), null);
  assert.equal(zugangFuer("http://127.0.0.1:1234/"), null);
  assert.equal(zugangFuer("keine-adresse"), null);
});

test("ohne gesetzte Variable verhält sich alles wie früher", () => {
  assert.equal(zugangFuer("https://www.scooly.dev/", ""), null);
  assert.equal(zugangFuer("https://www.scooly.dev/", "ohnetrenner"), null);
});

test("mit Zugang misst der Wächter die echte Seite", async () => {
  // Der Host ist hier nicht auf der Liste, deshalb den Kopf direkt prüfen:
  // dieselbe Rechnung, die probe() anstellt.
  const kopf = zugangFuer("https://www.scooly.dev/", "elias:elias");
  assert.ok(kopf);
  const res = await fetch(`http://127.0.0.1:${port}/`, { headers: { Authorization: kopf! } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "die echte Seite");
});

test("ein offener Pfad braucht den Zugang gar nicht", async () => {
  const p = await probe(dienst("/offen"));
  assert.equal(p.ok, true);
  assert.equal(p.status_code, 200);
});
