import { createClient } from "./utils/supabase/middleware";

export async function middleware(request) {
  const { supabase, supabaseResponse } = createClient(request);

  if (supabase) {
    try {
      await supabase.auth.getUser();
    } catch (e) {
      // ignore
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
