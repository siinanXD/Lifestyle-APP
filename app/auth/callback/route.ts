import { NextResponse } from "next/server";
import { ensureProfile, safeNext } from "../../../lib/auth/profile";
import { createClient } from "../../../lib/supabase/server";

// Ziel aller Mail-Links und des Google-Logins: tauscht den Code gegen eine Sitzung.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user && !(await ensureProfile(supabase, data.user.id)).error) {
      return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), origin));
    }
  }
  return NextResponse.redirect(new URL("/login?fehler=link", origin));
}
