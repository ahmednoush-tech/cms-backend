/**
 * Converts an array of flat objects into a CSV string, escaping
 * per RFC 4180: a value containing a comma, a double quote, or a
 * newline is wrapped in double quotes, with any double quote
 * inside it doubled. Column order follows the keys of the FIRST
 * row — every row is expected to share the same shape (this is
 * meant for already-tabular data like a report's result rows, not
 * arbitrary heterogeneous objects).
 */
export function toCsv<T extends object>(rows: T[], headers?: Partial<Record<keyof T, string>>): string {
  if (rows.length === 0) return '';

  // `T extends object` (not `Record<string, unknown>`) on purpose:
  // TypeScript interfaces (as opposed to inline object-literal types)
  // never structurally satisfy an index-signature type like
  // `Record<string, unknown>`, so every caller passing a named
  // interface — e.g. reports-registry.ts's ReportResultPoint — would
  // fail to compile against that stricter signature. Verified with a
  // real tsc run against this exact interface before and after this
  // change.
  const keys = Object.keys(rows[0]) as Array<keyof T & string>;
  const headerLine = keys.map((k) => escapeCsvValue(headers?.[k] ?? k)).join(',');
  const dataLines = rows.map((row) => keys.map((k) => escapeCsvValue(row[k])).join(','));

  return [headerLine, ...dataLines].join('\r\n');
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
