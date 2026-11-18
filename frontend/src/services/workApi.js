import api from './api.js';
const segment = encodeURIComponent;
const scope = (role) => { if (!['cmo', 'officer'].includes(role)) throw new Error('Unsupported work scope'); return role; };
const filters = ['page', 'page_size', 'status', 'category', 'district', 'sort_by', 'sort_order', 'priority', 'department_id', 'overdue_only', 'reference', 'subject', 'created_from', 'created_to'];
export function workParams(params, role) {
  return Object.fromEntries([...filters, ...(role === 'officer' ? ['assigned_to_me', 'unassigned_to_officer'] : [])].filter((key) => params[key] !== '' && params[key] != null).map((key) => [key, params[key]]));
}
export const workList = async (role, params, signal, assigned = false) => (await api.get(`/${scope(role)}/grievances${assigned && role === 'officer' ? '/assigned-to-me' : ''}`, { params: workParams(params, role), signal })).data;
export const workDetail = async (role, id, signal) => (await api.get(`/${scope(role)}/grievances/${segment(id)}`, { signal })).data;
export const workStatistics = async (role, signal) => (await api.get(`/${scope(role)}/dashboard/stats`, { signal })).data;
export const districtStatistics = async (signal) => (await api.get('/cmo/statistics/districts', { signal })).data;
export const departmentStatistics = async (signal) => (await api.get('/cmo/statistics/departments', { signal })).data;
export const reportList = async (params, signal) => (await api.get('/cmo/reports', { params: Object.fromEntries(['page', 'page_size', 'review_status', 'department_id', 'reference', 'sort_order'].filter((k) => params[k] !== '' && params[k] != null).map((k) => [k, params[k]])), signal })).data;

const actions = {
  review: ['patch', ['remarks', 'visibility']], resume: ['post', ['remarks', 'visibility']],
  assign: ['post', ['department_id', 'officer_id', 'assignment_note', 'priority']], reassign: ['post', ['department_id', 'officer_id', 'assignment_note', 'priority']],
  remarks: ['post', ['message', 'visibility']], priority: ['patch', ['priority', 'reason']],
  escalate: ['post', ['reason', 'new_deadline', 'priority']], reopen: ['post', ['reason']],
};
export async function mutateCase(id, action, values) {
  const spec = actions[action];
  if (!spec) throw new Error('Unsupported workflow action');
  const body = Object.fromEntries(spec[1].filter((key) => values[key] != null && values[key] !== '').map((key) => [key, typeof values[key] === 'string' ? values[key].trim() : values[key]]));
  if (['assign', 'reassign'].includes(action)) body.officer_id = body.officer_id || null;
  return (await api[spec[0]](`/cmo/grievances/${segment(id)}/${action}`, body)).data;
}
export const reviewReport = async (id, { decision, review_remarks }) => (await api.post(`/cmo/reports/${segment(id)}/review`, { decision, review_remarks: review_remarks.trim() })).data;
export const postUpdate = async (id, { message, visibility }) => (await api.post(`/officer/grievances/${segment(id)}/updates`, { message: message.trim(), visibility })).data;
export const postReport = async (id, { report_details }) => (await api.post(`/officer/grievances/${segment(id)}/reports`, { report_details: report_details.trim() })).data;
