import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CitizenDashboard from '../features/citizen/Dashboard.jsx';
import CitizenList from '../features/citizen/ListPage.jsx';
import SubmitPage from '../features/citizen/SubmitPage.jsx';
import FeedbackPanel from '../features/citizen/FeedbackPanel.jsx';
import EvidencePanel, { fileError } from '../features/portal/EvidencePanel.jsx';
import { citizenDetail } from '../services/grievanceApi.js';
import { validateGrievance } from '../features/portal/contracts.js';
import * as grievances from '../services/grievanceApi.js';
import * as evidence from '../services/evidenceApi.js';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'citizen', role: 'CITIZEN' } }) }));
vi.mock('../services/grievanceApi.js', async (original) => ({ ...await original(), listMine: vi.fn(), myStatistics: vi.fn(), getMine: vi.fn(), submitGrievance: vi.fn() }));
vi.mock('../services/evidenceApi.js', () => ({ listAttachments: vi.fn(), uploadAttachment: vi.fn(), signedDownload: vi.fn(), listFeedback: vi.fn(), sendFeedback: vi.fn() }));
const row = { id: 'case-1', reference_number: 'CMK-2026-TEST', subject: 'Fictional water supply issue', status: 'SUBMITTED', priority: 'MEDIUM', district: 'Kollam', category: 'Water Supply', description: 'A fictional issue described with sufficient detail.', created_at: '2026-11-18T00:00:00Z' };
const page = { items: [row], pagination: { page: 1, total_pages: 2, total_items: 11, page_size: 10 } };
const mount = (node) => render(<MemoryRouter>{node}</MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); grievances.listMine.mockResolvedValue(page); grievances.myStatistics.mockResolvedValue({ total: 11, pending: 11, resolved: 0, by_status: {} }); evidence.listAttachments.mockResolvedValue([]); evidence.listFeedback.mockResolvedValue([]); });

it('validates the exact controlled submission schema', () => {
  expect(Object.keys(validateGrievance({}))).toHaveLength(4);
  expect(validateGrievance({ ...row })).toEqual({});
  expect(validateGrievance({ ...row, district: 'Invented' }).district).toBeDefined();
});
it('projects citizen details and drops internal/private administrative data', () => {
  const safe = citizenDetail({ ...row, citizen: { email: 'secret' }, assignment_note: 'secret', history: [{ to_status: 'SUBMITTED', remarks: 'secret', changed_by: 'secret' }], updates: [{ message: 'secret', visibility: 'INTERNAL' }] });
  expect(JSON.stringify(safe)).not.toContain('secret');
});
it('loads actual citizen statistics and recent records', async () => {
  mount(<CitizenDashboard />);
  expect(await screen.findByText(row.subject)).toBeInTheDocument();
  expect(screen.getByText('Total submitted')).toBeInTheDocument();
  expect(grievances.myStatistics).toHaveBeenCalledTimes(1);
});
it('supports server pagination and controlled filters, with explicitly page-local text search', async () => {
  mount(<CitizenList />); await screen.findByText(row.subject);
  fireEvent.click(screen.getByText('Next'));
  await waitFor(() => expect(grievances.listMine).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'RESOLVED' } });
  fireEvent.click(screen.getByText('Apply filters'));
  await waitFor(() => expect(grievances.listMine).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'RESOLVED' }), expect.any(AbortSignal)));
});
it('does not submit invalid grievances', async () => {
  mount(<SubmitPage />); fireEvent.click(screen.getByText('Review grievance'));
  expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
  expect(grievances.submitGrievance).not.toHaveBeenCalled();
});
it('requires review/confirmation, prevents duplicate writes and retains the receipt for separate uploads', async () => {
  let finish; grievances.submitGrievance.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  mount(<SubmitPage />);
  for (const [label, value] of [['Subject', row.subject], ['Description', row.description], ['District', row.district], ['Category', row.category]]) fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`, 'i')), { target: { value } });
  fireEvent.click(screen.getByText('Review grievance'));
  expect(grievances.submitGrievance).not.toHaveBeenCalled();
  const confirm = screen.getByText('Confirm action'); fireEvent.click(confirm); fireEvent.click(confirm);
  expect(grievances.submitGrievance).toHaveBeenCalledTimes(1);
  finish(row);
  expect(await screen.findByText(row.reference_number)).toBeInTheDocument();
  expect(screen.getByText('Evidence attachments')).toBeInTheDocument();
});
it('submits eligible feedback without requesting a reopen', async () => {
  evidence.sendFeedback.mockResolvedValue({ id: 'feedback' });
  mount(<FeedbackPanel grievance={{ ...row, status: 'RESOLVED' }} />);
  fireEvent.change(await screen.findByLabelText('Satisfaction rating'), { target: { value: '4' } });
  fireEvent.click(screen.getByText('Review feedback')); fireEvent.click(screen.getByText('Confirm action'));
  await waitFor(() => expect(evidence.sendFeedback).toHaveBeenCalledWith(row.id, { rating: '4' }));
});
it('does not offer feedback on an unresolved case', async () => {
  mount(<FeedbackPanel grievance={row} />); await screen.findByText(/Feedback is available only/);
  expect(screen.queryByText('Review feedback')).not.toBeInTheDocument();
});
it('validates evidence types and sizes', () => {
  expect(fileError(new File(['x'], 'bad.exe', { type: 'application/octet-stream' }))).toMatch(/PDF/);
  expect(fileError(new File([''], 'empty.pdf', { type: 'application/pdf' }))).toMatch(/nonempty/);
  expect(fileError(new File(['x'], 'fictional.pdf', { type: 'application/pdf' }))).toBe('');
});
it('never auto-fetches signed links or uploads files on mount', async () => {
  mount(<EvidencePanel id={row.id} canUpload />); await screen.findByText('No evidence uploaded.');
  expect(evidence.signedDownload).not.toHaveBeenCalled(); expect(evidence.uploadAttachment).not.toHaveBeenCalled();
});
it('retains the submission receipt after an upload failure and requires listing before retry', async () => {
  grievances.submitGrievance.mockResolvedValue(row);
  evidence.uploadAttachment.mockRejectedValue({ response: { status: 503 } });
  mount(<SubmitPage />);
  for (const [label, value] of [['Subject', row.subject], ['Description', row.description], ['District', row.district], ['Category', row.category]]) fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`, 'i')), { target: { value } });
  fireEvent.click(screen.getByText('Review grievance')); fireEvent.click(screen.getByText('Confirm action'));
  await screen.findByText('No evidence uploaded.');
  fireEvent.change(screen.getByLabelText('Select evidence file'), { target: { files: [new File(['synthetic'], 'fictional.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByText('Upload selected evidence'));
  await screen.findByText(/Your grievance remains submitted/);
  expect(screen.getByText(row.reference_number)).toBeInTheDocument();
  expect(grievances.submitGrievance).toHaveBeenCalledTimes(1);
  expect(evidence.uploadAttachment).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Upload selected evidence')).toBeDisabled();
  fireEvent.click(screen.getByText('Reload attachment list before retry'));
  await waitFor(() => expect(evidence.listAttachments).toHaveBeenCalledTimes(2));
});
it('shows safe API failure and permits deliberate reload', async () => {
  grievances.listMine.mockRejectedValue({ response: { status: 403 } });
  mount(<CitizenList />); expect(await screen.findByText(/does not have permission/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Reload data'));
  await waitFor(() => expect(grievances.listMine).toHaveBeenCalledTimes(2));
});
