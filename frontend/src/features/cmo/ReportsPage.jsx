import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../../components/ui/index.jsx';
import { reportList } from '../../services/workApi.js';
import { Page, Section, ResourceState, Select, Pagination } from '../portal/components.jsx';
import { date, UUID_PATTERN } from '../portal/contracts.js';
import { usePortalResource } from '../portal/hooks.js';

export default function ReportsPage() {
  const [draft, setDraft] = useState({ review_status: 'PENDING', reference: '', department_id: '', sort_order: 'desc' });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const load = useCallback((signal) => reportList({ ...filters, page, page_size: 10 }, signal), [filters, page]);
  const resource = usePortalResource(load, `reports:${page}:${JSON.stringify(filters)}`);
  return <Page title="Report review queue" intro="Review pending reports in their case context before accepting or returning them."><Section title="Report filters"><form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft }); setPage(1); }}><Select label="Review status" options={['PENDING', 'ACCEPTED', 'RETURNED']} value={draft.review_status} onChange={(e) => setDraft((d) => ({ ...d, review_status: e.target.value }))} /><Input label="Reference search" value={draft.reference} maxLength={40} onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))} /><Input label="Department UUID (optional)" pattern={UUID_PATTERN.source} value={draft.department_id} onChange={(e) => setDraft((d) => ({ ...d, department_id: e.target.value }))} /><Select label="Order" options={['desc', 'asc']} empty={null} value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} /><Button type="submit">Apply report filters</Button></form></Section><Section title="Reports"><ResourceState resource={resource}>{(data) => <><ul className="space-y-4">{data.items.length ? data.items.map((r) => <li key={r.id} className="space-y-2 rounded-lg border border-slate-200 p-4"><p className="text-sm font-medium">{r.review_status} · {r.submitter?.name}</p><p className="text-xs text-slate-500">Submitted {date(r.submitted_at)}</p><p className="whitespace-pre-wrap text-sm">{r.report_details}</p>{r.review_remarks && <p className="text-sm">Review: {r.review_remarks}</p>}<Link className="text-sm text-teal-700 underline" to={`/cmo/grievances/${r.grievance_id}`}>Open case and review report</Link></li>) : <li className="text-sm text-slate-500">No reports match these filters.</li>}</ul><Pagination pagination={data.pagination} onPage={setPage} /></>}</ResourceState></Section></Page>;
}
