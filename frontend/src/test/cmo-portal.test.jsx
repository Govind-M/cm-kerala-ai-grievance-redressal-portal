import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CaseActions from '../features/cmo/CaseActions.jsx';
import ReportHistory from '../features/portal/ReportHistory.jsx';
import CMODashboard from '../features/cmo/Dashboard.jsx';
import WorkListPage from '../features/portal/WorkListPage.jsx';
import AnalyticsPage from '../features/cmo/AnalyticsPage.jsx';
import AIPanel, { AIResult } from '../features/portal/AIPanel.jsx';
import { caseActions } from '../features/portal/contracts.js';
import * as work from '../services/workApi.js';
import * as publicApi from '../services/publicApi.js';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'cmo', role: 'CMO_ADMIN' } }) }));
vi.mock('../services/workApi.js', () => ({ workList: vi.fn(), workStatistics: vi.fn(), reportList: vi.fn(), departmentStatistics: vi.fn(), districtStatistics: vi.fn(), mutateCase: vi.fn(), reviewReport: vi.fn() }));
vi.mock('../services/publicApi.js', () => ({ getDepartments: vi.fn() }));
const row = { id: 'case', status: 'UNDER_REVIEW', priority: 'MEDIUM', reports: [], current_assignment: null };
const page = { items: [], pagination: { page: 1, total_pages: 0, total_items: 0 } };
const mount = (element) => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); publicApi.getDepartments.mockResolvedValue([{ id: 'dept', name: 'Fictional department' }]); work.workList.mockResolvedValue(page); work.reportList.mockResolvedValue(page); work.departmentStatistics.mockResolvedValue([{ department_id: null, department_name: 'Unassigned', total: 3 }]); work.districtStatistics.mockResolvedValue([{ district: 'Kollam', total: 10, resolved: 4, pending: 6, overdue: 1 }]); work.workStatistics.mockResolvedValue({ total: 37, submitted: 2, under_review: 3, in_progress: 20, resolved: 10, reopened: 2, overdue: 4 }); });

it.each([
  ['SUBMITTED', 'review'], ['UNDER_REVIEW', 'assign'], ['RESOLVED', 'reopen'],
])('permits only verified lifecycle actions for %s', (status, action) => {
  expect(caseActions({ ...row, status })[action]).toBe(true);
  expect(caseActions({ ...row, status: 'RESOLVED' }).escalate).toBe(false);
});
it('blocks reassignment while a report is pending', () => {
  expect(caseActions({ ...row, status: 'IN_PROGRESS', current_assignment: { id: 'assignment' }, reports: [{ review_status: 'PENDING' }] }).reassign).toBe(false);
});
it('confirms department assignment and preserves optional department-pool semantics', async () => {
  work.mutateCase.mockResolvedValue(row); const done = vi.fn();
  mount(<CaseActions row={row} onDone={done} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assign department', exact: true }));
  fireEvent.change(await screen.findByLabelText('Active department'), { target: { value: 'dept' } });
  fireEvent.change(screen.getByLabelText(/Internal assignment instruction/), { target: { value: 'Please investigate this fictional issue.' } });
  fireEvent.click(screen.getByText('Review: Assign department'));
  expect(work.mutateCase).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Confirm action'));
  await waitFor(() => expect(work.mutateCase).toHaveBeenCalledWith('case', 'assign', { department_id: 'dept', assignment_note: 'Please investigate this fictional issue.' }));
  expect(done).toHaveBeenCalledTimes(1);
});
it('rejects an invalid manually supplied officer ID before mutation', async () => {
  mount(<CaseActions row={row} onDone={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assign department', exact: true }));
  fireEvent.change(await screen.findByLabelText('Optional verified officer UUID'), { target: { value: 'not-a-uuid' } });
  fireEvent.click(screen.getByText('Review: Assign department'));
  expect(await screen.findByText('Enter a valid value.')).toBeInTheDocument();
  expect(work.mutateCase).not.toHaveBeenCalled();
});
it('accepts or returns only a pending report from the active investigation', async () => {
  const report = { id: 'report', assignment_id: 'assignment', review_status: 'PENDING', report_details: 'Fictional report details' };
  work.reviewReport.mockResolvedValue(row);
  mount(<ReportHistory row={{ ...row, status: 'IN_PROGRESS', current_assignment: { id: 'assignment' } }} reports={[report]} admin onDone={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('CMO decision'), { target: { value: 'RETURNED' } });
  fireEvent.change(screen.getByLabelText(/Review remarks/), { target: { value: 'Please supply additional fictional evidence.' } });
  fireEvent.click(screen.getByText('Review report decision')); fireEvent.click(screen.getByText('Confirm action'));
  await waitFor(() => expect(work.reviewReport).toHaveBeenCalledWith('report', expect.objectContaining({ decision: 'RETURNED' })));
});
it('does not offer decisions on an old-cycle report', () => {
  mount(<ReportHistory row={{ ...row, status: 'IN_PROGRESS', current_assignment: { id: 'new' } }} reports={[{ id: 'old', review_status: 'PENDING', assignment_id: 'old' }]} admin />);
  expect(screen.queryByText('Review report decision')).not.toBeInTheDocument();
});
it('loads statewide counts without extrapolating from the recent page', async () => {
  mount(<CMODashboard />); expect(await screen.findByText('37')).toBeInTheDocument();
  expect(screen.getByText('Awaiting report decision')).toBeInTheDocument();
});
it('uses the aggregate district API and renders zero-safe resolution proportions', async () => {
  mount(<AnalyticsPage kind="districts" />); expect(await screen.findByText('Resolved share: 40%')).toBeInTheDocument();
  expect(work.districtStatistics).toHaveBeenCalledTimes(1);
});
it('sends supported administrative filters and resets page', async () => {
  mount(<WorkListPage role="cmo" />); await screen.findByText('No grievances match these filters.');
  fireEvent.change(screen.getByLabelText('Subject search'), { target: { value: 'water' } });
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'HIGH' } });
  fireEvent.click(screen.getByText('Apply filters'));
  await waitFor(() => expect(work.workList).toHaveBeenLastCalledWith('cmo', expect.objectContaining({ subject: 'water', priority: 'HIGH', page: 1 }), expect.any(AbortSignal), false));
});
it('renders advisory AI without executing administrative mutations', () => {
  mount(<AIResult result={{ summary: 'Fictional advice', suggested_category: 'Water Supply', suggested_priority: 'HIGH' }} />);
  expect(screen.getByText(/not an official decision/)).toBeInTheDocument();
  expect(work.mutateCase).not.toHaveBeenCalled();
});
it('never calls AI on mount and requires explicit per-request consent when enabled', async () => {
  vi.stubEnv('VITE_ENABLE_AI_REQUESTS', 'true'); const request = vi.fn().mockResolvedValue({ summary: 'Advice' });
  mount(<AIPanel request={request} />);
  expect(request).not.toHaveBeenCalled(); expect(screen.getByText('Analyze grievance')).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByText('Analyze grievance'));
  await screen.findByText('Advice'); expect(request).toHaveBeenCalledTimes(1);
});
it('keeps provider requests disabled by default', () => {
  const request = vi.fn(); mount(<AIPanel request={request} />);
  expect(screen.getByText(/disabled to protect API quota/)).toBeInTheDocument(); expect(request).not.toHaveBeenCalled();
});
