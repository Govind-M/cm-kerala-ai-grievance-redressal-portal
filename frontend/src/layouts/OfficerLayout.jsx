import PortalShell from './PortalShell.jsx';

const NAV = [
  { to: '/officer/dashboard', label: 'Dashboard' },
  { to: '/officer/grievances', label: 'Department Grievances' },
  { to: '/officer/grievances/assigned-to-me', label: 'Assigned to Me' },
];

export default function OfficerLayout() {
  return <PortalShell navLinks={NAV} title="Officer Portal" accentColor="bg-violet-900" />;
}
