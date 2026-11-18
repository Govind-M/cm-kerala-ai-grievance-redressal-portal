import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/index.jsx';
import { getDepartments, getFaqs } from '../../services/publicApi.js';
import { DepartmentCard, FAQAccordion, PortalCallout, ResourceState, SectionHeading, linkButton, outlineLink, pageWidth } from './components.jsx';
import PublishedContent from './PublishedContent.jsx';
import useResource from './useResource.js';

const process = ['Submit your grievance', 'CMO reviews and assigns', 'Department investigates', 'CMO reviews the outcome', 'Track updates and give feedback'];
const benefits = [
  ['A clearer view of progress', 'Track official status and public updates through your signed-in account.'],
  ['One place to raise a concern', 'A structured submission captures the issue, district and category.'],
  ['Clear departmental responsibility', 'CMO-approved assignments connect investigation to the appropriate department.'],
  ['Investigation before resolution', 'Officers document their work; the CMO reviews the action-taken report.'],
  ['Room for citizen feedback', 'Share a rating and comment after a completed resolution cycle.'],
  ['AI assistance, human oversight', 'Optional suggestions support review without replacing official decisions.'],
];

export default function HomePage() {
  const departments = useResource(getDepartments);
  const faqs = useResource(getFaqs);
  return <>
    <section className="border-b border-slate-200 bg-white"><div className={`${pageWidth} grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]`}>
      <div><p className="mb-5 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">Citizen-first · Human-reviewed</p><h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">Your voice matters.<br /><span className="text-teal-700">Every grievance counts.</span></h1><p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">A clearer way to raise a concern, follow its progress and hold each step accountable. Built around citizens, with people in charge of every official decision.</p><div className="mt-8 flex flex-wrap gap-3"><Link to="/citizen/submit" className={linkButton}>Submit a Grievance <span aria-hidden="true">→</span></Link><Link to="/track" className={outlineLink}>Track Your Grievance</Link></div><p className="mt-4 text-xs leading-relaxed text-slate-500">Sign-in required for submission and tracking.</p></div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8"><div className="mb-7 flex items-center justify-between gap-4"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">The process, at a glance</p><span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true" /></div><h2 className="mb-6 text-xl text-slate-900">From your concern<br />to an accountable response.</h2><ol className="space-y-0">{process.map((step, index) => <li key={step} className="relative flex gap-4 pb-6 last:pb-0"><span aria-hidden="true" className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-teal-700 ring-1 ring-teal-200">{index + 1}</span>{index < process.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-4 top-8 w-px bg-slate-200" />}<p className="pt-1 text-sm font-medium text-slate-700">{step}</p></li>)}</ol><Link className="mt-7 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:underline" to="/how-it-works">Understand the full process →</Link></div>
    </div></section>
    <section className={`${pageWidth} py-14 sm:py-20`}><SectionHeading eyebrow="A thoughtful approach" title="Less uncertainty. More clarity.">Understand where your concern stands and who is responsible for the next step.</SectionHeading><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{benefits.map(([title, text], index) => <Card key={title} className="p-6"><span className="mb-5 block text-xs font-semibold text-teal-700" aria-hidden="true">0{index + 1}</span><h3 className="text-base text-slate-900">{title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p></Card>)}</div></section>
    <section className="border-y border-slate-200 bg-slate-100/60 py-14 sm:py-16"><div className={pageWidth}><SectionHeading eyebrow="Connected responsibilities" title="Explore the departments">The active directory comes directly from the platform, not an illustrative list.</SectionHeading><ResourceState resource={departments} empty={!departments.data?.length} label="departments"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{departments.data?.slice(0, 3).map((row) => <DepartmentCard key={row.id} department={row} />)}</div></ResourceState><Link to="/departments" className={`${outlineLink} mt-7`}>View all departments →</Link></div></section>
    <section className={`${pageWidth} grid gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_1.5fr]`}><div><SectionHeading eyebrow="Before you begin" title="A few helpful answers">Understand registration, tracking and the role of human review.</SectionHeading><Link to="/faq" className={outlineLink}>Browse all FAQs →</Link></div><ResourceState resource={faqs} empty={!faqs.data?.length} label="published FAQs"><FAQAccordion items={faqs.data?.slice(0, 3) || []} /></ResourceState></section>
    <div className={`${pageWidth} space-y-10 pb-14`}><PublishedContent slug="home" /><PortalCallout /></div>
  </>;
}
