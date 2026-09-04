import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  // never intercept API routes (login/logout/sync must work without session)
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = path === "/login" || path === "/auth";

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
