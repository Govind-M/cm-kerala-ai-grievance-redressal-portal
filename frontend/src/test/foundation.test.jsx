import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { publicPages } from '../app/router.jsx';
import api from '../services/api.js';

/**
 * Phase 1 foundation tests.
 *
 * Router tests use MemoryRouter directly against isolated components
 * rather than the full App (which requires AuthProvider + network).
 * Auth integration tests live in features/auth/.
 */

describe('Phase 1 — public page registry', () => {
  it('exports the expected public page routes', () => {
    const paths = publicPages.map(([p]) => p);
    expect(paths).toContain('/');
    expect(paths).toContain('/about');
    expect(paths).toContain('/how-it-works');
    expect(paths).toContain('/departments');
    expect(paths).toContain('/contact');
    expect(paths).toContain('/faq');
    expect(paths).toContain('/track');
  });

  it('every public page entry has a path and a title', () => {
    publicPages.forEach(([path, title]) => {
      expect(typeof path).toBe('string');
      expect(path.startsWith('/')).toBe(true);
      expect(typeof title).toBe('string');
      expect(title.length).toBeGreaterThan(0);
    });
  });
});

describe('Phase 1 — API client configuration', () => {
  it('configures the base URL from the environment variable', () => {
    expect(api.defaults.baseURL).toBe(
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
    );
  });

  it('enables withCredentials for cookie handling', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('sets a sensible timeout', () => {
    expect(api.defaults.timeout).toBeGreaterThanOrEqual(10000);
  });

  it('normalizes connection errors without discarding the original error', async () => {
    const failure = new Error('offline');
    await expect(
      api.get('/health', { adapter: () => Promise.reject(failure) }),
    ).rejects.toMatchObject({
      message: 'offline',
      userMessage: 'The service could not be reached. Please check your connection.',
    });
  });

  it('normalizes server errors with detail string', async () => {
    const serverErr = { response: { status: 400, data: { detail: 'Bad input' } } };
    await expect(
      api.get('/health', {
        adapter: () => Promise.reject(Object.assign(new Error('400'), serverErr)),
      }),
    ).rejects.toMatchObject({ userMessage: 'Bad input' });
  });
});

describe('Phase 1 — PrototypeNotice component', () => {
  it('renders the disclaimer text', async () => {
    const { default: PrototypeNotice } = await import('../components/shared/PrototypeNotice.jsx');
    render(
      <MemoryRouter>
        <PrototypeNotice />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Independent demonstration project/i),
    ).toBeInTheDocument();
  });
});
