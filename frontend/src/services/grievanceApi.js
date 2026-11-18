import api from './api.js';

const pick = (row, keys) => Object.fromEntries(keys.map((key) => [key, row[key]]));
const summaryKeys = ['id', 'reference_number', 'subject', 'district', 'category', 'status', 'priority', 'created_at', 'updated_at'];
export function citizenDetail(row) {
  return {
    ...pick(row, [...summaryKeys, 'description', 'assigned_department_name', 'resolved_at']),
    // Never render administrative history text or arbitrary administrative properties.
    history: (row.history ?? []).map((h) => pick(h, ['from_status', 'to_status', 'created_at', 'actor_label'])),
    updates: (row.updates ?? []).filter((u) => u.visibility !== 'INTERNAL').map((u) => pick(u, ['message', 'created_at', 'actor_label'])),
  };
}
const queryKeys = ['page', 'page_size', 'status', 'category', 'district', 'sort_by', 'sort_order'];
export async function listMine(params, signal) {
  const clean = Object.fromEntries(queryKeys.filter((k) => params[k] !== '' && params[k] != null).map((k) => [k, params[k]]));
  const { data } = await api.get('/grievances/me', { params: clean, signal });
  return { pagination: data.pagination, items: data.items.map((r) => pick(r, summaryKeys)) };
}
export const myStatistics = async (signal) => (await api.get('/grievances/me/statistics', { signal })).data;
export const getMine = async (id, signal) => citizenDetail((await api.get(`/grievances/${encodeURIComponent(id)}`, { signal })).data);
export const submitGrievance = async ({ district, category, subject, description }) => citizenDetail((await api.post('/grievances', { district, category, subject: subject.trim(), description: description.trim() })).data);
