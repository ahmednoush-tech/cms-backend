export type TimelineEventSource = 'interaction' | 'activity';

export interface TimelineEvent {
  id: string;
  source: TimelineEventSource;
  date: string;
  title: string;
  description: string | null;
  /** Only set for source: 'interaction' — call | meeting | email | note | other. */
  interactionType: string | null;
  createdByUserId: string | null;
}
