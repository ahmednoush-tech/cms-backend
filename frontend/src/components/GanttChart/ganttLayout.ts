export interface GanttLayoutTask {
  id: string;
  startDate: string | null;
  dueDate: string | null;
}

export interface GanttBarPosition {
  taskId: string;
  leftPx: number;
  widthPx: number;
  /** True when only ONE of startDate/dueDate was set — the bar shown is a best-effort 1-day placeholder, not a real range. */
  isPartial: boolean;
}

export const DAY_WIDTH_PX = 32;
export const ROW_HEIGHT_PX = 40;

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

/**
 * The overall timeline bounds — the earliest of any task's
 * startDate/the project's own startDate, to the latest of any
 * task's dueDate/the project's own endDate. Returns null when
 * NOTHING has a date anywhere.
 */
export function computeDateRange(
  tasks: GanttLayoutTask[],
  projectStartDate: string | null,
  projectEndDate: string | null,
): { start: Date; end: Date } | null {
  const dates: Date[] = [];
  for (const t of tasks) {
    if (t.startDate) dates.push(new Date(t.startDate));
    if (t.dueDate) dates.push(new Date(t.dueDate));
  }
  if (projectStartDate) dates.push(new Date(projectStartDate));
  if (projectEndDate) dates.push(new Date(projectEndDate));
  if (dates.length === 0) return null;

  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

/**
 * Returns null for a task with NEITHER startDate nor dueDate — it
 * genuinely cannot be placed on a timeline and the caller should
 * list it separately as "unscheduled". A task with only ONE of the
 * two dates gets a 1-day placeholder bar at that date, flagged via
 * `isPartial` so the renderer can style it distinctly rather than
 * presenting a guess as a confirmed range.
 */
export function computeBarPosition(task: GanttLayoutTask, rangeStart: Date): GanttBarPosition | null {
  const hasStart = !!task.startDate;
  const hasDue = !!task.dueDate;
  if (!hasStart && !hasDue) return null;

  const startDate = hasStart ? new Date(task.startDate!) : new Date(task.dueDate!);
  const dueDate = hasDue ? new Date(task.dueDate!) : new Date(task.startDate!);

  const leftDays = daysBetween(rangeStart, startDate);
  const durationDays = Math.max(1, daysBetween(startDate, dueDate) + 1);

  return {
    taskId: task.id,
    leftPx: leftDays * DAY_WIDTH_PX,
    widthPx: durationDays * DAY_WIDTH_PX,
    isPartial: !hasStart || !hasDue,
  };
}

/** Week-start tick marks for the timeline header, from rangeStart to rangeEnd inclusive. */
export function computeWeekTicks(rangeStart: Date, rangeEnd: Date): Array<{ date: Date; leftPx: number }> {
  const ticks: Array<{ date: Date; leftPx: number }> = [];
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  for (let day = 0; day <= totalDays; day += 7) {
    const date = new Date(rangeStart);
    date.setDate(date.getDate() + day);
    ticks.push({ date, leftPx: day * DAY_WIDTH_PX });
  }
  return ticks;
}

export function computeTodayOffsetPx(rangeStart: Date): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const offsetDays = daysBetween(start, today);
  if (offsetDays < 0) return null;
  return offsetDays * DAY_WIDTH_PX;
}
