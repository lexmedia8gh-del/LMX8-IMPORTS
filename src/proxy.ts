import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secretString = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && !secretString) {
  console.warn("CRITICAL: SESSION_SECRET is not set in production!");
}
const SECRET_KEY = new TextEncoder().encode(secretString || "default_secret_key_change_in_production");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isPortalRoute = pathname.startsWith("/portal");
  const isAdminRoute = pathname.startsWith("/admin");

  if (!isPortalRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get("lmx8_session")?.value;

  if (!token) {
    if (isPortalRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isAdminRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  try {
    const { payload } = await jwtVerify(token!, SECRET_KEY);
    
    // Check type matching
    if (isPortalRoute && payload.type !== "customer") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    
    if (isAdminRoute && payload.type !== "admin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token — redirect to login
    const response = NextResponse.redirect(
      new URL(isPortalRoute ? "/login" : "/login", request.url)
    );
    response.cookies.delete("lmx8_session");
    return response;
  }
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
