import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_SCHEMA, supabaseEnv } from "./lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/registrieren"];

export async function proxy(request: NextRequest) {
  const { url, anonKey } = supabaseEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    db: { schema: SUPABASE_SCHEMA },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser prüft das Token beim Auth-Server; getSession würde dem Cookie blind glauben.
  const { data } = await supabase.auth.getUser();
  if (!data.user && !PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  // Nicht geschützt: Next-Assets, PWA-Dateien (Service Worker, Manifest, Icons).
  matcher: ["/((?!_next/|sw\.js|manifest\.webmanifest|icon-).*)"],
};
