import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';
import CitizenLayout from '../layouts/CitizenLayout.jsx';
import CMOLayout from '../layouts/CMOLayout.jsx';
import OfficerLayout from '../layouts/OfficerLayout.jsx';
import ProtectedRoute, { GuestRoute } from '../components/shared/ProtectedRoute.jsx';
import NotFoundPage from '../features/shared/NotFoundPage.jsx';
import UnauthorizedPage from '../features/shared/UnauthorizedPage.jsx';
import { PageLoader } from '../components/ui/index.jsx';

// Lazy-load auth pages to keep the initial bundle small
const LoginPage = lazy(() => import('../features/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../features/auth/RegisterPage.jsx'));
const HomePage = lazy(() => import('../features/public/HomePage.jsx'));
const InformationPage = lazy(() => import('../features/public/InformationPage.jsx'));
const DepartmentsPage = lazy(() => import('../features/public/DepartmentsPage.jsx'));
const FAQPage = lazy(() => import('../features/public/FAQPage.jsx'));
const ContactPage = lazy(() => import('../features/public/ContactPage.jsx'));
const TrackingPage = lazy(() => import('../features/public/TrackingPage.jsx'));
const CitizenDashboard = lazy(() => import('../features/citizen/Dashboard.jsx'));
const CitizenList = lazy(() => import('../features/citizen/ListPage.jsx'));
const CitizenDetail = lazy(() => import('../features/citizen/DetailPage.jsx'));
const SubmitPage = lazy(() => import('../features/citizen/SubmitPage.jsx'));
const CMODashboard = lazy(() => import('../features/cmo/Dashboard.jsx'));
const CMODetail = lazy(() => import('../features/cmo/DetailPage.jsx'));
const ReportsPage = lazy(() => import('../features/cmo/ReportsPage.jsx'));
const AnalyticsPage = lazy(() => import('../features/cmo/AnalyticsPage.jsx'));
const WorkListPage = lazy(() => import('../features/portal/WorkListPage.jsx'));
const OfficerDashboard = lazy(() => import('../features/officer/Dashboard.jsx'));
const OfficerDetail = lazy(() => import('../features/officer/DetailPage.jsx'));
const portalView = (element) => <Suspense fallback={<PageLoader />}>{element}</Suspense>;

const publicViews = {
  '/': <HomePage />, '/about': <InformationPage kind="about" />,
  '/how-it-works': <InformationPage kind="how-it-works" />, '/departments': <DepartmentsPage />,
  '/contact': <ContactPage />, '/faq': <FAQPage />, '/track': <TrackingPage />,
};

// Public page list (used by foundation tests)
export const publicPages = [
  ['/', 'Home'],
  ['/about', 'About Us'],
  ['/how-it-works', 'How It Works'],
  ['/departments', 'Departments'],
  ['/contact', 'Contact Us'],
  ['/faq', 'FAQ'],
  ['/track', 'Track Grievance'],
];

export const routes = [
  // ── Public site ────────────────────────────────────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      ...publicPages.map(([path]) => ({
        path,
        element: <Suspense fallback={<PageLoader />}>{publicViews[path]}</Suspense>,
      })),
      { path: '/track/:reference', element: <Suspense fallback={<PageLoader />}><TrackingPage /></Suspense> },
      { path: '/unauthorized', element: <UnauthorizedPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // ── Auth pages (guest-only: redirect authenticated users to their portal) ──
  {
    path: '/login',
    element: (
      <GuestRoute>
        <Suspense fallback={<PageLoader />}>
          <LoginPage />
        </Suspense>
      </GuestRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestRoute>
        <Suspense fallback={<PageLoader />}>
          <RegisterPage />
        </Suspense>
      </GuestRoute>
    ),
  },

  // ── Citizen portal ─────────────────────────────────────────────────────────
  {
    path: '/citizen',
    element: (
      <ProtectedRoute roles={['CITIZEN']}>
        <CitizenLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: portalView(<CitizenDashboard />) },
      { path: 'grievances', element: portalView(<CitizenList />) },
      { path: 'grievances/:id', element: portalView(<CitizenDetail />) },
      { path: 'submit', element: portalView(<SubmitPage />) },
      { path: 'track', element: portalView(<TrackingPage basePath="/citizen/track" />) },
      { path: 'track/:reference', element: portalView(<TrackingPage basePath="/citizen/track" />) },
    ],
  },

  // ── CMO portal ─────────────────────────────────────────────────────────────
  {
    path: '/cmo',
    element: (
      <ProtectedRoute roles={['CMO_ADMIN']}>
        <CMOLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: portalView(<CMODashboard />) },
      { path: 'grievances', element: portalView(<WorkListPage role="cmo" />) },
      { path: 'grievances/:id', element: portalView(<CMODetail />) },
      { path: 'reports', element: portalView(<ReportsPage />) },
      { path: 'analytics/districts', element: portalView(<AnalyticsPage kind="districts" />) },
      { path: 'analytics/departments', element: portalView(<AnalyticsPage kind="departments" />) },
    ],
  },

  // ── Officer portal ─────────────────────────────────────────────────────────
  {
    path: '/officer',
    element: (
      <ProtectedRoute roles={['DEPARTMENT_OFFICER']}>
        <OfficerLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: portalView(<OfficerDashboard />) },
      { path: 'grievances', element: portalView(<WorkListPage key="department" role="officer" />) },
      { path: 'grievances/assigned-to-me', element: portalView(<WorkListPage key="personal" role="officer" assigned />) },
      { path: 'grievances/:id', element: portalView(<OfficerDetail />) },
    ],
  },
];
