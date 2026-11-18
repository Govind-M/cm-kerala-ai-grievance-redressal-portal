// Mirrored verbatim from backend grievances/choices.py and enums.py.
export const DISTRICTS = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'];
export const CATEGORIES = ['Roads and Infrastructure', 'Healthcare', 'Education', 'Water Supply', 'Sanitation and Waste Management', 'Electricity', 'Transportation', 'Revenue and Land', 'Local Government Services', 'Public Safety', 'Social Welfare', 'Other'];
export const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const label = (value) => String(value ?? '').replaceAll('_', ' ');
export const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not available';

export function caseActions(row) {
  const pending = row.reports?.some((r) => r.review_status === 'PENDING');
  return {
    review: row.status === 'SUBMITTED',
    assign: ['UNDER_REVIEW', 'REOPENED'].includes(row.status) && !row.current_assignment && !pending,
    reassign: ['IN_PROGRESS', 'REOPENED'].includes(row.status) && !!row.current_assignment && !pending,
    resume: row.status === 'REOPENED' && !!row.current_assignment,
    reopen: row.status === 'RESOLVED',
    escalate: row.status !== 'RESOLVED',
    priority: true, remarks: true,
  };
}

export function validateGrievance(values) {
  const errors = {};
  if (!DISTRICTS.includes(values.district)) errors.district = 'Choose a supported district.';
  if (!CATEGORIES.includes(values.category)) errors.category = 'Choose a supported category.';
  for (const [key, min, max] of [['subject', 5, 255], ['description', 20, 10000]]) {
    const text = values[key]?.trim() ?? '';
    if (text.length < min || text.length > max || text.includes('\0')) errors[key] = `Enter ${min}–${max} characters.`;
  }
  return errors;
}

export function portalError(error) {
  const status = error?.response?.status;
  return ({
    401: 'Your session has expired. Sign in again.',
    403: 'Your account does not have permission for this action.',
    404: 'This record is unavailable or you do not have access to it.',
    409: 'The case has changed or this action conflicts with its current state. Reload before trying again.',
    413: 'The file or request exceeds the permitted size.',
    422: 'Please check the highlighted fields and supported values.',
    429: 'Too many requests. Wait before trying again.',
  })[status] ?? 'The service is unavailable. Your action was not confirmed. Reload to check before retrying.';
}
