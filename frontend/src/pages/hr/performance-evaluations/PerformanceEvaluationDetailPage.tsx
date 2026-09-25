import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePerformanceEvaluation,
  usePerformanceCriteria,
  useUpdatePerformanceEvaluation,
  useFinalizePerformanceEvaluation,
} from '../../../api/queries/usePerformanceEvaluation';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function PerformanceEvaluationDetailPage() {
  const { t } = useTranslation(['hr', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: evaluation, isLoading, error } = usePerformanceEvaluation(id);
  const { data: criteria } = usePerformanceCriteria();
  const updateMutation = useUpdatePerformanceEvaluation();
  const finalizeMutation = useFinalizePerformanceEvaluation();

  const [scoresByCriterion, setScoresByCriterion] = useState<Record<string, { score: number; comments: string }>>({});
  const [overallComments, setOverallComments] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (evaluation) {
      setOverallComments(evaluation.overallComments ?? '');
      const map: Record<string, { score: number; comments: string }> = {};
      for (const s of evaluation.scores ?? []) {
        map[s.criterionId] = { score: s.score, comments: s.comments ?? '' };
      }
      setScoresByCriterion(map);
    }
  }, [evaluation]);

  const isDraft = evaluation?.status === 'draft';

  const setScore = (criterionId: string, score: number) => {
    setScoresByCriterion((prev) => ({ ...prev, [criterionId]: { score, comments: prev[criterionId]?.comments ?? '' } }));
  };
  const setComments = (criterionId: string, comments: string) => {
    setScoresByCriterion((prev) => ({ ...prev, [criterionId]: { score: prev[criterionId]?.score ?? 0, comments } }));
  };

  const handleSave = () => {
    if (!id) return;
    setActionError(null);
    const scores = Object.entries(scoresByCriterion)
      .filter(([, v]) => v.score > 0)
      .map(([criterionId, v]) => ({ criterionId, score: v.score, comments: v.comments || undefined }));
    updateMutation.mutate(
      { id, input: { overallComments: overallComments || undefined, scores } },
      { onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.') },
    );
  };

  const handleFinalize = () => {
    if (!id) return;
    setActionError(null);
    finalizeMutation.mutate(id, {
      onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.'),
    });
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error instanceof ApiError ? error.message : undefined} />;
  if (!evaluation) return null;

  return (
    <div>
      <button type="button" onClick={() => navigate(-1)} className="mb-3 text-sm text-ink-muted hover:text-ink">
        ← {t('common:action.back')}
      </button>

      <PageHeader
        title={`${evaluation.employee?.firstName} ${evaluation.employee?.lastName}`}
        breadcrumb={evaluation.cycle?.name}
      />

      <div className="mb-4 flex items-center gap-3 text-sm text-ink-muted">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${evaluation.status === 'finalized' ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-muted'}`}>
          {t(`hr:performanceEvaluations.status.${evaluation.status}`)}
        </span>
        {evaluation.overallRating && <span>{t('hr:performanceEvaluations.fields.overallRating')}: <strong className="text-ink">{evaluation.overallRating}</strong> / 5</span>}
      </div>

      <div className="mb-4 space-y-3">
        {(criteria ?? []).map((criterion) => {
          const current = scoresByCriterion[criterion.id];
          return (
            <div key={criterion.id} className="rounded-lg border border-border p-3">
              <p className="font-medium text-ink">{criterion.name}</p>
              {criterion.description && <p className="mb-2 text-xs text-ink-muted">{criterion.description}</p>}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!isDraft}
                    onClick={() => setScore(criterion.id, n)}
                    className={`h-8 w-8 rounded-full border text-sm font-medium ${
                      current?.score === n ? 'border-primary bg-primary text-primary-fg' : 'border-border text-ink-muted hover:bg-surface-muted'
                    } disabled:cursor-not-allowed`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {isDraft ? (
                <input
                  type="text"
                  placeholder={t('hr:performanceEvaluations.fields.criterionComments')}
                  value={current?.comments ?? ''}
                  onChange={(e) => setComments(criterion.id, e.target.value)}
                  className="mt-2 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-ink"
                />
              ) : (
                current?.comments && <p className="mt-2 text-sm text-ink-muted">{current.comments}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:performanceEvaluations.fields.overallComments')}</label>
        <textarea
          disabled={!isDraft}
          value={overallComments}
          onChange={(e) => setOverallComments(e.target.value)}
          rows={3}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink disabled:bg-surface-muted"
        />
      </div>

      {actionError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      {isDraft && (
        <PermissionGate requires={PERMISSIONS.HR.performanceEvaluations.create}>
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={updateMutation.isPending} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50">
              {t('common:action.save')}
            </button>
            <PermissionGate requires={PERMISSIONS.HR.performanceEvaluations.finalize}>
              <button type="button" onClick={handleFinalize} disabled={finalizeMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
                {t('hr:performanceEvaluations.action.finalize')}
              </button>
            </PermissionGate>
          </div>
        </PermissionGate>
      )}
    </div>
  );
}
