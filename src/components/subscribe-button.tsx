"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Abo-Knopf. Gemessen: #141413, 12px/500, Laufweite 2px, Versalien,
 * Padding 10/15/9, Radius 4.
 */
export function SubscribeButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Das hat nicht geklappt.");
      setState("done");
      setMessage(data.message ?? "Fast geschafft - bestätige die E-Mail in deinem Postfach.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Das hat nicht geklappt.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-[4px] bg-[var(--sp-ink)] px-[15px] pt-[10px] pb-[9px] text-[12px] font-medium uppercase tracking-[2px] text-white transition-opacity hover:opacity-85"
        >
          Updates abonnieren
        </button>
      </DialogTrigger>

      <DialogContent className="rounded-[4px] border-[var(--sp-rule)] bg-[var(--sp-bg)] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-medium leading-[29px]">
            Updates abonnieren
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-[21px] text-[var(--sp-muted)]">
            Du bekommst eine E-Mail, sobald ein Vorfall angelegt, aktualisiert oder behoben wird.
          </DialogDescription>
        </DialogHeader>

        {state === "done" ? (
          <p className="text-[16px] leading-6">{message}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-[4px] border border-[var(--sp-rule)] bg-white px-3">
              <Mail size={16} className="shrink-0 text-[var(--sp-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@adresse.at"
                className="w-full bg-transparent py-[10px] text-[16px] leading-6 outline-none"
              />
            </div>
            {state === "error" && (
              <p className="text-[14px] leading-[21px] text-[var(--sp-red)]">{message}</p>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="rounded-[4px] bg-[var(--sp-ink)] px-[15px] pt-[10px] pb-[9px] text-[12px] font-medium uppercase tracking-[2px] text-white disabled:opacity-60"
            >
              {state === "sending" ? "Wird gesendet …" : "Abonnieren"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
