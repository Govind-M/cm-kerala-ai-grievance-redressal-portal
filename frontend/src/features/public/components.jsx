import { Link } from 'react-router-dom';
import { Alert, Button, Card, Spinner } from '../../components/ui/index.jsx';
import { publicError } from '../../services/publicApi.js';

export const linkButton = 'inline-flex min-h-11 items-center justify-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors';
export const outlineLink = 'inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors';
export const pageWidth = 'mx-auto w-full max-w-7xl px-4 sm:px-6';

export function SectionHeading({ eyebrow, title, children }) {
  return <div className="mb-8 max-w-2xl">
    {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal-700">{eyebrow}</p>}
    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
    {children && <p className="mt-3 leading-relaxed text-slate-600">{children}</p>}
  </div>;
}

export function PageHeading({ eyebrow, title, children }) {
  return <section className="border-b border-slate-200 bg-white py-12 sm:py-16"><div className={pageWidth}>
    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal-700">{eyebrow || 'CM Kerala Portal'}</p>
    <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
    <p className="mt-4 max-w-2xl leading-relaxed text-slate-600">{children}</p>
  </div></section>;
}

export function ResourceState({ resource, empty, children, label = 'information' }) {
  if (resource.loading) return <div role="status" className="flex items-center gap-3 py-8 text-sm text-slate-600"><Spinner />Loading {label}…</div>;
  if (resource.error) return <Alert type="error"><p>{publicError(resource.error)}</p><Button className="mt-3" variant="secondary" onClick={resource.retry}>Retry {label}</Button></Alert>;
  if (empty) return <Card className="p-6 text-sm text-slate-600">No {label} are available right now.</Card>;
  return children;
}

export function DepartmentCard({ department }) {
  return <Card className="h-full p-6"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 9h.01M15 9h.01" /></svg></div><h3 className="break-words text-lg text-slate-900">{department.name}</h3>{department.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{department.description}</p>}</Card>;
}

export function FAQAccordion({ items }) {
  return <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">{items.map((item) => <details key={item.id} className="group px-5 py-1"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-slate-800"><span>{item.question}</span><span aria-hidden="true" className="text-xl font-normal text-teal-700 group-open:rotate-45 motion-reduce:transform-none">+</span></summary><p className="whitespace-pre-line break-words pb-5 text-sm leading-relaxed text-slate-600">{item.answer}</p></details>)}</div>;
}

export function PortalCallout() {
  return <Card className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8"><div><h2 className="text-xl text-slate-900">Ready to make your voice heard?</h2><p className="mt-2 text-sm text-slate-600">Create a citizen account or sign in to your existing portal.</p></div><Link className={linkButton} to="/register">Create a citizen account</Link></Card>;
}
