import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attachmentsApi } from '../endpoints/attachments';
import type { AttachableEntityType, SignAttachmentInput } from '../../types/entities/attachment';

export function useAttachments(entityType: AttachableEntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => attachmentsApi.list(entityType, entityId!),
    enabled: !!entityId,
  });
}

export function useUploadAttachment(entityType: AttachableEntityType, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(entityType, entityId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] }),
  });
}

export function useDeleteAttachment(entityType: AttachableEntityType, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attachmentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] }),
  });
}

export function useAttachmentVersions(attachmentId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', 'versions', attachmentId],
    queryFn: () => attachmentsApi.listVersions(attachmentId!),
    enabled: !!attachmentId,
  });
}

/** Invalidates BOTH the version-history query for this document AND the entity's main attachment list — a new version changes what "current" means in both places. */
export function useUploadNewVersion(entityType: AttachableEntityType, entityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId, file }: { attachmentId: string; file: File }) => attachmentsApi.uploadNewVersion(attachmentId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['attachments', 'versions', variables.attachmentId] });
    },
  });
}

export function useAttachmentSignatures(attachmentId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', 'signatures', attachmentId],
    queryFn: () => attachmentsApi.listSignatures(attachmentId!),
    enabled: !!attachmentId,
  });
}

export function useSignAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentId, input }: { attachmentId: string; input: SignAttachmentInput }) => attachmentsApi.sign(attachmentId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'signatures', variables.attachmentId] });
      queryClient.invalidateQueries({ queryKey: ['attachments', 'versions'] });
    },
  });
}
