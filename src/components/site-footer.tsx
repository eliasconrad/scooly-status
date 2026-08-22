import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function SiteFooter({ back }: { back?: { href: string; label: string } }) {
  return (
    <footer className="mt-[60px] flex items-center justify-between border-t border-[var(--sp-rule)] pt-[26px] pb-[70px] text-[14px] leading-6">
      {back ? (
        <Link href={back.href} className="inline-flex items-center gap-[6px] hover:underline">
          <ArrowLeft size={14} strokeWidth={2} />
          {back.label}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[var(--sp-muted)]">Scooly · Elias Conrad</span>
    </footer>
  );
}
