// auth.ts — Auth.js v5 configuration
//
// Strategy: JWT (no database adapter).
// Rationale: Our `users` table doesn't have the Auth.js adapter columns
// (emailVerified, accounts, sessions). JWT strategy avoids extra tables
// while maintaining the same security model: Google authenticates identity,
// our `users` table controls access, the role is embedded in the JWT.
//
// Access control model:
//   1. User authenticates with Google.
//   2. signIn callback checks the email against our `users` table.
//   3. If not found or inactive → redirect to /unauthorized. No session created.
//   4. If found → jwt callback embeds userId + role in the token.
//   5. Every server action calls requireRole() which reads from the session.
//   6. The session is never the source of truth for permissions — the DB is.
//      On token rotation (default 30-day session) the role is re-read from DB.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],

  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Runs before a session is created. Return false or a URL to block login.
     * We return "/unauthorized" (a URL) so the user lands on our custom page
     * rather than Auth.js's generic AccessDenied screen.
     */
    async signIn({ user }) {
      if (!user.email) return "/unauthorized";

      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, user.email),
        columns: { id: true, active: true },
      });

      if (!dbUser || !dbUser.active) return "/unauthorized";

      return true;
    },

    /**
     * Runs when a JWT is created or refreshed.
     * On sign-in, embed the DB user's id and role into the token.
     * On refresh (trigger === "update"), re-read the DB so role changes
     * take effect without requiring the user to log out.
     */
    async jwt({ token, trigger }) {
      if (trigger === "signIn" || trigger === "update") {
        if (!token.email) return token;

        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, token.email as string),
          columns: { id: true, role: true },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.role   = dbUser.role;
        }
      }
      return token;
    },

    /**
     * Shapes the session object returned by auth().
     * Only expose what the client needs — never expose cost or margin here.
     */
    async session({ session, token }) {
      if (token.userId !== undefined) {
        session.user.id   = String(token.userId);
        session.user.role = token.role as "owner" | "manager" | "staff" | "accountant";
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/unauthorized", // catches AccessDenied and other OAuth errors
  },
});
