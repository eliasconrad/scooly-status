import assert from "node:assert/strict";
import test from "node:test";

import {
  SCHWEIGE_FAKTOR,
  SCHWEIGE_FARBE,
  SCHWEIGE_TEXT,
  schweigeHinweis,
  waechterSchweigt,
} from "../src/lib/schweigen";
import { baueZustand, ZUSTAND_FARBE } from "../src/lib/zustand";
import type { ServiceStatus, StatusPageData } from "../src/lib/types";

const JETZT = new Date("2026-08-24T12:00:00.000Z");
const TAKT = 5;

function vorMinuten(n: number): string {
  return new Date(JETZT.getTime() - n * 60_000).toISOString();
}

function daten(zuletzt: string | null): StatusPageData {
  const dienst = {
    service: { slug: "scooly-web", name: "Scooly", url: "", sort_order: 1, active: true },
    status: "operational",
    days: [],
    uptime90: null,
  } as unknown as ServiceStatus;
  return { services: [dienst], incidents: [], last_checked_at: zuletzt, demo: false };
}

test("frisch gemessen ist kein Schweigen", () => {
  assert.equal(waechterSchweigt(vorMinuten(2), TAKT, JETZT), false);
});

test("kurz über dem Takt ist noch kein Schweigen - ein Aussetzer ist ein Schluckauf", () => {
  assert.equal(waechterSchweigt(vorMinuten(TAKT + 1), TAKT, JETZT), false);
  assert.equal(waechterSchweigt(vorMinuten(TAKT * SCHWEIGE_FAKTOR - 1), TAKT, JETZT), false);
});

test("nach drei ausgefallenen Messungen schweigt der Wächter", () => {
  assert.equal(waechterSchweigt(vorMinuten(TAKT * SCHWEIGE_FAKTOR + 1), TAKT, JETZT), true);
});

test("noch nie gemessen zählt als Schweigen - nicht als 'alles gut'", () => {
  assert.equal(waechterSchweigt(null, TAKT, JETZT), true);
});

test("ein unlesbarer Zeitstempel zählt als Schweigen", () => {
  assert.equal(waechterSchweigt("kein Datum", TAKT, JETZT), true);
});

/*
 * Der eigentliche Punkt der ganzen Datei: Am 24.08.2026 stand in Scoolys
 * Einstellungen "Alle Systeme betriebsbereit" neben "zuletzt geprüft vor 22
 * Stunden". Beides zugleich darf es nie wieder geben.
 */
test("22 Stunden alt heißt nicht mehr 'Alle Systeme betriebsbereit'", () => {
  const z = baueZustand(daten(vorMinuten(22 * 60)), "https://status.scooly.dev", JETZT, TAKT);

  assert.equal(z.alles_gut, false, "ohne Messung darf nichts behauptet werden");
  assert.equal(z.text, SCHWEIGE_TEXT);
  assert.equal(z.farbe, SCHWEIGE_FARBE);
  assert.equal(z.waechter_schweigt, true);
  assert.notEqual(z.farbe, ZUSTAND_FARBE.operational, "grün wäre gelogen");
});

test("der gespeicherte Dienstzustand bleibt stehen - er wurde ja gemessen", () => {
  const z = baueZustand(daten(vorMinuten(22 * 60)), "https://status.scooly.dev", JETZT, TAKT);
  assert.equal(z.dienste[0].status, "operational");
  assert.match(schweigeHinweis(vorMinuten(22 * 60)), /letzte gemessene Stand/);
});

test("frisch gemessen und alles grün bleibt grün", () => {
  const z = baueZustand(daten(vorMinuten(1)), "https://status.scooly.dev", JETZT, TAKT);
  assert.equal(z.alles_gut, true);
  assert.equal(z.waechter_schweigt, false);
  assert.equal(z.farbe, ZUSTAND_FARBE.operational);
});

test("der Hinweis behauptet nichts, wenn nie gemessen wurde", () => {
  assert.match(schweigeHinweis(null), /noch nie gemessen/);
});
