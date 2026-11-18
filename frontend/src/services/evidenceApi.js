import api from './api.js';
export const listAttachments = async (id, signal) => (await api.get(`/grievances/${encodeURIComponent(id)}/attachments`, { signal })).data;
export const signedDownload = async (id) => (await api.get(`/attachments/${encodeURIComponent(id)}/download`)).data;
export async function uploadAttachment(id, file, onUploadProgress) {
  const form = new FormData();
  form.append('file', file);
  return (await api.post(`/grievances/${encodeURIComponent(id)}/attachments`, form, { onUploadProgress })).data;
}
export const listFeedback = async (id, signal) => (await api.get(`/grievances/${encodeURIComponent(id)}/feedback`, { signal })).data;
export const sendFeedback = async (id, { rating, comment }) => (await api.post(`/grievances/${encodeURIComponent(id)}/feedback`, { rating: Number(rating), comment: comment?.trim() || null })).data;
