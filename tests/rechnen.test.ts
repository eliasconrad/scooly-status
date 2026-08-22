import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAR, formatUptime, overallUptime, uptimeColor, worstStatus,
} from "../src/lib/uptime";
import type { UptimeDay } from "../src/lib/types";

const tag = (uptime: number | null, checks = 288): UptimeDay => ({
  day: "2026-01-01", uptime, checks, downtime_minutes: 0,
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

test("die Balkenfarben treffen die Stützstellen des Originals", () => {
  assert.equal(uptimeColor(1), "rgb(118, 173, 42)");
  assert.equal(uptimeColor(0.95), "rgb(224, 67, 67)");
  assert.equal(uptimeColor(0.5), "rgb(224, 67, 67)", "unter 95 % bleibt es rot");
  assert.equal(uptimeColor(0.995), "rgb(248, 167, 42)");
});

test("ein Balken ohne Messdaten ist grau, nicht grün", () => {
  const farbe = uptimeColor(null);
  assert.notEqual(farbe, "rgb(118, 173, 42)");
  assert.match(farbe, /^#/);
});

test("die Farbe wird mit sinkender Verfügbarkeit durchgehend dunkler/röter", () => {
  const rot = (u: number) => Number(uptimeColor(u).match(/\d+/g)![0]);
  const werte = [1, 0.999, 0.998, 0.996, 0.993, 0.985, 0.96];
  for (let i = 1; i < werte.length; i++) {
    assert.ok(
      rot(werte[i]) >= rot(werte[i - 1]) - 30,
      `Sprung zwischen ${werte[i - 1]} und ${werte[i]}: ${uptimeColor(werte[i - 1])} → ${uptimeColor(werte[i])}`,
    );
  }
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
