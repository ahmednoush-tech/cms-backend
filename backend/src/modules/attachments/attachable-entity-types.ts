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
