import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActivityLogs } from '../../../api/queries/useActivityLogs';
import { useAdminUsers } from '../../../api/queries/useAdminUsers';
import { activityLogsApi, type ActivityLogFilters } from '../../../api/endpoints/activityLogs';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { Modal } from '../../../components/Modal/Modal';
import { usePermissions } from '../../../rbac/usePermissions';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import type { ActivityLog } from '../../../types/entities/activityLog';

// Confirmed 1:1 against every actual entityType/action pair ever
// passed to ActivityLogService.record() across the backend
// (searched every file that imports it, not just guessed) — a
// value the backend adds later without updating this list still
// shows up in the table and is still filterable by typing/URL,
// it just won't appear as a named option in these two dropdowns
// until this list is updated too.
const ENTITY_TYPE_OPTIONS = [
  'customer', 'lead', 'opportunity', 'quotation', 'project',
  'work_order', 'task', 'employee', 'user', 'role',
];
const ACTION_OPTIONS = [
  'created', 'updated', 'deleted', 'status_changed', 'converted', 'sent', 'expired',
  'contact_added', 'contact_updated', 'contact_removed',
  'member_added', 'member_removed', 'member_role_changed', 'manager_assigned',
  'item_created', 'item_updated', 'item_deleted',
  'linked_user', 'portal_user_created', 'portal_user_linked', 'portal_user_revoked',
  'permissions_assigned', 'role_assigned', 'role_removed', 'permission_granted', 'permission_revoked',
];

/** Every filter lives in the URL: a filtered view can be bookmarked or shared, and other pages can link straight to one record's history (see AuditHistoryLink). */
const FILTER_KEYS = ['entityType', 'action', 'userId', 'entityId', 'from', 'to'] as const;

