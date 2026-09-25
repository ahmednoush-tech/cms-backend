import { forwardRef, type ReactNode } from 'react';
import clsx from 'clsx';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

/**
 * Every create/edit form composes this rather than hand-rolling
 * label/error layout (design doc section K). Pairs with React
 * Hook Form + Zod — the Zod schema per resource lives alongside
 * that resource's types (section L), not here; this component is
 * purely presentational.
 */
export function FormField({ label, htmlFor, error, required, children, hint }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Wrapped in forwardRef — this is not cosmetic. Every form in this
 * app spreads `{...register('fieldName')}` onto this component,
 * and React Hook Form's `register()` returns a `ref` it uses to
 * read the input's live DOM value directly (its uncontrolled-input
 * strategy, for performance). A plain function component silently
 * drops that ref — React only warns about it in the console
 * ("Function components cannot be given refs") — so RHF could
 * never reliably read what the user actually typed. This was
 * confirmed as the real cause of TaskFormModal's tests seeing a
 * "required" error on a field that had, in fact, been filled: RHF
 * had no working reference to check.
 */
export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }>(
  function TextInput({ hasError, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={clsx(
          'w-full rounded border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40',
          hasError ? 'border-danger' : 'border-border',
          className,
        )}
      />
    );
  },
);
