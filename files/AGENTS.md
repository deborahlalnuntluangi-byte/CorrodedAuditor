# AGENTS.md

Context for any AI agent working in this repository. Read this fully before planning any task.

---

## What we are building

An **internal-only** web app for a small business (2–10 people) that buys physical
products and resells them. The team uses it to record purchases, sales, expenses and
capital. The app derives stock levels, costs, profit and financial position from those
records, and charts which products actually make money.

Nobody outside the team ever logs in. Nothing is ever sold through this app — it is a
system of record for transactions that happened elsewhere. There is no storefront, no
customer login, no payment gateway, no cart.

---

## Non-negotiable rules

Violating any of these silently corrupts financial data. If a task seems to require
breaking one, stop and ask instead.

### 1. Money is always an integer

Store and compute every monetary amount as an integer number of paise (1/100 of a
rupee). Never `float`, never `double`, never JavaScript `number` for a stored amount.
Use `BigInt` or a decimal library in application code, `BIGINT` in Postgres.
Convert to a display string only at the last moment in the UI.

```ts
// WRONG
const total = price * qty * 1.18;

// RIGHT
const total = (priceInPaise * BigInt(qty) * 118n) / 100n;
```

### 2. Cost of goods sold is frozen at the moment of sale

Each product has a moving weighted average cost. When a sale is posted, copy the
current average cost onto the sale line and store it there permanently.

**Never recompute a past sale's cost.** When a new purchase changes the average cost,
sales that already happened keep the cost they had. Any query that joins a historical
sale to the product's *current* cost is a bug.

Moving average on receipt:
```
newAvg = (existingQty * existingAvg + receivedQty * receivedUnitCost)
       / (existingQty + receivedQty)
```

### 3. Purchase cost includes landed cost

Unit cost is not the supplier's price alone. Freight, duty, handling and packaging
recorded on the purchase header are allocated across the lines (by value or by
quantity, selectable per purchase) and folded into unit cost before the average is
updated.

### 4. Posted records are immutable

A document has status `draft` or `posted`. Drafts affect nothing and can be edited
freely. Posting is what creates stock movements and financial effect.

A posted document is never updated and never deleted. Mistakes are corrected by
posting a linked reversal plus a new corrected document. There must be no `UPDATE` or
`DELETE` path against posted financial rows anywhere in the codebase.

### 5. Stock is derived, not stored

`stock_movements` is append-only and is the single source of truth. Quantity on hand
is the sum of its signed quantities. A cached `current_stock` column may exist for
speed but must be recomputable from movements, and a test must prove it matches.

### 6. Every write happens in one transaction, with an audit row

Posting a sale writes: the sale, its lines, the stock movements, the average cost
update, and the audit event — inside a single serialisable database transaction.
Either all of it lands or none of it does. The audit row is written in the same
transaction as the change, never after.

### 7. Every posting endpoint is idempotent

Vercel functions get retried. Each posting action accepts a client-generated
idempotency key, stored with a unique constraint. A repeat of the same key returns
the original result instead of posting twice.

### 8. Permissions are enforced on the server

Role checks live in server actions and route handlers. Hiding a button is presentation,
not security. In particular: **staff must never receive cost price or margin data in
any API response**, not even in a field the UI does not render.

### 9. Time

Store all timestamps as UTC `timestamptz`. Financial periods are computed in a single
configured business timezone (`Asia/Kolkata`) so an evening sale lands in the correct
month. Never use the server's local time.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, server actions |
| Database | Postgres (Neon or Supabase), accessed via a pooled/HTTP driver |
| ORM | Drizzle, migrations committed to the repo |
| Auth | Auth.js, roles in the database |
| UI | Tailwind, shadcn/ui |
| Charts | Recharts |
| Files | Vercel Blob for invoice and receipt attachments |
| Scheduled | Vercel Cron for the nightly snapshot |
| Hosting | Vercel |

Constraints this imposes: serverless functions are stateless and time-limited, so
nothing that must complete may depend on one long request. Direct Postgres connections
will exhaust under serverless load — always use the pooled connection string.

---

