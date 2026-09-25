import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { StatusBreakdownBars } from '../StatusBreakdownBars';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('StatusBreakdownBars', () => {
  it('renders every bucket the backend returns, including zero-count ones, exactly as given', () => {
    // Mirrors the backend's own zero-filled example from the
    // approved Phase 2E decision (planning:0, approved:3,
    // in_progress:7, on_hold:0, completed:12, cancelled:1).
    renderWithI18n(
      <StatusBreakdownBars
        entity="project"
        title="Projects by Status"
        data={{ planning: 0, approved: 3, in_progress: 7, on_hold: 0, completed: 12, cancelled: 1 }}
      />,
    );

    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('On Hold')).toBeInTheDocument();
    // Both zero-value buckets are present as labeled bars, not omitted.
    const zeroCounts = screen.getAllByText('0');
    expect(zeroCounts.length).toBe(2);
  });

  it('translates raw backend enum values, never displaying them verbatim', () => {
    renderWithI18n(<StatusBreakdownBars entity="workOrder" title="Work Orders" data={{ in_progress: 5 }} />);
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });
});
