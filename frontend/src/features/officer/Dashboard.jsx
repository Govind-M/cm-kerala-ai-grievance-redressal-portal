import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { workList, workStatistics } from '../../services/workApi.js';
import { Page, Section, ResourceState, CaseTable, Stats } from '../portal/components.jsx';
import { usePortalResource } from '../portal/hooks.js';

export default function OfficerDashboard() {
  const load = useCallback(async (signal) => { const [stats, recent] = await Promise.all([workStatistics('officer', signal), workList('officer', { page: 1, page_size: 5, sort_by: 'updated_at', sort_order: 'desc' }, signal)]); return { stats, recent }; }, []);
  const resource = usePortalResource(load, 'officer-dashboard');
  return <Page title="Investigation dashboard" intro="Your department's current authorized workload and investigations."><ResourceState resource={resource}>{({ stats: s, recent }) => <><Stats entries={[[ 'Department active', s.department_active ], ['Assigned to me', s.assigned_to_me], ['Department pool', s.unassigned_to_officer], ['In progress', s.in_progress], ['Reports awaiting CMO', s.reports_pending_review], ['Overdue', s.overdue], ['Reopened', s.reopened], ['Pending cases', s.pending]]} /><Section title="Recently updated department cases"><CaseTable role="officer" items={recent.items} /><Link className="text-sm text-teal-700 underline" to="/officer/grievances/assigned-to-me">Open my assignments</Link></Section><Section title="Investigation guidance"><p className="text-sm text-slate-500">A department-pool case may be updated by an eligible officer. When an individual is assigned, other department officers have read-only access. Report submission never resolves a grievance; CMO must accept it.</p><p className="text-sm text-slate-500">Assignment-date ordering, returned/submitted report aggregates and a global officer report queue are not exposed. Review report status in each authorized case.</p></Section></>}</ResourceState></Page>;
}
