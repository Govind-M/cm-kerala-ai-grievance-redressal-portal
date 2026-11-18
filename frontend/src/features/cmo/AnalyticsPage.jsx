import { useCallback } from 'react';
import { departmentStatistics, districtStatistics } from '../../services/workApi.js';
import { Page, Section, ResourceState } from '../portal/components.jsx';
import { usePortalResource } from '../portal/hooks.js';

export default function AnalyticsPage({ kind }) {
  const load = useCallback((signal) => kind === 'districts' ? districtStatistics(signal) : departmentStatistics(signal), [kind]);
  const resource = usePortalResource(load, `analytics:${kind}`);
  return <Page title={kind === 'districts' ? 'District analytics' : 'Department analytics'} intro="Database aggregates across authorized statewide records, not totals extrapolated from a list page."><Section title="Workload and resolution"><ResourceState resource={resource}>{(rows) => rows.length ? <ul className="space-y-5">{rows.map((r) => <li key={r.district ?? r.department_id ?? 'unassigned'} className="space-y-2 border-b border-slate-100 pb-4"><h3 className="text-base">{r.district ?? r.department_name}</h3><p className="text-sm text-slate-600">{r.total} total · {r.pending} pending · {r.resolved} resolved · {r.overdue} overdue</p><meter aria-label={`${r.district ?? r.department_name} resolved proportion`} min={0} max={Math.max(1, r.total)} value={r.resolved} className="h-3 w-full accent-teal-600" /><p className="text-xs text-slate-500">Resolved share: {r.total ? `${Math.round(r.resolved / r.total * 100)}%` : 'No cases'}</p></li>)}</ul> : <p>No aggregate records available.</p>}</ResourceState></Section><Section title="Reporting availability"><p className="text-sm text-slate-500">Time-series trends, priority aggregates, resolution-duration metrics and report export endpoints are not available. No estimated values or simulated export are shown.</p></Section></Page>;
}
