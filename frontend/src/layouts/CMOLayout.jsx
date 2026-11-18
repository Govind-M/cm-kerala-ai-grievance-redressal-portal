import PortalShell from './PortalShell.jsx';

const NAV = [
  { to: '/cmo/dashboard', label: 'Dashboard' },
  { to: '/cmo/grievances', label: 'All Grievances' },
  { to: '/cmo/reports', label: 'Pending Reports' },
  { to: '/cmo/analytics/districts', label: 'District Analytics' },
  { to: '/cmo/analytics/departments', label: 'Department Analytics' },
];

export default function CMOLayout() {
  return <PortalShell navLinks={NAV} title="CMO Administration" accentColor="bg-indigo-900" />;
}
