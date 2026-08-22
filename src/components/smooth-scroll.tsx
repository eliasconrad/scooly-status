"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Lenis für den weichen Bildlauf. Bewusst zurückhaltend eingestellt -
 * eine Status-Page will man überfliegen, nicht durch sie hindurchgleiten.
 * Bei "Bewegung reduzieren" läuft der native Bildlauf.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 0.9, wheelMultiplier: 1, touchMultiplier: 1.6 });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
