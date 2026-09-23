// db/seed.ts
// Run once against a fresh database: `pnpm db:seed`
// Seeds categories, products, expense categories, and the first owner user.
// Safe to re-run — upsert pattern checks before inserting.

import { db } from "./client";
import { categories, products, users, expenseCategories } from "./schema";
import { eq } from "drizzle-orm";

async function upsertCategory(name: string): Promise<number> {
  const existing = await db.query.categories.findFirst({
    where: eq(categories.name, name),
  });
  if (existing) return existing.id;
  const [row] = await db.insert(categories).values({ name }).returning();
  return row.id;
}

async function upsertProduct(
  name: string,
  categoryId: number,
  type: "resale" | "made" = "resale",
  unit = "pcs"
): Promise<number> {
  const existing = await db.query.products.findFirst({
    where: eq(products.name, name),
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(products)
    .values({ name, categoryId, type, unit })
    .returning();
  return row.id;
}

async function main() {
  // --- Categories -----------------------------------------------------------
  const cigaretteId = await upsertCategory("Cigarette");
  const nepnawiId   = await upsertCategory("Nepnawi");
  const vurId       = await upsertCategory("Vur");
  const foodId      = await upsertCategory("Food");

  // --- Resale products ------------------------------------------------------
  await upsertProduct("V",       cigaretteId, "resale");
  await upsertProduct("V (Mint)", cigaretteId, "resale");
  await upsertProduct("Silk Cut", cigaretteId, "resale");

  await upsertProduct("Elaichi", nepnawiId, "resale");
  await upsertProduct("Jio",     nepnawiId, "resale");
  await upsertProduct("Dildaar", nepnawiId, "resale");

  await upsertProduct("Lassi",   vurId, "resale", "glass");
  await upsertProduct("Vur Sen", vurId, "resale");

  // --- Made products --------------------------------------------------------
  await upsertProduct("Momo", foodId, "made", "plate");

  // --- Expense categories ---------------------------------------------------
  for (const name of ["Rent", "Transport", "Utilities", "Wages", "Other"]) {
    const existing = await db.query.expenseCategories.findFirst({
      where: eq(expenseCategories.name, name),
    });
    if (!existing) await db.insert(expenseCategories).values({ name });
  }

  // --- First user (owner) ---------------------------------------------------
  // IMPORTANT: Replace this email with the real owner's Google account email.
  // Only users present in this table can log in — Google OAuth alone is not enough.
  const ownerEmail = "<YOUR_EMAIL_HERE>";
  const existingOwner = await db.query.users.findFirst({
    where: eq(users.email, ownerEmail),
  });
  if (!existingOwner) {
    await db.insert(users).values({
      email: ownerEmail,
      name: "Owner",
      role: "owner",
    });
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
