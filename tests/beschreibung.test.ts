import { test } from "node:test";
import assert from "node:assert/strict";
import { beschreibungAusfall, beschreibungLangsam } from "../src/lib/checker";
import { zeit } from "../src/lib/zeit";

const dienst = { name: "Scooly KI", degraded_ms: 12000 };

test("Zeiten werden lesbar geschrieben", () => {
  assert.equal(zeit(0), "0 ms");
  assert.equal(zeit(840), "840 ms");
  assert.equal(zeit(999), "999 ms");
  assert.equal(zeit(1000), "1,0 s");
  assert.equal(zeit(8437), "8,4 s");
  assert.equal(zeit(15000), "15,0 s");
});

test("ein Ausfall mit HTTP-Code nennt den Code", () => {
  const text = beschreibungAusfall(
    dienst,
    [
      { status_code: 502, error: "HTTP 502", response_ms: 240 },
      { status_code: 502, error: "HTTP 502", response_ms: 260 },
      { status_code: 502, error: "HTTP 502", response_ms: 210 },
    ],
    { status_code: 502, error: "HTTP 502", response_ms: 240 },
  );
  assert.match(text, /HTTP 502/);
  assert.match(text, /3 Messungen hintereinander ohne Erfolg/);
  assert.match(text, /240 ms/);
});

test("ein Ausfall ohne Antwort nennt den Grund statt eines Codes", () => {
  const text = beschreibungAusfall(
    dienst,
    [{ error: "Keine Antwort nach 15000 ms", response_ms: 15000 }],
    { status_code: null, error: "Keine Antwort nach 15000 ms", response_ms: 15000 },
  );
  assert.match(text, /antwortet gar nicht/);
  assert.match(text, /Keine Antwort nach 15000 ms/);
  assert.doesNotMatch(text, /HTTP/);
});

test("wechselnde Fehler werden alle genannt", () => {
  const text = beschreibungAusfall(
    dienst,
    [
      { status_code: 502, response_ms: 100 },
      { status_code: 500, response_ms: 120 },
      { status_code: 503, response_ms: 90 },
    ],
    { status_code: 503, error: "HTTP 503", response_ms: 90 },
  );
  assert.match(text, /Gesehene Antworten: HTTP 502, 500, 503/);
});

test("langsam wird mit Grenzwert und üblichem Wert eingeordnet", () => {
  const text = beschreibungLangsam(
    dienst,
    [{ response_ms: 18000 }, { response_ms: 17400 }, { response_ms: 19200 }],
    1200,
  );
  assert.match(text, /18,2 s pro Anfrage/, text);
  assert.match(text, /Grenzwert sind 12,0 s/);
  assert.match(text, /Üblich sind 1,2 s/);
  assert.match(text, /15,2-mal so lang/);
  assert.match(text, /Einzelmessungen: 18,0 s, 17,4 s, 19,2 s/);
});

test("ohne Vergleichswert wird keiner erfunden", () => {
  const text = beschreibungLangsam(dienst, [{ response_ms: 14000 }], null);
  assert.match(text, /14,0 s/);
  assert.doesNotMatch(text, /Üblich/, "ohne Messgrundlage darf da nichts stehen");
});

test("ein Faktor unter 1,5 wird nicht aufgebauscht", () => {
  const text = beschreibungLangsam(dienst, [{ response_ms: 13000 }], 12000);
  assert.match(text, /Üblich sind 12,0 s/);
  assert.doesNotMatch(text, /mal so lang/);
});

test("die Beschreibung behauptet nichts über die Ursache", () => {
  const texte = [
    beschreibungAusfall(dienst, [{ status_code: 500 }], { status_code: 500, error: "HTTP 500", response_ms: 10 }),
    beschreibungLangsam(dienst, [{ response_ms: 14000 }], 1000),
  ];
  for (const t of texte) {
    for (const wort of ["vermutlich", "wahrscheinlich", "vermutet", "sollte bald", "kein Grund zur Sorge"]) {
      assert.doesNotMatch(t, new RegExp(wort, "i"), `"${wort}" hat da nichts verloren: ${t}`);
    }
  }
});

const kiMitWirkung = {
  name: "Scooly KI",
  degraded_ms: 12000,
  wirkung_ausfall:
    "Neue Aufgaben, Quizze und Karteikarten lassen sich gerade nicht erstellen. Was schon da ist, kannst du weiter lernen.",
  wirkung_langsam: "Neue Aufgaben, Quizze und Karteikarten brauchen gerade deutlich länger.",
};

test("die Auswirkung steht vor der Technik - nicht dahinter", () => {
  const text = beschreibungAusfall(
    kiMitWirkung,
    [{ status_code: 502, response_ms: 200 }],
    { status_code: 502, error: "HTTP 502", response_ms: 200 },
  );
  const wirkung = text.indexOf("lassen sich gerade nicht erstellen");
  const technik = text.indexOf("HTTP 502");
  assert.ok(wirkung >= 0, "die Auswirkung fehlt");
  assert.ok(technik >= 0, "die Technik fehlt");
  assert.ok(wirkung < technik, "wer lernen will, kann mit HTTP 502 nichts anfangen");
});

test("auch bei langsam steht zuerst, was das für die Leute heißt", () => {
  const text = beschreibungLangsam(kiMitWirkung, [{ response_ms: 18000 }], 1200);
  assert.ok(text.startsWith("Neue Aufgaben"), text.slice(0, 60));
  assert.match(text, /18,0 s pro Anfrage/);
});

test("ohne hinterlegte Auswirkung wird keine erfunden", () => {
  const text = beschreibungAusfall(
    { name: "Irgendwas", wirkung_ausfall: null },
    [{ status_code: 500 }],
    { status_code: 500, error: "HTTP 500", response_ms: 10 },
  );
  assert.ok(text.startsWith("Irgendwas antwortet mit HTTP 500."), text);
});

test("die Auswirkung sagt auch, was trotzdem noch geht", () => {
  // Wichtiger Teil: "Was schon da ist, kannst du weiter lernen" verhindert,
  // dass jemand die App für komplett kaputt hält.
  for (const satz of [kiMitWirkung.wirkung_ausfall]) {
    assert.match(satz, /Was schon da ist/);
  }
});
