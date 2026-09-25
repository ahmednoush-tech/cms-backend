import { useTranslation } from 'react-i18next';
import type { GanttTask } from '../../types/entities/task';
import {
  computeDateRange,
  computeBarPosition,
  computeWeekTicks,
  computeTodayOffsetPx,
  DAY_WIDTH_PX,
  ROW_HEIGHT_PX,
} from './ganttLayout';

const LABEL_WIDTH_PX = 180;
const HEADER_HEIGHT_PX = 28;

const STATUS_BAR_COLOR: Record<GanttTask['status'], string> = {
  pending: 'bg-ink-muted/50',
  in_progress: 'bg-primary',
  completed: 'bg-success',
  cancelled: 'bg-danger/50',
};

interface GanttChartProps {
  tasks: GanttTask[];
  projectStartDate: string | null;
  projectEndDate: string | null;
}

export function GanttChart({ tasks, projectStartDate, projectEndDate }: GanttChartProps) {
  const { t } = useTranslation(['projects', 'common']);

  const range = computeDateRange(tasks, projectStartDate, projectEndDate);

  if (!range) {
    return <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-ink-muted">{t('projects:gantt.noDatesYet')}</p>;
  }

  const totalDays = Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const timelineWidthPx = Math.max(totalDays * DAY_WIDTH_PX, 200);
  const weekTicks = computeWeekTicks(range.start, range.end);
  const todayOffsetPx = computeTodayOffsetPx(range.start);

  const positioned = tasks.map((task) => ({ task, position: computeBarPosition(task, range.start) }));
  const scheduled = positioned.filter((p) => p.position !== null) as Array<{ task: GanttTask; position: NonNullable<ReturnType<typeof computeBarPosition>> }>;
  const unscheduled = positioned.filter((p) => p.position === null).map((p) => p.task);

  const rowIndexByTaskId = new Map(scheduled.map((s, i) => [s.task.id, i]));
  const bodyHeightPx = scheduled.length * ROW_HEIGHT_PX;

  const dependencyLines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
  for (const { task, position } of scheduled) {
    const depRowIndex = rowIndexByTaskId.get(task.id)!;
    for (const dep of task.dependencies) {
      const predEntry = scheduled.find((s) => s.task.id === dep.dependsOnTaskId);
      if (!predEntry) continue;
      const predRowIndex = rowIndexByTaskId.get(predEntry.task.id)!;
      dependencyLines.push({
        id: dep.id,
        x1: LABEL_WIDTH_PX + predEntry.position.leftPx + predEntry.position.widthPx,
        y1: predRowIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2,
        x2: LABEL_WIDTH_PX + position.leftPx,
        y2: depRowIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2,
      });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_WIDTH_PX + timelineWidthPx }}>
          <div className="flex border-b border-border" style={{ height: HEADER_HEIGHT_PX }}>
            <div style={{ width: LABEL_WIDTH_PX }} className="shrink-0 border-e border-border px-2 py-1 text-xs font-medium text-ink-muted">
              {t('projects:gantt.task')}
            </div>
            <div className="relative" style={{ width: timelineWidthPx }}>
              {weekTicks.map((tick) => (
                <div
                  key={tick.date.toISOString()}
                  className="absolute top-0 border-s border-border ps-1 text-xs text-ink-muted"
                  style={{ left: tick.leftPx }}
                >
                  {tick.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>
          </div>

          {scheduled.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">{t('projects:gantt.noScheduledTasks')}</p>
          ) : (
            <div className="relative" style={{ height: bodyHeightPx }}>
              <svg className="pointer-events-none absolute start-0 top-0" width={LABEL_WIDTH_PX + timelineWidthPx} height={bodyHeightPx}>
                <defs>
                  <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" className="fill-ink-muted" />
                  </marker>
                </defs>
                {dependencyLines.map((line) => (
                  <line key={line.id} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} className="stroke-ink-muted" strokeWidth={1.5} markerEnd="url(#gantt-arrow)" />
                ))}
              </svg>

              {todayOffsetPx !== null && (
                <div
                  className="pointer-events-none absolute top-0 border-s-2 border-danger"
                  style={{ left: LABEL_WIDTH_PX + todayOffsetPx, height: bodyHeightPx }}
                  title={t('projects:gantt.today')}
                />
              )}

              {scheduled.map(({ task, position }, index) => (
                <div
                  key={task.id}
                  className="absolute flex items-center border-b border-border"
                  style={{ top: index * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX, width: LABEL_WIDTH_PX + timelineWidthPx }}
                >
                  <div style={{ width: LABEL_WIDTH_PX }} className="shrink-0 truncate border-e border-border px-2 text-sm text-ink" title={task.title}>
                    {task.title}
                  </div>
                  <div className="relative h-full flex-1">
                    <div
                      className={`absolute rounded ${STATUS_BAR_COLOR[task.status]} ${position.isPartial ? 'border-2 border-dashed border-ink-muted' : ''}`}
                      style={{ left: position.leftPx, width: position.widthPx, top: 8, height: ROW_HEIGHT_PX - 16 }}
                      title={position.isPartial ? t('projects:gantt.partialDateWarning') : task.title}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="border-t border-border p-3">
          <p className="mb-1 text-xs font-medium text-ink-muted">{t('projects:gantt.unscheduledTasks')}</p>
          <ul className="text-sm text-ink">
            {unscheduled.map((task) => (
              <li key={task.id}>• {task.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
