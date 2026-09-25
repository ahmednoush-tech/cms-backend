import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInteractionsForCustomer, useInteractionsForLead, useInteractionsForOpportunity, useDeleteInteraction } from '../../../api/queries/useInteractions';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { LogInteractionModal } from './LogInteractionModal';
import type { Interaction } from '../../../types/entities/interaction';

type ParentRef = { kind: 'customer' | 'lead' | 'opportunity'; id: string };

const TYPE_ICON: Record<string, string> = { call: '📞', meeting: '🤝', email: '✉️', note: '📝', other: '•' };

export function InteractionsSection({ parent }: { parent: ParentRef }) {
  const { t } = useTranslation(['interactions', 'common']);

  const customerQuery = useInteractionsForCustomer(parent.kind === 'customer' ? parent.id : undefined);
  const leadQuery = useInteractionsForLead(parent.kind === 'lead' ? parent.id : undefined);
  const opportunityQuery = useInteractionsForOpportunity(parent.kind === 'opportunity' ? parent.id : undefined);
  const { data: interactions } =
    parent.kind === 'customer' ? customerQuery : parent.kind === 'lead' ? leadQuery : opportunityQuery;

  const deleteMutation = useDeleteInteraction(parent);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t('interactions:section.title')}</p>
        <PermissionGate requires={PERMISSIONS.CRM.interactions.create}>
          <button
            type="button"
            onClick={() => { setEditingInteraction(undefined); setActionError(null); setLogModalOpen(true); }}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('interactions:section.logInteraction')}
          </button>
        </PermissionGate>
      </div>

      {(!interactions || interactions.length === 0) && <p className="text-sm text-ink-muted">{t('interactions:section.empty')}</p>}

      {interactions && interactions.length > 0 && (
        <div className="space-y-3">
          {interactions.map((interaction) => (
            <div key={interaction.id} className="border-s-2 border-border ps-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">
                    <span className="me-1">{TYPE_ICON[interaction.type]}</span>
                    {interaction.subject}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {t(`interactions:type.${interaction.type}`)} · {interaction.interactionDate.slice(0, 10)}
                    {interaction.createdByUser && ` · ${interaction.createdByUser.email}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <PermissionGate requires={PERMISSIONS.CRM.interactions.edit}>
                    <button type="button" onClick={() => { setEditingInteraction(interaction); setActionError(null); setLogModalOpen(true); }} className="text-xs font-medium text-primary hover:underline">
                      {t('common:action.edit')}
                    </button>
                  </PermissionGate>
                  <PermissionGate requires={PERMISSIONS.CRM.interactions.delete}>
                    <button type="button" onClick={() => { setActionError(null); setConfirmDeleteId(interaction.id); }} className="text-xs font-medium text-danger hover:underline">
                      {t('common:action.delete')}
                    </button>
                  </PermissionGate>
                </div>
              </div>
              {interaction.notes && <p className="mt-1 text-sm text-ink-muted">{interaction.notes}</p>}
              {(interaction.outcome || interaction.followUpDate) && (
                <p className="mt-1 text-xs text-ink-muted">
                  {interaction.outcome && <span>{t('interactions:fields.outcome')}: {interaction.outcome}</span>}
                  {interaction.outcome && interaction.followUpDate && ' · '}
                  {interaction.followUpDate && <span>{t('interactions:fields.followUpDate')}: {interaction.followUpDate.slice(0, 10)}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {actionError && <p className="mt-2 text-sm text-danger" role="alert">{actionError}</p>}

      <LogInteractionModal open={logModalOpen} onOpenChange={setLogModalOpen} parent={parent} editingInteraction={editingInteraction} />

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title={t('interactions:section.deleteConfirmTitle')}
        message={t('interactions:section.deleteConfirmMessage')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          confirmDeleteId &&
          deleteMutation.mutate(confirmDeleteId, {
            onSuccess: () => setConfirmDeleteId(null),
            onError: (err) => { setConfirmDeleteId(null); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
    </div>
  );
}
