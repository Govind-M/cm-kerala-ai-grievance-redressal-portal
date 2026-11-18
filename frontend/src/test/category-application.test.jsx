import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubmitPage from '../features/citizen/SubmitPage.jsx';
import * as ai from '../services/aiApi.js';
import * as grievances from '../services/grievanceApi.js';

vi.mock('../services/aiApi.js', async (original) => ({ ...await original(), analyzeDraft: vi.fn() }));
vi.mock('../services/grievanceApi.js', () => ({ submitGrievance: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_ENABLE_AI_REQUESTS', 'true'); });
afterEach(() => vi.unstubAllEnvs());

async function analyze(category = 'Roads and Infrastructure', reviewFirst = false) {
  ai.analyzeDraft.mockResolvedValue({ suggested_category: category, summary: 'Fictional road damage reported.' });
  render(<MemoryRouter><SubmitPage /></MemoryRouter>);
  for (const [label, value] of [['Subject', 'Fictional road damage'], ['District', 'Ernakulam'], ['Description', 'Fictional potholes beside a public landmark require inspection.']]) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
  }
  if (reviewFirst) fireEvent.click(screen.getByText('Review grievance'));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Analyze grievance'));
  await screen.findByText('Fictional road damage reported.');
}

it('updates the actual controlled dropdown, preserves the draft, permits manual override and makes no submission or extra analysis', async () => {
  await analyze();
  fireEvent.click(screen.getByText('Use suggested category'));
  expect(screen.getByRole('status')).toHaveTextContent('Suggested category applied.');
  expect(screen.getByLabelText('Category')).toHaveValue('Roads and Infrastructure');
  expect(screen.getByRole('option', { name: 'Roads and Infrastructure' }).selected).toBe(true);
  expect(screen.getByLabelText(/^Subject/)).toHaveValue('Fictional road damage');
  expect(screen.getByLabelText('District')).toHaveValue('Ernakulam');
  expect(screen.getByLabelText(/^Description/)).toHaveValue('Fictional potholes beside a public landmark require inspection.');
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Healthcare' } });
  expect(screen.getByLabelText('Category')).toHaveValue('Healthcare');
  expect(grievances.submitGrievance).not.toHaveBeenCalled();
  expect(ai.analyzeDraft).toHaveBeenCalledTimes(1);
});

it('explains an unknown recommendation without applying it or requesting AI again', async () => {
  await analyze('Invented category');
  expect(screen.getByRole('alert')).toHaveTextContent('Please choose a category from the list.');
  expect(screen.queryByText('Use suggested category')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Category')).toHaveValue('');
  expect(ai.analyzeDraft).toHaveBeenCalledTimes(1);
  expect(grievances.submitGrievance).not.toHaveBeenCalled();
});

it('clears a previous category validation error when the valid suggestion is applied', async () => {
  await analyze('Roads and Infrastructure', true);
  expect(screen.getByLabelText('Category')).toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(screen.getByText('Use suggested category'));
  expect(screen.getByLabelText('Category')).toHaveValue('Roads and Infrastructure');
  expect(screen.getByLabelText('Category')).toHaveAttribute('aria-invalid', 'false');
});
