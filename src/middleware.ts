import { NextResponse, type NextRequest } from "next/server";

// Auth gate removed: the app is open (no sign-in required). Middleware is a
// pass-through. (Re-enable updateSession from "@/lib/supabase/middleware" to
// restore the login requirement.)
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
