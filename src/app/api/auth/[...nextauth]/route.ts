// src/app/api/auth/[...nextauth]/route.ts
// Standard Auth.js v5 App Router route handler.
// All configuration lives in auth.ts at the repo root.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
