import { useMemo, useState } from 'react';
import { Input } from '../../components/ui/index.jsx';
import { getDepartments } from '../../services/publicApi.js';
import { DepartmentCard, PageHeading, ResourceState, pageWidth } from './components.jsx';
import useResource from './useResource.js';

export default function DepartmentsPage() {
  const resource = useResource(getDepartments);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => (resource.data || []).filter((row) => `${row.name} ${row.description || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [resource.data, search]);
  return <><PageHeading title="Departments">Explore the active departments available in this demonstration platform. Assignment is reviewed and confirmed by the CMO.</PageHeading><section className={`${pageWidth} py-10 sm:py-14`}>
    <div className="mb-8 max-w-lg"><Input label="Search departments" id="department-search" type="search" maxLength={150} value={search} onChange={(event) => setSearch(event.target.value)} hint="Filter the available directory by name or description." /></div>
    <ResourceState resource={resource} empty={!resource.data?.length} label="departments">
      <p className="mb-5 text-sm text-slate-500" role="status">{rows.length} {rows.length === 1 ? 'department' : 'departments'} found</p>
      {!rows.length ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">No departments match your search. Try another name.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <DepartmentCard key={row.id} department={row} />)}</div>}
    </ResourceState>
  </section></>;
}
