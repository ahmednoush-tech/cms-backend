import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { THEME_PRESETS } from '../../config/themePresets';

/**
 * A personal, per-browser preference (see themeStorage.ts —
 * localStorage, not synced to the account or company). Every
 * preset keeps Mizan's own name/logo unchanged; only the
 * primary/secondary color variables change (see config/theme.ts).
 */
export function ThemeSwitcher() {
  const { t } = useTranslation(['common']);
  const { themeId, setThemeId } = useTheme();

  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-xs font-medium text-ink-muted">{t('common:themes.label')}</p>
      <div className="flex gap-2">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setThemeId(preset.id)}
            title={t(`common:themes.${preset.labelKey}`)}
            aria-label={t(`common:themes.${preset.labelKey}`)}
            aria-pressed={themeId === preset.id}
            className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform hover:scale-110 ${
              themeId === preset.id ? 'border-ink' : 'border-transparent'
            }`}
            style={{ backgroundColor: `rgb(${preset.primaryColorRgb})` }}
          />
        ))}
      </div>
    </div>
  );
}
