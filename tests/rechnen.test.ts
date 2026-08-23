import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAR, farbeFuerMinuten, formatUptime, overallUptime, tagesFarbe, tagesSchwere, worstStatus,
} from "../src/lib/uptime";
import type { UptimeDay } from "../src/lib/types";

const tag = (uptime: number | null, checks = 288): UptimeDay => ({
  day: "2026-01-01", uptime, checks,
  downtime_minutes: 0, degraded_minutes: 0,
  avg_response_ms: null, max_response_ms: null, top_error: null, incidents: [],
});

test("ohne Messdaten gibt es keinen Wert - nicht etwa 100 Prozent", () => {
  assert.equal(overallUptime([]), null);
  assert.equal(overallUptime([tag(null), tag(null)]), null);
  assert.equal(formatUptime(null), "-");
});

test("Tage ohne Messung fließen nicht in den Schnitt ein", () => {
  assert.equal(overallUptime([tag(1), tag(null), tag(1)]), 1);
});

test("der Schnitt wird nach Anzahl der Messungen gewichtet", () => {
  // Ein voller Tag mit 100 % und ein angefangener Tag mit 0 % nach 6 Messungen.
  // Ungewichtet käme 50 % heraus - das wäre grob falsch.
  const wert = overallUptime([tag(1, 288), tag(0, 6)])!;
  assert.ok(wert > 0.97, `gewichtet erwartet (~0,979), bekommen: ${wert}`);
  assert.equal(Number(wert.toFixed(6)), Number((288 / 294).toFixed(6)));
});

test("Verfügbarkeit wird abgeschnitten, nicht aufgerundet", () => {
  // 99,996 % darf nicht als glatte 100 % dastehen.
  assert.equal(formatUptime(0.99996), "99.99 %");
  assert.equal(formatUptime(0.999999), "99.99 %");
  assert.equal(formatUptime(1), "100.00 %");
  assert.equal(formatUptime(0.9937), "99.37 %");
  assert.equal(formatUptime(0), "0.00 %");
});

/** Kurzschreibweise: Tag mit x Ausfallminuten und y zähen Minuten. */
const tagMit = (aus: number, zaeh = 0): UptimeDay => ({
  day: "2026-01-01", uptime: 1 - (aus + zaeh) / 1440, checks: 288,
  downtime_minutes: aus, degraded_minutes: zaeh,
  avg_response_ms: null, max_response_ms: null, top_error: null, incidents: [],
});

/** Grob einordnen, damit die Tests nicht an einzelnen RGB-Werten kleben. */
function stufe(farbe: string): string {
  const [r, g] = farbe.match(/\d+/g)!.map(Number);
  if (r < 140 && g > 160) return "grün";
  if (r < 215 && g > 160) return "gelbgrün";
  if (g > 150) return "gelb";
  if (g > 90) return "orange";
  return "rot";
}

test("ein Tag ohne Ausfall ist grün", () => {
  assert.equal(stufe(tagesFarbe(tagMit(0))), "grün");
});

test("eine einzige zähe Antwort färbt den Tag nicht ein", () => {
  // Das war der Hauptfehler der alten Prozentskala: 5 von 1440 Minuten
  // zäh reichten für Gelb.
  assert.equal(stufe(tagesFarbe(tagMit(0, 5))), "grün");
});

test("ein Tag, der nur zäh war, wird nicht rot", () => {
  assert.equal(stufe(tagesFarbe(tagMit(0, 60))), "gelbgrün", "eine zähe Stunde");
  assert.equal(stufe(tagesFarbe(tagMit(0, 240))), "orange", "vier zähe Stunden");
  assert.notEqual(stufe(tagesFarbe(tagMit(0, 720))), "rot", "auch ein halber zäher Tag ist kein Ausfall");
});

test("die Ausfalldauer bekommt über den ganzen Tag Spielraum", () => {
  assert.equal(stufe(tagesFarbe(tagMit(5))), "gelbgrün");
  assert.equal(stufe(tagesFarbe(tagMit(30))), "gelb");
  assert.equal(stufe(tagesFarbe(tagMit(120))), "orange");
  assert.equal(stufe(tagesFarbe(tagMit(480))), "rot");
  assert.equal(stufe(tagesFarbe(tagMit(720))), "rot");
});

test("die Farbe wird mit der Ausfalldauer durchgehend schlechter", () => {
  // Der Rotwert allein taugt nicht als Maßstab: Von Gelb (250,167,42) nach
  // Orange (232,98,53) sinkt er, obwohl es schlimmer wird. Aussagekräftig
  // ist der Abstand zwischen Rot und Grün.
  const roete = (m: number) => {
    const [r, g] = farbeFuerMinuten(m).match(/\d+/g)!.map(Number);
    return r - g;
  };
  const stufen = [0, 5, 15, 30, 60, 120, 240, 480, 900];
  for (let i = 1; i < stufen.length; i++) {
    assert.ok(
      roete(stufen[i]) >= roete(stufen[i - 1]),
      `${stufen[i - 1]} -> ${stufen[i]} Min wurde harmloser statt schlimmer`,
    );
  }
  assert.ok(roete(900) > roete(0) + 150, "zwischen bestem und schlimmstem Tag muss Abstand liegen");
});

test("Ausfall wiegt schwerer als zäh", () => {
  assert.equal(tagesSchwere(tagMit(60, 0)), 60);
  assert.equal(tagesSchwere(tagMit(0, 60)), 15, "zäh zählt zu einem Viertel");
  assert.equal(tagesSchwere(tagMit(10, 40)), 20);
});

test("alte Tage ohne Minutenspalten werden aus dem Prozentwert gerechnet", () => {
  const alt = {
    day: "2026-01-01", uptime: 0.99, checks: 288,
    downtime_minutes: 0, degraded_minutes: 0,
    avg_response_ms: null, max_response_ms: null, top_error: null, incidents: [],
  };
  assert.equal(Math.round(tagesSchwere(alt)), 14, "1 % von 1440 Minuten");
});

test("ein Balken ohne Messdaten ist grau, nicht grün", () => {
  const ohne = { ...tagMit(0), uptime: null, checks: 0 };
  const farbe = tagesFarbe(ohne);
  assert.match(farbe, /^#/);
  assert.notEqual(farbe, tagesFarbe(tagMit(0)));
});

test("die Leiste hat die Geometrie des Originals", () => {
  assert.equal(BAR.days, 90);
  assert.equal(BAR.viewBoxWidth, 448);
  assert.equal(BAR.viewBoxHeight, 34);
  assert.equal(BAR.width, 3);
  assert.equal(Number(BAR.pitch.toFixed(4)), 4.9778);
  // 90 Balken müssen in die Fläche passen, ohne rechts herauszulaufen.
  assert.ok((BAR.days - 1) * BAR.pitch + BAR.width <= BAR.viewBoxWidth);
});

test("das Banner zeigt immer den schlechtesten Einzelstatus", () => {
  assert.equal(worstStatus(["operational", "operational"]), "operational");
  assert.equal(worstStatus(["operational", "degraded_performance"]), "degraded_performance");
  assert.equal(worstStatus(["degraded_performance", "major_outage"]), "major_outage");
  assert.equal(worstStatus(["major_outage", "partial_outage"]), "major_outage");
  assert.equal(worstStatus(["under_maintenance", "operational"]), "under_maintenance");
});
