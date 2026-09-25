import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';

/**
 * "Change history" link for any detail page: opens the audit log
 * filtered to this one record. Renders nothing for users without the
 * audit-log permission. What they then see inside still goes through
 * the backend's field masking (pay/identity data per permission).
 */
export function AuditHistoryLink({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { t } = useTranslation(['activityLogs']);
  const to = `/admin/activity-logs?${new URLSearchParams({ entityType, entityId }).toString()}`;
  return (
    <PermissionGate requires={PERMISSIONS.Administration.activityLogs.view}>
      <Link to={to} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
        {t('activityLogs:historyLink')}
      </Link>
    </PermissionGate>
  );
}
