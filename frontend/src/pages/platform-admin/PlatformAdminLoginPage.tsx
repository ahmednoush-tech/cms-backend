import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformAdminAuth } from '../../auth/usePlatformAdminAuth';
import { ApiError } from '../../api/client';

/**
 * Deliberately styled differently from the tenant LoginPage (dark
 * background, no Mizan customer-facing branding) — this is an
 * internal ops tool, and looking visually distinct helps prevent
 * anyone from mistaking it for (or phishing it as) the real
 * customer-facing login.
 */
export function PlatformAdminLoginPage() {
  const { login } = usePlatformAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/platform-admin/companies', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800 p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Internal Only</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-100">Mizan Platform Admin</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          {error && <p className="mb-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
