import Link from "next/link";

/**
 * Reiterleiste über den Unterseiten. Gemessen: 42px hoch, Haarlinie unten,
 * Reiter 16px mit Padding 10/18, aktiv = dunkler Text, inaktiv = gedeckt.
 */
export function HistoryNav({ current }: { current: "vorfaelle" | "verfuegbarkeit" }) {
  const tabs = [
    { key: "vorfaelle", label: "Vorfälle", href: "/history" },
    { key: "verfuegbarkeit", label: "Verfügbarkeit", href: "/uptime" },
  ] as const;

  return (
    <nav className="mb-[32px] border-b border-[var(--sp-rule)]">
      <ul className="flex">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={current === tab.key ? "page" : undefined}
              className={
                "block px-[18px] py-[10px] text-[16px] leading-[22px] " +
                (current === tab.key
                  ? "text-[var(--sp-ink)]"
                  : "text-[var(--sp-muted)] hover:text-[var(--sp-ink)]")
              }
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
