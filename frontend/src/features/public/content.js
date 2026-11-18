// Maintained workflow explanations, not simulated API data or government policy.
export const steps = [
  ['Create your account', 'Register as a citizen, then sign in. Your grievance records are private to you and authorized staff.'],
  ['Describe your grievance', 'Choose the district and category, explain the issue and optionally upload supporting evidence after submission.'],
  ['Consider AI suggestions', 'Optional AI can suggest a category, department and priority. Submission does not depend on AI availability.'],
  ['CMO reviews the case', 'The grievance moves from Submitted to Under Review. The CMO administrator makes the official decisions.'],
  ['A department is assigned', 'The CMO chooses a department and optionally a designated officer. Investigation moves to In Progress.'],
  ['Officers investigate', 'Authorized officers record investigation updates. Only public updates are visible to the citizen.'],
  ['An action-taken report is submitted', 'Submitting a report does not resolve the case. The CMO must review it.'],
  ['CMO reviews the outcome', 'The CMO can accept the report and resolve the case, or return it for further work.'],
  ['Track and share feedback', 'Sign in to see status and public updates. After resolution, give feedback once per resolution cycle.'],
];

export const guidanceFaqs = [
  ['Who can submit a grievance?', 'Registered citizens can submit grievances after signing in.'],
  ['How do I register and sign in?', 'Choose Register, create a citizen account and then use Sign In. CMO and officer accounts are provisioned separately.'],
  ['How do I submit a grievance?', 'Use Submit a Grievance to enter the citizen portal. The submission screen is part of the next citizen-portal phase; backend submission is already implemented.'],
  ['How do I track my status?', 'Use your reference number on Track Grievance after signing in. Citizens can only track their own records; there is no anonymous grievance lookup.'],
  ['Who assigns the department?', 'The CMO administrator selects the department and may designate an officer. AI suggestions never make the assignment automatically.'],
  ['What does AI assistance do?', 'Optional AI suggests classification and summarizes information. Human administrators retain all official decisions. AI may be unavailable without preventing manual workflows.'],
  ['When is a grievance resolved?', 'An officer submits an action-taken report. Only CMO acceptance of the appropriate report resolves the grievance. No guaranteed resolution timeline is implied.'],
  ['How can I give feedback?', 'After resolution, the citizen owner may submit a rating from 1 to 5 and an optional comment. One entry is allowed per completed resolution cycle.'],
  ['What happens if further review is needed?', 'The CMO may return a report for further investigation or reopen a resolved case. A reopened case requires a fresh investigation and report before another resolution. Citizen feedback does not automatically reopen a case.'],
];
