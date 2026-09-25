import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useReportsMetadata,
  useReportDefinition,
  useCreateReportDefinition,
  useUpdateReportDefinition,
  usePreviewReport,
} from '../../../api/queries/useCustomReports';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { SimpleBarChart } from '../../../components/charts/SimpleBarChart';
import { SimpleLineChart } from '../../../components/charts/SimpleLineChart';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';
import type { ReportAggregateType, ReportChartType, ReportFilter, ReportResultPoint } from '../../../types/entities/report';

export function CustomReportBuilderPage() {
  const { t } = useTranslation(['reports', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: metadata, isLoading: metadataLoading } = useReportsMetadata();
  const { data: existing } = useReportDefinition(isNew ? undefined : id);
  const createMutation = useCreateReportDefinition();
  const updateMutation = useUpdateReportDefinition();
  const previewMutation = usePreviewReport();

  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [groupByField, setGroupByField] = useState('');
  const [aggregateType, setAggregateType] = useState<ReportAggregateType>('count');
  const [aggregateField, setAggregateField] = useState('');
  const [chartType, setChartType] = useState<ReportChartType>('bar');
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [previewResult, setPreviewResult] = useState<ReportResultPoint[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setEntityType(existing.entityType);
      setGroupByField(existing.groupByField);
      setAggregateType(existing.aggregateType);
      setAggregateField(existing.aggregateField ?? '');
      setChartType(existing.chartType);
      setFilters(existing.filters);
    }
  }, [existing]);

  const entityConfig = metadata && entityType ? metadata[entityType] : undefined;

  const handleEntityChange = (newEntityType: string) => {
    setEntityType(newEntityType);
    setGroupByField('');
    setAggregateField('');
    setFilters([]);
    setPreviewResult(null);
  };

  const buildInput = () => ({
    name,
    entityType,
    groupByField,
    aggregateType,
    aggregateField: aggregateType === 'sum' ? aggregateField : undefined,
    chartType,
    filters,
  });

  const handlePreview = () => {
    setFormError(null);
    previewMutation.mutate(buildInput(), {
      onSuccess: (result) => setPreviewResult(result),
      onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
    });
  };

  const handleSave = () => {
    setFormError(null);
    const input = buildInput();
    const onSuccess = () => navigate('/analytics/custom-reports');
    const onError = (err: unknown) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');

    if (isNew) {
      createMutation.mutate(input, { onSuccess, onError });
    } else if (id) {
      updateMutation.mutate({ id, input }, { onSuccess, onError });
    }
  };

  const canPreview = !!entityType && !!groupByField && (aggregateType === 'count' || !!aggregateField);

  if (metadataLoading) return <LoadingState />;

  return (
    <div>
      <button type="button" onClick={() => navigate('/analytics/custom-reports')} className="mb-3 text-sm text-ink-muted hover:text-ink">
        ← {t('common:action.back')}
      </button>

      <PageHeader title={isNew ? t('reports:action.new') : t('reports:action.edit')} />

      <div className="max-w-xl space-y-4">
        <FormField label={t('reports:fields.name')} htmlFor="reportName" required>
          <TextInput id="reportName" value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('reports:fields.entityType')}</label>
          <select value={entityType} onChange={(e) => handleEntityChange(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {metadata && Object.entries(metadata).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {entityConfig && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('reports:fields.groupByField')}</label>
              <select value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">—</option>
                {entityConfig.groupByFields.map((f) => (
                  <option key={f.field} value={f.field}>{f.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('reports:fields.aggregateType')}</label>
              <select
                value={aggregateType}
                onChange={(e) => {
                  setAggregateType(e.target.value as ReportAggregateType);
                  setAggregateField('');
                }}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="count">{t('reports:aggregateType.count')}</option>
                {entityConfig.sumFields.length > 0 && <option value="sum">{t('reports:aggregateType.sum')}</option>}
              </select>
            </div>

            {aggregateType === 'sum' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">{t('reports:fields.aggregateField')}</label>
                <select value={aggregateField} onChange={(e) => setAggregateField(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">—</option>
                  {entityConfig.sumFields.map((f) => (
                    <option key={f.field} value={f.field}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('reports:fields.chartType')}</label>
              <div className="flex gap-2">
                {(['bar', 'line', 'table'] as ReportChartType[]).map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setChartType(ct)}
                    className={`rounded border px-3 py-1.5 text-sm font-medium ${chartType === ct ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink-muted hover:bg-surface-muted'}`}
                  >
                    {t(`reports:chartType.${ct}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {formError && <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!canPreview || previewMutation.isPending}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            {previewMutation.isPending ? t('common:action.processing') : t('reports:action.preview')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canPreview || !name || createMutation.isPending || updateMutation.isPending}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {t('common:action.save')}
          </button>
        </div>
      </div>

      {previewResult && (
        <div className="mt-6 max-w-2xl rounded-lg border border-border p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('reports:previewTitle')}</p>
          {previewResult.length === 0 && <p className="text-sm text-ink-muted">{t('reports:noData')}</p>}
          {previewResult.length > 0 && chartType === 'bar' && <SimpleBarChart bars={previewResult} />}
          {previewResult.length > 0 && chartType === 'line' && <SimpleLineChart points={previewResult} />}
          {previewResult.length > 0 && chartType === 'table' && (
            <table className="w-full text-start text-sm">
              <tbody className="divide-y divide-border">
                {previewResult.map((point) => (
                  <tr key={point.label}>
                    <td className="py-1.5 text-ink">{point.label}</td>
                    <td className="py-1.5 text-end font-medium text-ink">{point.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
