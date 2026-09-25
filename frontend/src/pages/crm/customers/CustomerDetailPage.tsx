import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useCustomerTimeline } from '../../../api/queries/useCrmTimeline';
import { CrmTimeline } from '../../../components/CrmTimeline/CrmTimeline';
import {
  useCustomer,
  useUpdateCustomer,
  useCustomerContacts,
  useCreateCustomerContact,
  useDeleteCustomerContact,
  useCustomerPortalUsers,
  useCreatePortalUser,
  useRevokePortalUser,
} from '../../../api/queries/useCustomers';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { WhatsAppButton } from '../../../components/WhatsAppButton/WhatsAppButton';
import { InteractionsSection } from '../shared/InteractionsSection';
import { CustomFieldsDisplay } from '../../../components/CustomFieldsDisplay/CustomFieldsDisplay';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { CustomerFormModal, type CustomerFormValues } from './CustomerFormModal';
import { ApiError } from '../../../api/client';

type Tab = 'overview' | 'contacts' | 'portal';

export function CustomerDetailPage() {
  const { t } = useTranslation(['customers', 'common']);
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer, isLoading, error } = useCustomer(id);
  const { data: timelineEvents } = useCustomerTimeline(id);
  const updateMutation = useUpdateCustomer(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!customer) return null;

  return (
    <div>
      <PageHeader
        title={customer.companyName ?? customer.customerCode}
        breadcrumb={t('customers:title')}
        action={
          <>
            <WhatsAppButton phone={customer.phone} message={t('common:whatsappGreeting', { name: customer.companyName ?? customer.customerCode })} />
            <PermissionGate requires={PERMISSIONS.CRM.customers.edit}>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                {t('customers:action.edit')}
              </button>
            </PermissionGate>
          </>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
        {(['overview', 'contacts', 'portal'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={
              tab === tabKey
                ? 'border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary'
                : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink'
            }
          >
            {t(`customers:tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          <Field label={t('customers:fields.customerCode')} value={customer.customerCode} />
          <Field label={t('customers:fields.status')} value={t(`customers:status.${customer.status}`)} />
          <Field label={t('customers:fields.email')} value={customer.email ?? '—'} />
          <Field label={t('customers:fields.phone')} value={customer.phone ?? '—'} />
          <Field label={t('customers:fields.website')} value={customer.website ?? '—'} />
          <Field label={t('customers:fields.address')} value={customer.address ?? '—'} />
          <Field label={t('customers:fields.city')} value={customer.city ?? '—'} />
          <Field label={t('customers:fields.country')} value={customer.country ?? '—'} />
          <Field label={t('customers:fields.vatRegistrationNumber')} value={customer.vatRegistrationNumber ?? '—'} />
        </dl>
      )}

      {tab === 'contacts' && <ContactsTab customerId={customer.id} />}
      {tab === 'portal' && <PortalUsersTab customerId={customer.id} />}

      <CustomerFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={customer}
        isSubmitting={updateMutation.isPending}
        onSubmit={(values: CustomerFormValues) => {
          updateMutation.mutate(
            { ...values, email: values.email || undefined },
            { onSuccess: () => setEditOpen(false) },
          );
        }}
      />

      <InteractionsSection parent={{ kind: 'customer', id: customer.id }} />

      <CustomFieldsDisplay entityType="customer" customFields={customer.customFields} />

      <div className="mt-6">
        <p className="mb-3 text-sm font-medium text-ink">{t('customers:timeline.title')}</p>
        <CrmTimeline events={timelineEvents ?? []} />
      </div>

      <div className="mt-4">
        <AttachmentsSection entityType="customer" entityId={customer.id} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function ContactsTab({ customerId }: { customerId: string }) {
  const { t } = useTranslation(['customers', 'common']);
  const { data: contacts, isLoading } = useCustomerContacts(customerId);
  const createMutation = useCreateCustomerContact(customerId);
  const deleteMutation = useDeleteCustomerContact(customerId);
  const [name, setName] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <div>
      <PermissionGate requires={PERMISSIONS.CRM.customers.edit}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createMutation.mutate({ name }, { onSuccess: () => setName('') });
          }}
          className="mb-3 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('customers:contacts.namePlaceholder')}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          />
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('customers:contacts.add')}
          </button>
        </form>
      </PermissionGate>

      {(!contacts || contacts.length === 0) ? (
        <EmptyState title={t('customers:contacts.empty')} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="font-medium text-ink">{contact.name}</span>
                {contact.isPrimary && (
                  <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t('customers:contacts.primary')}</span>
                )}
                {contact.email && <span className="ms-2 text-ink-muted">{contact.email}</span>}
              </div>
              <PermissionGate requires={PERMISSIONS.CRM.customers.edit}>
                <button type="button" onClick={() => setConfirmId(contact.id)} className="text-xs font-medium text-danger hover:underline">
                  {t('common:action.delete')}
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title={t('customers:contacts.deleteTitle')}
        message={t('customers:contacts.deleteMessage')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => confirmId && deleteMutation.mutate(confirmId, { onSuccess: () => setConfirmId(null) })}
      />
    </div>
  );
}

function PortalUsersTab({ customerId }: { customerId: string }) {
  const { t } = useTranslation(['customers', 'common']);
  const { data: portalUsers, isLoading } = useCustomerPortalUsers(customerId);
  const createMutation = useCreatePortalUser(customerId);
  const revokeMutation = useRevokePortalUser(customerId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <div>
      <PermissionGate requires={PERMISSIONS.CRM.customers.edit}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(
              { name, email, password },
              { onSuccess: () => { setName(''); setEmail(''); setPassword(''); } },
            );
          }}
          className="mb-3 flex flex-wrap gap-2"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('customers:portal.namePlaceholder')} className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('customers:portal.emailPlaceholder')} className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={t('customers:portal.passwordPlaceholder')} className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink" />
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('customers:portal.create')}
          </button>
        </form>
      </PermissionGate>

      {(!portalUsers || portalUsers.length === 0) ? (
        <EmptyState title={t('customers:portal.empty')} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {portalUsers.map((pu) => (
            <li key={pu.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="font-medium text-ink">{pu.user?.email ?? pu.userId}</span>
                <span className="ms-2 text-ink-muted">{t(`customers:portal.status.${pu.status}`)}</span>
              </div>
              <PermissionGate requires={PERMISSIONS.CRM.customers.edit}>
                <button type="button" onClick={() => setConfirmId(pu.id)} className="text-xs font-medium text-danger hover:underline">
                  {t('customers:portal.revoke')}
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title={t('customers:portal.revokeTitle')}
        message={t('customers:portal.revokeMessage')}
        variant="destructive"
        isLoading={revokeMutation.isPending}
        onConfirm={() => confirmId && revokeMutation.mutate(confirmId, { onSuccess: () => setConfirmId(null) })}
      />
    </div>
  );
}
