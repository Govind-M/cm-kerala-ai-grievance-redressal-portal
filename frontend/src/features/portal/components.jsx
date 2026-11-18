import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Spinner, StatusBadge, PriorityBadge } from '../../components/ui/index.jsx';
import { date, label, portalError } from './contracts.js';

export function Page({ title, intro, children, action }) {
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl text-slate-900">{title}</h1>{intro && <p className="mt-2 max-w-3xl text-sm text-slate-500">{intro}</p>}</div>{action}</header>{children}</div>;
}
export function Section({ title, children }) { return <Card className="min-w-0 space-y-4 p-4 sm:p-6"><h2 className="text-lg text-slate-900">{title}</h2>{children}</Card>; }
export function ResourceState({ resource, children }) {
  if (resource.loading) return <div role="status" className="flex items-center gap-3 p-6 text-slate-500"><Spinner />Loading…</div>;
  if (resource.error) return <div className="space-y-3"><Alert type="error">{portalError(resource.error)}</Alert><Button variant="secondary" onClick={resource.retry}>Reload data</Button></div>;
  return children(resource.data);
}
export function Stats({ entries }) {
  return <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{entries.map(([name, value]) => <Card key={name} className="p-4"><dt className="text-sm text-slate-500">{name}</dt><dd className="mt-2 text-3xl font-semibold text-slate-900">{value ?? 'Not available'}</dd></Card>)}</dl>;
}
export function Select({ label: title, options, empty = 'All', error, ...props }) {
  const id = useId();
  return <div className="min-w-0"><label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{title}</label><select id={id} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props}>{empty !== null && <option value="">{empty}</option>}{options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? label(o)}</option>)}</select>{error && <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{error}</p>}</div>;
}
export function Textarea({ label: title, error, ...props }) {
  const id = useId();
  return <div><label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{title}</label><textarea id={id} rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{error}</p>}</div>;
}
export function Pagination({ pagination: p, onPage }) {
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><p>{p.total_items} records · Page {p.page} of {Math.max(1, p.total_pages)}</p><div className="flex gap-2"><Button variant="secondary" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>Previous</Button><Button variant="secondary" disabled={p.page >= p.total_pages} onClick={() => onPage(p.page + 1)}>Next</Button></div></nav>;
}
export function CaseTable({ items, role }) {
  if (!items.length) return <p className="py-8 text-center text-slate-500">No grievances match these filters.</p>;
  // Cards avoid a wide administrative table causing horizontal viewport scrolling.
  return <ul className="divide-y divide-slate-100">{items.map((r) => <li key={r.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><Link className="font-medium text-teal-700 underline decoration-teal-200 underline-offset-4" to={`/${role}/grievances/${r.id}`}>{r.reference_number}</Link><p className="mt-1 font-medium text-slate-900">{r.subject}</p><p className="mt-1 text-sm text-slate-500">{r.district} · {r.category}</p>{r.department_name && <p className="text-sm text-slate-500">{r.department_name}</p>}<p className="text-xs text-slate-500">Submitted {date(r.created_at)}</p></div><div className="flex flex-wrap items-start gap-2"><StatusBadge status={r.status} /><PriorityBadge priority={r.priority} />{r.overdue && <span className="text-sm text-red-700">Overdue</span>}</div></li>)}</ul>;
}
export function Timeline({ entries = [], admin = false }) {
  return entries.length ? <ol className="space-y-5 border-l-2 border-teal-100 pl-5">{entries.map((e, i) => <li key={e.id ?? `${e.created_at}-${i}`}><StatusBadge status={e.to_status} /><p className="mt-1 text-xs text-slate-500">{date(e.created_at)} · {e.actor_label ?? 'CMO administration'}</p>{admin && e.remarks && <p className="mt-2 whitespace-pre-wrap text-sm">{e.remarks} <span className="text-slate-500">({e.remarks_visibility})</span></p>}</li>)}</ol> : <p className="text-sm text-slate-500">No history available.</p>;
}
export function ConfirmationDialog({ title, children, pending, onCancel, onConfirm }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal?.();
    return () => { ref.current?.close?.(); previous?.focus?.(); };
  }, []);
  return <dialog ref={ref} open={typeof HTMLDialogElement.prototype.showModal !== 'function' ? true : undefined} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); if (!pending) onCancel(); }} className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-900/50"><h2 id={id} className="text-lg">{title}</h2><div className="my-4 space-y-3 text-sm">{children}</div><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={pending} onClick={onCancel} autoFocus>Go back</Button><Button loading={pending} onClick={onConfirm}>Confirm action</Button></div></dialog>;
}
