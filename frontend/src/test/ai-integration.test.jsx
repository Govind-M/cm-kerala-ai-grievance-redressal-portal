import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { analyzeCase, analyzeDraft } from '../services/aiApi.js';
import AIPanel, { AIResult } from '../features/portal/AIPanel.jsx';

const id = '00000000-0000-4000-8000-000000000001';
const mount = (node) => render(<MemoryRouter>{node}</MemoryRouter>);
beforeEach(() => { vi.stubEnv('VITE_ENABLE_AI_REQUESTS', 'true'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each([
  ['analysis', `/cmo/grievances/${id}/ai-analyze`],
  ['duplicates', `/cmo/grievances/${id}/detect-duplicates`],
  ['report', `/cmo/reports/${id}/ai-analyze`],
])('runs %s only after consent, using the existing endpoint', async (kind, path) => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { summary: 'Synthetic advisory result' } });
  mount(<AIPanel request={() => analyzeCase(id, kind)} />);
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Analyze grievance'));
  await screen.findByText('Synthetic advisory result');
  expect(post).toHaveBeenCalledExactlyOnceWith(path, {});
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

it('preserves the citizen draft and applies a category only on explicit review', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { summary: 'Reported road issue', suggested_category: 'Roads and Infrastructure', suggested_priority: 'HIGH', suggested_department: { name: 'Public Works' } } });
  const apply = vi.fn();
  const draft = { district: 'Ernakulam', subject: '  Synthetic road damage  ', description: '  Fictional potholes requiring an inspection.  ', citizen_id: 'must-not-send' };
  mount(<AIPanel request={() => analyzeDraft(draft)} onCategory={apply} />);
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByText('Analyze grievance'));
  await screen.findByText('Department: Public Works');
  expect(apply).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledExactlyOnceWith('/ai/analyze-grievance', { district: draft.district, subject: draft.subject.trim(), description: draft.description.trim() });
  fireEvent.click(screen.getByText('Use suggested category'));
  expect(apply).toHaveBeenCalledExactlyOnceWith('Roads and Infrastructure');
  expect(draft.subject).toBe('  Synthetic road damage  ');
});

it('requires renewed consent after failure and never automatically retries', async () => {
  const request = vi.fn().mockRejectedValue({ response: { status: 429, data: { detail: 'private-provider-detail' } } });
  mount(<AIPanel request={request} />);
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByText('Analyze grievance'));
  await screen.findByRole('alert');
  expect(screen.getByText('Analyze grievance')).toBeDisabled();
  expect(screen.queryByText('private-provider-detail')).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
});

it('blocks repeated clicks while a paid operation is pending', async () => {
  let finish;
  const request = vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  mount(<AIPanel request={request} />);
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByText('Analyze grievance'));
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('status')).toHaveTextContent('Manual workflows remain available');
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => finish({ summary: 'Completed synthetic operation' }));
});

it('links real candidate IDs, labels scores honestly and renders model text safely', () => {
  mount(<AIResult result={{ summary: '<script>untrusted()</script>', candidates: [{ grievance_id: id, reference_number: 'CMK-SYNTHETIC', potentially_duplicate: true, similarity_score: 0.91, reasoning: 'The reports may concern the same event.' }] }} />);
  expect(screen.getByRole('link')).toHaveAttribute('href', `/cmo/grievances/${id}`);
  expect(screen.getByText(/0.91 \(not confidence\)/)).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText('<script>untrusted()</script>')).toBeInTheDocument();
});

it('never turns unvalidated model-generated identifiers into links', () => {
  mount(<AIResult result={{ candidates: [{ grievance_id: 'javascript:alert(1)', reference_number: 'Unknown', potentially_duplicate: false, similarity_score: 0.1, reasoning: 'Invalid identifier' }] }} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
