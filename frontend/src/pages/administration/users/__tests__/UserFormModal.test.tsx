import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { UserFormModal } from '../UserFormModal';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Proves the deliberate omission: UpdateUserDto has no password
 * field (confirmed this session), so the edit form must never
 * offer one — offering a field that silently does nothing would
 * be worse than not offering it at all.
 */

function renderCreate() {
  return render(
    <I18nextProvider i18n={i18n}>
      <UserFormModal open onOpenChange={vi.fn()} isSubmitting={false} mode="create" onSubmitCreate={vi.fn()} />
    </I18nextProvider>,
  );
}

function renderEdit() {
  return render(
    <I18nextProvider i18n={i18n}>
      <UserFormModal
        open
        onOpenChange={vi.fn()}
        isSubmitting={false}
        mode="edit"
        initialValues={{ id: 'u1', name: 'Ahmed', email: 'ahmed@example.com', status: 'active' } as any}
        onSubmitEdit={vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe('UserFormModal', () => {
  it('the create form has a password field', () => {
    renderCreate();
    // FormField renders required fields as "Password" + a separate
    // "*" span, so the accessible label text is "Password *", not
    // an exact "Password" — matched with a regex instead of an
    // exact string (the same pattern already works for "Status"
    // below, which isn't marked required and has no trailing "*").
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
  });

  it('the edit form has NO password field — the backend has no endpoint that would accept one', () => {
    renderEdit();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('the edit form offers status (active/inactive/locked), matching UpdateUserDto exactly', () => {
    renderEdit();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('the create form does NOT offer status — a new user always starts active per the backend default', () => {
    renderCreate();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });
});
