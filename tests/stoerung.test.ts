import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aufzaehlung,
  bannerBetroffen,
  betroffeneDienste,
  dienstNamen,
  formatDauer,
  formatMs,
  istOffen,
  messwertZeile,
  neuesteMeldung,
  offeneVorfaelle,
  seitText,
} from "../src/lib/stoerung";
import type { ComponentStatus, Incident, ServiceStatus, UptimeDay } from "../src/lib/types";

function vorfall(over: Partial<Incident> = {}): Incident {
  return {
    id: "i1",
    title: "Titel",
    impact: "minor",
    status: "investigating",
    started_at: "2026-08-23T14:05:00.000Z",
    resolved_at: null,
    automatic: true,
    service_slugs: [],
    updates: [],
    ...over,
  };
}

function tag(over: Partial<UptimeDay> = {}): UptimeDay {
  return {
    day: "2026-08-23",
    uptime: 1,
    checks: 288,
    downtime_minutes: 0,
    degraded_minutes: 0,
    avg_response_ms: 300,
    max_response_ms: 500,
    top_error: null,
    incidents: [],
    ...over,
  };
}

function dienst(slug: string, name: string, status: ComponentStatus): ServiceStatus {
  return {
    service: {
      id: slug,
      slug,
      name,
      probe_url: null,
      degraded_ms: 2500,
      sort_order: 1,
      active: true,
    },
    status,
    days: [tag()],
    uptime90: 1,
  };
}

test("offen ist, was weder abgeschlossen noch behoben ist", () => {
  assert.equal(istOffen(vorfall()), true);
  assert.equal(istOffen(vorfall({ status: "resolved" })), false);
  assert.equal(istOffen(vorfall({ status: "completed" })), false);
  // Ein Zeitpunkt der Behebung zählt auch dann, wenn der Status hängengeblieben ist.
  assert.equal(istOffen(vorfall({ resolved_at: "2026-08-23T15:00:00.000Z" })), false);
});

test("offene Vorfälle kommen jüngster zuerst", () => {
  const alt = vorfall({ id: "alt", started_at: "2026-08-20T10:00:00.000Z" });
  const neu = vorfall({ id: "neu", started_at: "2026-08-23T10:00:00.000Z" });
  const zu = vorfall({ id: "zu", status: "resolved" });
  assert.deepEqual(
    offeneVorfaelle([alt, zu, neu]).map((v) => v.id),
    ["neu", "alt"],
  );
});

test("die jüngste Meldung ist die erste - so kommen sie aus der Datenbank", () => {
  const v = vorfall({
    updates: [
      { id: "b", status: "identified", body: "neuer", created_at: "2026-08-23T15:00:00.000Z" },
      { id: "a", status: "investigating", body: "älter", created_at: "2026-08-23T14:05:00.000Z" },
    ],
  });
  assert.equal(neuesteMeldung(v)?.id, "b");
  assert.equal(neuesteMeldung(vorfall()), null);
});

test("betroffen ist alles, was nicht betriebsbereit ist", () => {
  const services = [
    dienst("a", "Anmeldung", "operational"),
    dienst("b", "KI", "degraded_performance"),
    dienst("c", "Daten", "major_outage"),
  ];
  assert.deepEqual(
    betroffeneDienste(services).map((s) => s.service.slug),
    ["b", "c"],
  );
  assert.equal(bannerBetroffen(services), "Betroffen: KI und Daten");
  assert.equal(bannerBetroffen([dienst("a", "Anmeldung", "operational")]), null);
});

test("Slugs werden zu Namen, Unbekanntes fällt still raus", () => {
  const services = [dienst("a", "Anmeldung", "operational"), dienst("b", "KI", "operational")];
  assert.deepEqual(dienstNamen(services, ["b", "gibtsnicht", "a"]), ["KI", "Anmeldung"]);
});

test("die Aufzählung endet auf und", () => {
  assert.equal(aufzaehlung([]), "");
  assert.equal(aufzaehlung(["A"]), "A");
  assert.equal(aufzaehlung(["A", "B"]), "A und B");
  assert.equal(aufzaehlung(["A", "B", "C"]), "A, B und C");
});

test("Zeiten werden ausgeschrieben, wie man sie sagt", () => {
  assert.equal(formatMs(820), "820 ms");
  assert.equal(formatMs(4200), "4,2 s");
  assert.equal(formatMs(15000), "15 s");
  assert.equal(formatDauer(1), "1 Minute");
  assert.equal(formatDauer(38), "38 Minuten");
  assert.equal(formatDauer(60), "1 Stunde");
  assert.equal(formatDauer(65), "1 Stunde 5 Minuten");
  assert.equal(formatDauer(180), "3 Stunden");
});

test("seit-Text nennt Uhrzeit und Abstand", () => {
  const jetzt = new Date("2026-08-23T14:27:00.000Z");
  assert.equal(seitText("2026-08-23T14:05:00.000Z", jetzt), "seit 14:05 UTC (vor 22 Minuten)");
  assert.equal(seitText("2026-08-23T14:27:00.000Z", jetzt), "seit 14:27 UTC (gerade eben)");
  assert.match(seitText("2026-08-21T14:05:00.000Z", jetzt), /vor 2 Tagen/);
});

test("bei Ausfall steht da, wie lange und woran", () => {
  const zeile = messwertZeile("major_outage", tag({ downtime_minutes: 38, top_error: "HTTP 502" }), 2500);
  assert.equal(zeile, "Heute 38 Minuten ohne Antwort, zuletzt HTTP 502.");
});

test("ohne bekannten Fehler bleibt die Dauer stehen, nichts wird erfunden", () => {
  assert.equal(
    messwertZeile("partial_outage", tag({ downtime_minutes: 5 }), 2500),
    "Heute 5 Minuten ohne Antwort.",
  );
});

test("bei Zähigkeit steht der Messwert gegen den Grenzwert", () => {
  const zeile = messwertZeile(
    "degraded_performance",
    tag({ avg_response_ms: 3750, max_response_ms: 5750 }),
    2500,
  );
  assert.equal(zeile, "Antwortzeit heute im Schnitt 3,8 s, Spitze 5,8 s - normal sind unter 2,5 s.");
});

test("ist die Spitze nicht höher als der Schnitt, wird sie weggelassen", () => {
  const zeile = messwertZeile(
    "degraded_performance",
    tag({ avg_response_ms: 3000, max_response_ms: 3000 }),
    2500,
  );
  assert.equal(zeile, "Antwortzeit heute im Schnitt 3,0 s - normal sind unter 2,5 s.");
});

test("ohne Messung steht nichts da", () => {
  assert.equal(messwertZeile("major_outage", tag({ checks: 0, downtime_minutes: 38 }), 2500), null);
  assert.equal(messwertZeile("major_outage", undefined, 2500), null);
  assert.equal(
    messwertZeile("degraded_performance", tag({ avg_response_ms: null }), 2500),
    null,
  );
});

test("betriebsbereit und Wartung bekommen keine Messzeile", () => {
  assert.equal(messwertZeile("operational", tag(), 2500), null);
  assert.equal(messwertZeile("under_maintenance", tag(), 2500), null);
});

test("Ausfallstatus ohne Ausfallminuten nennt wenigstens den Fehler", () => {
  assert.equal(
    messwertZeile("major_outage", tag({ downtime_minutes: 0, top_error: "HTTP 500" }), 2500),
    "Letzter Fehler: HTTP 500.",
  );
  assert.equal(messwertZeile("major_outage", tag({ downtime_minutes: 0 }), 2500), null);
});
