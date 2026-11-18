import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api.js';
import { getDepartments, getFaqs, getPublicContent, publicError, submitContact, trackGrievance } from '../services/publicApi.js';

afterEach(() => vi.restoreAllMocks());

describe('Verified public API adapters', () => {
  it('uses active department array data with explicit public fields', async () => {
    const signal = new AbortController().signal;
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: '1', name: 'Health', description: 'Description', private: 'SECRET' }, { id: '2', name: 'Inactive', is_active: false }] });
    expect(await getDepartments(signal)).toEqual([{ id: '1', name: 'Health', description: 'Description' }]);
    expect(get).toHaveBeenCalledWith('/departments', { signal });
  });

  it('loads published FAQ records without admin flags', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: '1', question: 'Question?', answer: 'Answer', display_order: 2, is_active: true }] });
    expect(await getFaqs()).toEqual([{ id: '1', question: 'Question?', answer: 'Answer', display_order: 2 }]);
  });

  it('uses the dedicated published page endpoint', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { title: 'Title', introduction: 'Intro', sections: [], is_published: true, draft: 'SECRET' } });
    expect(await getPublicContent('about')).toEqual({ title: 'Title', introduction: 'Intro', sections: [] });
    expect(get).toHaveBeenCalledWith('/public/content/about', { signal: undefined });
  });

  it.each([getDepartments, getFaqs])('rejects malformed collection envelopes instead of fabricating records', async (load) => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } });
    await expect(load()).rejects.toThrow(/Invalid/);
  });

  it('uses ONLY tracking and strips private payload properties and remarks', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { reference_number: 'CMK-2026-A7F29C810D59E246', subject: 'Road', status: 'SUBMITTED', email: 'SECRET', updates: [{ message: 'PRIVATE' }], history: [{ to_status: 'SUBMITTED', created_at: '2026-11-18', actor_label: 'Citizen', remarks: 'SECRET' }] } });
    const data = await trackGrievance('CMK-2026-A7F29C810D59E246');
    expect(get.mock.calls[0][0]).toBe('/grievances/track/CMK-2026-A7F29C810D59E246');
    expect(JSON.stringify(data)).not.toMatch(/SECRET|PRIVATE|email|remarks|updates/);
  });

  it('posts only the accepted contact schema with no privileged fields', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { message: 'Received' } });
    const input = { name: 'Fictional', email: 'fictional@example.com', subject: 'Question', message: 'Test', website: '' };
    await submitContact({ ...input, status: 'REVIEWED', user_id: 'SECRET' });
    expect(post).toHaveBeenCalledWith('/contact/enquiries', input);
  });

  it.each([401, 403, 404, 413, 422, 429, 500, 503, undefined])('never reflects arbitrary error bodies for status %s', (status) => {
    expect(publicError({ response: { status, data: { detail: 'SECRET TRACE' } } })).not.toContain('SECRET');
  });
});
