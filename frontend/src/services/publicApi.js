import api from './api.js';

// Verified FastAPI contracts: array collections, no pagination envelope.
export async function getDepartments(signal) {
  const { data } = await api.get('/departments', { signal });
  if (!Array.isArray(data)) throw new Error('Invalid department response');
  return data.filter((row) => row.is_active !== false).map(({ id, name, description }) => ({ id, name, description }));
}

export async function getFaqs(signal) {
  const { data } = await api.get('/public/faqs', { signal });
  if (!Array.isArray(data)) throw new Error('Invalid FAQ response');
  return data.filter((row) => row.is_active !== false).map(({ id, question, answer, display_order }) => ({ id, question, answer, display_order }));
}

export async function getPublicContent(slug, signal) {
  const { data } = await api.get(`/public/content/${encodeURIComponent(slug)}`, { signal });
  return { title: data.title, introduction: data.introduction, sections: Array.isArray(data.sections) ? data.sections : [] };
}

export async function trackGrievance(reference, signal) {
  const { data } = await api.get(`/grievances/track/${encodeURIComponent(reference)}`, { signal });
  // Explicit projection: never fetch private detail or render arbitrary API properties.
  return {
    reference_number: data.reference_number, subject: data.subject, status: data.status,
    assigned_department_name: data.assigned_department_name, created_at: data.created_at,
    updated_at: data.updated_at,
    history: (Array.isArray(data.history) ? data.history : []).map(({ to_status, created_at, actor_label }) => ({ to_status, created_at, actor_label })),
  };
}

export async function submitContact(fields) {
  const { name, email, subject, message, website } = fields;
  const { data } = await api.post('/contact/enquiries', { name, email, subject, message, website });
  return data;
}

export function publicError(error) {
  const status = error.response?.status;
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'Your account does not have permission for this action.';
  if (status === 404) return 'This record is unavailable or you do not have access to it.';
  if (status === 422) return 'Please check the information entered and try again.';
  if (status === 429) return 'Too many requests. Please wait before trying again.';
  if (status === 413) return 'The message is too large. Please shorten it and try again.';
  return 'The service is currently unavailable. Please try again later.';
}
