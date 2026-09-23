import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Root route: redirect based on auth state.
// No content rendered here — just a gatekeeper.
export default async function RootPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
