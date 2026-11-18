import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import PortalShell from '../layouts/PortalShell.jsx';
import { presentedPage } from '../features/public/presentation.js';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'test', name: 'Fictional', role: 'CITIZEN' }, logout: vi.fn() }) }));
beforeEach(() => vi.clearAllMocks());
const notice = 'Independent demonstration project. Not affiliated with the Government of Kerala.';

it.each([PublicLayout, PortalShell])('shows one concise disclosure in the layout footer, not as a banner', (Layout) => {
  render(<MemoryRouter><Layout navLinks={[]} title="Citizen portal" /></MemoryRouter>);
  expect(screen.getAllByText(notice)).toHaveLength(1);
  expect(within(screen.getByRole('contentinfo')).getByText(notice)).toBeInTheDocument();
  expect(screen.queryByText(/recruitment demonstration prototype/i)).not.toBeInTheDocument();
});

it('suppresses only the exact seeded duplicate section and leaves original content untouched', () => {
  const disclaimer = { heading: 'Prototype disclaimer', body: 'This is a recruitment demonstration prototype and is not an official Government of Kerala service.' };
  const operational = { heading: 'Important guidance', body: 'Do not send personal data. Not an official service; retain this operational guidance.' };
  const page = { title: 'About this prototype', introduction: 'A WhiteMatrix Software Solutions recruitment demonstration, using fictional data.', sections: [disclaimer, operational] };
  const before = JSON.stringify(page);
  expect(presentedPage(page).sections).toEqual([operational]);
  expect(presentedPage(page).title).toBe('About the platform');
  expect(JSON.stringify(page)).toBe(before);
});
