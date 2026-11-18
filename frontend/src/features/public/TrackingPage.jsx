import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Input, StatusBadge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { trackGrievance } from '../../services/publicApi.js';
import { PageHeading, ResourceState, linkButton, pageWidth } from './components.jsx';
import useResource from './useResource.js';

const referencePattern = /^CMK-\d{4}-[A-F0-9]{16}$/;
const date = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

function TrackingResult({ reference, user }) {
  const load = useCallback((signal) => trackGrievance(reference, signal), [reference]);
  const resource = useResource(load, `${user.id}:${reference}`);
  const row = resource.data;
  return <ResourceState resource={resource} label="grievance status"><div aria-live="polite">{row && <Card className="p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><p className="break-all font-mono text-sm text-slate-600">{row.reference_number}</p><StatusBadge status={row.status} /></div><h2 className="mt-5 break-words text-xl text-slate-900">{row.subject}</h2><dl className="mt-6 grid gap-5 border-y border-slate-200 py-5 text-sm sm:grid-cols-3">{[['Department', row.assigned_department_name || 'Not yet assigned'], ['Submitted', date(row.created_at)], ['Last updated', date(row.updated_at)]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>)}</dl><h3 className="mt-7 text-base">Official status history</h3>{row.history.length ? <ol className="mt-5 space-y-5">{row.history.map((entry, index) => <li key={`${entry.created_at}-${index}`} className="flex flex-wrap items-center gap-3 border-l-2 border-teal-200 pl-4"><StatusBadge status={entry.to_status} /><span className="text-xs text-slate-500">{date(entry.created_at)} · {entry.actor_label}</span></li>)}</ol> : <p className="mt-4 text-sm text-slate-500">No status history is available.</p>}<p className="mt-7 text-xs leading-relaxed text-slate-500">This view excludes private notes, contact details and attachments. Status information is visible only after authorization.</p></Card>}</div></ResourceState>;
}

export default function TrackingPage({ basePath = '/track' }) {
  const { reference: param = '' } = useParams();
  const [reference, setReference] = useState(param);
  const [error, setError] = useState('');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const normalized = param.trim().toUpperCase();
  const valid = referencePattern.test(normalized);
  const allowed = user && ['CITIZEN', 'CMO_ADMIN'].includes(user.role);
  useEffect(() => { setReference(param); setError(''); }, [param]);

  function submit(event) {
    event.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!referencePattern.test(value)) {
      setError('Enter a reference such as CMK-2026-A7F29C810D59E246.');
      return;
    }
    setError('');
    navigate(`${basePath}/${encodeURIComponent(value)}`);
  }

  return <><PageHeading title="Track your grievance">Use the reference from your submission receipt. Sign-in protects your records; a reference number alone does not grant access.</PageHeading><div className={`${pageWidth} max-w-4xl space-y-7 py-12`}>
    <Card className="p-6 sm:p-8"><form onSubmit={submit} noValidate className="space-y-4"><Input id="tracking-reference" label="Grievance reference number" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={40} autoComplete="off" spellCheck={false} required error={error || (param && !valid ? 'This reference number is not valid.' : '')} hint="Example: CMK-2026-A7F29C810D59E246" /><Button type="submit" size="lg">Find grievance</Button></form></Card>
    {loading ? <p role="status" className="text-sm text-slate-600">Checking your session…</p> : !user ? <Card className="p-6"><h2 className="text-lg">Sign in to view grievance status</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Citizens can track only their own grievances. Anonymous tracking is not available.</p><Link to="/login" state={{ from: { pathname: valid ? `/track/${normalized}` : location.pathname } }} className={`${linkButton} mt-5`}>Sign in to track</Link></Card> : !allowed ? <Alert type="info">This tracking view is available to citizen owners and CMO administrators. Department officers should use their assigned grievance queue.</Alert> : valid ? <TrackingResult key={user.id} reference={normalized} user={user} /> : null}
  </div></>;
}
