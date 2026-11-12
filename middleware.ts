import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// - /admin: refreshes the Supabase session cookie and blocks anyone who isn't a signed-in admin.
// - /?admin=true: sends an already-signed-in admin straight to /admin (done here so the
//   home page can stay static). Plain visits to "/" return immediately with no auth call.
export async function middleware(request: NextRequest) {
  const isHome = request.nextUrl.pathname === "/";
  if (isHome && request.nextUrl.searchParams.get("admin") !== "true") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user?.app_metadata?.role === "admin";

  if (isHome) {
    if (!isAdmin) return response; // show the sign-in modal
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  if (!isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?admin=true";
    return redirectWithCookies(url, response);
  }

  return response;
}

// Keep any refreshed session cookies when redirecting, otherwise the rotated
// refresh token would be lost and the user signed out.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
