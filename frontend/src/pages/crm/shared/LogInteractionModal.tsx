import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useCreateInteraction, useUpdateInteraction } from '../../../api/queries/useInteractions';
import { ApiError } from '../../../api/client';
import type { Interaction, InteractionType } from '../../../types/entities/interaction';

const schema = z.object({
  type: z.enum(['call', 'meeting', 'email', 'note', 'other']),
  subject: z.string().min(1, 'validation.required').max(200),
  interactionDate: z.string().min(1, 'validation.required'),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  followUpDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type ParentRef = { kind: 'customer' | 'lead' | 'opportunity'; id: string };

interface LogInteractionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: ParentRef;
  editingInteraction?: Interaction;
}

const TYPES: InteractionType[] = ['call', 'meeting', 'email', 'note', 'other'];

export function LogInteractionModal({ open, onOpenChange, parent, editingInteraction }: LogInteractionModalProps) {
  const { t } = useTranslation(['interactions', 'common']);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateInteraction(parent);
  const updateMutation = useUpdateInteraction(editingInteraction?.id ?? '', parent);
  const isEditing = !!editingInteraction;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'call', interactionDate: new Date().toISOString().slice(0, 10) },
  });

  useEffect(() => {
    if (open) {
      reset({
        type: editingInteraction?.type ?? 'call',
        subject: editingInteraction?.subject ?? '',
        interactionDate: editingInteraction?.interactionDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        notes: editingInteraction?.notes ?? '',
        outcome: editingInteraction?.outcome ?? '',
        followUpDate: editingInteraction?.followUpDate?.slice(0, 10) ?? '',
      });
      setSubmitError(null);
    }
  }, [open, editingInteraction, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    setSubmitError(null);
    const onError = (err: unknown) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic'));
    const onSuccess = () => onOpenChange(false);

    const payload = {
      type: values.type,
      subject: values.subject,
      interactionDate: values.interactionDate,
      notes: values.notes || undefined,
      outcome: values.outcome || undefined,
      followUpDate: values.followUpDate || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload, { onSuccess, onError });
    } else {
      createMutation.mutate(
        { ...payload, [parent.kind === 'customer' ? 'customerId' : parent.kind === 'lead' ? 'leadId' : 'opportunityId']: parent.id },
        { onSuccess, onError },
      );
    }
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEditing ? t('interactions:form.editTitle') : t('interactions:form.createTitle')}>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('interactions:fields.type')} htmlFor="type" required>
            <select id="type" {...register('type')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>{t(`interactions:type.${tp}`)}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('interactions:fields.interactionDate')} htmlFor="interactionDate" required error={errors.interactionDate && t(`common:${errors.interactionDate.message}`)}>
            <TextInput id="interactionDate" type="date" hasError={!!errors.interactionDate} {...register('interactionDate')} />
          </FormField>
        </div>

        <FormField label={t('interactions:fields.subject')} htmlFor="subject" required error={errors.subject && t(`common:${errors.subject.message}`)}>
          <TextInput id="subject" hasError={!!errors.subject} {...register('subject')} />
        </FormField>

        <FormField label={t('interactions:fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={3} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('interactions:fields.outcome')} htmlFor="outcome">
            <TextInput id="outcome" {...register('outcome')} />
          </FormField>
          <FormField label={t('interactions:fields.followUpDate')} htmlFor="followUpDate">
            <TextInput id="followUpDate" type="date" {...register('followUpDate')} />
          </FormField>
        </div>

        {submitError && <p className="mt-1 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isPending ? t('common:action.processing') : isEditing ? t('common:action.save') : t('common:action.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
