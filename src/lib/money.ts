// src/lib/money.ts
//
// All monetary arithmetic for CorrodedAuditor.
//
// Rule: every amount is a bigint representing integer paise (1/100 rupee).
// There is no float, no number, no rounding at the business logic layer.
// Convert to a display string ONLY at the last moment in the UI via formatPaise().
//
// If you are tempted to write `price * qty` where price is a number — don't.
// Use mulPaise(priceInPaise, qty) instead.

/**
 * Parse a decimal rupee string into integer paise (bigint).
 *
 * Accepts:
 *   "12.50"  → 1250n
 *   "100"    → 10000n
 *   "0.01"   → 1n
 *   "1.5"    → 150n   (single decimal digit, padded)
 *   "-12.50" → -1250n
 *
 * Rejects (throws):
 *   "12.505"  — more than 2 decimal places; we do NOT round silently
 *   "abc"     — not a number
 *   ""        — empty string
 *   "12."     — decimal point with no following digits
 *
 * Ambiguous or imprecise input is a bug at the call site, not a rounding
 * decision. Throwing here is correct — better a loud error than a quietly
 * wrong paise value reaching the database.
 */
export function paise(rupees: string): bigint {
  const trimmed = rupees.trim();
  if (!trimmed) {
    throw new Error("paise: empty string is not a valid rupee amount");
  }

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;

  // Allow digits, optionally followed by exactly 1–2 decimal digits.
  // "12." is rejected (decimal with no following digits).
  if (!/^\d+(\.\d{1,2})?$/.test(abs)) {
    throw new Error(
      `paise: "${rupees}" is not a valid rupee amount. ` +
        `Expected digits with at most 2 decimal places (e.g. "12.50", "100", "0.01").`
    );
  }

  const [intStr, decStr = ""] = abs.split(".");
  const paddedDec = decStr.padEnd(2, "0");
  const result = BigInt(intStr) * 100n + BigInt(paddedDec);
  return negative ? -result : result;
}

/**
 * Format integer paise as a rupee display string.
 *
 * 1250n   → "₹12.50"
 * 0n      → "₹0.00"
 * 1n      → "₹0.01"
 * -1250n  → "-₹12.50"
 *
 * FOR DISPLAY ONLY. Never feed this string back into a computation.
 */
export function formatPaise(p: bigint): string {
  const negative = p < 0n;
  const abs = negative ? -p : p;
  const rupees = abs / 100n;
  const cents = abs % 100n;

  // toLocaleString on BigInt is not universally supported; convert to Number
  // for formatting only. Safe because we're only formatting the rupee integer
  // part for display — no arithmetic happens here.
  const rupeesStr = Number(rupees).toLocaleString("en-IN");
  const centsStr = cents.toString().padStart(2, "0");

  return (negative ? "-" : "") + "₹" + rupeesStr + "." + centsStr;
}

/**
 * Sum any number of paise amounts.
 *
 * addPaise(100n, 200n, 300n) === 600n
 * addPaise()                 === 0n
 */
export function addPaise(...amounts: bigint[]): bigint {
  return amounts.reduce((sum, a) => sum + a, 0n);
}

/**
 * Multiply a paise amount by an integer quantity.
 *
 * mulPaise(1000n, 3)  === 3000n
 * mulPaise(100n, 0)   === 0n
 *
 * qty must be a non-negative safe integer. Fractional or negative qty throws.
 * Negative values (e.g. for reversals) should be expressed by negating the
 * result: -mulPaise(price, qty).
 */
export function mulPaise(amount: bigint, qty: number): bigint {
  if (!Number.isInteger(qty)) {
    throw new Error(
      `mulPaise: qty must be an integer, got ${qty}. ` +
        `Fractional quantities are not supported — check your input.`
    );
  }
  if (qty < 0) {
    throw new Error(
      `mulPaise: qty must be non-negative, got ${qty}. ` +
        `For reversals, negate the result: -mulPaise(amount, qty).`
    );
  }
  if (!Number.isSafeInteger(qty)) {
    throw new Error(
      `mulPaise: qty ${qty} exceeds Number.MAX_SAFE_INTEGER. Use BigInt arithmetic directly.`
    );
  }
  return amount * BigInt(qty);
}

/**
 * Allocate landed costs (freight, duty, handling) across purchase lines.
 *
 * STUB — NOT IMPLEMENTED IN PHASE 1.
 *
 * This function exists as a typed API contract so Phase 2 knows where the
 * implementation goes. The allocation math involves rounding decisions that
 * require a plan review before implementation (see AGENTS.md §Non-negotiables
 * Rule 3 and the "always stop" list).
 *
 * Any caller that invokes this before Phase 2 will get a loud runtime error,
 * not silently wrong numbers.
 */
export function allocateLandedCost(
  _lines: Array<{ valuePaise: bigint; qty: number }>,
  _totalLandedPaise: bigint,
  _method: "value" | "qty"
): bigint[] {
  throw new Error(
    "allocateLandedCost: not yet implemented. " +
      "This requires a Phase 2 plan review before implementation — see AGENTS.md."
  );
}
