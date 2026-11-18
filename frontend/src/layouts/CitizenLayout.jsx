import PortalShell from './PortalShell.jsx';

const NAV = [
  { to: '/citizen/dashboard', label: 'Dashboard' },
  { to: '/citizen/grievances', label: 'My Grievances' },
  { to: '/citizen/submit', label: 'Submit Grievance' },
  { to: '/citizen/track', label: 'Track Grievance' },
];

export default function CitizenLayout() {
  return <PortalShell navLinks={NAV} title="Citizen Portal" accentColor="bg-teal-700" />;
}
