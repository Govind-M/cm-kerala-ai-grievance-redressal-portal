import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listMine, myStatistics } from '../../services/grievanceApi.js';
import { CaseTable, Page, ResourceState, Section, Stats } from '../portal/components.jsx';
import { usePortalResource } from '../portal/hooks.js';

export default function CitizenDashboard() {
  const load = useCallback(async (signal) => { const [stats, recent] = await Promise.all([myStatistics(signal), listMine({ page: 1, page_size: 5 }, signal)]); return { stats, recent }; }, []);
  const resource = usePortalResource(load, 'citizen-dashboard');
  return <Page title="Citizen dashboard" intro="Your grievances, progress and next steps." action={<Link className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white" to="/citizen/submit">Submit a grievance</Link>}><ResourceState resource={resource}>{({ stats, recent }) => <><Stats entries={[[ 'Total submitted', stats.total ], ['Pending', stats.pending], ['Under review', stats.by_status?.UNDER_REVIEW ?? 0], ['In progress', stats.by_status?.IN_PROGRESS ?? 0], ['Resolved', stats.resolved], ['Reopened', stats.by_status?.REOPENED ?? 0]]} /><Section title="Recent grievances"><CaseTable items={recent.items} role="citizen" /><Link to="/citizen/grievances" className="text-sm text-teal-700 underline">View all my grievances</Link></Section></>}</ResourceState><Section title="Quick links"><Link className="text-teal-700 underline" to="/citizen/track">Track a reference</Link><p className="text-sm text-slate-500">Updates appear in your grievance timeline. The backend does not provide a notifications inbox.</p></Section></Page>;
}
