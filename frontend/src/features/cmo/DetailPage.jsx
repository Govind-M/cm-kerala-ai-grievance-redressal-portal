import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { workDetail } from '../../services/workApi.js';
import { analyzeCase } from '../../services/aiApi.js';
import { Page, ResourceState, Section } from '../portal/components.jsx';
import { date } from '../portal/contracts.js';
import { usePortalResource } from '../portal/hooks.js';
import CaseOverview from '../portal/CaseOverview.jsx';
import EvidencePanel from '../portal/EvidencePanel.jsx';
import ReportHistory from '../portal/ReportHistory.jsx';
import AIPanel from '../portal/AIPanel.jsx';
import CaseActions from './CaseActions.jsx';

export default function CMODetail() {
  const { id } = useParams();
  const load = useCallback((signal) => workDetail('cmo', id, signal), [id]);
  const resource = usePortalResource(load, `cmo-case:${id}`);
  return <Page title="CMO case review"><ResourceState resource={resource}>{(r) => <div key={r.id} className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="min-w-0 space-y-6"><CaseOverview row={r} admin /><EvidencePanel id={r.id} reportAttachments={r.attachments} /><ReportHistory reports={r.reports} row={r} admin onDone={resource.retry} /><Section title="Assignment audit">{r.assignments.map((a) => <div key={a.id} className="space-y-1 border-b border-slate-100 pb-3 text-sm"><p>{a.department.name} · {a.officer?.name ?? 'Department pool'}</p><p>{date(a.assigned_at)} → {a.closed_at ? date(a.closed_at) : 'Active'}</p><p className="whitespace-pre-wrap">{a.assignment_note}</p></div>)}</Section><Section title="Escalation audit">{r.escalations.length ? r.escalations.map((e) => <article key={e.id} className="text-sm"><p>{date(e.created_at)} · {e.previous_priority} → {e.new_priority}</p><p className="whitespace-pre-wrap">{e.reason}</p><p>Deadline: {date(e.previous_due_at)} → {date(e.new_due_at)}</p></article>) : <p className="text-sm text-slate-500">No escalation recorded.</p>}</Section></div><aside className="min-w-0 space-y-6"><CaseActions row={r} onDone={resource.retry} /><Section title="AI intelligence — advisory only"><AIPanel title="Analyze case" request={() => analyzeCase(r.id)} /><AIPanel title="Assess possible duplicates" request={() => analyzeCase(r.id, 'duplicates')} /><p className="text-xs text-slate-500">No recommendation automatically changes official classification, assignment, priority or resolution.</p></Section></aside></div>}</ResourceState></Page>;
}
