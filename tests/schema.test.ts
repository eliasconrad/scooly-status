import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Ohne laufende Datenbank kann niemand ausprobieren, ob eine Abfrage
 * durchgeht. Ein vertippter Spaltenname fliegt sonst erst in der Produktion
 * auf - und zwar still, weil Supabase-Fehler oft nur geloggt werden.
 *
 * Deshalb hier ein Abgleich: Jede Tabelle und jede Spalte, die der Code
 * anfasst, muss in supabase/schema.sql stehen.
 */

const wurzel = path.resolve(import.meta.dirname, "..");
const sql = fs.readFileSync(path.join(wurzel, "supabase/schema.sql"), "utf8");

/** Tabellen samt Spalten aus dem Schema lesen. */
function schemaLesen(): Map<string, Set<string>> {
  const tabellen = new Map<string, Set<string>>();
  const re = /create table if not exists\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
  for (const treffer of sql.matchAll(re)) {
    const [, name, koerper] = treffer;
    const spalten = new Set<string>();
    for (const zeile of koerper.split("\n")) {
      const z = zeile.trim();
      if (!z || z.startsWith("--")) continue;
      if (/^(primary|foreign|unique|check|constraint)\b/i.test(z)) continue;
      const m = z.match(/^(\w+)\s+/);
      if (m) spalten.add(m[1]);
    }
    tabellen.set(name, spalten);
  }
  return tabellen;
}

/** Erstes Objektliteral nach einer Stelle einlesen und die Schlüssel ziehen. */
function objektSchluessel(text: string, ab: number): string[] {
  const start = text.indexOf("{", ab);
  if (start === -1) return [];
  let tiefe = 0;
  let ende = start;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") tiefe++;
    else if (text[i] === "}") {
      tiefe--;
      if (tiefe === 0) { ende = i; break; }
    }
  }
  const inhalt = text.slice(start + 1, ende);
  // Nur Schlüssel der obersten Ebene.
  const schluessel: string[] = [];
  let t = 0;
  for (const teil of inhalt.split("\n")) {
    const m = teil.trim().match(/^(\w+)\s*:/);
    if (m && t === 0) schluessel.push(m[1]);
    t += (teil.match(/[{[(]/g) ?? []).length - (teil.match(/[}\])]/g) ?? []).length;
  }
  return schluessel;
}

function quellenDateien(dir: string, treffer: string[] = []): string[] {
  for (const eintrag of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, eintrag.name);
    if (eintrag.isDirectory()) quellenDateien(p, treffer);
    else if (/\.tsx?$/.test(eintrag.name)) treffer.push(p);
  }
  return treffer;
}

type Zugriff = { tabelle: string; spalten: string[]; datei: string };

/** Alle .from("…")-Ketten im Quellcode einsammeln. */
function zugriffeSammeln(): Zugriff[] {
  const zugriffe: Zugriff[] = [];
  for (const datei of quellenDateien(path.join(wurzel, "src"))) {
    const text = fs.readFileSync(datei, "utf8");
    const stellen = [...text.matchAll(/\.from\("(\w+)"\)/g)];

    stellen.forEach((treffer, i) => {
      const von = treffer.index! + treffer[0].length;
      const bis = i + 1 < stellen.length ? stellen[i + 1].index! : text.length;
      const kette = text.slice(von, bis);
      const spalten = new Set<string>();

      // Filter- und Sortierbedingungen
      for (const m of kette.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|is|like|ilike|contains|order)\(\s*"(\w+)"/g)) {
        spalten.add(m[1]);
      }
      // Feldlisten in select(). Eingebettete Tabellen - "incidents(title,
      // impact)" - gehören zur anderen Tabelle und werden vorher entfernt,
      // sonst gelten deren Spalten fälschlich als Spalten dieser hier.
      for (const m of kette.matchAll(/\.select\(\s*"([^"]*)"/g)) {
        const ohneEinbettung = m[1].replace(/\w+\s*\([^)]*\)/g, "");
        for (const feld of ohneEinbettung.split(",")) {
          const f = feld.trim();
          if (!f || f === "*") continue;
          spalten.add(f);
        }
      }
      // Schlüssel in insert/upsert/update
      for (const m of kette.matchAll(/\.(?:insert|upsert|update)\(/g)) {
        for (const s of objektSchluessel(kette, m.index! + m[0].length - 1)) spalten.add(s);
      }

      zugriffe.push({ tabelle: treffer[1], spalten: [...spalten], datei: path.relative(wurzel, datei) });
    });
  }
  return zugriffe;
}

