/** Minimal dashboard placeholders — will be replaced in F2/F3/F4/F5 phases. */
import { useAuth } from '../../context/AuthContext.jsx';
import { Card } from '../../components/ui/index.jsx';

function DashboardShell({ role, items }) {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome, {user?.name ?? 'User'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{role} Dashboard</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label} className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{item.value ?? '—'}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Card className="p-5">
          <p className="text-sm text-slate-500 italic">
            Full dashboard content will be implemented in Phase F3 (Citizen), F4 (CMO), or F5 (Officer).
          </p>
        </Card>
      </div>
    </div>
  );
}

export function CitizenDashboard() {
  return (
    <DashboardShell
      role="Citizen"
      items={[
        { label: 'My Grievances', value: null },
        { label: 'In Progress', value: null },
        { label: 'Resolved', value: null },
      ]}
    />
  );
}

export function CMODashboard() {
  return (
    <DashboardShell
      role="CMO Administration"
      items={[
        { label: 'Total Grievances', value: null },
        { label: 'Pending', value: null },
        { label: 'Overdue', value: null },
        { label: 'Resolved', value: null },
        { label: 'Pending Reports', value: null },
        { label: 'Reopened', value: null },
      ]}
    />
  );
}

export function OfficerDashboard() {
  return (
    <DashboardShell
      role="Officer"
      items={[
        { label: 'Assigned to Me', value: null },
        { label: 'Unassigned in Dept', value: null },
        { label: 'Reports Pending Review', value: null },
      ]}
    />
  );
}
