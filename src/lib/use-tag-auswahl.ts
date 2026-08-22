"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Steuert, welches Tages-Popup offen ist.
 *
 * Zwei Wege, weil ein reiner Hover-Tooltip auf dem Handy gar nicht aufgeht:
 *
 *   Zeigen      -> Popup folgt dem Zeiger und schließt beim Weggehen
 *   Antippen    -> Popup bleibt stehen, bis man es wieder antippt,
 *                  woanders hinklickt oder Esc drückt
 *
 * Der Zustand liegt bewusst bei der Leiste und nicht bei jedem einzelnen
 * Balken: 540 eigenständige Popups würden beim Wechsel zwischen zwei
 * benachbarten Balken gegeneinander arbeiten.
 */
export function useTagAuswahl() {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [fest, setFest] = useState(false);

  useEffect(() => {
    if (!fest) return;
    const zu = () => {
      setFest(false);
      setAktiv(null);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") zu();
    };
    document.addEventListener("pointerdown", zu);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("pointerdown", zu);
      document.removeEventListener("keydown", taste);
    };
  }, [fest]);

  const griffe = useCallback(
    (schluessel: string) => ({
      // Bewusst onPointerMove statt onPointerEnter: React bildet
      // enter/leave aus pointerover/pointerout nach, was bei SVG-Elementen
      // gelegentlich verschluckt wird. Radix nutzt aus demselben Grund
      // pointermove. Der Aufruf ist billig, weil der Zustand nur dann
      // gesetzt wird, wenn er sich wirklich ändert.
      onPointerMove: () => {
        if (!fest) setAktiv((vorher) => (vorher === schluessel ? vorher : schluessel));
      },
      onPointerLeave: () => {
        if (!fest) setAktiv(null);
      },
      // Sonst würde der Klick sofort beim Zuhörer am Dokument landen
      // und das gerade festgesteckte Popup wieder schließen.
      onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
      onClick: () => {
        if (fest && aktiv === schluessel) {
          setFest(false);
          setAktiv(null);
        } else {
          setAktiv(schluessel);
          setFest(true);
        }
      },
      onFocus: () => {
        if (!fest) setAktiv(schluessel);
      },
      onBlur: () => {
        if (!fest) setAktiv(null);
      },
    }),
    [aktiv, fest],
  );

  return { aktiv, griffe };
}
