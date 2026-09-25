import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../../types/entities/crmTimeline';

const INTERACTION_TYPE_COLOR: Record<string, string> = {
  call: 'bg-primary',
  meeting: 'bg-success',
  email: 'bg-warning',
  note: 'bg-ink-muted',
  other: 'bg-ink-muted',
};
const ACTIVITY_COLOR = 'bg-ink-muted/50';

interface CrmTimelineProps {
  events: TimelineEvent[];
}

/** Dependency-free, matching SimpleBarChart/SimpleLineChart's rationale. */
export function CrmTimeline({ events }: CrmTimelineProps) {
  const { t } = useTranslation(['crmTimeline', 'interactions', 'common']);

  if (events.length === 0) {
    return <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-ink-muted">{t('crmTimeline:empty')}</p>;
  }

  return (
    <div className="relative">
      {events.map((event, index) => (
        <div key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
          {index < events.length - 1 && (
            <div className="absolute start-[5px] top-3 h-full w-px bg-border" aria-hidden="true" />
          )}

          <div
            className={`relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ${event.source === 'interaction' ? INTERACTION_TYPE_COLOR[event.interactionType ?? 'other'] : ACTIVITY_COLOR}`}
            title={event.source === 'interaction' ? t(`interactions:type.${event.interactionType}`) : t('crmTimeline:activityEvent')}
          />

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink">{event.title}</p>
              {event.source === 'interaction' && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                  {t(`interactions:type.${event.interactionType}`)}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted">{new Date(event.date).toLocaleString()}</p>
            {event.description && <p className="mt-1 text-sm text-ink-muted">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
