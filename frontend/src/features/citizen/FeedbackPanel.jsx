import { useCallback } from 'react';
import { listFeedback, sendFeedback } from '../../services/evidenceApi.js';
import { date } from '../portal/contracts.js';
import { ResourceState, Section } from '../portal/components.jsx';
import { usePortalResource } from '../portal/hooks.js';
import ActionForm from '../portal/ActionForm.jsx';

export default function FeedbackPanel({ grievance }) {
  const load = useCallback((signal) => listFeedback(grievance.id, signal), [grievance.id]);
  const resource = usePortalResource(load, `feedback:${grievance.id}`);
  return <Section title="Resolution feedback"><ResourceState resource={resource}>{(rows) => <><ul className="space-y-3">{rows.map((r) => <li key={r.id} className="text-sm"><p>{r.rating ?? 'Legacy unrated'} / 5 · {date(r.created_at)}</p><p className="whitespace-pre-wrap">{r.comment}</p></li>)}</ul>{!rows.length && <p className="text-sm text-slate-500">No feedback recorded.</p>}{grievance.status === 'RESOLVED' ? <ActionForm title="Review feedback" fields={[{ name: 'rating', label: 'Satisfaction rating', required: true, options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` })) }, { name: 'comment', label: 'Feedback comment (optional)', type: 'textarea', max: 2000 }]} submit={(values) => sendFeedback(grievance.id, values)} onDone={resource.retry} confirmation="One feedback entry is allowed per resolution cycle. Feedback does not reopen the grievance." /> : <p className="text-sm text-slate-500">Feedback is available only after CMO-approved resolution. Only CMO can reopen a grievance.</p>}</>}</ResourceState></Section>;
}
