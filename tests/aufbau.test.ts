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

test("die Umschaltpunkte stehen so im CSS, wie sie am Original gemessen wurden", () => {
  const css = lies("src/app/globals.css");
  // 451 = Kopfzeile stapelt, Knopftext kurz, Schrift kleiner
  // 651 = zurück auf die Desktop-Werte
  // 601 / 1025 = 30 -> 60 -> 90 Tage in der Leiste
  for (const punkt of [451, 651, 601, 1025]) {
    assert.match(css, new RegExp(`min-width:\\s*${punkt}px`), `Umschaltpunkt ${punkt} fehlt`);
  }
});

test("der Ausschnitt der Leiste zeigt rechnerisch genau 30 bzw. 60 Tage", () => {
  const css = lies("src/app/globals.css");
  const GESAMT = 448; // viewBox-Breite
  const RASTER = GESAMT / 90;

  const gelesen = [...css.matchAll(/scaleX\(([\d.]+)\)\s*translateX\((-?[\d.]+)px\)/g)].map(
    (m) => ({ skala: Number(m[1]), versatz: Number(m[2]) }),
  );
  assert.equal(gelesen.length, 2, "erwartet je eine Regel für 30 und 60 Tage");

  for (const [i, tage] of [30, 60].entries()) {
    const { skala, versatz } = gelesen[i];
    const fensterBreite = tage * RASTER;

    // Der Versatz muss auf den ersten sichtbaren Tag zeigen.
    assert.ok(
      Math.abs(-versatz - (GESAMT - fensterBreite)) < 2,
      `${tage} Tage: Versatz ${versatz}, erwartet rund ${-(GESAMT - fensterBreite).toFixed(0)}`,
    );
    // Und die Streckung muss dieses Fenster auf die volle Breite bringen.
    assert.ok(
      Math.abs(skala - GESAMT / fensterBreite) < 0.02,
      `${tage} Tage: Streckung ${skala}, erwartet ${(GESAMT / fensterBreite).toFixed(4)}`,
    );
    // Gegenprobe: der letzte Tag muss genau am rechten Rand landen.
    const rechterRand = (GESAMT + versatz) * skala;
    assert.ok(
      Math.abs(rechterRand - GESAMT) < 3,
      `${tage} Tage: rechter Rand landet bei ${rechterRand.toFixed(1)} statt ${GESAMT}`,
    );
  }
});

test("zu jedem Ausschnitt gibt es einen eigenen Prozentwert", () => {
  // Sonst stünde am Handy die 90-Tage-Zahl unter einer 30-Tage-Leiste.
  const bar = lies("src/components/uptime-bar.tsx");
  assert.match(bar, /days\.slice\(-30\)/);
  assert.match(bar, /days\.slice\(-60\)/);
  for (const k of ["sp-zeitraum-30", "sp-zeitraum-60", "sp-zeitraum-90"]) {
    assert.match(lies("src/app/globals.css"), new RegExp(`\\.${k}`), `${k} fehlt im CSS`);
  }
});

test("der Inhalt nimmt 90 Prozent der Fensterbreite, höchstens 850", () => {
  const css = lies("src/app/globals.css");
  const block = css.slice(css.indexOf(".sp-container"), css.indexOf(".sp-container") + 200);
  assert.match(block, /width:\s*90%/);
  assert.match(block, /max-width:\s*var\(--sp-width\)/);
  assert.match(css, /--sp-width:\s*850px/);
});

test("die Popups stehen unter dem Balken, nicht darüber", () => {
  for (const datei of ["src/components/uptime-bar.tsx", "src/components/uptime-calendar.tsx"]) {
    assert.match(lies(datei), /side="bottom"/, `${datei} setzt die Seite nicht`);
  }
});

