import Image from "next/image";
import Link from "next/link";
import { SubscribeButton } from "./subscribe-button";

/**
 * Kopfzeile. Beim Original ist die Wortmarke eine Grafik links,
 * rechts der schwarze Abo-Knopf; unter 451 px stapeln beide.
 */
export function Masthead() {
  return (
    <header className="flex flex-col items-start gap-[18px] pt-[50px] pb-[40px] min-[451px]:flex-row min-[451px]:items-center min-[451px]:justify-between min-[451px]:gap-4 min-[451px]:pt-[75px] min-[451px]:pb-[74px]">
      <Link href="/" className="flex items-center" aria-label="Scooly Status">
        {/* Die echte Wortmarke aus Scooly-Material, für das helle Papier
            der Seite auf #141413 umgefärbt. */}
        <Image
          src="/scooly-logo.svg"
          alt=""
          width={768}
          height={200}
          priority
          className="h-[34px] w-auto min-[451px]:h-[42px]"
        />
      </Link>
      <SubscribeButton />
    </header>
  );
}
