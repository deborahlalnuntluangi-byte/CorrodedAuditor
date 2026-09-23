// db/schema.ts — source of truth for Drizzle ORM (Postgres / Neon)
//
// Money rule: every amount is bigint, storing paise (1/100 rupee). Never float.
// Price rule: nothing here fixes a selling price. products.lastPricePaise and
// products.lastCostPaise are just defaults the UI pre-fills — every transaction
// can override them freely.

import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  bigint,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", [
  "owner",
  "manager",
  "staff",
  "accountant",
]);

export const productType = pgEnum("product_type", [
  "resale", // bought from a supplier, e.g. cigarettes, nepnawi, vur
  "made",   // produced in-house on specific days, e.g. momo
]);

export const documentStatus = pgEnum("document_status", [
  "draft",
  "posted",
  "reversed",
]);

export const movementType = pgEnum("movement_type", [
  "purchase",
  "production", // stock created from a made-product batch
  "sale",
  "return_in",
  "return_out",
  "adjustment",
  "opening",
  "writeoff",
]);

export const adjustmentStatus = pgEnum("adjustment_status", [
  "requested",
  "approved",
  "rejected",
]);

export const paymentDirection = pgEnum("payment_direction", ["in", "out"]);
export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "other",
]);

export const capitalEventType = pgEnum("capital_event_type", [
  "contribution",
  "drawing",
  "loan_in",
  "loan_repayment",
]);

export const periodStatus = pgEnum("period_status", ["open", "closed"]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  role: userRole("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 40 }).unique(),
    name: varchar("name", { length: 120 }).notNull(),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    type: productType("type").notNull().default("resale"),
    unit: varchar("unit", { length: 20 }).notNull().default("pcs"),

    // Convenience defaults only — never the authoritative price.
    lastPricePaise: bigint("last_price_paise", { mode: "bigint" }),
    lastCostPaise: bigint("last_cost_paise", { mode: "bigint" }),

    reorderLevel: integer("reorder_level").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("products_category_idx").on(t.categoryId),
  })
);

// Running derived state per product — always recomputable from stock_movements
// and sale/purchase lines. Kept as a table for read speed.
export const productCostState = pgTable("product_cost_state", {
  productId: integer("product_id").primaryKey().references(() => products.id),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  avgCostPaise: bigint("avg_cost_paise", { mode: "bigint" }).notNull().default(0n),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Suppliers / Customers
// ---------------------------------------------------------------------------

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Purchases (resale products)
// ---------------------------------------------------------------------------

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  purchaseDate: date("purchase_date").notNull(),
  invoiceRef: varchar("invoice_ref", { length: 80 }),
  freightPaise: bigint("freight_paise", { mode: "bigint" }).notNull().default(0n),
  dutyPaise: bigint("duty_paise", { mode: "bigint" }).notNull().default(0n),
  otherCostPaise: bigint("other_cost_paise", { mode: "bigint" }).notNull().default(0n),
  allocationMethod: varchar("allocation_method", { length: 10 }).notNull().default("value"), // "value" | "qty"
  attachmentUrl: text("attachment_url"),
  status: documentStatus("status").notNull().default("draft"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseLines = pgTable("purchase_lines", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id),
  productId: integer("product_id").notNull().references(() => products.id),
  qty: integer("qty").notNull(),
  unitPricePaise: bigint("unit_price_paise", { mode: "bigint" }).notNull(),
  allocatedCostPaise: bigint("allocated_cost_paise", { mode: "bigint" }).notNull().default(0n),
  finalUnitCostPaise: bigint("final_unit_cost_paise", { mode: "bigint" }).notNull(),
});

// ---------------------------------------------------------------------------
// Production batches (made products, e.g. momo on a specific day)
// ---------------------------------------------------------------------------

export const productionBatches = pgTable("production_batches", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  batchDate: date("batch_date").notNull(),
  qtyProduced: integer("qty_produced").notNull(),
  totalCostPaise: bigint("total_cost_paise", { mode: "bigint" }).notNull(),
  notes: text("notes"),
  status: documentStatus("status").notNull().default("draft"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  saleDate: timestamp("sale_date", { withTimezone: true }).notNull().defaultNow(),
  discountPaise: bigint("discount_paise", { mode: "bigint" }).notNull().default(0n),
  taxPaise: bigint("tax_paise", { mode: "bigint" }).notNull().default(0n),
  paymentStatus: varchar("payment_status", { length: 12 }).notNull().default("paid"),
  status: documentStatus("status").notNull().default("draft"),
  reversalOfId: integer("reversal_of_id"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const saleLines = pgTable("sale_lines", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  productId: integer("product_id").notNull().references(() => products.id),
  qty: integer("qty").notNull(),
  unitPricePaise: bigint("unit_price_paise", { mode: "bigint" }).notNull(),
  discountPaise: bigint("discount_paise", { mode: "bigint" }).notNull().default(0n),

  // THE critical field: copied from product_cost_state at the instant of posting.
  // Never updated afterwards, even if the product's average cost later changes.
  frozenUnitCostPaise: bigint("frozen_unit_cost_paise", { mode: "bigint" }).notNull(),

  lineProfitPaise: bigint("line_profit_paise", { mode: "bigint" }).notNull(),
});

// ---------------------------------------------------------------------------
// Stock movements — append-only source of truth for stock
// ---------------------------------------------------------------------------

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id),
    qtySigned: integer("qty_signed").notNull(), // + in, - out
    unitCostPaise: bigint("unit_cost_paise", { mode: "bigint" }).notNull(),
    type: movementType("type").notNull(),
    sourceType: varchar("source_type", { length: 30 }).notNull(),
    sourceId: integer("source_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index("stock_movements_product_idx").on(t.productId),
    sourceIdx: index("stock_movements_source_idx").on(t.sourceType, t.sourceId),
  })
);

