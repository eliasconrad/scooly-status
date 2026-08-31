/**
 * Wann der Wächter als verstummt gilt - und was dann statt "alles gut" dasteht.
 *
 * DAS PROBLEM, DAS DAS LÖST: Fällt der Wächter aus, hört die Seite einfach
 * auf, sich zu ändern. Die letzten gemessenen Zustände bleiben stehen, und
 * das waren fast immer grüne. Eine Statusseite, die grün zeigt, weil seit
 * Stunden niemand mehr nachgesehen hat, ist schlimmer als gar keine: Sie
 * behauptet etwas, statt nur nichts zu wissen.
 *
 * Am 24.08.2026 stand genau das in Scoolys Einstellungen - "zuletzt geprüft
 * vor 22 Stunden" neben "Alle Systeme betriebsbereit". Der zweite Satz war
 * durch den ersten längst widerlegt, aber nur für den, der beide liest.
 *
 * NICHT VERWECHSELN MIT EINEM AUSFALL: Hier wird nicht behauptet, Scooly sei
 * kaputt. Es wird gesagt, dass es niemand weiß. Deshalb eine eigene Farbe und
 * ein eigener Satz und keine der fünf Stufen - die stehen für Gemessenes.
 */

/**
 * So viele ausgefallene Messungen hintereinander, bis der Wächter als
 * verstummt gilt.
 *
 * Dieselbe Drei wie FAIL_STREAK in `bewertung.ts`, und aus demselben Grund:
 * Ein einzelner ausgefallener Lauf ist ein Schluckauf - GitHub, ein
 * Netzhänger, ein Deploy, der dazwischenfunkt. Dreimal hintereinander ist
 * ein Muster. Bei einem Zehn-Minuten-Takt sind das 30 Minuten Stille.
 */
export const SCHWEIGE_FAKTOR = 3;

/** Was dann oben steht - statt eines Zustands, den niemand gemessen hat. */
export const SCHWEIGE_TEXT = "Zustand unbekannt";

/**
 * Grau, nicht rot und nicht grün. Rot hieße "kaputt", grün hieße "läuft" -
 * beides wäre erfunden. Grau ist die einzige ehrliche Farbe für "wir haben
 * gerade keine Messung".
 */
export const SCHWEIGE_FARBE = "#6b6b68";

/**
 * Schweigt der Wächter?
 *
 * `null` zählt als Schweigen: Noch nie gemessen ist genauso wenig ein
 * Zustand wie seit Stunden nicht mehr gemessen.
 */
export function waechterSchweigt(
  zuletztGeprueft: string | null,
  taktMinuten: number,
  jetzt: Date = new Date(),
): boolean {
  if (!zuletztGeprueft) return true;
  const alter = jetzt.getTime() - new Date(zuletztGeprueft).getTime();
  if (Number.isNaN(alter)) return true;
  return alter > taktMinuten * SCHWEIGE_FAKTOR * 60_000;
}

/**
 * Der Satz unter der Überschrift.
 *
 * Sagt bewusst dazu, was die Zustände darunter noch wert sind: Sie stimmen,
 * sie sind nur alt. Ohne diesen Zusatz läse sich die graue Seite, als wäre
 * auch die Liste darunter bedeutungslos.
 */
export function schweigeHinweis(zuletztGeprueft: string | null): string {
  return zuletztGeprueft
    ? "Der Wächter misst gerade nicht. Die Zustände unten sind der letzte gemessene Stand."
    : "Es wurde noch nie gemessen.";
}
