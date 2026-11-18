import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useRoutes } from 'react-router-dom';
import HomePage from '../features/public/HomePage.jsx';
import DepartmentsPage from '../features/public/DepartmentsPage.jsx';
import InformationPage from '../features/public/InformationPage.jsx';
import FAQPage from '../features/public/FAQPage.jsx';
import ContactPage from '../features/public/ContactPage.jsx';
import TrackingPage from '../features/public/TrackingPage.jsx';
import PublicLayout from '../layouts/PublicLayout.jsx';
import { routes } from '../app/router.jsx';
import * as service from '../services/publicApi.js';

const { auth } = vi.hoisted(() => ({ auth: { user: null, loading: false } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('../services/publicApi.js', async (original) => ({
  ...await original(), getDepartments: vi.fn(), getFaqs: vi.fn(), getPublicContent: vi.fn(),
  trackGrievance: vi.fn(), submitContact: vi.fn(),
}));

const reference = 'CMK-2026-A7F29C810D59E246';
const departments = [{ id: '1', name: 'Public Works', description: 'Infrastructure enquiries.' }, { id: '2', name: 'Health', description: 'Healthcare enquiries.' }];
const faqs = [{ id: 'faq1', question: 'How do I track a grievance?', answer: 'Sign in and use your reference.', display_order: 0 }];
const page = { title: 'Published prototype information', introduction: 'Fictional recruitment demonstration.', sections: [{ heading: 'Human decisions', body: 'CMO retains official decisions.' }] };
const tracking = { reference_number: reference, subject: 'Fictional road repair', status: 'IN_PROGRESS', assigned_department_name: 'Public Works', created_at: '2026-11-18T09:00:00Z', updated_at: '2026-11-18T10:00:00Z', history: [{ to_status: 'SUBMITTED', created_at: '2026-11-18T09:00:00Z', actor_label: 'Citizen', remarks: 'SECRET NOTE' }], email: 'private@example.test', attachments: ['SECRET OBJECT'] };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  auth.loading = false;
  service.getDepartments.mockResolvedValue(departments);
  service.getFaqs.mockResolvedValue(faqs);
  service.getPublicContent.mockResolvedValue(page);
  service.trackGrievance.mockResolvedValue(tracking);
  service.submitContact.mockResolvedValue({ message: 'Thank you.' });
});

const mount = (element) => render(<MemoryRouter>{element}</MemoryRouter>);
function Site() { return useRoutes(routes); }
function track(path = `/track/${reference}`) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/track/:reference?" element={<TrackingPage />} /><Route path="/login" element={<p>Sign in screen</p>} /></Routes></MemoryRouter>);
}

