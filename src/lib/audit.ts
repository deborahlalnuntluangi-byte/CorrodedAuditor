// src/lib/audit.ts
//
// Audit event writer.
//
// IMPORTANT: This function accepts a Drizzle transaction object (DbTransaction),
// NOT the bare `db` client. This is enforced by the TypeScript type.
//
// If you try to pass `db` instead of `tx`, you will get a type error.
// That is intentional: audit events MUST be written in the same transaction
// as the change they record. An audit event committed outside the transaction
// can describe a write that was later rolled back — which is worse than no
// audit at all.
//
// Usage pattern (the ONLY correct way to call this):
//
//   await db.transaction(async (tx) => {
//     const [sale] = await tx.insert(sales).values({ ... }).returning();
//     await writeAuditEvent(tx, {
//       actorId:    session.user.id,
//       action:     "post",
//       entityType: "sale",
//       entityId:   sale.id,
//       afterJson:  sale,
//     });
//     // If anything above throws, the whole transaction rolls back — including
//     // the audit event. That is correct behaviour.
//   });

import { auditEvents } from "@/db/schema";
import type { DbTransaction } from "@/db/client";

interface AuditEventInput {
  /** ID of the user performing the action. */
  actorId: number;

  /**
   * Short verb describing what happened.
   * Canonical values: "post", "reverse", "approve", "reject", "create",
   * "update_draft", "adjust", "close_period".
   * Keep these consistent — they will be filtered and displayed in the audit log viewer.
   */
  action: string;

  /** Table or domain entity being acted on, e.g. "sale", "purchase", "stock_adjustment". */
  entityType: string;

  /** Primary key of the entity being acted on. */
  entityId: number;

  /** Snapshot of the row BEFORE the change (omit for creates). */
  beforeJson?: unknown;

  /** Snapshot of the row AFTER the change (omit for deletes, which we don't do). */
  afterJson?: unknown;

  /** Human-readable reason, required for reversals and adjustments. */
  reason?: string;

  /** Client IP address, forwarded from the request headers. */
  ip?: string;
}

/**
 * Append a row to audit_events inside an open transaction.
 *
 * @param tx   The active Drizzle transaction — NOT the bare db client.
 * @param event Audit event data.
 */
export async function writeAuditEvent(
  tx: DbTransaction,
  event: AuditEventInput
): Promise<void> {
  await tx.insert(auditEvents).values({
    actorId:    event.actorId,
    action:     event.action,
    entityType: event.entityType,
    entityId:   event.entityId,
    beforeJson: event.beforeJson ?? null,
    afterJson:  event.afterJson ?? null,
    reason:     event.reason    ?? null,
    ip:         event.ip        ?? null,
  });
}
