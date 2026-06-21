import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

function getEdition(): "website" | "control_plane" {
  const v = process.env.CENTRAL_EDITION?.trim().toLowerCase();
  if (v === "website" || v === "marketing") return "website";
  return "control_plane";
}

const WEBSITE_ALLOWED_PREFIXES = ["/", "/docs", "/install", "/install.sh", "/api/search", "/_next", "/favicon"];

const WEBSITE_BLOCKED_PREFIXES = [
  "/dashboard",
  "/setup",
  "/login",
  "/signup",
  "/api/deploy",
  "/api/agent",
  "/api/setup",
  "/api/github/webhook",
  "/api/webhook"
];

function isWebsiteAllowed(pathname: string): boolean {
  if (pathname === "/") return true;
  for (const prefix of WEBSITE_ALLOWED_PREFIXES) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return true;
  }
  if (/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/.test(pathname)) return true;
  return false;
}

function isWebsiteBlocked(pathname: string): boolean {
  for (const prefix of WEBSITE_BLOCKED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const edition = getEdition();

  if (edition === "website") {
    if (isWebsiteBlocked(pathname)) {
      const dest = pathname.startsWith("/docs") ? "/" : "/install";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (!isWebsiteAllowed(pathname) && pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not available on website edition" }, { status: 404 });
    }
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  if (pathname === "/") {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (pathname.startsWith("/dashboard") && !sessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/setup/:path*",
    "/login",
    "/signup",
    "/install",
    "/docs/:path*",
    "/api/:path*"
  ]
};