const schema = schemaLesen();
const zugriffe = zugriffeSammeln();

test("das Schema wird überhaupt eingelesen", () => {
  assert.ok(schema.size >= 6, `nur ${schema.size} Tabellen gefunden`);
  for (const t of ["services", "checks", "daily_uptime", "incidents", "incident_updates", "subscribers"]) {
    assert.ok(schema.has(t), `Tabelle ${t} fehlt im Schema`);
  }
});

test("es werden überhaupt Datenbankzugriffe gefunden", () => {
  assert.ok(zugriffe.length >= 10, `nur ${zugriffe.length} Zugriffe gefunden - der Abgleich läuft ins Leere`);
});

test("jede angesprochene Tabelle steht im Schema", () => {
  const eingebettet = new Set([...schema.keys()]);
  for (const z of zugriffe) {
    assert.ok(
      eingebettet.has(z.tabelle),
      `${z.datei}: Tabelle "${z.tabelle}" gibt es im Schema nicht`,
    );
  }
});

test("jede angesprochene Spalte steht im Schema", () => {
  const fehler: string[] = [];
  for (const z of zugriffe) {
    const spalten = schema.get(z.tabelle);
    if (!spalten) continue;
    for (const s of z.spalten) {
      if (!spalten.has(s)) fehler.push(`${z.datei}: ${z.tabelle}.${s} gibt es nicht`);
    }
  }
  assert.deepEqual(fehler, [], fehler.join("\n"));
});

test("die eingebettete Abfrage incident_updates passt zur Fremdschlüsselkette", () => {
  assert.ok(schema.get("incident_updates")?.has("incident_id"));
  assert.match(sql, /incident_id\s+uuid not null references incidents\(id\) on delete cascade/);
});

test("daily_uptime hat den zusammengesetzten Schlüssel, den der Upsert braucht", () => {
  // onConflict: "service_slug,day" funktioniert nur mit passendem Primärschlüssel.
  assert.match(sql, /primary key \(service_slug, day\)/);
});

test("services.slug ist eindeutig - sonst greifen die Fremdschlüssel nicht", () => {
  assert.match(sql, /slug\s+text unique not null/);
});

test("die Startbelegung passt zu den Spalten der Tabelle services", () => {
  const m = sql.match(/insert into services \(([^)]+)\) values/);
  assert.ok(m, "keine Startbelegung gefunden");
  for (const spalte of m![1].split(",").map((s) => s.trim())) {
    assert.ok(schema.get("services")!.has(spalte), `services.${spalte} gibt es nicht`);
  }
});

