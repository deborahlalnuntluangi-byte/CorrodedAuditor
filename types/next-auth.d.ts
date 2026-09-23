// types/next-auth.d.ts
// Augment Auth.js types to include our custom session fields.
// Without this, session.user.role and session.user.id are type errors.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Database user ID (from users.id). String to match DefaultSession convention. */
      id: string;
      /** Business role. Controls what data the user can read and write. */
      role: "owner" | "manager" | "staff" | "accountant";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Database user ID. */
    userId?: number;
    /** Business role — embedded in JWT, re-read from DB on token refresh. */
    role?: "owner" | "manager" | "staff" | "accountant";
  }
}
