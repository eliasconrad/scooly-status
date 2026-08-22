"use client";

import { useRouter } from "next/navigation";
import type { Service } from "@/lib/types";

/**
 * Auswahlfeld für den Dienst, dessen Kalender gezeigt wird.
 * Steht links in der Kopfzeile, die Blätterung rechts - auf schmalen
 * Geräten untereinander, Auswahl zuerst. Genau wie beim Original.
 */
export function DienstAuswahl({
  services,
  selected,
}: {
  services: Service[];
  selected: Service;
}) {
  const router = useRouter();

  return (
    <>
      <label className="sr-only" htmlFor="dienst">
        Dienst wählen
      </label>
      <select
        id="dienst"
        value={selected.slug}
        onChange={(e) => router.push(`/uptime?dienst=${e.target.value}`)}
        className="h-[40px] w-full rounded-[4px] border border-[var(--sp-rule)] bg-transparent px-3 text-[16px] leading-6 outline-none focus:border-[var(--sp-ink)] min-[651px]:w-[298px]"
      >
        {services.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </>
  );
}
