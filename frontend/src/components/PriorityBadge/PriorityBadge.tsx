import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { getPriorityColor, getPriorityLabelKey } from '../StatusBadge/statusMap';

interface PriorityBadgeProps {
  value: string;
}

/** Shared low/medium/high/urgent enum, identical across Work Orders and Tasks (confirmed against both backend filter DTOs). */
export function PriorityBadge({ value }: PriorityBadgeProps) {
  const { t } = useTranslation('common');
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        getPriorityColor(value),
      )}
    >
      {t(getPriorityLabelKey(value))}
    </span>
  );
}
