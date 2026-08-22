import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonth, monthName, monthsForPage, pageLabel } from "../src/lib/calendar";
import { lastNDays } from "../src/lib/demo";
import type { UptimeDay } from "../src/lib/types";

const AM = new Date("2026-08-22T10:00:00Z");

test("ein Blatt zeigt drei Monate und endet mit dem laufenden", () => {
  const m = monthsForPage(1, AM);
  assert.equal(m.length, 3);
  assert.deepEqual(m.map(monthName), ["Juni 2026", "Juli 2026", "August 2026"]);
  assert.equal(pageLabel(m), "Juni 2026 bis August 2026");
});

test("zurückblättern springt sauber über den Jahreswechsel", () => {
  assert.deepEqual(monthsForPage(2, AM).map(monthName), ["März 2026", "April 2026", "Mai 2026"]);
  assert.deepEqual(monthsForPage(3, AM).map(monthName), ["Dezember 2025", "Januar 2026", "Februar 2026"]);
  assert.deepEqual(monthsForPage(4, AM).map(monthName), ["September 2025", "Oktober 2025", "November 2025"]);
});

test("die Woche beginnt am Montag", () => {
  // 1. Juni 2026 ist ein Montag - kein Platzhalter davor.
  const juni = buildMonth({ year: 2026, month: 5 }, new Map(), AM);
  assert.equal(juni.cells[0]?.day, "2026-06-01");

  // 1. Juli 2026 ist ein Mittwoch - zwei Platzhalter.
  const juli = buildMonth({ year: 2026, month: 6 }, new Map(), AM);
  assert.equal(juli.cells[0], null);
  assert.equal(juli.cells[1], null);
  assert.equal(juli.cells[2]?.day, "2026-07-01");

  // 1. August 2026 ist ein Samstag - fünf Platzhalter.
  const august = buildMonth({ year: 2026, month: 7 }, new Map(), AM);
  assert.equal(august.cells.filter((c) => c === null).length, 5);
  assert.equal(august.cells[5]?.day, "2026-08-01");
});

test("Monatslängen stimmen, auch im Schaltjahr", () => {
  const zaehle = (y: number, m: number) =>
    buildMonth({ year: y, month: m }, new Map(), AM).cells.filter((c) => c !== null).length;
  assert.equal(zaehle(2026, 1), 28, "Februar 2026");
  assert.equal(zaehle(2028, 1), 29, "Februar 2028 ist ein Schaltjahr");
  assert.equal(zaehle(2026, 3), 30, "April");
  assert.equal(zaehle(2026, 0), 31, "Januar");
});

test("Tage in der Zukunft sind als solche gekennzeichnet", () => {
  const august = buildMonth({ year: 2026, month: 7 }, new Map(), AM);
  const heute = august.cells.find((c) => c?.day === "2026-08-22");
  const morgen = august.cells.find((c) => c?.day === "2026-08-23");
  assert.equal(heute?.future, false, "der heutige Tag zählt noch mit");
  assert.equal(morgen?.future, true);
});

test("ein Monat ohne Messdaten hat keine Verfügbarkeit - keine 100 Prozent", () => {
  const m = buildMonth({ year: 2026, month: 5 }, new Map(), AM);
  assert.equal(m.uptime, null);
  assert.ok(m.cells.every((c) => c === null || c.uptime === null));
});

test("die Monatsverfügbarkeit rechnet nur mit gemessenen Tagen", () => {
  const daten = new Map<string, UptimeDay>([
    ["2026-06-01", { day: "2026-06-01", uptime: 1, checks: 288, downtime_minutes: 0 }],
    ["2026-06-02", { day: "2026-06-02", uptime: 0.5, checks: 288, downtime_minutes: 720 }],
  ]);
  const m = buildMonth({ year: 2026, month: 5 }, daten, AM);
  assert.equal(m.uptime, 0.75, "zwei gemessene Tage, nicht dreißig");
});

test("die 90-Tage-Leiste hat genau 90 Tage und endet heute", () => {
  const tage = lastNDays(90, AM);
  assert.equal(tage.length, 90);
  assert.equal(tage[89], "2026-08-22");
  assert.equal(tage[0], "2026-05-25");
  assert.equal(new Set(tage).size, 90, "keine Dopplungen");
});
