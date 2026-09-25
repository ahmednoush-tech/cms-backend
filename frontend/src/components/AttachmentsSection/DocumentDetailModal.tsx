import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { attachmentsApi } from '../../api/endpoints/attachments';
import { useAttachmentVersions, useUploadNewVersion, useSignAttachment } from '../../api/queries/useAttachments';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';
import { ApiError } from '../../api/client';
import type { Attachment, AttachableEntityType, SignatureType } from '../../types/entities/attachment';

const PREVIEWABLE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

interface DocumentDetailModalProps {
  attachment: Attachment;
  entityType: AttachableEntityType;
  entityId: string;
  onClose: () => void;
}

export function DocumentDetailModal({ attachment, entityType, entityId, onClose }: DocumentDetailModalProps) {
  const { t } = useTranslation(['attachments', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [signMode, setSignMode] = useState<SignatureType | null>(null);
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);

  const { data: versions, isLoading: versionsLoading } = useAttachmentVersions(attachment.id);
  const uploadVersionMutation = useUploadNewVersion(entityType, entityId);
  const signMutation = useSignAttachment();

  const currentVersion = versions?.find((v) => v.isCurrentVersion) ?? versions?.[0];
  const isPreviewable = PREVIEWABLE_MIME_TYPES.includes(attachment.mimeType);

  useEffect(() => {
    if (!isPreviewable || !currentVersion) return;
    let objectUrl: string | null = null;
    attachmentsApi.getPreviewBlobUrl(currentVersion.id).then((url) => {
      objectUrl = url;
      setPreviewUrl(url);
    }).catch((err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')));
    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [currentVersion?.id, isPreviewable]);

  const handleNewVersionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    uploadVersionMutation.mutate(
      { attachmentId: attachment.id, file },
      { onError: (err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')) },
    );
    e.target.value = '';
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!ctx || !rect) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!ctx || !rect) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const handleStopDrawing = () => setIsDrawing(false);

  const submitSignature = () => {
    if (!currentVersion) return;
    setError(null);
    const signatureData = signMode === 'typed' ? typedName : canvasRef.current?.toDataURL('image/png') ?? '';
    if (!signatureData) return;
    signMutation.mutate(
      { attachmentId: currentVersion.id, input: { signatureType: signMode!, signatureData } },
      {
        onSuccess: () => { setSignMode(null); setTypedName(''); },
        onError: (err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="truncate text-sm font-medium text-ink" title={attachment.fileName}>{attachment.fileName}</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted hover:text-ink">{t('common:action.close')}</button>
        </div>

        {error && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

        {isPreviewable && previewUrl && (
          <div className="mb-4 h-96 overflow-hidden rounded border border-border">
            {attachment.mimeType === 'application/pdf' ? (
              <iframe src={previewUrl} title={attachment.fileName} className="h-full w-full" />
            ) : (
              <img src={previewUrl} alt={attachment.fileName} className="h-full w-full object-contain" />
            )}
          </div>
        )}
        {!isPreviewable && <p className="mb-4 text-sm text-ink-muted">{t('attachments:noPreview')}</p>}

        <div className="mb-4 flex flex-wrap gap-2">
          <PermissionGate requires={PERMISSIONS.Common.attachments.upload}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('attachments:uploadNewVersion')}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleNewVersionFile} />
          </PermissionGate>
          <PermissionGate requires={PERMISSIONS.Common.attachments.sign}>
            <button type="button" onClick={() => setSignMode('typed')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('attachments:signTyped')}
            </button>
            <button type="button" onClick={() => setSignMode('drawn')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('attachments:signDrawn')}
            </button>
          </PermissionGate>
        </div>

        {signMode === 'typed' && (
          <div className="mb-4 rounded border border-border p-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('attachments:typedNameLabel')}</label>
            <input type="text" value={typedName} onChange={(e) => setTypedName(e.target.value)} className="mb-2 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSignMode(null)} className="text-sm text-ink-muted hover:text-ink">{t('common:action.cancel')}</button>
              <button type="button" onClick={submitSignature} disabled={!typedName || signMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
                {t('attachments:submitSignature')}
              </button>
            </div>
          </div>
        )}
        {signMode === 'drawn' && (
          <div className="mb-4 rounded border border-border p-3">
            <p className="mb-1 text-xs text-ink-muted">{t('attachments:drawSignatureHint')}</p>
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="mb-2 w-full cursor-crosshair rounded border border-border bg-white"
              onMouseDown={handleStartDrawing}
              onMouseMove={handleDraw}
              onMouseUp={handleStopDrawing}
              onMouseLeave={handleStopDrawing}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSignMode(null)} className="text-sm text-ink-muted hover:text-ink">{t('common:action.cancel')}</button>
              <button type="button" onClick={submitSignature} disabled={signMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
                {t('attachments:submitSignature')}
              </button>
            </div>
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-ink">{t('attachments:versionHistory')}</p>
        {versionsLoading && <p className="text-sm text-ink-muted">{t('attachments:loading')}</p>}
        {versions && (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="rounded border border-border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{t('attachments:versionLabel', { number: v.versionNumber })}</span>
                  {v.isCurrentVersion && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{t('attachments:current')}</span>}
                </div>
                <p className="mt-1 text-xs text-ink-muted">{v.uploadedByUser?.email} · {new Date(v.createdAt).toLocaleString()}</p>
                {v.signatures.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {v.signatures.map((sig) => (
                      <p key={sig.id} className="text-xs text-ink-muted">
                        {t('attachments:signedBy', { name: sig.signedByUser?.email, date: new Date(sig.signedAt).toLocaleString() })}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
