import { useCallback, useState } from 'react';
import { Button, Input } from '../../components/ui/index.jsx';
import { listMine } from '../../services/grievanceApi.js';
import { CaseTable, Page, Pagination, ResourceState, Section, Select } from '../portal/components.jsx';
import { CATEGORIES, DISTRICTS, STATUSES } from '../portal/contracts.js';
import { usePortalResource } from '../portal/hooks.js';

export default function CitizenList() {
  const [filters, setFilters] = useState({ status: '', category: '', district: '', sort_by: 'created_at', sort_order: 'desc' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const load = useCallback((signal) => listMine({ ...applied, page, page_size: 10 }, signal), [applied, page]);
  const resource = usePortalResource(load, `mine:${JSON.stringify(applied)}:${page}`);
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  return <Page title="My grievances" intro="Only records belonging to your account are available here."><Section title="Find grievances"><form onSubmit={(e) => { e.preventDefault(); setApplied({ ...filters }); setPage(1); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Select label="Status" options={STATUSES} value={filters.status} onChange={set('status')} /><Select label="Category" options={CATEGORIES} value={filters.category} onChange={set('category')} /><Select label="District" options={DISTRICTS} value={filters.district} onChange={set('district')} /><Select label="Sort by" options={['created_at', 'updated_at']} empty={null} value={filters.sort_by} onChange={set('sort_by')} /><Select label="Order" options={[{ value: 'desc', label: 'Newest first' }, { value: 'asc', label: 'Oldest first' }]} empty={null} value={filters.sort_order} onChange={set('sort_order')} /><Button type="submit">Apply filters</Button></form><Input label="Search this page by reference or subject" value={search} onChange={(e) => setSearch(e.target.value)} hint="Citizen APIs do not support full-list text search. Filters and pagination are server-side; this text search only filters the loaded page." /></Section><Section title="Your records"><ResourceState resource={resource}>{(data) => <><CaseTable role="citizen" items={data.items.filter((r) => `${r.subject} ${r.reference_number}`.toLowerCase().includes(search.toLowerCase()))} /><Pagination pagination={data.pagination} onPage={setPage} /></>}</ResourceState></Section></Page>;
}
