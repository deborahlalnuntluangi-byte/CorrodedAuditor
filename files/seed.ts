// db/seed.ts
// Run once against a fresh database: e.g. `tsx db/seed.ts`
// Seeds categories and the current product list. Safe to re-run — it checks
// for existing rows by name before inserting.

import { db } from "./client"; // adjust to wherever you create your Drizzle client
import { categories, products, users, expenseCategories } from "./schema";
import { eq } from "drizzle-orm";

async function upsertCategory(name: string) {
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
) {
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
  // --- Categories -----------------------------------------------------
  const cigaretteId = await upsertCategory("Cigarette");
  const nepnawiId = await upsertCategory("Nepnawi");
  const vurId = await upsertCategory("Vur");
  const foodId = await upsertCategory("Food"); // for made-on-specific-days items

  // --- Resale products --------------------------------------------------
  await upsertProduct("V", cigaretteId, "resale");
  await upsertProduct("V (Mint)", cigaretteId, "resale");
  await upsertProduct("Silk Cut", cigaretteId, "resale");

  await upsertProduct("Elaichi", nepnawiId, "resale");
  await upsertProduct("Jio", nepnawiId, "resale");
  await upsertProduct("Dildaar", nepnawiId, "resale");

  await upsertProduct("Lassi", vurId, "resale", "glass");
  await upsertProduct("Vur Sen", vurId, "resale");

  // --- Made products (produced on specific days, e.g. momo) ------------
  // One reusable product; each day you make it, you post a new production
  // batch against it (see production_batches). Stock and cost update the
  // same way a purchase would.
  await upsertProduct("Momo", foodId, "made", "plate");

  // --- Expense categories (adjust freely) -------------------------------
  for (const name of ["Rent", "Transport", "Utilities", "Wages", "Other"]) {
    const existing = await db.query.expenseCategories.findFirst({
      where: eq(expenseCategories.name, name),
    });
    if (!existing) await db.insert(expenseCategories).values({ name });
  }

  // --- First user (owner) — replace with your real email ----------------
  const ownerEmail = "owner@example.com";
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
