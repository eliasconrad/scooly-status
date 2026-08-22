import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const wurzel = path.resolve(import.meta.dirname, "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

function quellen(dir: string, treffer: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) quellen(p, treffer);
    else if (/\.tsx?$/.test(e.name)) treffer.push(p);
  }
  return treffer;
}

test("jede Umgebungsvariable, die der Code liest, steht in .env.example", () => {
  const beispiel = lies(".env.example");
  const gelesen = new Set<string>();
  for (const datei of quellen(path.join(wurzel, "src"))) {
    for (const m of fs.readFileSync(datei, "utf8").matchAll(/process\.env\.(\w+)/g)) {
      if (["NODE_ENV"].includes(m[1])) continue;
      gelesen.add(m[1]);
    }
  }
  assert.ok(gelesen.size > 5, `nur ${gelesen.size} Variablen gefunden`);
  const fehlend = [...gelesen].filter((v) => !new RegExp(`^#?\\s*${v}=`, "m").test(beispiel));
  assert.deepEqual(fehlend, [], `nicht dokumentiert: ${fehlend.join(", ")}`);
});

test("der Messtakt im Code und im Wächter-Zeitplan passen zusammen", () => {
  const workflow = lies(".github/workflows/waechter.yml");
  const takt = workflow.match(/cron:\s*"\*\/(\d+) \* \* \* \*"/);
  assert.ok(takt, "kein Minutentakt im Zeitplan gefunden");

  const beispiel = lies(".env.example");
  const minuten = beispiel.match(/^CHECK_INTERVAL_MINUTES=(\d+)/m);
  assert.ok(minuten, "CHECK_INTERVAL_MINUTES fehlt in .env.example");
  assert.equal(
    takt![1],
    minuten![1],
    "sonst stimmen die ausgewiesenen Ausfallminuten nicht mit der Wirklichkeit überein",
  );
});

test("der Wächter-Zeitplan bricht bei einer schlechten Antwort ab", () => {
  const workflow = lies(".github/workflows/waechter.yml");
  assert.match(workflow, /exit 1/, "ein stiller Fehlschlag wäre schlimmer als keine Überwachung");
  assert.match(workflow, /Authorization: Bearer/, "der Aufruf muss das Geheimnis mitschicken");
});

test("die Zeitgrenze passt in das Zeitfenster der Serverfunktion", () => {
  const route = lies("src/app/api/check/route.ts");
  const maxDuration = Number(route.match(/maxDuration = (\d+)/)![1]);
  const checker = lies("src/lib/checker.ts");
  const timeout = Number(checker.match(/CHECK_TIMEOUT_MS \?\? (\d+)/)![1]);

  // Gemessen wird parallel, also zählt eine Zeitgrenze - plus Luft für die
  // Datenbankschreibvorgänge.
  assert.ok(
    timeout / 1000 < maxDuration / 2,
    `Zeitgrenze ${timeout} ms passt nicht in ${maxDuration} s`,
  );
  assert.match(checker, /Promise\.all\(services\.map/, "sequenzielles Messen würde die Grenze reißen");
});

test("vercel.json ist gültiges JSON und trifft eine echte Route", () => {
  const cfg = JSON.parse(lies("vercel.json"));
  for (const cron of cfg.crons ?? []) {
    const pfad = path.join(wurzel, "src/app", cron.path, "route.ts");
    assert.ok(fs.existsSync(pfad), `${cron.path} gibt es nicht`);
  }
});

test("die Startseite bleibt zwischenspeicherbar", () => {
  const seite = lies("src/app/page.tsx");
  assert.match(seite, /export const revalidate = \d+/);
  assert.doesNotMatch(seite, /searchParams/, "Query-Parameter machen die Seite dynamisch");
  assert.doesNotMatch(seite, /force-dynamic/);
});

test("keine Seite erfindet Dienste, wenn die Datenbank leer ist", () => {
  for (const datei of ["src/lib/calendar.ts", "src/app/page.tsx"]) {
    assert.match(
      lies(datei),
      /keine Dienste eingetragen/,
      `${datei} müsste bei leerer Dienstliste abbrechen statt etwas anzuzeigen`,
    );
  }
});

test("Demodaten sind in der Produktion gesperrt", () => {
  const status = lies("src/lib/status.ts");
  assert.match(status, /process\.env\.NODE_ENV !== "production"/);
  assert.match(status, /STATUS_DEMO === "1"/);
  // Der Kalender muss dieselbe Sperre haben.
  assert.match(lies("src/lib/calendar.ts"), /NODE_ENV === "production"[\s\S]{0,80}STATUS_DEMO/);
});
