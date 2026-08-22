import type { IncidentImpact } from "./types";

/**
 * Die HTML-Fassung der Meldungen.
 *
 * Bewusst altmodisch gebaut: Tabellen statt Flexbox, Stile direkt am
 * Element, keine SVG. Outlook rendert mit der Word-Engine und kann mit
 * modernem CSS nichts anfangen; SVG blockieren Gmail und Outlook ganz.
 * Auch ein Bild gibt es nicht - viele Postfächer laden Bilder erst nach
 * Nachfrage, und dann stünde oben ein leerer Kasten. Der Schriftzug ist
 * deshalb Text.
 */

/** Farbe des Bandes - dieselben Werte wie auf der Seite. */
const BANDFARBE: Record<IncidentImpact, string> = {
  none: "#76ad2a",
  maintenance: "#3498db",
  minor: "#faa72a",
  major: "#e86235",
  critical: "#e04343",
};

const INK = "#141413";
const PAPIER = "#faf9f5";
const LINIE = "#dedcd1";
const GEDECKT = "#87867f";
const SCHRIFT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export type Meldung = {
  /** Überschrift im farbigen Band, z.B. "Scooly KI antwortet langsam" */
  titel: string;
  /** Fließtext darunter - Absätze durch Leerzeilen trennen */
  text: string;
  impact: IncidentImpact;
  /** Adresse der Status-Seite */
  basis: string;
  /** Voller Abmeldelink, falls vorhanden */
  abmeldeLink?: string | null;
};

export function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function baueHtml({ titel, text, impact, basis, abmeldeLink }: Meldung): string {
  const band = BANDFARBE[impact] ?? BANDFARBE.minor;

  const absaetze = text
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map(
      (a) =>
        `<p style="margin:0 0 14px;font-family:${SCHRIFT};font-size:16px;line-height:24px;color:${INK};">${escape(
          a,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escape(titel)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPIER};">
<!-- Vorschautext in der Postfachliste, im Text selbst unsichtbar -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(
    text.split("\n")[0].slice(0, 120),
  )}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPIER};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">

        <tr>
          <td style="padding-bottom:26px;font-family:${SCHRIFT};font-size:22px;font-weight:700;letter-spacing:-0.4px;color:${INK};">
            scooly&nbsp;<span style="font-weight:400;color:${GEDECKT};">status</span>
          </td>
        </tr>

        <tr>
          <td style="background:${band};border-radius:4px;padding:12px 20px;font-family:${SCHRIFT};font-size:20px;line-height:29px;font-weight:500;color:#ffffff;">
            ${escape(titel)}
          </td>
        </tr>

        <tr><td style="height:26px;line-height:26px;font-size:0;">&nbsp;</td></tr>

        <tr>
          <td>${absaetze}</td>
        </tr>

        <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>

        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${INK};border-radius:4px;">
                  <a href="${escape(basis)}" style="display:inline-block;padding:10px 15px 9px;font-family:${SCHRIFT};font-size:12px;font-weight:500;line-height:19px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Status ansehen</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:34px;line-height:34px;font-size:0;">&nbsp;</td></tr>

        <tr>
          <td style="border-top:1px solid ${LINIE};padding-top:20px;font-family:${SCHRIFT};font-size:13px;line-height:20px;color:${GEDECKT};">
            Scooly &middot; <a href="https://www.eliasconrad.eu" style="color:${GEDECKT};">Elias Conrad</a><br>
            ${
              abmeldeLink
                ? `<a href="${escape(abmeldeLink)}" style="color:${GEDECKT};">Keine Meldungen mehr bekommen</a>`
                : ""
            }
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Dieselbe Meldung als reiner Text - für Postfächer ohne HTML und als Vorschau. */
export function baueText({ titel, text, basis, abmeldeLink }: Meldung): string {
  const teile = [titel, "", text, "", `Status ansehen: ${basis}`, "", "--", `Scooly · ${basis}`];
  if (abmeldeLink) teile.push(`Keine Meldungen mehr: ${abmeldeLink}`);
  return teile.join("\n");
}
