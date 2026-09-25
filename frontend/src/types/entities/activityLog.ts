export interface ActivityLog {
  id: string;
  companyId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  /** Browser/client that performed the action. Captured from entries written after migration 113; null on older entries. */
  userAgent: string | null;
  createdAt: string;
  /** Always included — see backend ActivityLogsService.findAll's include. */
  user: { id: string; name: string; email: string } | null;
}
