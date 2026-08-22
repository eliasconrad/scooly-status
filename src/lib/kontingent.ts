/**
 * Höchstens so viele Meldungen bekommt eine Person am Tag.
 * Über MAIL_MAX_PRO_TAG umstellbar, ohne den Code anzufassen.
 */
export const MAIL_GRENZE = Math.max(1, Number(process.env.MAIL_MAX_PRO_TAG ?? 2));

/**
 * Was mit einer Meldung passiert, gemessen am schon verbrauchten Kontingent.
 *
 * `zaehler` ist der Rückgabewert von `mail_kontingent()` in der Datenbank:
 * 0 heißt aufgebraucht, sonst die laufende Nummer der heutigen Meldung.
 */
export type Kontingent = {
  /** Darf diese Meldung raus? */
  darf: boolean;
  /** Ist es die letzte, die heute noch geht? */
  letzte: boolean;
};

export function bewerteKontingent(zaehler: number, grenze = MAIL_GRENZE): Kontingent {
  if (zaehler <= 0) return { darf: false, letzte: false };
  return { darf: true, letzte: zaehler >= grenze };
}

/**
 * Hinweis unter der letzten Meldung des Tages.
 *
 * Ohne den wäre die Grenze eine Falle: Wer die Störungsmeldung bekommt,
 * aber die Entwarnung nicht mehr, hält Scooly für kaputt, obwohl es längst
 * wieder läuft. Der Satz sagt, wo der aktuelle Stand steht.
 */
export function hinweisLetzteMeldung(basis: string, grenze = MAIL_GRENZE): string {
  return (
    `Das war die ${grenze === 2 ? "zweite" : `${grenze}.`} und letzte Meldung für heute - ` +
    `mehr verschicken wir bewusst nicht. Den aktuellen Stand siehst du jederzeit ` +
    `auf ${basis}.`
  );
}
