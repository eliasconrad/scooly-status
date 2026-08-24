import { test } from "node:test";
import assert from "node:assert/strict";
import { baueZustand, ZUSTAND_FARBE } from "../src/lib/zustand";
import type { ComponentStatus, Incident, ServiceStatus, StatusPageData } from "../src/lib/types";

function dienst(slug: string, name: string, status: ComponentStatus): ServiceStatus {
  return {
    service: { id: slug, slug, name, probe_url: null, degraded_ms: 2500, sort_order: 1, active: true },
    status,
    days: [],
    uptime90: 1,
  };
}

/*
 * Feste Uhr statt der echten. Vorher stand hier ein fester Zeitstempel und
 * `baueZustand` rechnete gegen `new Date()` - die Messung wurde also mit
 * jedem Tag älter, und seit der Wächter auch verstummen kann, wäre der Test
 * von selbst rot geworden. Ein Test, dessen Ergebnis vom Kalender abhängt,
 * prüft nicht das, was er zu prüfen vorgibt.
 */
const JETZT = new Date("2026-08-23T08:02:00.000Z");

function daten(over: Partial<StatusPageData> = {}): StatusPageData {
  return {
    services: [dienst("a", "Anmeldung", "operational")],
    incidents: [],
    last_checked_at: "2026-08-23T08:00:00.000Z",
    demo: false,
    ...over,
  };
}

const SEITE = "https://status.scooly.dev";

test("läuft alles, sagt es das in einem Satz und in Grün", () => {
  const z = baueZustand(daten(), SEITE, JETZT);
  assert.equal(z.status, "operational");
  assert.equal(z.text, "Alle Systeme betriebsbereit");
  assert.equal(z.farbe, "#76ad2a");
  assert.equal(z.alles_gut, true);
  assert.equal(z.seite, SEITE);
});

test("der schlechteste Dienst bestimmt Farbe und Satz", () => {
  const z = baueZustand(
    daten({
      services: [
        dienst("a", "Anmeldung", "operational"),
        dienst("b", "KI", "degraded_performance"),
        dienst("c", "Daten", "major_outage"),
      ],
    }),
    SEITE,
    JETZT,
  );
  assert.equal(z.status, "major_outage");
  assert.equal(z.farbe, ZUSTAND_FARBE.major_outage);
  assert.equal(z.alles_gut, false);
  assert.equal(z.dienste.length, 3);
  assert.equal(z.dienste[1].text, "Beeinträchtigte Leistung");
});

test("jede Stufe hat eine Farbe - sonst stünde die App ohne da", () => {
  const stufen: ComponentStatus[] = [
    "operational",
    "degraded_performance",
    "partial_outage",
    "major_outage",
    "under_maintenance",
  ];
  for (const stufe of stufen) {
    assert.match(ZUSTAND_FARBE[stufe], /^#[0-9a-f]{6}$/, `${stufe} braucht eine Hex-Farbe`);
  }
});

test("offene Störungen kommen mit Klartext und Namen mit", () => {
  const vorfall: Incident = {
    id: "i1",
    title: "Handschrift-Erkennung antwortet nicht",
    impact: "major",
    status: "identified",
    started_at: "2026-08-23T07:30:00.000Z",
    resolved_at: null,
    automatic: true,
    service_slugs: ["b", "unbekannt"],
    updates: [
      { id: "u2", status: "identified", body: "neuer", created_at: "2026-08-23T07:50:00.000Z" },
      { id: "u1", status: "investigating", body: "älter", created_at: "2026-08-23T07:30:00.000Z" },
    ],
  };
  const z = baueZustand(
    daten({
      services: [dienst("b", "Handschrift-Erkennung", "major_outage")],
      incidents: [vorfall],
    }),
    SEITE,
    new Date("2026-08-23T08:00:00.000Z"),
  );
  assert.equal(z.stoerungen.length, 1);
  assert.equal(z.stoerungen[0].titel, vorfall.title);
  assert.equal(z.stoerungen[0].meldung, "neuer", "die jüngste Meldung, nicht die erste");
  assert.deepEqual(z.stoerungen[0].betrifft, ["Handschrift-Erkennung", "unbekannt"]);
  assert.match(z.stoerungen[0].seit, /07:30 UTC/);
});

test("behobene Vorfälle tauchen nicht auf", () => {
  const behoben: Incident = {
    id: "i2",
    title: "war mal",
    impact: "minor",
    status: "resolved",
    started_at: "2026-08-22T07:30:00.000Z",
    resolved_at: "2026-08-22T08:30:00.000Z",
    automatic: true,
    service_slugs: [],
    updates: [],
  };
  assert.equal(baueZustand(daten({ incidents: [behoben] }), SEITE).stoerungen.length, 0);
});

test("ohne Messung bleibt der Zeitpunkt leer statt erfunden", () => {
  assert.equal(baueZustand(daten({ last_checked_at: null }), SEITE).geprueft, null);
});