test("die Spitze ist für beide Seiten gebaut und zeigt in die richtige Richtung", () => {
  // Kippt Radix am Fensterrand nach oben, muss die Spitze mitdrehen - sonst
  // steht sie auf dem Kopf. Ein Rahmen-Dreieck zeigt in die Richtung, die der
  // GEGENÜBERLIEGENDEN Kante gehört: `border-bottom` malt nach oben.
  const css = lies("src/app/globals.css");
  const regel = (seite: string, teil: string) =>
    css.match(
      new RegExp(`\\.sp-popup\\[data-side="${seite}"\\] > span::${teil} \\{([^}]+)\\}`),
    );

  for (const [seite, richtung] of [
    ["bottom", "border-bottom"],
    ["top", "border-top"],
  ] as const) {
    const aussen = regel(seite, "before");
    const innen = regel(seite, "after");
    assert.ok(aussen && innen, `für "${seite}" fehlt eines der beiden Dreiecke`);
    assert.match(aussen![1], new RegExp(`${richtung}: \\d+px solid var\\(--sp-rule\\)`));
    assert.match(innen![1], new RegExp(`${richtung}: \\d+px solid var\\(--sp-bg\\)`));
  }
});

test("das innere Dreieck ist kleiner und liegt einen Punkt tiefer", () => {
  // Daraus entsteht der Rand von einem Punkt an den Schrägen - und die
  // Grundlinie deckt das Stück Rahmenlinie zu, über dem die Spitze steht.
  // Wären beide gleich gross, gäbe es keine Linie; läge das innere nicht
  // tiefer, liefe die Rahmenlinie quer durch die Spitze.
  const css = lies("src/app/globals.css");
  for (const seite of ["bottom", "top"] as const) {
    const kante = seite === "bottom" ? "top" : "bottom";
    const zahl = (teil: string, feld: string) => {
      const block = css.match(
        new RegExp(`\\.sp-popup\\[data-side="${seite}"\\] > span::${teil} \\{([^}]+)\\}`),
      );
      const treffer = block![1].match(new RegExp(`${feld}: (-?\\d+)px`));
      return Number(treffer![1]);
    };
    assert.equal(zahl("before", "border-left-width") - zahl("after", "border-left-width"), 1);
    assert.equal(zahl("after", kante) - zahl("before", kante), 1, `${seite}: Versatz fehlt`);
  }
});

test("der Pfeil von Radix zeichnet nichts mehr, behält aber seinen Platz", () => {
  // Er wird weiter gebraucht: Radix schiebt ihn über den richtigen Balken,
  // auch wenn das Popup am Fensterrand verrutscht. Verschwände er ganz,
  // stünde die Spitze irgendwo.
  const css = lies("src/app/globals.css");
  const pfeil = css.match(/\.sp-popup-arrow \{([^}]+)\}/);
  assert.ok(pfeil, "die Regel für den Pfeil fehlt");
  assert.match(pfeil![1], /background: transparent/);
  assert.match(pfeil![1], /fill: transparent/);
  assert.doesNotMatch(pfeil![1], /display: none/, "ohne Platz verrutscht die Spitze");
});

test("das Popup bleibt schmal und passt auf schmale Geräte", () => {
  const popup = lies("src/components/tag-popup.tsx");
  const breite = popup.match(/w-\[(\d+)px\]/);
  assert.ok(breite, "keine feste Breite gefunden");
  assert.ok(Number(breite![1]) <= 300, `${breite![1]}px ist zu breit fürs Handy`);
  assert.match(popup, /max-w-\[calc\(100vw-32px\)\]/, "sonst ragt es auf schmalen Geräten heraus");
});

test("die Messwerte stehen in einer Zeile, nicht als Liste", () => {
  // Drei Zeilen Definitionsliste machten das Popup doppelt so hoch.
  const popup = lies("src/components/tag-popup.tsx");
  assert.doesNotMatch(popup, /<dl/, "eine Definitionsliste treibt die Höhe hoch");
  assert.match(popup, /gemessen\.join\(" · "\)/);
});

test("das Anmeldeformular begrenzt die Länge der Adresse", () => {
  // Am 23.08. beim Prüfen: Eine 5012 Zeichen lange "Adresse" bestand die
  // Musterprüfung und landete in der Datenbank. 254 ist das Maximum nach
  // RFC 5321.
  const route = lies("src/app/api/subscribe/route.ts");
  assert.match(route, /email\.length > 254/);
});

test("das Anmeldeformular hat eine Bremse je Absender", () => {
  // Die Sperrfrist gilt je Adresse und hält niemanden auf, der zehntausend
  // verschiedene Adressen einträgt - jede davon eine echte Mail von unserer
  // Domain.
  const route = lies("src/app/api/subscribe/route.ts");
  assert.match(route, /abosBremse/);
  assert.match(route, /status: 429/);
});
