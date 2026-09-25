import { apiRequest, apiClient } from '../client';
import type { Attachment, AttachableEntityType, AttachmentVersion, AttachmentSignature, SignAttachmentInput } from '../../types/entities/attachment';

/** Confirmed 1:1 against backend/src/modules/attachments/attachments.controller.ts. */
export const attachmentsApi = {
  upload: async (entityType: AttachableEntityType, entityId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('file', file);
    // Deliberately no explicit Content-Type header — Axios sets
    // multipart/form-data with the correct boundary automatically
    // when `data` is a FormData instance.
    const { data } = await apiRequest<Attachment>({ method: 'POST', url: '/attachments', data: formData });
    return data;
  },
  list: async (entityType: AttachableEntityType, entityId: string): Promise<Attachment[]> => {
    const { data } = await apiRequest<Attachment[]>({ method: 'GET', url: '/attachments', params: { entityType, entityId } });
    return data;
  },
  /**
   * Downloads happen via a Bearer-authenticated blob fetch, not a
   * plain <a href> to the API — the download endpoint requires
   * auth like every other route, so a bare link (with no way to
   * attach an Authorization header) would just 401.
   */
  download: async (id: string, fileName: string): Promise<void> => {
    const response = await apiClient.get(`/attachments/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  /**
   * Same authenticated-blob-fetch necessity as download() — a
   * plain <iframe src="/attachments/:id/preview"> cannot attach a
   * Bearer token, so this fetches the blob and hands back an
   * object URL the caller can put directly into an <iframe>/<img>
   * src. The caller owns the returned URL's lifetime and MUST call
   * URL.revokeObjectURL() on it (e.g. in a useEffect cleanup) once
   * done, or the blob leaks for the rest of the page's lifetime.
   */
  getPreviewBlobUrl: async (id: string): Promise<string> => {
    const response = await apiClient.get(`/attachments/${id}/preview`, { responseType: 'blob' });
    return window.URL.createObjectURL(new Blob([response.data]));
  },
  uploadNewVersion: async (attachmentId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiRequest<Attachment>({ method: 'POST', url: `/attachments/${attachmentId}/versions`, data: formData });
    return data;
  },
  listVersions: async (attachmentId: string): Promise<AttachmentVersion[]> => {
    const { data } = await apiRequest<AttachmentVersion[]>({ method: 'GET', url: `/attachments/${attachmentId}/versions` });
    return data;
  },
  sign: async (attachmentId: string, input: SignAttachmentInput): Promise<AttachmentSignature> => {
    const { data } = await apiRequest<AttachmentSignature>({ method: 'POST', url: `/attachments/${attachmentId}/sign`, data: input });
    return data;
  },
  listSignatures: async (attachmentId: string): Promise<AttachmentSignature[]> => {
    const { data } = await apiRequest<AttachmentSignature[]>({ method: 'GET', url: `/attachments/${attachmentId}/signatures` });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/attachments/${id}` });
  },
};
