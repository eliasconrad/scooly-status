/**
 * Verschickt eine echte Testmail über Resend - denselben Weg, den auch
 * eine Störungsmeldung nimmt, samt Abmeldelink und List-Unsubscribe.
 *
 *   npm run testmail -- adresse@example.com
 *
 * Ohne RESEND_API_KEY passiert nichts. Es wird genau eine Mail verschickt,
 * an genau diese eine Adresse.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

function umgebungLaden() {
  try {
    for (const zeile of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const m = zeile.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* keine .env.local - dann aus der Umgebung */
  }
}

async function main() {
  umgebungLaden();
  const an = process.argv[2];

  if (!an) {
    console.log("\nAufruf: npm run testmail -- adresse@example.com\n");
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(an)) {
    console.log(`\n"${an}" sieht nicht wie eine Adresse aus. Abgebrochen.\n`);
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.log(
      "\nRESEND_API_KEY fehlt.\n" +
        "  In Resend unter API Keys einen Schlüssel kopieren, dann:\n" +
        "  ./scripts/setze.sh RESEND_API_KEY\n",
    );
    process.exit(1);
  }

  const { sendeAnEmpfaenger } = await import("../src/lib/mail");

  console.log(`\nAbsender:  ${process.env.RESEND_FROM}`);
  console.log(`Empfänger: ${an}`);
  console.log("Sende …\n");

  const ergebnis = await sendeAnEmpfaenger(
    [{ email: an, unsubscribe: randomUUID() }],
    "Scooly Status: Testmeldung",
    [
      "Scooly KI ist erreichbar, braucht aber 18,2 s pro Anfrage. Grenzwert sind 12,0 s. Üblich sind 1,2 s - also rund 15,2-mal so lang.",
      "",
      "Einzelmessungen: 18,0 s, 17,4 s, 19,2 s.",
      "",
      "Das hier ist eine Testmeldung. So sieht eine echte Störungsmeldung aus - wenn sie angekommen ist, funktioniert der Versand.",
    ].join("\n"),
    "minor",
    "Scooly KI antwortet langsam",
  );

  if (!ergebnis.eingerichtet) {
    console.log("Versand ist nicht eingerichtet - es wurde nichts verschickt.\n");
    process.exit(1);
  }
  if (ergebnis.gesendet === 1) {
    console.log("\x1b[32mVerschickt.\x1b[0m Schau ins Postfach - auch in den Spam-Ordner.\n");
  } else {
    console.log(
      "\x1b[31mNicht verschickt.\x1b[0m Die Meldung von Resend steht oben.\n" +
        "Häufigster Grund: Die Absenderdomain ist in Resend noch nicht verifiziert.\n" +
        "Für einen ersten Test geht auch RESEND_FROM='Scooly Status <onboarding@resend.dev>',\n" +
        "das darf aber nur an die eigene Resend-Kontoadresse senden.\n",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFehlgeschlagen:", err);
  process.exit(1);
});
