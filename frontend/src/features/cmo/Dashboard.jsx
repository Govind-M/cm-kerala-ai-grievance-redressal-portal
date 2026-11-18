import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { workStatistics, workList, reportList, departmentStatistics } from '../../services/workApi.js';
import { Page, ResourceState, Stats, Section, CaseTable } from '../portal/components.jsx';
import { usePortalResource } from '../portal/hooks.js';

export default function CMODashboard() {
  const load = useCallback(async (signal) => {
    const [stats, recent, reports, departments] = await Promise.all([workStatistics('cmo', signal), workList('cmo', { page: 1, page_size: 5, sort_by: 'updated_at' }, signal), reportList({ page: 1, page_size: 1, review_status: 'PENDING' }, signal), departmentStatistics(signal)]);
    return { stats, recent, reports, departments };
  }, []);
  const resource = usePortalResource(load, 'cmo-dashboard');
  return <Page title="CMO control center" intro="Statewide workload and official decisions. AI recommendations never replace your review."><ResourceState resource={resource}>{({ stats: s, recent, reports, departments }) => <><Stats entries={[[ 'Total grievances', s.total ], ['Awaiting review', s.submitted], ['Under review', s.under_review], ['Unassigned', departments.find((d) => d.department_id === null)?.total ?? 'Unavailable'], ['Active investigations', s.in_progress], ['Awaiting report decision', reports.pagination.total_items], ['Resolved', s.resolved], ['Overdue', s.overdue]]} /><Section title="Status distribution"><div className="space-y-3">{['submitted', 'under_review', 'in_progress', 'resolved', 'reopened'].map((key) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-3 text-sm"><span>{key.replaceAll('_', ' ')}</span><meter aria-label={key.replaceAll('_', ' ')} className="w-full accent-teal-600" min={0} max={Math.max(1, s.total)} value={s[key]} /><span>{s[key]}</span></div>)}</div></Section><Section title="Recently updated cases"><CaseTable role="cmo" items={recent.items} /></Section><Section title="Department workload"><ul className="grid gap-3 sm:grid-cols-2">{departments.map((d) => <li key={d.department_id ?? 'unassigned'} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{d.department_name}</p><p>{d.total} total · {d.pending} pending · {d.resolved} resolved</p></li>)}</ul><Link to="/cmo/analytics/districts" className="text-teal-700 underline">View district analytics</Link></Section><p className="text-xs text-slate-500">Escalation counts and statewide activity feeds are not exposed as aggregates. Escalations are available on individual cases; recently updated cases are not an audit-event feed.</p></>}</ResourceState></Page>;
}
