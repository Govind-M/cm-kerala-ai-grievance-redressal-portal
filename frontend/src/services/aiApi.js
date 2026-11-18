import api from './api.js';
// Independent opt-in: no real provider work merely because a backend has a key.
export const aiRequestsEnabled = () => import.meta.env.VITE_ENABLE_AI_REQUESTS === 'true';
export async function analyzeDraft({ district, subject, description }) {
  if (!aiRequestsEnabled()) throw new Error('AI requests are disabled');
  return (await api.post('/ai/analyze-grievance', { district, subject: subject.trim(), description: description.trim() })).data;
}
export async function analyzeCase(id, kind = 'analysis') {
  if (!aiRequestsEnabled()) throw new Error('AI requests are disabled');
  const routes = { analysis: `/cmo/grievances/${encodeURIComponent(id)}/ai-analyze`, duplicates: `/cmo/grievances/${encodeURIComponent(id)}/detect-duplicates`, report: `/cmo/reports/${encodeURIComponent(id)}/ai-analyze` };
  if (!routes[kind]) throw new Error('Unsupported AI operation');
  return (await api.post(routes[kind], {})).data;
}
