import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../../components/ui/index.jsx';
import { getMine } from '../../services/grievanceApi.js';
import { Page, ResourceState, Section, Timeline } from '../portal/components.jsx';
import { date } from '../portal/contracts.js';
import { usePortalResource } from '../portal/hooks.js';
import EvidencePanel from '../portal/EvidencePanel.jsx';
import FeedbackPanel from './FeedbackPanel.jsx';

export default function CitizenDetail() {
  const { id } = useParams();
  const load = useCallback((signal) => getMine(id, signal), [id]);
  const resource = usePortalResource(load, `citizen-detail:${id}`);
  return <Page title="Grievance details"><ResourceState resource={resource}>{(r) => <div key={r.id} className="space-y-6"><Section title={r.reference_number}><h3>{r.subject}</h3><div className="flex flex-wrap gap-2"><StatusBadge status={r.status} /><PriorityBadge priority={r.priority} /></div><p className="whitespace-pre-wrap">{r.description}</p><dl className="grid gap-3 text-sm sm:grid-cols-2">{[['District', r.district], ['Category', r.category], ['Department', r.assigned_department_name || 'Not yet assigned'], ['Submitted', date(r.created_at)], ['Updated', date(r.updated_at)], ['Resolved', date(r.resolved_at)]].map(([name, value]) => <div key={name}><dt className="text-slate-500">{name}</dt><dd>{value}</dd></div>)}</dl></Section><Section title="Official history"><Timeline entries={r.history} /></Section><Section title="Public updates">{r.updates.length ? r.updates.map((u, i) => <article key={i} className="text-sm"><p className="whitespace-pre-wrap">{u.message}</p><p className="text-xs text-slate-500">{date(u.created_at)} · {u.actor_label}</p></article>) : <p className="text-sm text-slate-500">No public updates yet.</p>}</Section><EvidencePanel id={r.id} canUpload={r.status !== 'RESOLVED'} /><FeedbackPanel grievance={r} /></div>}</ResourceState></Page>;
}
