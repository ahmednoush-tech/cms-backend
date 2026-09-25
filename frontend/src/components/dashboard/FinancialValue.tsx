/**
 * Renders a backend-supplied decimal STRING (e.g. "16585.00")
 * exactly as returned, formatted for display via Intl.NumberFormat
 * on a single controlled parse — never used in further arithmetic
 * client-side, matching the backend's own "Decimal, never JS
 * float math on money" rule extended to the display layer
 * (design doc section L.4).
 */
interface FinancialValueProps {
  value: string;
  currency?: string;
}

export function FinancialValue({ value, currency = 'SAR' }: FinancialValueProps) {
  const numeric = Number(value);
  const formatted = Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)
    : value;

  return (
    <span>
      {formatted} <span className="text-sm font-normal text-ink-muted">{currency}</span>
    </span>
  );
}
