import { PageHeader } from '../../components/PageHeader/PageHeader';
import { EmptyState } from '../../components/EmptyState/EmptyState';

interface ComingSoonPageProps {
  title: string;
  phase: string;
}

/**
 * Per the explicit Phase 3A instruction: "Do not start Dashboard,
 * CRM, Operations, or Administration UI yet." Every route for
 * those modules exists in routeMap.ts (so the Sidebar shows real,
 * correctly permission-gated navigation from day one) but renders
 * this placeholder instead of real business functionality — no
 * business logic, no API calls to any CRM/Operations/Dashboard
 * endpoint happens on this page.
 */
export function ComingSoonPage({ title, phase }: ComingSoonPageProps) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        title="Coming soon"
        description={`This section will be built in ${phase}. The navigation, routing, and permission checks for it are already in place.`}
      />
    </div>
  );
}
