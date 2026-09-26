// src/lib/auth/require-role.ts
//
// Server-side role enforcement. Call this at the top of every server action
// and route handler. Never skip it "for now" — the consequence is a staff
// member seeing cost data, which is a hard requirement in AGENTS.md §8.
//
// Two functions:
//   requireRole(allowed)          — for server components / page.tsx: redirects on failure
//   assertRole(session, allowed)  — for API route handlers: throws on failure (return 403 yourself)
//
// The distinction matters: redirect() in a server component is the right UX;
// redirect() inside a JSON route handler would return an HTML redirect, not a 403.

import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type UserRole = "owner" | "manager" | "staff" | "accountant";

/**
 * Call at the top of server components and server actions that require auth.
 *
 * - If there is no session: redirects to /login.
 * - If the session role is not in `allowed`: redirects to /unauthorized.
 * - If authorized: returns the session (typed, with .user.role and .user.id).
 *
 * Example:
 *   export default async function PurchasesPage() {
 *     const session = await requireRole(["owner", "manager"]);
 *     // session.user.role is guaranteed to be "owner" or "manager" here
 *   }
 */
export async function requireRole(allowed: UserRole[]) {
  const session = await auth();

  if (!session?.user?.role) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;

  if (!allowed.includes(role)) {
    redirect("/unauthorized");
  }

  return session;
}

/**
 * Use in API route handlers (GET/POST/etc.) where you want to return a
 * JSON 403 response rather than an HTML redirect.
 *
 * Throws with a message beginning "UNAUTHORIZED" or "FORBIDDEN" so callers
 * can catch and respond accordingly.
 *
 * Example:
 *   export async function POST(req: Request) {
 *     const session = await auth();
 *     try {
 *       assertRole(session, ["owner", "manager"]);
 *     } catch (e) {
 *       return Response.json({ error: String(e) }, { status: 403 });
 *     }
 *     // ... handle request
 *   }
 */
export function assertRole(
  session: Awaited<ReturnType<typeof auth>>,
  allowed: UserRole[]
): void {
  if (!session?.user?.role) {
    throw new Error("UNAUTHORIZED: No active session.");
  }

  const role = session.user.role as UserRole;

  if (!allowed.includes(role)) {
    throw new Error(
      `FORBIDDEN: Role "${role}" is not permitted. Allowed: [${allowed.join(", ")}].`
    );
  }
}
