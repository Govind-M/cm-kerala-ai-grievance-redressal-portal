import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitGrievance } from '../../services/grievanceApi.js';
import { analyzeDraft } from '../../services/aiApi.js';
import ActionForm from '../portal/ActionForm.jsx';
import AIPanel from '../portal/AIPanel.jsx';
import EvidencePanel from '../portal/EvidencePanel.jsx';
import { Page, Section } from '../portal/components.jsx';
import { CATEGORIES, DISTRICTS, validateGrievance } from '../portal/contracts.js';

export default function SubmitPage() {
  const [receipt, setReceipt] = useState(null);
  return <Page title="Submit a grievance" intro="Describe the issue clearly. You decide what to submit; AI assistance is optional.">{receipt ? <><Section title="Grievance submitted"><p role="status">Your reference: <strong>{receipt.reference_number}</strong></p><p className="text-sm text-slate-500">Your grievance has been saved. Uploading evidence is a separate optional step; an upload failure will not undo this submission.</p><Link className="text-teal-700 underline" to={`/citizen/grievances/${receipt.id}`}>View grievance details</Link></Section><EvidencePanel id={receipt.id} canUpload /></> : <Section title="Grievance information"><ActionForm title="Review grievance" fields={[{ name: 'subject', label: 'Subject', required: true, min: 5, max: 255 }, { name: 'district', label: 'District', required: true, options: DISTRICTS }, { name: 'category', label: 'Category', required: true, options: CATEGORIES }, { name: 'description', label: 'Description', type: 'textarea', required: true, min: 20, max: 10000 }]} validate={validateGrievance} submit={submitGrievance} onDone={setReceipt} confirmation="Confirm this grievance is accurate and ready to submit. Supporting evidence can be added after you receive a reference.">{(values, _setValues, setFieldValue) => <div className="space-y-3 rounded-lg bg-slate-50 p-4"><h3>Optional AI assistance</h3><AIPanel key={`${values.district}:${values.subject}:${values.description}`} valid={!Object.keys(validateGrievance({ ...values, category: values.category || 'Other' })).length} request={() => analyzeDraft(values)} onCategory={(category) => setFieldValue('category', category)} /><p className="text-xs text-slate-500">Include location/landmark in your description if relevant. The API has no separate location field. Do not include unnecessary personal information.</p></div>}</ActionForm></Section>}</Page>;
}
