import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';
import { WorkloadTable } from '../WorkloadTable';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */

function renderWithI18n(ui: React.ReactElement, lang: 'en' | 'ar' = 'en') {
  i18n.changeLanguage(lang);
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('WorkloadTable', () => {
  it('renders an empty state when there is no workload data', () => {
    renderWithI18n(
      <WorkloadTable openTasksByEmployee={{}} openWorkOrdersByEmployee={{}} totalOpenAssignmentsByEmployee={{}} />,
    );
    expect(screen.getByText('No workload data')).toBeInTheDocument();
  });

  it('renders three distinct columns — tasks, work orders, and total are never merged into one value', () => {
    renderWithI18n(
      <WorkloadTable
        openTasksByEmployee={{ 'emp-1': 4 }}
        openWorkOrdersByEmployee={{ 'emp-1': 2 }}
        totalOpenAssignmentsByEmployee={{ 'emp-1': 6 }}
      />,
    );

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('renders correctly with Arabic active (RTL context, translated headers)', () => {
    renderWithI18n(
      <WorkloadTable
        openTasksByEmployee={{ 'emp-1': 1 }}
        openWorkOrdersByEmployee={{ 'emp-1': 0 }}
        totalOpenAssignmentsByEmployee={{ 'emp-1': 1 }}
      />,
      'ar',
    );
    expect(screen.getByText('المهام المفتوحة')).toBeInTheDocument();
    expect(screen.getByText('إجمالي التكليفات')).toBeInTheDocument();
  });
});
