import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OfficerDashboard from '../features/officer/Dashboard.jsx';
import InvestigationForms from '../features/officer/InvestigationForms.jsx';
import WorkListPage from '../features/portal/WorkListPage.jsx';
import CaseOverview from '../features/portal/CaseOverview.jsx';
import * as work from '../services/workApi.js';
import * as publicApi from '../services/publicApi.js';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'officer', role: 'DEPARTMENT_OFFICER' } }) }));
vi.mock('../services/workApi.js', () => ({ workList: vi.fn(), workStatistics: vi.fn(), postUpdate: vi.fn(), postReport: vi.fn() }));
vi.mock('../services/publicApi.js', () => ({ getDepartments: vi.fn() }));
const row = { id: 'case', status: 'IN_PROGRESS', priority: 'HIGH', can_modify: true, reports: [] };
const mount = (element) => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); publicApi.getDepartments.mockResolvedValue([]); work.workList.mockResolvedValue({ items: [], pagination: { page: 1, total_items: 0, total_pages: 0 } }); work.workStatistics.mockResolvedValue({ department_active: 14, assigned_to_me: 2, unassigned_to_officer: 12, in_progress: 10, reports_pending_review: 3, overdue: 1, reopened: 4, pending: 14 }); });

it('loads department-scoped counts instead of invented report totals', async () => {
  mount(<OfficerDashboard />); expect(await screen.findByText('Reports awaiting CMO')).toBeInTheDocument();
  expect(work.workStatistics).toHaveBeenCalledWith('officer', expect.any(AbortSignal));
});
it('uses the dedicated assigned-to-me endpoint selection', async () => {
  mount(<WorkListPage role="officer" assigned />); await screen.findByText('No grievances match these filters.');
  expect(work.workList).toHaveBeenCalledWith('officer', expect.any(Object), expect.any(AbortSignal), true);
});
it.each([{ ...row, can_modify: false }, { ...row, status: 'REOPENED' }])('withholds mutation forms for read-only/ineligible assignments', (value) => {
  mount(<InvestigationForms row={value} />); expect(screen.getByText('Read-only investigation')).toBeInTheDocument();
  expect(screen.queryByText('Review investigation update')).not.toBeInTheDocument();
});
it('requires update visibility and confirmation without changing official status', async () => {
  work.postUpdate.mockResolvedValue({}); const done = vi.fn(); mount(<InvestigationForms row={row} onDone={done} />);
  fireEvent.change(screen.getByLabelText(/Investigation update/), { target: { value: 'Fictional inspection completed.' } });
  fireEvent.change(screen.getByLabelText('Update visibility'), { target: { value: 'PUBLIC' } });
  fireEvent.click(screen.getByText('Review investigation update')); expect(work.postUpdate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Confirm action'));
  await waitFor(() => expect(work.postUpdate).toHaveBeenCalledWith('case', { message: 'Fictional inspection completed.', visibility: 'PUBLIC' }));
  expect(done).toHaveBeenCalledTimes(1);
});
it('submits the actual narrative report schema once, after officer review', async () => {
  work.postReport.mockResolvedValue({ review_status: 'PENDING' }); mount(<InvestigationForms row={row} onDone={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Action Taken Report details/), { target: { value: 'Fictional findings and all actions taken are described here.' } });
  fireEvent.click(screen.getByText('Review Action Taken Report'));
  fireEvent.click(screen.getByText('Confirm action'));
  await waitFor(() => expect(work.postReport).toHaveBeenCalledWith('case', { report_details: 'Fictional findings and all actions taken are described here.' }));
});
it('blocks a second pending report but keeps update capability', () => {
  mount(<InvestigationForms row={{ ...row, reports: [{ review_status: 'PENDING' }] }} />);
  expect(screen.queryByText('Review Action Taken Report')).not.toBeInTheDocument(); expect(screen.getByText('Review investigation update')).toBeInTheDocument();
});
it('does not render CMO-only contact or instruction data in shared officer overview', () => {
  mount(<CaseOverview row={{ ...row, citizen: { email: 'private@example.test' }, current_assignment: { assignment_note: 'Secret CMO instruction', department: { name: 'Public Works' } }, history: [{ to_status: 'IN_PROGRESS', remarks: 'Secret internal note' }] }} />);
  expect(screen.queryByText(/Secret/)).not.toBeInTheDocument(); expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
});
it('handles a conflict without reporting success or automatically retrying', async () => {
  work.postReport.mockRejectedValue({ response: { status: 409 } }); mount(<InvestigationForms row={row} />);
  fireEvent.change(screen.getByLabelText(/Action Taken Report details/), { target: { value: 'Fictional report with enough details for validation.' } });
  fireEvent.click(screen.getByText('Review Action Taken Report')); fireEvent.click(screen.getByText('Confirm action'));
  expect(await screen.findByText(/case has changed/)).toBeInTheDocument(); expect(work.postReport).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Action confirmed by the server.')).not.toBeInTheDocument();
});
