import { test } from "node:test";
import assert from "node:assert/strict";
import { incidentsByDay } from "../src/lib/vorfaelle";
import { dauer } from "../src/components/tag-popup";
import type { Incident } from "../src/lib/types";

const AM = new Date("2026-08-22T12:00:00Z");

function vorfall(teil: Partial<Incident>): Incident {
  return {
    id: "v1", title: "Test", impact: "major", status: "resolved",
    started_at: "2026-08-20T09:00:00Z", resolved_at: "2026-08-20T10:00:00Z",
    automatic: true, service_slugs: ["scooly-web"], updates: [],
    ...teil,
  };
}

test("ein Vorfall landet am richtigen Tag beim richtigen Dienst", () => {
  const m = incidentsByDay([vorfall({})], AM);
  assert.equal(m.get("scooly-web:2026-08-20")?.length, 1);
  assert.equal(m.get("scooly-web:2026-08-19"), undefined);
  assert.equal(m.get("scooly-web:2026-08-21"), undefined);
  assert.equal(m.get("scooly-ki:2026-08-20"), undefined);
});

test("ein Vorfall über Mitternacht taucht an beiden Tagen auf", () => {
  const m = incidentsByDay(
    [vorfall({ started_at: "2026-08-20T23:30:00Z", resolved_at: "2026-08-21T00:20:00Z" })],
    AM,
  );
  assert.equal(m.get("scooly-web:2026-08-20")?.length, 1);
  assert.equal(m.get("scooly-web:2026-08-21")?.length, 1);
});

test("ein Vorfall über mehrere Dienste landet bei allen", () => {
  const m = incidentsByDay([vorfall({ service_slugs: ["scooly-web", "scooly-ki"] })], AM);
  assert.equal(m.get("scooly-web:2026-08-20")?.length, 1);
  assert.equal(m.get("scooly-ki:2026-08-20")?.length, 1);
});

test("ein noch offener Vorfall läuft bis heute, aber nicht weiter", () => {
  const m = incidentsByDay(
    [vorfall({ started_at: "2026-08-19T08:00:00Z", resolved_at: null })],
    AM,
  );
  for (const t of ["19", "20", "21", "22"]) {
    assert.ok(m.get(`scooly-web:2026-08-${t}`), `${t}. fehlt`);
  }
  assert.equal(m.get("scooly-web:2026-08-23"), undefined, "die Zukunft bleibt leer");
});

test("ein Vorfall wird pro Tag nur einmal gelistet", () => {
  const eins = vorfall({});
  const m = incidentsByDay([eins, eins], AM);
  assert.equal(m.get("scooly-web:2026-08-20")?.length, 1);
});

test("kaputte Zeitangaben legen die Zuordnung nicht lahm", () => {
  const m = incidentsByDay(
    [
      vorfall({ id: "kaputt", started_at: "gar kein Datum" }),
      // behoben vor dem Beginn - dann zählt nur der Starttag
      vorfall({ id: "verdreht", started_at: "2026-08-20T10:00:00Z", resolved_at: "2026-08-19T10:00:00Z" }),
    ],
    AM,
  );
  assert.equal(m.get("scooly-web:2026-08-20")?.length, 1);
  assert.equal([...m.values()].flat().some((v) => v.id === "kaputt"), false);
});

test("ein nie geschlossener Vorfall aus der Vergangenheit läuft nicht endlos", () => {
  const m = incidentsByDay(
    [vorfall({ started_at: "2019-01-01T00:00:00Z", resolved_at: null })],
    AM,
  );
  assert.ok(m.size <= 400, `${m.size} Einträge - die Schleife hat kein Netz`);
});

test("Dauern werden lesbar geschrieben", () => {
  assert.equal(dauer(0), "0 Min.");
  assert.equal(dauer(22), "22 Min.");
  assert.equal(dauer(60), "1 Std.");
  assert.equal(dauer(97), "1 Std. 37 Min.");
  assert.equal(dauer(1440), "24 Std.");
});

test("die Vorfälle kommen wirklich an den Tagesbalken an", async () => {
  const { demoData } = await import("../src/lib/demo");
  const daten = demoData();

  const ki = daten.services.find((s) => s.service.slug === "scooly-ki");
  assert.ok(ki, "Dienst nicht gefunden");

  const mitVorfall = ki!.days.filter((d) => d.incidents.length > 0);
  assert.ok(mitVorfall.length > 0, "kein einziger Tagesbalken kennt seinen Vorfall");

  // Der Demovorfall betrifft nur diesen Dienst - kein anderer darf ihn zeigen.
  const fremd = daten.services
    .filter((s) => s.service.slug !== "scooly-ki")
    .flatMap((s) => s.days)
    .flatMap((d) => d.incidents)
    .filter((v) => v.title.includes("Karteikarten"));
  assert.equal(fremd.length, 0, "ein Vorfall ist bei einem fremden Dienst gelandet");
});

test("jeder Tagesbalken trägt die Felder, die das Popup braucht", async () => {
  const { demoData } = await import("../src/lib/demo");
  for (const dienst of demoData().services) {
    for (const tag of dienst.days) {
      assert.equal(typeof tag.downtime_minutes, "number", tag.day);
      assert.equal(typeof tag.degraded_minutes, "number", tag.day);
      assert.ok(Array.isArray(tag.incidents), tag.day);
      assert.ok(tag.downtime_minutes >= 0 && tag.degraded_minutes >= 0);
    }
  }
});

test("ein Tag ohne Messung behauptet nicht, es sei nichts passiert", async () => {
  const { buildMonth } = await import("../src/lib/calendar");
  const m = buildMonth({ year: 2026, month: 5 }, new Map(), new Date("2026-08-22T12:00:00Z"));
  const erster = m.cells.find((c) => c !== null)!;
  assert.equal(erster.tag.uptime, null);
  assert.equal(erster.tag.checks, 0);
  // Das Popup unterscheidet daran "keine Messdaten" von "kein Ausfall".
});
