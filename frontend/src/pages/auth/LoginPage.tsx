import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../api/client';
import { FormField, TextInput } from '../../components/Form/FormField';
import { getBrandingConfig } from '../../config/branding';
import { usePlatformSettingsPublic } from '../../api/queries/usePlatformSettings';

const loginSchema = z.object({
  email: z.string().min(1, 'validation.required').email('validation.email'),
  // Mirrors the backend's MinLength(8) on LoginDto — confirmed
  // this session — but this is a client-side convenience only;
  // the backend independently re-validates on every request.
  password: z.string().min(8, 'validation.minLength'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const branding = getBrandingConfig();
  const { data: platformSettings } = usePlatformSettingsPublic();

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        // Backend returns the same generic message for unknown
        // email vs. wrong password (no user enumeration, confirmed
        // this session) — locked/inactive get distinct 403s.
        if (err.message.toLowerCase().includes('locked')) {
          setSubmitError(t('auth:login.accountLocked'));
        } else if (err.status === 403) {
          setSubmitError(t('auth:login.accountInactive'));
        } else {
          setSubmitError(t('auth:login.invalidCredentials'));
        }
      } else {
        setSubmitError(t('common:error.generic'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={platformSettings?.logoUrl ?? branding.logoUrl} alt={platformSettings?.productName ?? t('common:productName')} className="h-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h1 className="text-lg font-semibold text-ink">{t('auth:login.title')}</h1>
          <p className="text-sm text-ink-muted">{t('auth:login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label={t('auth:login.email')} htmlFor="email" required error={errors.email && t(`common:${errors.email.message}`)}>
            <TextInput id="email" type="email" autoComplete="email" hasError={!!errors.email} {...register('email')} />
          </FormField>

          <FormField label={t('auth:login.password')} htmlFor="password" required error={errors.password && t(`common:${errors.password.message}`)}>
            <div className="relative">
              <TextInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                hasError={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 end-2 text-xs text-ink-muted hover:text-ink"
                aria-label={showPassword ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
              >
                {showPassword ? t('auth:login.hidePassword') : t('auth:login.showPassword')}
              </button>
            </div>
          </FormField>

          <div className="mb-4 text-end">
            <Link to="/forgot-password" className="text-xs text-ink-muted hover:text-ink hover:underline">
              {t('auth:login.forgotPassword')}
            </Link>
          </div>

          {submitError && (
            <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? t('common:action.processing') : t('auth:login.submit')}
          </button>

          <p className="mt-4 text-center text-xs text-ink-muted">
            {t('auth:login.noAccount')}{' '}
            <Link to="/signup" className="text-ink hover:underline">
              {t('auth:login.signUpLink')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
