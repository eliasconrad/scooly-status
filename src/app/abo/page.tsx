import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";

/**
 * Eigene Seite statt eines Query-Parameters auf der Startseite:
 * Die Startseite bleibt dadurch zwischenspeicherbar und geht bei einer
 * Störung nicht in die Knie, nur weil gerade viele draufschauen.
 */
export const metadata = { title: "Abo · Scooly Status" };

export default async function AboPage(props: PageProps<"/abo">) {
  const params = await props.searchParams;
  const ok = params.status === "bestaetigt";

  return (
    <>
      <Masthead />
      <div className="rounded-[4px] border border-[var(--sp-rule)] px-5 py-6">
        <h2 className="flex items-center gap-2 text-[20px] font-medium leading-[29px]">
          {ok ? (
            <CheckCircle2 size={20} strokeWidth={2} color="var(--sp-green)" />
          ) : (
            <XCircle size={20} strokeWidth={2} color="var(--sp-muted)" />
          )}
          {ok ? "Abo bestätigt" : "Dieser Link ist nicht mehr gültig"}
        </h2>
        <p className="pt-2 text-[16px] leading-6 text-[var(--sp-muted)]">
          {ok
            ? "Du bekommst ab jetzt eine E-Mail, sobald ein Vorfall angelegt, aktualisiert oder behoben wird."
            : "Trag dich einfach noch einmal ein, dann schicken wir dir eine neue Bestätigungsmail."}
        </p>
        <p className="pt-4 text-[16px] leading-6">
          <Link href="/" className="underline underline-offset-2">
            Zurück zum Status
          </Link>
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
