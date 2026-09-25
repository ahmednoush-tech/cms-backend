import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { getStatusLabelKey, getStatusColor, type StatusEntity } from './statusMap';

interface StatusBadgeProps {
  entity: StatusEntity;
  value: string;
}

/**
 * Never displays a raw backend enum value (e.g. "in_progress")
 * directly — always resolves through statusMap.ts, per the design
 * doc's explicit "do not translate database values blindly"
 * requirement (section G). Color-coding is keyed by entity+value
 * together, since the same raw value can reasonably mean a
 * different visual weight on different entities.
 */
export function StatusBadge({ entity, value }: StatusBadgeProps) {
  const { t } = useTranslation('common');
  const colorClass = getStatusColor(entity, value);

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClass,
      )}
    >
      {t(getStatusLabelKey(entity, value))}
    </span>
  );
}
