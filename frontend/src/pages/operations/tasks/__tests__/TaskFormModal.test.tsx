import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { TaskFormModal } from '../TaskFormModal';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Mirrors the backend's "at least one of projectId/workOrderId"
 * rule (also DB-enforced via chk_task_parent) — this is a
 * client-side convenience hint only; the backend independently
 * re-validates and would reject with 400 regardless.
 */

function renderModal(onSubmit = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TaskFormModal open onOpenChange={vi.fn()} onSubmit={onSubmit} isSubmitting={false} />
    </I18nextProvider>,
  );
}

describe('TaskFormModal', () => {
  it('rejects submission when neither Project ID nor Work Order ID is provided', async () => {
    const onSubmit = vi.fn();
    renderModal(onSubmit);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Inspect wiring' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Provide a Project ID or a Work Order ID.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows submission with only projectId supplied', async () => {
    const onSubmit = vi.fn();
    renderModal(onSubmit);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Inspect wiring' } });
    fireEvent.change(screen.getByLabelText(/Project ID/), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('allows submission with only workOrderId supplied', async () => {
    const onSubmit = vi.fn();
    renderModal(onSubmit);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Inspect wiring' } });
    fireEvent.change(screen.getByLabelText(/Work Order ID/), { target: { value: '22222222-2222-4222-8222-222222222222' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('rejects submission with an empty title regardless of parent fields', async () => {
    const onSubmit = vi.fn();
    renderModal(onSubmit);

    fireEvent.change(screen.getByLabelText(/Project ID/), { target: { value: '11111111-1111-4111-8111-111111111111' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('This field is required.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
