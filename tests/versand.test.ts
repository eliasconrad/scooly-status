import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

/**
 * Der Mailversand gegen einen echten HTTP-Server, der sich als Resend ausgibt.
 * Geprüft wird, was wirklich rausgeht: Kopfzeilen, Empfänger, Abmeldelink.
 */

let server: http.Server;
let port = 0;
let empfangen: { headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
let antwortStatus = 200;

let mail: typeof import("../src/lib/mail");

before(async () => {
  server = http.createServer((req, res) => {
    let roh = "";
    req.on("data", (c) => (roh += c));
    req.on("end", () => {
      empfangen.push({ headers: req.headers, body: JSON.parse(roh || "{}") });
      res.writeHead(antwortStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify(antwortStatus === 200 ? { id: "test" } : { message: "nope" }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;

  process.env.RESEND_API_KEY = "re_test_schluessel";
  process.env.RESEND_API_URL = `http://127.0.0.1:${port}/emails`;
  process.env.RESEND_FROM = "Scooly Status <status@scooly.dev>";
  process.env.PUBLIC_URL = "https://status.scooly.dev";

  mail = await import("../src/lib/mail");
});

after(() => {
  server.closeAllConnections?.();
  server.close();
});

beforeEach(() => {
  empfangen = [];
  antwortStatus = 200;
});

test("ohne Schlüssel gilt der Versand als nicht eingerichtet", async () => {
  const alt = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.equal(mail.versandEingerichtet(), false);
  process.env.RESEND_API_KEY = alt;
  assert.equal(mail.versandEingerichtet(), true);
});

test("die Bestätigungsmail geht wirklich raus und enthält den Bestätigungslink", async () => {
  const ok = await mail.sendeBestaetigung("hallo@example.com", "token-123");
  assert.equal(ok, true);
  assert.equal(empfangen.length, 1);

  const { headers, body } = empfangen[0];
  assert.equal(headers.authorization, "Bearer re_test_schluessel");
  assert.equal(body.to, "hallo@example.com");
  assert.equal(body.from, "Scooly Status <status@scooly.dev>");
  assert.match(String(body.subject), /bestätigen/i);
  assert.match(String(body.text), /https:\/\/status\.scooly\.dev\/api\/confirm\?token=token-123/);
});

test("die Bestätigungsmail verspricht nichts ohne Bestätigung", async () => {
  await mail.sendeBestaetigung("hallo@example.com", "t");
  assert.match(String(empfangen[0].body.text), /ohne Bestätigung/i);
});

test("ein Fehler bei Resend wird als Fehler gemeldet, nicht verschluckt", async () => {
  antwortStatus = 422;
  const ok = await mail.sendeBestaetigung("hallo@example.com", "t");
  assert.equal(ok, false, "ein stilles true wäre ein Versprechen, das keiner einlöst");
});

test("ein toter Mailserver bringt den Wächter nicht um", async () => {
  const alt = process.env.RESEND_API_URL;
  process.env.RESEND_API_URL = "http://127.0.0.1:1/emails";
  const frisch = await import(`../src/lib/mail?tot=${Date.now()}`);
  const ok = await frisch.sendeBestaetigung("hallo@example.com", "t");
  assert.equal(ok, false);
  process.env.RESEND_API_URL = alt;
});

test("jeder Empfänger bekommt eine eigene Mail - Adressen werden nicht verteilt", async () => {
  const ergebnis = await mail.sendeAnEmpfaenger(
    [
      { email: "a@example.com", unsubscribe: "schluessel-a" },
      { email: "b@example.com", unsubscribe: "schluessel-b" },
      { email: "c@example.com", unsubscribe: "schluessel-c" },
    ],
    "Störung bei Scooly",
    "Die Anmeldung ist nicht erreichbar.",
  );

  assert.equal(ergebnis.gesendet, 3);
  assert.equal(ergebnis.fehlgeschlagen, 0);
  assert.equal(empfangen.length, 3, "eine Anfrage je Adresse");

  for (const { body } of empfangen) {
    assert.equal(typeof body.to, "string", "niemals eine Liste in 'to'");
    const text = String(body.text);
    // Keine fremde Adresse darf in einer Mail auftauchen.
    const fremde = ["a@example.com", "b@example.com", "c@example.com"].filter(
      (adr) => adr !== body.to && text.includes(adr),
    );
    assert.deepEqual(fremde, [], "eine fremde Adresse ist in der Mail gelandet");
  }
});

test("jede Meldung trägt einen persönlichen Abmeldelink", async () => {
  await mail.sendeAnEmpfaenger(
    [{ email: "a@example.com", unsubscribe: "schluessel-a" }],
    "Störung",
    "Text",
  );
  const { body } = empfangen[0];
  const link = "https://status.scooly.dev/api/abmelden?schluessel=schluessel-a";
  assert.match(String(body.text), new RegExp(link.replace(/[?]/g, "\\?")));

  const kopf = body.headers as Record<string, string>;
  assert.equal(kopf["List-Unsubscribe"], `<${link}>`);
  assert.equal(kopf["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("ein Fehlschlag stoppt die übrigen Empfänger nicht", async () => {
  let n = 0;
  const alterServer = server.listeners("request")[0] as http.RequestListener;
  server.removeAllListeners("request");
  server.on("request", (req, res) => {
    n++;
    let roh = "";
    req.on("data", (c) => (roh += c));
    req.on("end", () => {
      empfangen.push({ headers: req.headers, body: JSON.parse(roh || "{}") });
      // Der zweite Empfänger scheitert.
      const status = n === 2 ? 500 : 200;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });

  const ergebnis = await mail.sendeAnEmpfaenger(
    [
      { email: "a@example.com", unsubscribe: "a" },
      { email: "b@example.com", unsubscribe: "b" },
      { email: "c@example.com", unsubscribe: "c" },
    ],
    "Störung",
    "Text",
  );

  assert.equal(empfangen.length, 3, "auch nach dem Fehler wurde weitergemacht");
  assert.equal(ergebnis.gesendet, 2);
  assert.equal(ergebnis.fehlgeschlagen, 1);

  server.removeAllListeners("request");
  server.on("request", alterServer);
});

test("ohne eingerichteten Versand wird nichts behauptet", async () => {
  const alt = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const ergebnis = await mail.sendeAnEmpfaenger(
    [{ email: "a@example.com", unsubscribe: "a" }],
    "Störung",
    "Text",
  );
  assert.equal(ergebnis.eingerichtet, false);
  assert.equal(ergebnis.gesendet, 0);
  assert.equal(empfangen.length, 0, "es darf gar nichts verschickt worden sein");
  process.env.RESEND_API_KEY = alt;
});
