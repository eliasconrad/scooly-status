import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bandFarbeFuer, betreffUndTitel, meldungsText, nochAktuell, zeichen,
} from "../src/lib/meldungen";

test("das Zeichen sagt schon in der Postfachliste, wie schlimm es ist", () => {
  assert.equal(zeichen("major", "investigating"), "🔴");
  assert.equal(zeichen("critical", "identified"), "🔴");
  assert.equal(zeichen("minor", "investigating"), "🟡");
  assert.equal(zeichen("maintenance", "scheduled"), "🔵");
});

test("behoben ist immer grün, egal wie schlimm es vorher war", () => {
  assert.equal(zeichen("critical", "resolved"), "🟢");
  assert.equal(zeichen("major", "completed"), "🟢");
  assert.equal(bandFarbeFuer("critical", "resolved"), "none");
  assert.equal(bandFarbeFuer("critical", "investigating"), "critical");
});

test("der Betreff trägt das Zeichen, die Überschrift nicht", () => {
  const a = betreffUndTitel("Scooly KI antwortet langsam", "minor", "investigating");
  assert.equal(a.betreff, "🟡 Scooly KI antwortet langsam");
  assert.equal(a.titel, "Scooly KI antwortet langsam");
});

test("bei einer Entwarnung steht das auch im Betreff", () => {
  const a = betreffUndTitel("Anmeldung nicht erreichbar", "major", "resolved");
  assert.equal(a.betreff, "🟢 Anmeldung nicht erreichbar - behoben");
  assert.equal(a.titel, "Anmeldung nicht erreichbar - behoben");
});

test("der Zustand steht als Vorspann vor dem Text - wie auf der Seite", () => {
  assert.equal(meldungsText("investigating", "Wir schauen es uns an."),
    "Wird untersucht - Wir schauen es uns an.");
  assert.equal(meldungsText("resolved", "Läuft wieder."), "Behoben - Läuft wieder.");
});

test("ein unbekannter Zustand verschluckt den Text nicht", () => {
  assert.equal(meldungsText("gibtesnicht" as never, "Trotzdem wichtig."), "Trotzdem wichtig.");
});

test("frische Meldungen gehen raus, alte werden nur abgehakt", () => {
  const jetzt = new Date("2026-08-22T12:00:00Z");
  const vor = (min: number) => new Date(jetzt.getTime() - min * 60000).toISOString();
  assert.equal(nochAktuell(vor(0), jetzt), true);
  assert.equal(nochAktuell(vor(179), jetzt), true);
  assert.equal(nochAktuell(vor(181), jetzt), false, "nach dem Fenster nichts mehr verschicken");
});

test("eine kaputte Zeitangabe führt nicht zum Versand", () => {
  assert.equal(nochAktuell("kein Datum"), false);
});
