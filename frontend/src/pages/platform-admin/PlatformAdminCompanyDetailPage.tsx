import { useParams, useNavigate } from 'react-router-dom';
import { usePlatformAdminCompanyDetail } from '../../api/queries/usePlatformAdminCompanies';
import { ApiError } from '../../api/client';

export function PlatformAdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading, error } = usePlatformAdminCompanyDetail(id);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 px-6 py-4">
        <button type="button" onClick={() => navigate('/platform-admin/companies')} className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to companies
        </button>
      </div>

      <div className="p-6">
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {error && (
          <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300" role="alert">
            {error instanceof ApiError ? error.message : 'Something went wrong.'}
          </p>
        )}

        {company && (
          <>
            <h1 className="text-xl font-semibold">{company.name}</h1>
            {company.legalName && <p className="mt-1 text-sm text-slate-400">{company.legalName}</p>}
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${company.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                {company.status}
              </span>
              <span>Signed up {new Date(company.createdAt).toLocaleDateString()}</span>
              {company.email && <span>{company.email}</span>}
            </div>

            <p className="mb-3 mt-8 text-sm font-medium text-slate-300">Usage</p>
            <div className="grid grid-cols-4 gap-3">
              <UsageStat label="Users" value={company.usage.userCount} />
              <UsageStat label="Employees" value={company.usage.employeeCount} />
              <UsageStat label="Customers" value={company.usage.customerCount} />
              <UsageStat label="Leads" value={company.usage.leadCount} />
              <UsageStat label="Opportunities" value={company.usage.opportunityCount} />
              <UsageStat label="Invoices" value={company.usage.invoiceCount} />
              <UsageStat label="Projects" value={company.usage.projectCount} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
