import { useNavigate } from 'react-router-dom';
import { usePlatformAdminCompanies } from '../../api/queries/usePlatformAdminCompanies';
import { usePlatformAdminAuth } from '../../auth/usePlatformAdminAuth';
import { ApiError } from '../../api/client';

export function PlatformAdminCompaniesListPage() {
  const { data: companies, isLoading, error } = usePlatformAdminCompanies();
  const { logout } = usePlatformAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/platform-admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Internal Only</p>
          <h1 className="text-lg font-semibold">Mizan Platform Admin — Companies</h1>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/platform-admin/settings')} className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Product Settings
          </button>
          <button type="button" onClick={handleLogout} className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Sign out
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {error && (
          <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300" role="alert">
            {error instanceof ApiError ? error.message : 'Something went wrong.'}
          </p>
        )}

        {companies && (
          <>
            <p className="mb-4 text-sm text-slate-400">{companies.length} companies on the platform</p>
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Company</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Signed up</th>
                    <th className="p-3 text-left">Users</th>
                    <th className="p-3 text-left">Employees</th>
                    <th className="p-3 text-left">Customers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {companies.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/platform-admin/companies/${c.id}`)}
                      className="cursor-pointer hover:bg-slate-800"
                    >
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="p-3">{c.userCount}</td>
                      <td className="p-3">{c.employeeCount}</td>
                      <td className="p-3">{c.customerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
