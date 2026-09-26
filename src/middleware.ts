// src/middleware.ts
// Protects all routes under /dashboard.
// Unauthenticated requests to /dashboard/* are redirected to /login.
// Auth.js v5 pattern: export the auth function directly as middleware.

export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    // Protect everything under /dashboard
    "/dashboard/:path*",
    // Exclude static files and Next.js internals from middleware
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
