// src/lib/money.test.ts
//
// Unit tests for money.ts. Every function that touches monetary amounts has
// a test with a worked numeric example. "Looks right in the UI" is not done.
//
// Run: pnpm test

import { describe, it, expect } from "vitest";
import {
  paise,
  formatPaise,
  addPaise,
  mulPaise,
  allocateLandedCost,
} from "./money";

// ---------------------------------------------------------------------------
// paise() — decimal rupee string → integer paise bigint
// ---------------------------------------------------------------------------

describe("paise", () => {
  it('converts "12.50" → 1250n (worked example: ₹12.50)', () => {
    expect(paise("12.50")).toBe(1250n);
  });

  it('converts "0.01" → 1n (single paise — smallest unit)', () => {
    expect(paise("0.01")).toBe(1n);
  });

  it('converts "100" → 10000n (whole rupees, no decimal)', () => {
    expect(paise("100")).toBe(10000n);
  });

  it('converts "0" → 0n', () => {
    expect(paise("0")).toBe(0n);
  });

  it('pads single decimal digit: "1.5" → 150n', () => {
    // "1.5" means ₹1.50, not ₹1.05
    expect(paise("1.5")).toBe(150n);
  });

  it('converts negative "-12.50" → -1250n', () => {
    expect(paise("-12.50")).toBe(-1250n);
  });

  it('converts "-0.01" → -1n (negative single paise)', () => {
    expect(paise("-0.01")).toBe(-1n);
  });

  it('trims surrounding whitespace: "  12.50  " → 1250n', () => {
    expect(paise("  12.50  ")).toBe(1250n);
  });

  it("throws on more than 2 decimal places — no silent rounding", () => {
    // ₹12.505 is ambiguous: is the last digit a mistake or truncation?
    // We throw rather than silently round to preserve exactness.
    expect(() => paise("12.505")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => paise("")).toThrow();
  });

  it("throws on whitespace-only string", () => {
    expect(() => paise("   ")).toThrow();
  });

  it("throws on alphabetic input", () => {
    expect(() => paise("abc")).toThrow();
  });

  it('throws on "12." (decimal point with no following digits)', () => {
    expect(() => paise("12.")).toThrow();
  });

  it("throws on scientific notation (not a valid rupee string)", () => {
    expect(() => paise("1e2")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// formatPaise() — integer paise bigint → display string (UI only)
// ---------------------------------------------------------------------------

describe("formatPaise", () => {
  it("formats 1250n → '₹12.50'", () => {
    expect(formatPaise(1250n)).toBe("₹12.50");
  });

  it("formats 0n → '₹0.00'", () => {
    expect(formatPaise(0n)).toBe("₹0.00");
  });

  it("formats 1n (single paise) → '₹0.01'", () => {
    expect(formatPaise(1n)).toBe("₹0.01");
  });

  it("formats 99n → '₹0.99'", () => {
    expect(formatPaise(99n)).toBe("₹0.99");
  });

  it("formats negative -1250n → '-₹12.50'", () => {
    expect(formatPaise(-1250n)).toBe("-₹12.50");
  });
});

// ---------------------------------------------------------------------------
// addPaise() — sum any number of paise bigints
// ---------------------------------------------------------------------------

describe("addPaise", () => {
  it("adds two amounts: 100n + 200n = 300n", () => {
    expect(addPaise(100n, 200n)).toBe(300n);
  });

  it("adds three amounts: 100n + 200n + 300n = 600n", () => {
    expect(addPaise(100n, 200n, 300n)).toBe(600n);
  });

  it("handles zero argument: addPaise() = 0n", () => {
    expect(addPaise()).toBe(0n);
  });

  it("handles single argument: addPaise(500n) = 500n", () => {
    expect(addPaise(500n)).toBe(500n);
  });

  it("handles zero addend: 100n + 0n = 100n", () => {
    expect(addPaise(100n, 0n)).toBe(100n);
  });

  it("handles mixed sign (reversal scenario): -100n + 200n = 100n", () => {
    expect(addPaise(-100n, 200n)).toBe(100n);
  });

  it("handles negative result: 100n + (-200n) = -100n", () => {
    expect(addPaise(100n, -200n)).toBe(-100n);
  });
});

// ---------------------------------------------------------------------------
// mulPaise() — paise × integer quantity
// ---------------------------------------------------------------------------

describe("mulPaise", () => {
  it("100n * 3 = 300n (worked example: ₹1 × 3 units = ₹3)", () => {
    expect(mulPaise(100n, 3)).toBe(300n);
  });

  it("any amount * 0 = 0n", () => {
    expect(mulPaise(9999n, 0)).toBe(0n);
  });

  it("1n * 1 = 1n (smallest valid multiplication)", () => {
    expect(mulPaise(1n, 1)).toBe(1n);
  });

  it("large amount: 10000n * 100 = 1000000n (₹100 × 100 = ₹10,000)", () => {
    expect(mulPaise(10000n, 100)).toBe(1000000n);
  });

  it("throws on fractional qty (1.5) — no silent truncation", () => {
    expect(() => mulPaise(100n, 1.5)).toThrow();
  });

  it("throws on negative qty — use -mulPaise(amount, qty) for reversals", () => {
    expect(() => mulPaise(100n, -1)).toThrow();
  });

  it("throws on NaN qty", () => {
    expect(() => mulPaise(100n, NaN)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// allocateLandedCost() — stub guard
// ---------------------------------------------------------------------------

describe("allocateLandedCost", () => {
  it("throws — not yet implemented, requires Phase 2 plan review", () => {
    // This test documents intent: the function must throw until Phase 2
    // provides an approved implementation. If this test ever fails because
    // the function no longer throws, it means someone implemented it without
    // the required plan review.
    expect(() =>
      allocateLandedCost([{ valuePaise: 1000n, qty: 1 }], 100n, "value")
    ).toThrow(/not yet implemented/);
  });
});
