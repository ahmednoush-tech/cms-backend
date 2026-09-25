import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../../api/queries/useAttachments';
import { attachmentsApi } from '../../api/endpoints/attachments';
import { DocumentDetailModal } from './DocumentDetailModal';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';
import { ApiError } from '../../api/client';
import type { Attachment, AttachableEntityType } from '../../types/entities/attachment';

interface AttachmentsSectionProps {
  entityType: AttachableEntityType;
  entityId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable across every attachable entity type — a Project detail
 * page, a Bill detail page, a Fixed Asset detail page, etc. all
 * render this exact same component with their own
 * entityType/entityId, rather than each page reimplementing its
 * own upload widget.
 */
export function AttachmentsSection({ entityType, entityId }: AttachmentsSectionProps) {
  const { t } = useTranslation(['attachments', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [detailAttachment, setDetailAttachment] = useState<Attachment | null>(null);

  const { data: attachments, isLoading } = useAttachments(entityType, entityId);
  const uploadMutation = useUploadAttachment(entityType, entityId);
  const deleteMutation = useDeleteAttachment(entityType, entityId);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    uploadMutation.mutate(file, {
      onError: (err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')),
    });
    e.target.value = '';
  };

  const handleDownload = async (id: string, fileName: string) => {
    setError(null);
    setDownloadingId(id);
    try {
      await attachmentsApi.download(id, fileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common:error.generic'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    setError(null);
    deleteMutation.mutate(pendingDeleteId, {
      onSuccess: () => setPendingDeleteId(null),
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : t('common:error.generic'));
        setPendingDeleteId(null);
      },
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t('attachments:title')}</p>
        <PermissionGate requires={PERMISSIONS.Common.attachments.upload}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            {uploadMutation.isPending ? t('common:action.processing') : t('attachments:upload')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelected}
          />
        </PermissionGate>
      </div>

      {error && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

      {isLoading && <p className="text-sm text-ink-muted">{t('attachments:loading')}</p>}

      {!isLoading && (attachments ?? []).length === 0 && (
        <p className="text-sm text-ink-muted">{t('attachments:empty')}</p>
      )}

      {!isLoading && (attachments ?? []).length > 0 && (
        <ul className="divide-y divide-border">
          {attachments!.map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <button
                type="button"
                onClick={() => handleDownload(att.id, att.fileName)}
                disabled={downloadingId === att.id}
                className="flex-1 truncate text-start font-medium text-primary hover:underline disabled:opacity-50"
                title={att.fileName}
              >
                {att.fileName}
              </button>
              <span className="shrink-0 text-xs text-ink-muted">{formatFileSize(att.fileSizeBytes)}</span>
              <button
                type="button"
                onClick={() => setDetailAttachment(att)}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {t('attachments:viewDetails')}
              </button>
              <PermissionGate requires={PERMISSIONS.Common.attachments.delete}>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(att.id)}
                  className="shrink-0 text-xs font-medium text-danger hover:underline"
                >
                  {t('common:action.delete')}
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title={t('attachments:confirm.deleteTitle')}
        message={t('attachments:confirm.deleteMessage')}
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
      />

      {detailAttachment && (
        <DocumentDetailModal
          attachment={detailAttachment}
          entityType={entityType}
          entityId={entityId}
          onClose={() => setDetailAttachment(null)}
        />
      )}
    </div>
  );
}
