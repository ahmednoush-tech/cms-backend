export const ATTACHABLE_ENTITY_TYPES = [
  'customer',
  'lead',
  'opportunity',
  'quotation',
  'project',
  'work_order',
  'task',
  'invoice',
  'bill',
  'purchase_order',
  'fixed_asset',
  'vendor',
  'employee',
  'interaction',
] as const;

export type AttachableEntityType = (typeof ATTACHABLE_ENTITY_TYPES)[number];

export interface Attachment {
  id: string;
  companyId: string;
  entityType: AttachableEntityType;
  entityId: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  uploadedByUser?: { id: string; email: string } | null;
  documentGroupId: string;
  versionNumber: number;
  isCurrentVersion: boolean;
}

export type SignatureType = 'typed' | 'drawn';

export interface AttachmentSignature {
  id: string;
  attachmentId: string;
  signedBy: string;
  signatureType: SignatureType;
  signatureData: string;
  ipAddress: string | null;
  signedAt: string;
  signedByUser?: { id: string; email: string } | null;
}

export interface AttachmentVersion extends Attachment {
  signatures: AttachmentSignature[];
}

export interface SignAttachmentInput {
  signatureType: SignatureType;
  signatureData: string;
}
