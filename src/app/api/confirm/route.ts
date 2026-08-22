import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = supabase();
  const token = new URL(request.url).searchParams.get("token");
  if (!db || !token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const { data } = await db
    .from("subscribers")
    .update({ confirmed: true })
    .eq("token", token)
    .select("email")
    .maybeSingle();

  const url = new URL("/abo", request.url);
  url.searchParams.set("status", data ? "bestaetigt" : "ungueltig");
  return NextResponse.redirect(url);
}
