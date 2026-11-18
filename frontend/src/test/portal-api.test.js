import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../services/api.js';
import * as citizen from '../services/grievanceApi.js';
import * as work from '../services/workApi.js';
import * as evidence from '../services/evidenceApi.js';
import * as ai from '../services/aiApi.js';
import { portalError } from '../features/portal/contracts.js';

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [], pagination: {} } });
  vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('posts only the four supported grievance fields, without official overrides', async () => {
  await citizen.submitGrievance({ district: 'Kollam', category: 'Water Supply', subject: '  Subject  ', description: '  Description  ', priority: 'HIGH', citizen_id: 'other', department_id: 'secret' });
  expect(api.post).toHaveBeenCalledWith('/grievances', { district: 'Kollam', category: 'Water Supply', subject: 'Subject', description: 'Description' });
});
it('does not send unsupported citizen search/assignment parameters', async () => {
  await citizen.listMine({ page: 2, status: 'RESOLVED', subject: 'ignored', department_id: 'ignored' });
  expect(api.get).toHaveBeenCalledWith('/grievances/me', { signal: undefined, params: { page: 2, status: 'RESOLVED' } });
});
it.each([
  ['review', 'patch', { remarks: 'Reviewed', visibility: 'INTERNAL' }],
  ['resume', 'post', { remarks: 'Resume work', visibility: 'INTERNAL' }],
  ['assign', 'post', { department_id: 'dept', officer_id: null, assignment_note: 'Investigation required' }],
  ['reassign', 'post', { department_id: 'dept', officer_id: null, assignment_note: 'New investigation' }],
  ['priority', 'patch', { priority: 'HIGH', reason: 'Urgent public matter' }],
  ['remarks', 'post', { message: 'Progress update', visibility: 'PUBLIC' }],
  ['escalate', 'post', { reason: 'Escalation required', priority: 'HIGH' }],
  ['reopen', 'post', { reason: 'Issue remains unresolved' }],
])('maps CMO %s to the exact method and request contract', async (action, method, body) => {
  await work.mutateCase('case', action, { ...body, arbitrary_status: 'RESOLVED', citizen_id: 'other' });
  expect(api[method]).toHaveBeenCalledWith(`/cmo/grievances/case/${action}`, body);
});
it('rejects invented actions without making a request', async () => {
  await expect(work.mutateCase('case', 'resolve', {})).rejects.toThrow('Unsupported');
  expect(api.post).not.toHaveBeenCalled();
});
it('whitelists work filters and constrains officer assignment filters to officer APIs', () => {
  expect(work.workParams({ assigned_to_me: true, status: 'IN_PROGRESS', ignored: 'x' }, 'cmo')).toEqual({ status: 'IN_PROGRESS' });
  expect(work.workParams({ assigned_to_me: true }, 'officer')).toEqual({ assigned_to_me: true });
});
it.each(['cmo', 'officer'])('uses the distinct %s detail and aggregate APIs', async (role) => {
  await work.workDetail(role, 'id'); await work.workStatistics(role);
  expect(api.get).toHaveBeenCalledWith(`/${role}/grievances/id`, { signal: undefined });
  expect(api.get).toHaveBeenCalledWith(`/${role}/dashboard/stats`, { signal: undefined });
});
it('uses the officer assigned-to-me route without cross-role fallback', async () => {
  await work.workList('officer', { page: 1 }, undefined, true);
  expect(api.get).toHaveBeenCalledWith('/officer/grievances/assigned-to-me', { params: { page: 1 }, signal: undefined });
  await expect(work.workDetail('citizen', 'id')).rejects.toThrow('Unsupported');
});
it('keeps report submission separate from CMO report acceptance', async () => {
  await work.postReport('case', { report_details: '  Report narrative  ', status: 'RESOLVED' });
  expect(api.post).toHaveBeenCalledWith('/officer/grievances/case/reports', { report_details: 'Report narrative' });
  await work.reviewReport('report', { decision: 'ACCEPTED', review_remarks: '  Accepted after review  ' });
  expect(api.post).toHaveBeenLastCalledWith('/cmo/reports/report/review', { decision: 'ACCEPTED', review_remarks: 'Accepted after review' });
});
it('uploads one multipart file without forcing JSON Content-Type', async () => {
  const file = new File(['synthetic'], 'fictional.pdf', { type: 'application/pdf' });
  await evidence.uploadAttachment('case', file);
  const [path, body, config] = api.post.mock.calls[0];
  expect(path).toBe('/grievances/case/attachments'); expect([...body.keys()]).toEqual(['file']);
  expect(body.get('file')).toBeInstanceOf(File); expect(config.headers).toBeUndefined();
});
it('posts feedback as a strict integer and never sends reopen flags', async () => {
  await evidence.sendFeedback('case', { rating: '5', comment: '  Thank you  ', reopen_requested: true });
  expect(api.post).toHaveBeenCalledWith('/grievances/case/feedback', { rating: 5, comment: 'Thank you' });
});
it('requests signed downloads only through their authorized backend route', async () => {
  await evidence.signedDownload('attachment');
  expect(api.get).toHaveBeenCalledWith('/attachments/attachment/download');
});
it('enforces disabled-by-default AI even if called outside the panel', async () => {
  vi.stubEnv('VITE_ENABLE_AI_REQUESTS', 'false');
  await expect(ai.analyzeDraft({})).rejects.toThrow('disabled');
  await expect(ai.analyzeCase('case')).rejects.toThrow('disabled');
  expect(api.post).not.toHaveBeenCalled();
});
it.each([
  ['analysis', '/cmo/grievances/case/ai-analyze'],
  ['duplicates', '/cmo/grievances/case/detect-duplicates'],
  ['report', '/cmo/reports/case/ai-analyze'],
])('integrates opt-in %s AI with mocked transport only', async (kind, route) => {
  vi.stubEnv('VITE_ENABLE_AI_REQUESTS', 'true'); await ai.analyzeCase('case', kind);
  expect(api.post).toHaveBeenCalledWith(route, {});
});
it.each([401, 403, 404, 409, 413, 422, 429, 500, 503])('provides a safe %i error without reflecting backend internals', (status) => {
  expect(portalError({ response: { status, data: { detail: 'secret internal payload' } } })).not.toContain('secret');
});
