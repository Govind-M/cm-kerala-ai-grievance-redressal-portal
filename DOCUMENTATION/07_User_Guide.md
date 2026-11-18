# User Guide

This independent demonstration is not a government service. Use fictional grievances and evidence only. Account credentials are supplied privately by the operator; none are included in this repository.

## Public visitors

Use the Home, About, How It Works, Departments and FAQ pages for published information. Contact accepts an enquiry but does not expose other enquiries. Tracking is authentication-required: a reference number alone does not grant access to another person's grievance. Login and registration are available from the public navigation.

## Citizens

1. Register with name, email, mobile number and a private password of 12–128 characters. Registration creates a Citizen only.
2. Log in and open the Citizen dashboard to see your statistics and case list. Filters and pagination apply to your records, not the entire register.
3. Submit a grievance with district, category, subject and description. Choose from the supported values and avoid personal or sensitive detail in the narrative.
4. If AI is enabled by the operator, read the consent notice and explicitly request assistance. Review suggestions before applying a category; advice is not an official priority or assignment. Submission remains available without AI.
5. Retain the generated reference number. Use your list/detail or authenticated tracking page to see status, authorized history and public updates. Internal administrative notes are not visible.
6. When private Storage is configured, upload permitted evidence through the case page in an eligible non-resolved stage. Authorized download links expire; they are not permanent public file URLs. An unavailable Storage service does not imply an upload succeeded.
7. After resolution, submit eligible feedback with a 1–5 rating and optional comments/reopen request. Only one entry per resolution cycle is accepted. A reopen request still needs CMO action.
8. Log out from the account controls. A conclusive expired/revoked session requires login; temporary network failure offers restoration recovery. Do not repeatedly submit a form whose outcome is unknown.

## CMO administrators

1. Use an operator-provisioned CMO account. The dashboard shows statewide workload; the register supports status, district, category, priority, department, date and reference filters.
2. Open a submitted grievance and start review. Check the original narrative; optional AI analysis is separately labelled advice.
3. Choose an active department and optionally a designated officer, with a meaningful assignment note. The backend validates the assignment. Assigned cases move to `IN_PROGRESS`.
4. Update priority with a reason, add appropriately visible remarks, reassign or escalate when justified. Previous assignments and history remain available.
5. Inspect officer updates and pending Action Taken Reports. Optional AI review identifies reported actions/gaps but does not verify physical completion.
6. Return an incomplete report with clear review remarks. The case stays `IN_PROGRESS`; the officer provides corrections through a new report. Accept an eligible pending report only after human review; acceptance resolves the case.
7. Reopen a resolved grievance with a reason and resume controlled investigation when needed. A fresh report is required for a new resolution cycle.
8. Review analytics, feedback and contact enquiries. Public FAQ/page management exposes only active/published content. Never place private case information in public content.

## Department officers

1. Log in with the operator-provisioned account linked to your active department.
2. Review departmental cases or the Assigned to Me list. A named officer assignment limits modifications to that officer; other officers in the same department may have read-only access. Unrelated departments cannot access the case.
3. Open investigation detail, review the grievance and existing authorized history, and add factual progress updates with the correct public/internal visibility.
4. Submit an Action Taken Report describing the work and any limitations. Submission creates a `PENDING` report; it does not resolve the grievance.
5. If CMO returns the report, address the stated gaps and submit a corrected report. Preserve earlier report history. Only CMO acceptance changes an eligible case to `RESOLVED`.

## Acceptance checklist

- Public pages, navigation, FAQ and contact errors behave correctly at desktop, tablet and mobile widths.
- Each role reaches its own dashboard; cross-role links and direct API calls are rejected.
- Citizen A cannot retrieve Citizen B's details, tracking, history, attachments or feedback.
- Refresh/reload/tab switching preserves valid sessions; transient failures do not silently discard credentials; revoked sessions cannot restore.
- One labelled synthetic case completes submission, review, assignment, investigation, returned report, correction, acceptance and feedback while preserving audit history.
- Officer report submission cannot resolve the case, and AI advice cannot perform official actions.
- Evidence is tested only with an explicitly authorized private test bucket. AI is tested only under a separately approved counted budget.
- On hosted domains, verify Secure/HttpOnly cookies, CSRF enforcement and browser third-party-cookie behavior. Automated component tests do not replace these checks.

These are operator acceptance steps, not a claim they have all been executed on a hosted deployment.