test("alle Status- und Schweregradwerte im Code sind im Schema erlaubt", () => {
  const erlaubteStatus = sql.match(/status in \(([^)]+)\)/)![1].match(/'(\w+)'/g)!.map((s) => s.slice(1, -1));
  const erlaubteImpacts = sql.match(/impact in \(([^)]+)\)/)![1].match(/'(\w+)'/g)!.map((s) => s.slice(1, -1));

  const uptimeTs = fs.readFileSync(path.join(wurzel, "src/lib/uptime.ts"), "utf8");

  /** Schlüssel eines benannten Record-Objekts aus der Quelle ziehen. */
  const schluesselVon = (name: string): string[] => {
    const start = uptimeTs.indexOf(`export const ${name}`);
    assert.notEqual(start, -1, `${name} nicht gefunden`);
    return objektSchluessel(uptimeTs, start);
  };

  const statusImCode = schluesselVon("STATUS_LABEL");
  assert.deepEqual(
    schluesselVon("STATUS_COLOR").sort(),
    statusImCode.slice().sort(),
    "STATUS_LABEL und STATUS_COLOR müssen dieselben Stufen kennen",
  );
  assert.deepEqual(
    schluesselVon("BANNER_LABEL").sort(),
    statusImCode.slice().sort(),
    "jeder Dienststatus braucht auch einen Bannertext",
  );

  for (const s of statusImCode) {
    assert.ok(erlaubteStatus.includes(s), `Dienststatus "${s}" wäre in der Datenbank nicht erlaubt`);
  }
  assert.equal(statusImCode.length, erlaubteStatus.length, "Code und Schema kennen unterschiedlich viele Stufen");

  for (const i of schluesselVon("IMPACT_COLOR")) {
    assert.ok(erlaubteImpacts.includes(i), `Schweregrad "${i}" wäre in der Datenbank nicht erlaubt`);
  }
});

test("jeder Vorfallszustand, den der Wächter schreibt, hat einen deutschen Text", () => {
  const uptimeTs = fs.readFileSync(path.join(wurzel, "src/lib/uptime.ts"), "utf8");
  const bekannt = objektSchluessel(uptimeTs, uptimeTs.indexOf("export const INCIDENT_STATUS_LABEL"));

  const checkerTs = fs.readFileSync(path.join(wurzel, "src/lib/checker.ts"), "utf8");
  const geschrieben = [...checkerTs.matchAll(/status:\s*"(\w+)"/g)].map((m) => m[1]);

  assert.ok(geschrieben.length > 0, "der Wächter schreibt gar keinen Zustand?");
  for (const z of geschrieben) {
    assert.ok(bekannt.includes(z), `Zustand "${z}" hätte auf der Seite keinen Text`);
  }
});

test("das Prüfskript erwartet genau die Spalten, die im Schema stehen", () => {
  // Sonst prüft es irgendwann an der Wirklichkeit vorbei.
  const skript = fs.readFileSync(path.join(wurzel, "scripts/pruefe-datenbank.ts"), "utf8");
  const block = skript.slice(skript.indexOf("const erwartet"), skript.indexOf("for (const [tabelle"));

  const fehler: string[] = [];
  for (const treffer of block.matchAll(/(\w+):\s*\[([^\]]+)\]/g)) {
    const tabelle = treffer[1];
    const spalten = schema.get(tabelle);
    if (!spalten) {
      fehler.push(`Tabelle ${tabelle} gibt es im Schema nicht`);
      continue;
    }
    for (const m of treffer[2].matchAll(/"(\w+)"/g)) {
      if (!spalten.has(m[1])) fehler.push(`${tabelle}.${m[1]} gibt es nicht`);
    }
  }
  assert.ok(block.length > 100, "der Erwartungsblock wurde nicht gefunden");
  assert.deepEqual(fehler, [], fehler.join("\n"));
});

test("anon und authenticated bekommen nichts - jetzt und künftig", () => {
  // Ohne das wäre der Haken "Automatically expose new tables" im Dashboard
  // eine offene Flanke für jede später angelegte Tabelle.
  assert.match(sql, /revoke all on all tables in schema public from anon, authenticated;/);
  assert.match(
    sql,
    /alter default privileges in schema public revoke all on tables from anon, authenticated;/,
    "künftige Tabellen wären sonst öffentlich lesbar",
  );
});

test("jede Tabelle schaltet RLS selbst ein", () => {
  // Damit ist der Haken "Enable automatic RLS" im Dashboard für uns egal.
  for (const tabelle of schema.keys()) {
    assert.match(
      sql,
      new RegExp(`alter table\\s+${tabelle}\\s+enable row level security`),
      `${tabelle} hat kein RLS`,
    );
  }
});

test("es gibt keine Regel, die anon doch etwas lesen ließe", () => {
  assert.doesNotMatch(sql, /create policy/i, "eine Policy würde RLS wieder öffnen");
});