// ---------------------------------------------------------------------------
// Stock adjustments
// ---------------------------------------------------------------------------

export const stockAdjustments = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  qtySigned: integer("qty_signed").notNull(),
  reasonType: varchar("reason_type", { length: 20 }).notNull(),
  reasonText: text("reason_text").notNull(),
  requestedBy: integer("requested_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  status: adjustmentStatus("status").notNull().default("requested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  expenseDate: date("expense_date").notNull(),
  categoryId: integer("category_id").notNull().references(() => expenseCategories.id),
  amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
  vendor: varchar("vendor", { length: 120 }),
  paymentMethod: paymentMethod("payment_method").notNull().default("cash"),
  attachmentUrl: text("attachment_url"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  direction: paymentDirection("direction").notNull(),
  amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
  method: paymentMethod("method").notNull().default("cash"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  sourceType: varchar("source_type", { length: 20 }).notNull(),
  sourceId: integer("source_id").notNull(),
});

// ---------------------------------------------------------------------------
// Capital
// ---------------------------------------------------------------------------

export const capitalEvents = pgTable("capital_events", {
  id: serial("id").primaryKey(),
  type: capitalEventType("type").notNull(),
  amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
  occurredAt: date("occurred_at").notNull(),
  party: varchar("party", { length: 120 }),
  note: text("note"),
  recordedBy: integer("recorded_by").notNull().references(() => users.id),
});

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export const periods = pgTable(
  "periods",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    status: periodStatus("status").notNull().default("open"),
    closedBy: integer("closed_by").references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => ({
    yearMonthIdx: uniqueIndex("periods_year_month_idx").on(t.year, t.month),
  })
);

// ---------------------------------------------------------------------------
// Analytics rollup — charts read from here, never from raw transactions
// ---------------------------------------------------------------------------

export const dailyProductRollup = pgTable(
  "daily_product_rollup",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    productId: integer("product_id").notNull().references(() => products.id),
    units: integer("units").notNull().default(0),
    revenuePaise: bigint("revenue_paise", { mode: "bigint" }).notNull().default(0n),
    costPaise: bigint("cost_paise", { mode: "bigint" }).notNull().default(0n),
    profitPaise: bigint("profit_paise", { mode: "bigint" }).notNull().default(0n),
  },
  (t) => ({
    dateProductIdx: uniqueIndex("rollup_date_product_idx").on(t.date, t.productId),
  })
);

// ---------------------------------------------------------------------------
// Audit log — append-only, written in the same transaction as the change
// ---------------------------------------------------------------------------

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").notNull().references(() => users.id),
    action: varchar("action", { length: 40 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: integer("entity_id").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    reason: text("reason"),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
    actorIdx: index("audit_actor_idx").on(t.actorId),
  })
);

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: varchar("key", { length: 100 }).primaryKey(),
  endpoint: varchar("endpoint", { length: 80 }).notNull(),
  responseJson: jsonb("response_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
