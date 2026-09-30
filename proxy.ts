import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./lib/supabase/database.types";
import { onboardingRedirect } from "./lib/auth/onboarding-routing";
import { getSupabaseConfig, isSupabaseConfigured } from "./lib/supabase/config";

const protectedPrefixes = [
  "/today",
  "/calendar",
  "/insights",
  "/settings",
  "/onboarding",
];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (isProtected && !data.user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (data.user && (isProtected || request.nextUrl.pathname === "/login")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .single();
    const destination = onboardingRedirect(
      request.nextUrl.pathname,
      profile?.onboarding_completed ?? false,
    );
    if (destination) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
