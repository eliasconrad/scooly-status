import { test } from "node:test";
import assert from "node:assert/strict";
import { baueHtml, baueText, escape } from "../src/lib/mail-vorlage";

const meldung = {
  titel: "Scooly KI antwortet langsam",
  text: "Erste Zeile.\n\nZweiter Absatz.",
  impact: "minor" as const,
  basis: "https://status.scooly.dev",
  abmeldeLink: "https://status.scooly.dev/api/abmelden?schluessel=abc",
};

test("Sonderzeichen werden maskiert", () => {
  assert.equal(escape('<b>"x" & \'y\'</b>'), "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
});

test("Text aus der Meldung landet nie ungefiltert im HTML", () => {
  const html = baueHtml({ ...meldung, titel: '<script>alert(1)</script>', text: "a & b" });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /a &amp; b/);
});

test("die Bandfarbe folgt dem Schweregrad", () => {
  assert.match(baueHtml({ ...meldung, impact: "none" }), /#76ad2a/);
  assert.match(baueHtml({ ...meldung, impact: "minor" }), /#faa72a/);
  assert.match(baueHtml({ ...meldung, impact: "major" }), /#e86235/);
  assert.match(baueHtml({ ...meldung, impact: "critical" }), /#e04343/);
});

test("Absätze werden getrennt, nicht zusammengeklebt", () => {
  const html = baueHtml(meldung);
  assert.equal((html.match(/<p style=/g) ?? []).length, 2);
});

test("der Abmeldelink steht drin, wenn es einen gibt", () => {
  assert.match(baueHtml(meldung), /Keine Meldungen mehr bekommen/);
  assert.match(baueHtml(meldung), /schluessel=abc/);
});

test("ohne Abmeldelink steht auch kein toter Link da", () => {
  const html = baueHtml({ ...meldung, abmeldeLink: null });
  assert.doesNotMatch(html, /Keine Meldungen mehr/);
  assert.doesNotMatch(html, /abmelden\?schluessel=/);
});

test("nichts Modernes, an dem Outlook scheitert", () => {
  const html = baueHtml(meldung);
  for (const verboten of [/<svg/i, /display:\s*flex/i, /display:\s*grid/i, /<style/i, /class=/]) {
    assert.doesNotMatch(html, verboten, `${verboten} hat in einer Mail nichts verloren`);
  }
  assert.match(html, /role="presentation"/, "Layouttabellen müssen als solche gekennzeichnet sein");
});

test("keine nachzuladenden Bilder - sonst steht bei blockierten Bildern ein leerer Kasten", () => {
  assert.doesNotMatch(baueHtml(meldung), /<img/i);
});

test("es gibt immer auch eine Textfassung", () => {
  const text = baueText(meldung);
  assert.match(text, /Scooly KI antwortet langsam/);
  assert.match(text, /Zweiter Absatz/);
  assert.match(text, /status\.scooly\.dev/);
  assert.match(text, /Keine Meldungen mehr/);
  assert.doesNotMatch(text, /<[a-z]/i, "in der Textfassung darf kein HTML stehen");
});

test("der Vorschautext verrät die erste Zeile, ohne sie doppelt zu zeigen", () => {
  const html = baueHtml(meldung);
  assert.match(html, /display:none;max-height:0/);
  assert.match(html, /Erste Zeile\./);
});