export function ActivityLogsListPage() {
  const { t, i18n } = useTranslation(['activityLogs', 'common']);
  const [params, setParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ActivityLog | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ kind: 'error' | 'truncated'; text: string } | null>(null);

  const filters: ActivityLogFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined]));
  const setFilter = (key: (typeof FILTER_KEYS)[number], value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    // Changing the record type invalidates a single-record filter.
    if (key === 'entityType') next.delete('entityId');
    setParams(next, { replace: true });
    setPage(1);
  };
  const clearAll = () => { setParams(new URLSearchParams(), { replace: true }); setPage(1); };
  const hasAnyFilter = FILTER_KEYS.some((k) => params.get(k));

  // Filtering by "who" needs the user list, which is its own permission.
  // An auditor without it still gets every other filter.
  const canListUsers = hasPermission(PERMISSIONS.Administration.users.view);
  const { data: usersData } = useAdminUsers({ page: 1, pageSize: 500 }, { enabled: canListUsers });

  const { data, isLoading, error } = useActivityLogs({ page, pageSize: 25, ...filters });

  const runExport = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const { truncated } = await activityLogsApi.exportCsv(filters);
      if (truncated) setExportNote({ kind: 'truncated', text: t('activityLogs:export.truncated') });
    } catch (err) {
      setExportNote({ kind: 'error', text: err instanceof ApiError ? err.message : t('activityLogs:export.error') });
    } finally {
      setExporting(false);
    }
  };

  const columns: Array<DataTableColumn<ActivityLog>> = [
    { key: 'createdAt', headerKey: 'activityLogs:columns.when', render: (l) => new Date(l.createdAt).toLocaleString(i18n.language) },
    { key: 'user', headerKey: 'activityLogs:columns.actor', render: (l) => (l.user ? `${l.user.name} (${l.user.email})` : t('activityLogs:columns.system')) },
    { key: 'action', headerKey: 'activityLogs:columns.action', render: (l) => t(`activityLogs:action.${l.action}`, { defaultValue: l.action }) },
    { key: 'entityType', headerKey: 'activityLogs:columns.entityType', render: (l) => t(`activityLogs:entityType.${l.entityType}`, { defaultValue: l.entityType }) },
    { key: 'summary', headerKey: 'activityLogs:columns.summary', render: (l) => summarize(l, t) },
  ];

  const inputCls = 'rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink';

  return (
    <div>
      <PageHeader
        title={t('activityLogs:title')}
        action={
          <button type="button" onClick={runExport} disabled={exporting} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50">
            {exporting ? t('activityLogs:export.inProgress') : t('activityLogs:export.csv')}
          </button>
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-ink-muted">{t('activityLogs:intro')}</p>
      {exportNote && (
        <p className={`mb-3 text-sm ${exportNote.kind === 'error' ? 'text-danger' : 'text-ink-muted'}`} role={exportNote.kind === 'error' ? 'alert' : undefined}>{exportNote.text}</p>
      )}

      {filters.entityId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-ink">
          <span>{t('activityLogs:filters.singleRecord', { type: t(`activityLogs:entityType.${filters.entityType}`, { defaultValue: filters.entityType ?? '' }) })}</span>
          <button type="button" onClick={() => setFilter('entityId', '')} className="ms-auto text-xs font-medium text-primary hover:underline">{t('activityLogs:filters.showAll')}</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <select value={filters.entityType ?? ''} onChange={(e) => setFilter('entityType', e.target.value)} className={inputCls} aria-label={t('activityLogs:columns.entityType')}>
          <option value="">{t('activityLogs:filters.allEntityTypes')}</option>
          {ENTITY_TYPE_OPTIONS.map((et) => (
            <option key={et} value={et}>{t(`activityLogs:entityType.${et}`, { defaultValue: et })}</option>
          ))}
        </select>
        <select value={filters.action ?? ''} onChange={(e) => setFilter('action', e.target.value)} className={inputCls} aria-label={t('activityLogs:columns.action')}>
          <option value="">{t('activityLogs:filters.allActions')}</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{t(`activityLogs:action.${a}`, { defaultValue: a })}</option>
          ))}
        </select>
        {canListUsers && (
          <select value={filters.userId ?? ''} onChange={(e) => setFilter('userId', e.target.value)} className={inputCls} aria-label={t('activityLogs:columns.actor')}>
            <option value="">{t('activityLogs:filters.allUsers')}</option>
            {(usersData?.items ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1 text-xs text-ink-muted">
          {t('activityLogs:filters.from')}
          <input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => setFilter('from', e.target.value)} className={inputCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-ink-muted">
          {t('activityLogs:filters.to')}
          <input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => setFilter('to', e.target.value)} className={inputCls} />
        </label>
        {hasAnyFilter && (
          <button type="button" onClick={clearAll} className="px-2 py-1.5 text-sm text-primary hover:underline">{t('activityLogs:filters.clear')}</button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(l) => l.id}
        onRowClick={setSelected}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('activityLogs:empty.title')}
        emptyDescription={t('activityLogs:empty.description')}
      />

      <Modal
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        title={selected ? t(`activityLogs:action.${selected.action}`, { defaultValue: selected.action }) : ''}
      >
        {selected && <EntryDetail log={selected} />}
      </Modal>
    </div>
  );
}

/** Values the backend substitutes; shown as explanations, never as if they were real data. */
const HIDDEN = '[hidden]';
const REDACTED = '[redacted]';

function EntryDetail({ log }: { log: ActivityLog }) {
  const { t, i18n } = useTranslation(['activityLogs']);
  const oldV = (log.oldValues ?? {}) as Record<string, unknown>;
  const newV = (log.newValues ?? {}) as Record<string, unknown>;
  const fields = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  const kind = log.oldValues && log.newValues ? 'change' : log.newValues ? 'created' : log.oldValues ? 'removed' : 'none';

  const show = (v: unknown) => {
    if (v === HIDDEN) return <span className="italic text-ink-muted" title={t('activityLogs:detail.hiddenHint')}>{t('activityLogs:detail.hidden')}</span>;
    if (v === REDACTED) return <span className="italic text-ink-muted">{t('activityLogs:detail.redacted')}</span>;
    if (v === undefined) return <span className="text-ink-muted">—</span>;
    if (v === null) return <span className="text-ink-muted">{t('activityLogs:detail.empty')}</span>;
    const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return <span className="break-all">{text}</span>;
  };

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
        <dt className="text-ink-muted">{t('activityLogs:columns.when')}</dt>
        <dd>{new Date(log.createdAt).toLocaleString(i18n.language)}</dd>
        <dt className="text-ink-muted">{t('activityLogs:columns.actor')}</dt>
        <dd>{log.user ? `${log.user.name} (${log.user.email})` : t('activityLogs:columns.system')}</dd>
        <dt className="text-ink-muted">{t('activityLogs:columns.entityType')}</dt>
        <dd>{t(`activityLogs:entityType.${log.entityType}`, { defaultValue: log.entityType })} <span className="text-xs text-ink-muted">({log.entityId})</span></dd>
        <dt className="text-ink-muted">{t('activityLogs:detail.ip')}</dt>
        <dd>{log.ipAddress ?? t('activityLogs:detail.notRecorded')}</dd>
        <dt className="text-ink-muted">{t('activityLogs:detail.browser')}</dt>
        <dd className="break-all text-xs">{log.userAgent ?? t('activityLogs:detail.notRecorded')}</dd>
      </dl>

      {fields.length === 0 ? (
        <p className="text-ink-muted">{t('activityLogs:detail.noFieldData')}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-start text-xs">
            <thead className="bg-surface-muted text-ink-muted">
              <tr>
                <th className="p-2 text-start">{t('activityLogs:detail.field')}</th>
                {kind !== 'created' && <th className="p-2 text-start">{t('activityLogs:detail.before')}</th>}
                {kind !== 'removed' && <th className="p-2 text-start">{t('activityLogs:detail.after')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((f) => (
                <tr key={f}>
                  <td className="p-2 font-medium text-ink">{humanizeField(f)}</td>
                  {kind !== 'created' && <td className="p-2 text-ink">{show(oldV[f])}</td>}
                  {kind !== 'removed' && <td className="p-2 text-ink">{show(newV[f])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {JSON.stringify(log).includes(HIDDEN) && <p className="text-xs text-ink-muted">{t('activityLogs:detail.hiddenHint')}</p>}
    </div>
  );
}

/** "basicSalary" -> "Basic salary". Field names come from the database schema, so they're shown as-is rather than translated. */
function humanizeField(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const IDENTIFYING_FIELDS = [
  'name', 'title', 'status', 'quotationNumber', 'workOrderNumber',
  'projectNumber', 'employeeNumber', 'email', 'roleName', 'permissionString',
];

function summarize(log: ActivityLog, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (log.action === 'role_assigned' && log.newValues && 'roleName' in log.newValues) {
    return t('activityLogs:summary.roleAssigned', { roleName: log.newValues.roleName });
  }
  if (log.action === 'role_removed' && log.oldValues && 'roleName' in log.oldValues) {
    return t('activityLogs:summary.roleRemoved', { roleName: log.oldValues.roleName });
  }
  if (log.action === 'permissions_assigned' && log.newValues && 'permissionIds' in log.newValues) {
    const ids = log.newValues.permissionIds as unknown[];
    return t('activityLogs:summary.permissionsAssigned', { count: ids.length });
  }

  // Updates now store only the fields that changed — name them.
  if (log.oldValues && log.newValues) {
    const changed = Object.keys(log.newValues);
    if (changed.length > 0) {
      const shown = changed.slice(0, 3).map(humanizeField).join(t('activityLogs:summary.listSeparator'));
      return t('activityLogs:summary.fieldsChanged', { fields: shown + (changed.length > 3 ? '…' : '') });
    }
  }

  const source = log.newValues ?? log.oldValues;
  if (source) {
    for (const field of IDENTIFYING_FIELDS) {
      if (field in source && source[field] != null && source[field] !== '') {
        return String(source[field]);
      }
    }
  }
  return '—';
}
