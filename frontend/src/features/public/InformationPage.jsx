import { Card, StatusBadge } from '../../components/ui/index.jsx';
import { PageHeading, PortalCallout, SectionHeading, pageWidth } from './components.jsx';
import PublishedContent from './PublishedContent.jsx';
import { steps } from './content.js';

const actors = [
  ['Citizens', 'Describe a concern, follow its progress and provide feedback after resolution. Access to citizen grievance records is ownership-scoped.'],
  ['CMO administrators', 'Review grievances, confirm priorities, assign departments, review reports and make official resolution or reopening decisions.'],
  ['Department officers', 'Investigate active assignments, post progress updates and submit action-taken reports. Officers cannot independently resolve a grievance.'],
];

export default function InformationPage({ kind }) {
  const process = kind === 'how-it-works';
  return <><PageHeading title={process ? 'How It Works' : 'About Us'}>{process ? 'A clear process. Human decisions. A record of every official step.' : 'A citizen-centered demonstration of transparent, accountable grievance handling.'}</PageHeading><div className={`${pageWidth} space-y-14 py-12 sm:py-16`}>
    {process ? <section><SectionHeading eyebrow="From concern to resolution" title="Know what happens next">These are process steps, not extra grievance statuses. AI is optional and all official decisions remain human-reviewed.</SectionHeading><ol className="grid gap-x-12 gap-y-8 md:grid-cols-2">{steps.map(([title, text], index) => <li key={title} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-sm font-semibold text-teal-700" aria-hidden="true">{index + 1}</span><div><h3 className="text-base text-slate-900">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p></div></li>)}</ol><Card className="mt-10 p-6"><h3 className="mb-4 text-base">The five official statuses</h3><div className="flex flex-wrap gap-3">{['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'].map((status) => <StatusBadge key={status} status={status} />)}</div><p className="mt-4 text-sm leading-relaxed text-slate-600">An accepted report is required for resolution. Reopened cases need a fresh investigation and report. Check updates by signing in; automated email or SMS notifications are not implemented.</p></Card></section> : <>
      <section className="grid gap-8 lg:grid-cols-2"><SectionHeading eyebrow="Designed around citizens" title="One concern. A shared responsibility.">A centralized place to submit concerns, understand their progress and see public updates without losing the accountability of human review.</SectionHeading><Card className="space-y-5 p-6 sm:p-8">{[['Transparency', 'Official status changes are recorded in a timeline. Private administrative notes are not part of citizen tracking.'], ['Accountability', 'Department assignments, investigation reports and CMO decisions are separate, traceable stages.'], ['Privacy', 'Signing in protects grievance records. A reference number alone does not grant access.']].map(([title, text]) => <div key={title}><h3 className="text-base">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p></div>)}</Card></section>
      <section><SectionHeading title="People remain at the center">Each role has clear responsibilities and carefully scoped access.</SectionHeading><div className="grid gap-5 md:grid-cols-3">{actors.map(([title, text]) => <Card key={title} className="p-6"><h3>{title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p></Card>)}</div></section>
      <section className="rounded-xl border border-teal-200 bg-teal-50 p-6 sm:p-8"><SectionHeading eyebrow="Assisted, not automated" title="AI supports people. It does not replace them.">AI can suggest classification, summarize a grievance or flag potential duplicates. Administrators review these suggestions; AI never assigns departments, merges cases or resolves grievances on its own.</SectionHeading><p className="text-sm text-slate-600">AI availability is optional. The manual grievance workflow continues independently.</p></section>
    </>}
    <section aria-label="Published website content"><PublishedContent slug={kind} /></section>
    <PortalCallout />
  </div></>;
}
