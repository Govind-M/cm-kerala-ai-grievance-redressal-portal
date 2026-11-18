import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { workDetail } from '../../services/workApi.js';
import { Page, ResourceState, Section } from '../portal/components.jsx';
import { usePortalResource } from '../portal/hooks.js';
import CaseOverview from '../portal/CaseOverview.jsx';
import EvidencePanel from '../portal/EvidencePanel.jsx';
import ReportHistory from '../portal/ReportHistory.jsx';
import InvestigationForms from './InvestigationForms.jsx';

export default function OfficerDetail() {
  const { id } = useParams();
  const load = useCallback((signal) => workDetail('officer', id, signal), [id]);
  const resource = usePortalResource(load, `officer-case:${id}`);
  return <Page title="Investigation workspace"><ResourceState resource={resource}>{(r) => <div key={r.id} className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="min-w-0 space-y-6"><CaseOverview row={r} /><EvidencePanel id={r.id} reportAttachments={r.attachments} /><ReportHistory reports={r.reports} row={r} /></div><aside className="min-w-0 space-y-6"><InvestigationForms key={r.updated_at} row={r} onDone={resource.retry} /><Section title="Officer AI assistance"><p className="text-sm text-slate-500">Not available: the backend has no officer-authorized summarization, drafting or procedural-guidance endpoint. No chatbot, generated report or CMO-only AI request is substituted.</p><button type="button" disabled className="cursor-not-allowed rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-500">AI drafting unavailable</button></Section></aside></div>}</ResourceState></Page>;
}
