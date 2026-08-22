import { test } from "node:test";
import assert from "node:assert/strict";
import { bewerte, FAIL_STREAK, RECOVER_STREAK } from "../src/lib/bewertung";
import type { ComponentStatus, IncidentImpact } from "../src/lib/types";

const gut = { ok: true, degraded: false };
const zaeh = { ok: true, degraded: true };
const weg = { ok: false, degraded: false };

function urteil(
  messungen: { ok: boolean; degraded: boolean }[],
  bisher: ComponentStatus = "operational",
  offenerVorfall: IncidentImpact | null = null,
) {
  return bewerte({ bisher, messungen, offenerVorfall });
}

test("Schwellen sind drei Messungen", () => {
  assert.equal(FAIL_STREAK, 3);
  assert.equal(RECOVER_STREAK, 3);
});

test("ohne Messungen passiert nichts", () => {
  const r = urteil([]);
  assert.equal(r.status, "operational");
  assert.equal(r.aktion, "nichts");
});

test("ein neuer Dienst mit zwei Fehlmessungen löst noch nichts aus", () => {
  const r = urteil([weg, weg]);
  assert.equal(r.aktion, "nichts", "zwei Messungen sind zu wenig für einen Vorfall");
  assert.equal(r.status, "operational");
});

test("eine einzelne Fehlmessung löst keinen Vorfall aus", () => {
  const r = urteil([weg, gut, gut]);
  assert.equal(r.aktion, "nichts");
  assert.equal(r.status, "operational");
});

test("zwei Fehlmessungen mit einer guten dazwischen lösen nichts aus", () => {
  const r = urteil([weg, gut, weg]);
  assert.equal(r.aktion, "nichts");
});

test("drei Fehlmessungen hintereinander legen einen Ausfall an", () => {
  const r = urteil([weg, weg, weg]);
  assert.equal(r.status, "major_outage");
  assert.equal(r.aktion, "vorfall_anlegen");
  assert.equal(r.impact, "major");
});

test("drei langsame Messungen legen einen kleineren Vorfall an", () => {
  const r = urteil([zaeh, zaeh, zaeh]);
  assert.equal(r.status, "degraded_performance");
  assert.equal(r.aktion, "vorfall_anlegen");
  assert.equal(r.impact, "minor");
});

test("bei offenem Vorfall wird kein zweiter angelegt", () => {
  const r = urteil([weg, weg, weg], "major_outage", "major");
  assert.equal(r.aktion, "nichts");
  assert.equal(r.status, "major_outage");
});

test("aus langsam wird ein Ausfall - der Vorfall wird verschärft", () => {
  const r = urteil([weg, weg, weg], "degraded_performance", "minor");
  assert.equal(r.aktion, "vorfall_verschaerfen");
  assert.equal(r.status, "major_outage");
});

test("ein Ausfall wird nicht zu einem langsamen Vorfall herabgestuft", () => {
  const r = urteil([zaeh, zaeh, zaeh], "major_outage", "major");
  assert.equal(r.aktion, "nichts", "solange es hakt, bleibt der Vorfall offen");
  assert.equal(r.status, "degraded_performance");
});

test("drei saubere Messungen schließen den offenen Vorfall", () => {
  const r = urteil([gut, gut, gut], "major_outage", "major");
  assert.equal(r.aktion, "vorfall_schliessen");
  assert.equal(r.status, "operational");
});

test("zwei saubere Messungen schließen noch nichts", () => {
  const r = urteil([gut, gut, weg], "major_outage", "major");
  assert.equal(r.aktion, "nichts");
  assert.equal(r.status, "major_outage", "der Status bleibt, bis die Erholung steht");
});

test("eine langsame Messung verhindert das Schließen", () => {
  const r = urteil([gut, zaeh, gut], "degraded_performance", "minor");
  assert.equal(r.aktion, "nichts");
});

test("ohne offenen Vorfall wird nichts geschlossen", () => {
  const r = urteil([gut, gut, gut], "operational", null);
  assert.equal(r.aktion, "nichts");
  assert.equal(r.status, "operational");
});

test("nur die jüngsten drei Messungen zählen", () => {
  const r = urteil([gut, gut, gut, weg, weg, weg], "major_outage", "major");
  assert.equal(r.aktion, "vorfall_schliessen", "ältere Fehlmessungen dürfen nicht nachwirken");
});

test("ein Ausfall gewinnt gegen langsam im selben Fenster", () => {
  const r = urteil([weg, zaeh, weg]);
  assert.equal(r.aktion, "nichts", "gemischtes Fenster ist keine Serie");
  assert.equal(r.status, "operational");
});
