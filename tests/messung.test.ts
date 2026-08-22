import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { Service } from "../src/lib/types";

// Muss vor dem Laden des Wächters stehen - er liest den Wert beim Import.
process.env.CHECK_TIMEOUT_MS = "600";

type Probe = Awaited<ReturnType<typeof import("../src/lib/checker").probe>>;
let probe: (s: Service) => Promise<Probe>;

let server: http.Server;
let port = 0;

/**
 * Ein echter HTTP-Server, der sich wirklich so verhält, wie ein kaputter
 * Dienst sich verhalten würde. Keine Attrappe der fetch-Funktion.
 */
before(async () => {
  // Erst hier laden, damit die Zeitgrenze oben schon gesetzt ist.
  ({ probe } = await import("../src/lib/checker"));

  server = http.createServer((req, res) => {
    const pfad = (req.url ?? "/").split("?")[0];
    if (pfad === "/ok") return res.writeHead(200).end("ok");
    if (pfad === "/leer") return res.writeHead(204).end();
    if (pfad === "/umleitung") return res.writeHead(302, { Location: "/ok" }).end();
    if (pfad === "/kaputt") return res.writeHead(500).end("kaputt");
    if (pfad === "/verboten") return res.writeHead(403).end();
    if (pfad === "/nichtda") return res.writeHead(404).end();
    if (pfad === "/langsam") return void setTimeout(() => res.writeHead(200).end("spät"), 250);
    if (pfad === "/haengt") return; // antwortet nie
    if (pfad === "/abbruch") return void req.socket.destroy();
    res.writeHead(200).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});

after(() => {
  server.closeAllConnections?.();
  server.close();
});

function dienst(pfad: string, degraded_ms = 5000): Service {
  return {
    id: "t", slug: "t", name: "Test",
    probe_url: `http://127.0.0.1:${port}${pfad}`,
    degraded_ms, sort_order: 1, active: true,
  };
}

test("200 gilt als in Ordnung", async () => {
  const r = await probe(dienst("/ok"));
  assert.equal(r.ok, true);
  assert.equal(r.degraded, false);
  assert.equal(r.status_code, 200);
  assert.equal(r.error, null);
  assert.ok(r.response_ms >= 0);
});

test("204 ohne Inhalt gilt als in Ordnung", async () => {
  const r = await probe(dienst("/leer"));
  assert.equal(r.ok, true);
  assert.equal(r.status_code, 204);
});

test("einer Umleitung wird gefolgt", async () => {
  const r = await probe(dienst("/umleitung"));
  assert.equal(r.ok, true);
  assert.equal(r.status_code, 200);
});

test("500 gilt als Ausfall", async () => {
  const r = await probe(dienst("/kaputt"));
  assert.equal(r.ok, false);
  assert.equal(r.status_code, 500);
  assert.equal(r.error, "HTTP 500");
});

test("403 und 404 gelten als Ausfall", async () => {
  assert.equal((await probe(dienst("/verboten"))).ok, false);
  assert.equal((await probe(dienst("/nichtda"))).ok, false);
});

test("eine langsame Antwort gilt als beeinträchtigt, nicht als Ausfall", async () => {
  const r = await probe(dienst("/langsam", 100));
  assert.equal(r.ok, true, "erreichbar war er ja");
  assert.equal(r.degraded, true);
  assert.ok(r.response_ms > 100, `gemessen: ${r.response_ms} ms`);
});

test("dieselbe langsame Antwort mit hohem Grenzwert ist nicht beeinträchtigt", async () => {
  const r = await probe(dienst("/langsam", 5000));
  assert.equal(r.ok, true);
  assert.equal(r.degraded, false);
});

test("ein hängender Dienst läuft in die Zeitgrenze und gilt als Ausfall", async () => {
  const start = Date.now();
  const r = await probe(dienst("/haengt"));
  const gebraucht = Date.now() - start;
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /Keine Antwort nach 600 ms/);
  assert.ok(gebraucht < 2000, `hätte nach ~600 ms abbrechen müssen, brauchte ${gebraucht} ms`);
});

test("eine abgebrochene Verbindung gilt als Ausfall", async () => {
  const r = await probe(dienst("/abbruch"));
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test("ein gar nicht laufender Dienst gilt als Ausfall", async () => {
  const r = await probe({
    id: "t", slug: "t", name: "Tot",
    probe_url: "http://127.0.0.1:1/nichts",
    degraded_ms: 1000, sort_order: 1, active: true,
  });
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test("ein Dienst ohne Probe-URL wird nicht gemessen", async () => {
  const r = await probe({
    id: "t", slug: "t", name: "Von Hand",
    probe_url: null, degraded_ms: 1000, sort_order: 1, active: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.status_code, null);
  assert.equal(r.response_ms, 0);
});
