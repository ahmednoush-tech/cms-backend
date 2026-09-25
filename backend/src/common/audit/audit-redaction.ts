/**
 * What the audit trail may store, and what each viewer may see.
 *
 * Matching is by FIELD NAME PATTERN (case-insensitive, underscores
 * ignored), not a fixed list — so a salary or secret column added to
 * any model in future is covered automatically, without anyone having
 * to remember to update this file.
 */

export const REDACTED = '[redacted]';
export const HIDDEN = '[hidden]';

/** Never stored at all — replaced at WRITE time. Passwords/hashes, tokens (incl. quotation share-link tokens), encryption keys, API secrets. */
const SECRET_PATTERN = /password|secret|token|privatekey|apikey/;

/** Pay data — stored, but shown only to viewers with Payroll:runs:view. */
const COMPENSATION_PATTERN = /salary|allowance|gosi|grosspay|netpay|hourlyrate/;

/** Personal identity data — stored, but shown only to viewers with Administration:employees:view. */
const IDENTITY_PATTERN = /iqama|nationalid|passport|nationality|dateofbirth|birthdate|iban|bankaccount/;

export const COMPENSATION_VIEW_PERMISSION = 'Payroll:runs:view';
export const IDENTITY_VIEW_PERMISSION = 'Administration:employees:view';

const MAX_DEPTH = 8;

const normalizeKey = (key: string) => key.toLowerCase().replace(/_/g, '');

/**
 * Turns Prisma Decimals, Dates and BigInts into plain JSON values
 * first, so everything below works on ordinary objects and the stored
 * JSON is exactly what a viewer later reads back.
 */
function toPlainJson(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

function mapKeys(value: unknown, replace: (normalizedKey: string, v: unknown) => unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => mapKeys(item, replace, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const replaced = replace(normalizeKey(key), v);
    out[key] = replaced === undefined ? mapKeys(v, replace, depth + 1) : replaced;
  }
  return out;
}

/** WRITE time: strips secrets before anything reaches the database. */
export function redactSecrets(value: Record<string, unknown>): Record<string, unknown> {
  return mapKeys(toPlainJson(value), (key, v) => (SECRET_PATTERN.test(key) && v !== null ? REDACTED : undefined)) as Record<string, unknown>;
}

/**
 * WRITE time, for update-style entries (both old and new given):
 * keeps only the fields that actually changed, so a viewer sees what
 * the edit DID rather than two near-identical full snapshots.
 *
 * - updatedAt is ignored (it always changes — pure noise).
 * - A field present only in `old` is ignored: callers often read the
 *   "before" row with extra related data included (e.g. an employee's
 *   department) that the "after" row simply doesn't include — that is
 *   not a change, and treating it as one would show fake removals.
 * - A field present only in `new` is kept (a genuinely new value).
 *
 * Creates (new only) and deletes (old only) keep their full snapshot.
 */
export function diffForAudit(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined,
): { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null } {
  if (!oldValues || !newValues) {
    return { oldValues: oldValues ?? null, newValues: newValues ?? null };
  }
  const oldPlain = toPlainJson(oldValues) as Record<string, unknown>;
  const newPlain = toPlainJson(newValues) as Record<string, unknown>;
  const changedOld: Record<string, unknown> = {};
  const changedNew: Record<string, unknown> = {};
  for (const key of Object.keys(newPlain)) {
    if (key === 'updatedAt') continue;
    if (!(key in oldPlain)) {
      changedNew[key] = newPlain[key];
      continue;
    }
    if (JSON.stringify(oldPlain[key]) !== JSON.stringify(newPlain[key])) {
      changedOld[key] = oldPlain[key];
      changedNew[key] = newPlain[key];
    }
  }
  return { oldValues: changedOld, newValues: changedNew };
}

/**
 * READ time: hides pay and identity fields unless the person viewing
 * the audit log holds the permission that already governs that data
 * elsewhere in the system. Applied on every read, so it also protects
 * rows written before this filter existed (which do contain salaries
 * and Iqama numbers in full).
 */
export function maskForViewer(value: unknown, viewerPermissions: string[]): unknown {
  if (value === null || value === undefined) return value;
  const canSeePay = viewerPermissions.includes(COMPENSATION_VIEW_PERMISSION);
  const canSeeIdentity = viewerPermissions.includes(IDENTITY_VIEW_PERMISSION);
  if (canSeePay && canSeeIdentity) {
    // Still strip secrets from rows written BEFORE write-time redaction
    // existed (e.g. old quotation entries containing publicToken).
    return mapKeys(value, (key, v) => (SECRET_PATTERN.test(key) && v !== null ? REDACTED : undefined));
  }
  return mapKeys(value, (key, v) => {
    if (v === null) return undefined;
    if (SECRET_PATTERN.test(key)) return REDACTED;
    if (!canSeePay && COMPENSATION_PATTERN.test(key)) return HIDDEN;
    if (!canSeeIdentity && IDENTITY_PATTERN.test(key)) return HIDDEN;
    return undefined;
  });
}
