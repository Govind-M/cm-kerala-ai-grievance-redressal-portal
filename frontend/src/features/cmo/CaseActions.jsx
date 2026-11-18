import { useCallback, useState } from 'react';
import { getDepartments } from '../../services/publicApi.js';
import { mutateCase } from '../../services/workApi.js';
import { Section, ResourceState } from '../portal/components.jsx';
import ActionForm from '../portal/ActionForm.jsx';
import { caseActions, PRIORITIES, UUID_PATTERN } from '../portal/contracts.js';
import { usePortalResource } from '../portal/hooks.js';

const reason = { name: 'reason', label: 'Reason', required: true, type: 'textarea', min: 10, max: 2000 };
const visibility = { name: 'visibility', label: 'Visibility', options: ['INTERNAL', 'PUBLIC'], required: true };
const remarks = { name: 'remarks', label: 'Review remarks (optional)', type: 'textarea', min: 5, max: 10000 };
export default function CaseActions({ row, onDone }) {
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback((signal) => getDepartments(signal), []);
  const departments = usePortalResource(load, `assignment-departments:${row.id}`);
  const allowed = caseActions(row);
  const definitions = {
    review: ['Start review', [remarks, visibility]], resume: ['Resume investigation', [remarks, visibility]],
    reopen: ['Reopen case', [reason]],
    priority: ['Update priority', [{ name: 'priority', label: 'Priority', options: PRIORITIES, required: true }, reason]],
    remarks: ['Add administrative update', [{ name: 'message', label: 'Update message', required: true, type: 'textarea', min: 5, max: 10000 }, visibility]],
    escalate: ['Escalate case', [reason, { name: 'priority', label: 'Escalated priority (optional)', options: PRIORITIES.filter((p) => PRIORITIES.indexOf(p) >= PRIORITIES.indexOf(row.priority)) }, { name: 'new_deadline', label: 'New deadline (optional, local time)', type: 'datetime-local' }]],
    assign: ['Assign department', []], reassign: ['Reassign department', []],
  };
  const assignment = ['assign', 'reassign'].includes(action);
  const fields = assignment ? [{ name: 'department_id', label: 'Active department', required: true, options: (departments.data ?? []).map((d) => ({ value: d.id, label: d.name })) }, { name: 'officer_id', label: 'Optional verified officer UUID', pattern: UUID_PATTERN, hint: 'No officer-directory API exists. Leave empty for the department pool, or enter an operator-verified officer ID. Backend validates active department membership.' }, { name: 'assignment_note', label: 'Internal assignment instruction', required: true, type: 'textarea', min: 10, max: 2000 }, { name: 'priority', label: 'Priority (optional)', options: PRIORITIES }] : definitions[action]?.[1];
  return <Section title="Official CMO actions">
    <p className="text-sm text-slate-500">Actions are constrained by the current lifecycle. The backend revalidates permissions, assignments and concurrent changes. There is no arbitrary status editor.</p>
    <div className="flex flex-wrap gap-2">
      {Object.entries(definitions).filter(([key]) => allowed[key]).map(([key, [title]]) => (
        <button type="button" key={key} disabled={busy} onClick={() => setAction(key)}
          className={`rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${action === key ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white text-slate-700'}`}
          aria-pressed={action === key}>{title}</button>
      ))}
    </div>
    {action && allowed[action] && <div className="space-y-3 border-t border-slate-100 pt-4">
      <h3>{definitions[action][0]}</h3>
      {assignment && <ResourceState resource={departments}>{() => <p className="text-sm text-slate-500">Department pool assignment is supported without selecting an individual officer.</p>}</ResourceState>}
      {(!assignment || (!departments.loading && !departments.error)) && <ActionForm
        key={`${row.id}:${action}:${row.updated_at}`}
        title={`Review: ${definitions[action][0]}`}
        fields={fields}
        initial={['review', 'resume', 'remarks'].includes(action) ? { visibility: 'INTERNAL' } : {}}
        onPending={setBusy}
        validate={(values) => values.new_deadline && (Number.isNaN(Date.parse(values.new_deadline)) || new Date(values.new_deadline) <= new Date()) ? { new_deadline: 'Choose a future deadline.' } : {}}
        submit={(values) => mutateCase(row.id, action, { ...values, ...(values.new_deadline ? { new_deadline: new Date(values.new_deadline).toISOString() } : {}) })}
        onDone={() => { setBusy(false); setAction(''); onDone(); }}
        confirmation={action === 'assign' ? 'This assigns official responsibility. An initial UNDER_REVIEW assignment starts investigation; a reopened case must subsequently be resumed.' : 'Confirm this official action. Prior history and assignments will be retained.'}
      />}
    </div>}
  </Section>;
}