## Roles

`owner`, `manager`, `staff`, `accountant`.

- **owner** — everything, including capital events, period close, user management
- **manager** — purchases, sales, expenses, products, reversals; sees cost and margin
- **staff** — records sales only; **never sees cost or margin**; can request but not approve stock adjustments
- **accountant** — read-only across all financial data plus the audit log; no writes at all

---

## Schema

The real schema lives in `db/schema.ts` (Drizzle) — treat that file as the source of
truth, not this summary. Seed data for the current catalogue is in `db/seed.ts`.
Highlights that matter for how you write features against it:

- `products.lastPricePaise` / `lastCostPaise` are **defaults only**, never
  authoritative. Prices change constantly, so every `sale_lines.unit_price_paise`
  and `purchase_lines.unit_price_paise` is entered by hand at the time of the
  transaction. Pre-fill the form with the last price as a convenience; never block
  editing it, never compute profit from the product table's price.
- `products.type` is `resale` or `made`. Resale products (cigarettes, nepnawi, vur)
  receive stock via `purchases`. Made products (e.g. momo, cooked on specific days)
  receive stock via `production_batches`: a date, a quantity produced, and a total
  cost typed in by hand — no recipe/BOM system in v1. Both post into the same
  `stock_movements` table and update `product_cost_state` the same way, so sales and
  the profit charts treat them identically once stock exists.
- `sale_lines.frozen_unit_cost_paise` is the single most important field in the
  schema — copied from `product_cost_state.avg_cost_paise` at the instant of
  posting, never touched again.
- `movement_type` enum: `purchase`, `production`, `sale`, `return_in`, `return_out`,
  `adjustment`, `opening`, `writeoff`.
- `daily_product_rollup` is what every chart reads from — rebuilt on post and
  nightly, never queried live against raw transactions.

---

## Analytics

Charts read from `daily_product_rollup`, never from raw transactions. The rollup is
maintained on post and rebuilt nightly. Drill-downs query the real tables.

Required charts, all filtered by date range and category:

1. **Product profitability** — horizontal bars of gross profit per product, sorted, revenue shown as a lighter bar behind, losses extending left of zero
2. **Margin vs volume** — scatter, x = units sold, y = margin %, dot size = total profit, average reference lines splitting it into four quadrants
3. **Pareto** — profit bars sorted descending with a cumulative percentage line
4. **Profit trend** — monthly line for a product, category or the whole business
5. **Category comparison** — revenue and profit side by side
6. **Capital efficiency** — gross profit ÷ average inventory value per product, plus a slow-moving list by days of stock on hand

Every data point is clickable and opens the transactions behind it. Never signal a
loss with colour alone.

---

## Conventions

- Business logic lives in `/lib/domain/*`, never in React components or route handlers
- Every domain function that touches money has a unit test with a worked example
- No `any` in financial code paths
- Errors state what went wrong and what to do; they do not apologise
- Do not add a dependency without saying why in the plan
- Do not add features that are not in the current task

## Definition of done

A task is finished when: it compiles with no type errors; domain logic has tests;
the write path is transactional and idempotent; permissions are checked server-side;
an audit event is written; and the feature has been exercised in the browser.

---

## Build order

Do not skip ahead. Each phase must work before the next begins.

1. **Foundations** — schema, migrations, auth, roles, the audit writer, the money integer helpers, deploy to Vercel
2. **Products and stock** — catalogue, suppliers, purchases with landed cost, stock movements, moving average cost, adjustments, stock count
3. **Sales** — sales entry with frozen cost, returns, customers, payments, receivables
4. **Money and reporting** — expenses, capital events, dashboard, P&L, cash flow, inventory valuation, exports
5. **Analytics** — the rollup table and the six charts
6. **Close and audit** — period close, audit log viewer, adjustment approvals, nightly snapshot, weekly backup export

---

## Working with this repo

Use plan mode for each phase and review the plan before execution — especially
anything touching `stock_movements`, `sale_lines` or `product_cost_state`. Those three
tables are where money is either correct or quietly wrong, and a wrong write there is
not obvious until months later.