describe('Public website', () => {
  it('renders the home narrative, live previews and real route CTAs', async () => {
    mount(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your voice matters.');
    expect(screen.getByRole('link', { name: /submit a grievance/i })).toHaveAttribute('href', '/citizen/submit');
    expect(screen.getByRole('link', { name: /track your grievance/i })).toHaveAttribute('href', '/track');
    expect(await screen.findByText('Public Works')).toBeInTheDocument();
    expect(await screen.findByText('How do I track a grievance?')).toBeInTheDocument();
    expect(await screen.findByText(page.title)).toBeInTheDocument();
    expect(service.getDepartments).toHaveBeenCalledTimes(1);
    expect(service.getFaqs).toHaveBeenCalledTimes(1);
  });

  it('loads departments and filters the actual available dataset', async () => {
    mount(<DepartmentsPage />);
    expect(screen.getByText('Loading departments…')).toBeInTheDocument();
    await screen.findByText('Public Works');
    fireEvent.change(screen.getByLabelText('Search departments'), { target: { value: ' HEALTH ' } });
    expect(screen.getByRole('heading', { name: 'Health' })).toBeInTheDocument();
    expect(screen.queryByText('Public Works')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search departments'), { target: { value: 'unknown' } });
    expect(screen.getByText(/no departments match/i)).toBeInTheDocument();
  });

  it('shows empty departments honestly', async () => {
    service.getDepartments.mockResolvedValue([]);
    mount(<DepartmentsPage />);
    expect(await screen.findByText(/no departments are available/i)).toBeInTheDocument();
  });

  it('sanitizes department errors and supports explicit retry', async () => {
    service.getDepartments.mockRejectedValueOnce({ response: { status: 503, data: { detail: 'PRIVATE DATABASE TRACE' } } });
    mount(<DepartmentsPage />);
    expect(await screen.findByText(/service is currently unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE DATABASE/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry departments' }));
    expect(await screen.findByText('Public Works')).toBeInTheDocument();
  });

  it('loads an accessible FAQ and separates maintained guidance', async () => {
    mount(<FAQPage />);
    const summary = await screen.findByText('How do I track a grievance?');
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
    expect(screen.getByText(/maintained guidance based on the implemented workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/no anonymous grievance lookup/i)).toBeInTheDocument();
  });

  it.each(['about', 'how-it-works'])('renders %s information and real published content', async (kind) => {
    mount(<InformationPage kind={kind} />);
    expect(await screen.findByText(page.title)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    if (kind === 'how-it-works') expect(screen.getByText(/automated email or SMS notifications are not implemented/i)).toBeInTheDocument();
  });

  it('renders published content as text, never HTML', async () => {
    service.getPublicContent.mockResolvedValue({ ...page, introduction: '<img src=x onerror=alert(1)>' });
    mount(<InformationPage kind="about" />);
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('keeps unpublished/missing content unavailable without manufacturing it', async () => {
    service.getPublicContent.mockRejectedValue({ response: { status: 404 } });
    mount(<InformationPage kind="about" />);
    expect(await screen.findByText(/record is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(page.title)).not.toBeInTheDocument();
  });

  it('extends mobile navigation, active routes and prototype branding', () => {
    render(<MemoryRouter><Routes><Route element={<PublicLayout />}><Route path="/" element={<p>Start</p>} /><Route path="/about" element={<h1>About route</h1>} /></Route></Routes></MemoryRouter>);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    const menu = document.getElementById('public-mobile-navigation');
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    const about = within(menu).getByRole('link', { name: 'About' });
    about.focus();
    fireEvent.keyDown(about, { key: 'Escape' });
    expect(toggle).toHaveFocus();
    expect(document.getElementById('public-mobile-navigation')).toBeNull();
    fireEvent.click(toggle);
    fireEvent.click(within(document.getElementById('public-mobile-navigation')).getByRole('link', { name: 'About' }));
    expect(screen.getByRole('heading', { name: 'About route' })).toBeInTheDocument();
    expect(document.getElementById('public-mobile-navigation')).toBeNull();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#public-main');
    expect(screen.queryByText('Government of Kerala')).not.toBeInTheDocument();
  });

  it.each(['/about', '/how-it-works', '/departments', '/faq', '/contact', '/track'])('registers working lazy route %s', async (path) => {
    render(<MemoryRouter initialEntries={[path]}><Site /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Module under development')).not.toBeInTheDocument();
  });
});

describe('Authorized tracking entry', () => {
  it('does not call tracking for anonymous visitors and retains the login destination', async () => {
    track();
    expect(screen.getByText(/anonymous tracking is not available/i)).toBeInTheDocument();
    expect(service.trackGrievance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Sign in to track' }));
    expect(screen.getByText('Sign in screen')).toBeInTheDocument();
  });

  it.each(['CITIZEN', 'CMO_ADMIN'])('renders safe status/history for %s without sensitive fields', async (role) => {
    auth.user = { id: role, role };
    track();
    expect(await screen.findByText('Fictional road repair')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Public Works')).toBeInTheDocument();
    expect(screen.queryByText('SECRET NOTE')).not.toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('SECRET OBJECT')).not.toBeInTheDocument();
  });

  it('never queries officer or invalid-reference access', () => {
    auth.user = { id: 'officer', role: 'DEPARTMENT_OFFICER' };
    track();
    expect(screen.getByText(/department officers should use/i)).toBeInTheDocument();
    expect(service.trackGrievance).not.toHaveBeenCalled();
  });

  it.each([404, 401, 403, 422, 429, 503])('handles tracking HTTP %s safely', async (status) => {
    auth.user = { id: 'citizen', role: 'CITIZEN' };
    service.trackGrievance.mockRejectedValue({ response: { status, data: { detail: 'SECRET' } } });
    track();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  });

  it('validates reference input before navigation or querying', () => {
    auth.user = { id: 'citizen', role: 'CITIZEN' };
    track('/track');
    fireEvent.change(screen.getByLabelText(/grievance reference number/i), { target: { value: '../private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find grievance' }));
    expect(screen.getByText(/enter a reference such as/i)).toBeInTheDocument();
    expect(service.trackGrievance).not.toHaveBeenCalled();
  });

  it('clears displayed data immediately when the identity logs out', async () => {
    auth.user = { id: 'citizen', role: 'CITIZEN' };
    const view = track();
    await screen.findByText('Fictional road repair');
    auth.user = null;
    view.rerender(<MemoryRouter initialEntries={[`/track/${reference}`]}><Routes><Route path="/track/:reference?" element={<TrackingPage />} /></Routes></MemoryRouter>);
    expect(screen.queryByText('Fictional road repair')).not.toBeInTheDocument();
  });
});

function fillContact() {
  for (const [label, value] of [['Full name', ' Fictional Citizen '], ['Contact email', ' demo@example.com '], ['Subject', ' General enquiry '], ['Message', ' A fictional question. ']]) fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
}

describe('Contact enquiry', () => {
  it('validates required fields and email without making a request', () => {
    mount(<ContactPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(screen.getAllByText('This field is required.')).toHaveLength(4);
    fillContact();
    fireEvent.change(screen.getByLabelText(/contact email/i), { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(service.submitContact).not.toHaveBeenCalled();
  });

  it('normalizes data and prevents repeated clicks while pending', async () => {
    let finish;
    service.submitContact.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mount(<ContactPage />);
    fillContact();
    fireEvent.submit(screen.getByRole('form', { name: 'Contact enquiry' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Contact enquiry' }));
    expect(service.submitContact).toHaveBeenCalledTimes(1);
    expect(service.submitContact).toHaveBeenCalledWith({ name: 'Fictional Citizen', email: 'demo@example.com', subject: 'General enquiry', message: 'A fictional question.', website: '' });
    expect(screen.getByRole('button', { name: /sending enquiry/i })).toBeDisabled();
    finish({ message: 'Thank you.' });
    expect(await screen.findByText(/thank you for getting in touch/i)).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it.each([422, 429, 500, undefined])('handles enquiry failure %s without exposing internals', async (status) => {
    service.submitContact.mockRejectedValue({ response: status ? { status, headers: { 'retry-after': '120' }, data: { detail: 'SECRET' } } : undefined });
    mount(<ContactPage />);
    fillContact();
    fireEvent.click(screen.getByRole('button', { name: 'Send enquiry' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
    if (status === 429) expect(screen.getByRole('button', { name: 'Send enquiry' })).toBeDisabled();
    else await waitFor(() => expect(screen.getByRole('button', { name: 'Send enquiry' })).not.toBeDisabled());
  });
});
