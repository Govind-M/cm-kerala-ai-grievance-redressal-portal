# API Documentation

Base path: `/api/v1`. The registered OpenAPI contract is `/openapi.json`; interactive documentation is `/docs`. Paths below have no trailing slash unless shown. Path IDs are UUIDs. JSON bodies reject unexpected fields in security-sensitive inputs. The tables cover every registered operation, excluding FastAPI's documentation endpoints.

## Authentication and errors

Protected operations require `Authorization: Bearer <access-token>`. Login sets an HttpOnly refresh cookie and returns `access_token`, `token_type`, `expires_in`, `csrf_token` and `user`. Refresh uses that cookie plus the matching `X-CSRF-Token` and trusted Origin; it rotates the token. Logout requires the appropriate authenticated session and CSRF/Origin checks. Do not expose tokens in URLs or persistent browser storage.

| HTTP status | Meaning |
| --- | --- |
| 401 | Missing/invalid/expired token or revoked session |
| 403 | Wrong role, disallowed Origin/CSRF or denied operation |
| 404 | Missing resource or deliberately hidden unauthorized record |
| 409 | Conflict, duplicate feedback or invalid lifecycle operation |
| 413 / 415 | Excessive body/file size or unsupported file type |
| 422 | Input validation failure |
| 429 | Worker-local request/quota limit |
| 503 / 504 | Database/integration unavailable or provider timeout |

Typical error: `{"detail":"Not found"}`. Validation errors use `detail` as an array of `loc`, `msg`, `type`; raw passwords/tokens are not reflected. Error wording varies by operation. Unexpected errors return a sanitized 500 response.

## Public and account endpoints

| Method | Path | Access / input |
| --- | --- | --- |
| GET | `/health` | Public liveness; status/service/version |
| GET | `/health/db` | Public DB connectivity; status/database or 503 |
| GET | `/departments` | Public; optional `q` |
| GET | `/departments/{department_id}` | Public department detail |
| GET | `/public/faqs` | Public active FAQs |
| GET | `/public/content/{page_slug}` | Public published page |
| POST | `/contact/enquiries` | Public validated contact body; write-only acknowledgement |
| POST | `/auth/register` | Public Citizen registration; name/email/mobile_number/password |
| POST | `/auth/login` | Public email/password; session and refresh cookie |
| POST | `/auth/refresh` | Refresh cookie, CSRF nonce and trusted Origin |
| POST | `/auth/logout` | Current authenticated session; cookie/CSRF/Origin |
| POST | `/auth/logout-all` | Authenticated user; revoke user's sessions; CSRF/Origin |
| GET | `/auth/me` | Current authenticated profile |
| PATCH | `/users/me` | Authenticated profile update; not role/password administration |

Registration passwords are 12–128 characters. Public registration cannot select a role or department. For registration/login examples, supply a privately generated password at runtime; no shared demo password is distributed.

Contact example:

```json
{"name":"Demo Visitor","email":"visitor@example.com","subject":"Demonstration enquiry","message":"This is a fictional demonstration enquiry.","website":""}
```

Successful response (202):

```json
{"message":"Thank you. Your enquiry has been received."}
```

## Citizen and shared record endpoints

| Method | Path | Access / input |
| --- | --- | --- |
| POST | `/grievances` | Citizen; district/category/subject/description; 201 detail |
| GET | `/grievances/me` | Citizen's paginated grievances |
| GET | `/grievances/me/statistics` | Citizen counts and status breakdown |
| GET | `/grievances/track/{reference_number}` | Citizen owner or CMO; not public lookup |
| GET | `/grievances/{grievance_id}` | Citizen owner or CMO; citizen-safe detail |
| GET | `/grievances/{grievance_id}/history` | Citizen owner or CMO; internal remarks redacted |
| POST | `/grievances/{grievance_id}/attachments` | Owning Citizen, eligible stage; multipart `file`; 201 metadata |
| GET | `/grievances/{grievance_id}/attachments` | Owner, CMO or currently authorized department; metadata |
| GET | `/attachments/{attachment_id}/download` | Authorized record access; short-lived signed URL |
| POST | `/grievances/{grievance_id}/feedback` | Owning Citizen, eligible resolved cycle; 201 feedback |
| GET | `/grievances/{grievance_id}/feedback` | Owning Citizen's feedback |
| POST | `/ai/analyze-grievance` | Citizen advisory analysis; district/subject/description |

List queries support `page` (default 1), `page_size` (default 10, maximum 100), `status`, `category`, `district`, `sort_by` (`created_at`/`updated_at`) and `sort_order` (`asc`/`desc`). Responses use `items` and `pagination` with `page`, `page_size`, `total_items`, `total_pages`.

Grievance creation example (all fictional):

```json
{"district":"Ernakulam","category":"Roads and Infrastructure","subject":"Demo damaged road surface","description":"Fictional road surface damage is reported near a demonstration junction."}
```

Subject is 5–255 characters; description is 20–10,000. District/category use the canonical 14 districts/12 categories. Clients cannot set citizen_id, reference, status, priority or department. The response includes `id`, generated `reference_number`, subject/district/category, `SUBMITTED`, `MEDIUM`, timestamps, description, assigned_department_name, resolved_at, history and updates. The server generates IDs/references; illustrative IDs must never be treated as existing records.

Feedback body: `{"rating":5,"comments":"Fictional acceptance feedback.","reopen_requested":false}`. Rating is 1–5. A reopen request does not change official status.

## CMO administration

All endpoints in this section require `CMO_ADMIN`.

| Method | Path | Purpose / body |
| --- | --- | --- |
| GET | `/cmo/dashboard/stats` | Statewide dashboard |
| GET | `/cmo/statistics/districts` | District breakdown |
| GET | `/cmo/statistics/departments` | Department breakdown |
| GET | `/cmo/grievances` | Paginated administrative register |
| GET | `/cmo/grievances/{grievance_id}` | Administrative detail |
| PATCH | `/cmo/grievances/{grievance_id}/review` | `remarks?`, `visibility?`; starts review |
| POST | `/cmo/grievances/{grievance_id}/assign` | `department_id`, `assignment_note`, optional officer_id/priority |
| POST | `/cmo/grievances/{grievance_id}/reassign` | Same assignment body; preserves previous assignment |
| POST | `/cmo/grievances/{grievance_id}/remarks` | `message`, optional `visibility` |
| PATCH | `/cmo/grievances/{grievance_id}/priority` | `priority`, `reason` |
| POST | `/cmo/grievances/{grievance_id}/escalate` | `reason`, optional new_deadline/priority |
| POST | `/cmo/grievances/{grievance_id}/reopen` | `reason` |
| POST | `/cmo/grievances/{grievance_id}/resume` | Optional remarks/visibility |
| GET | `/cmo/reports` | Paginated reports; review_status/department_id/reference/sort_order |
| POST | `/cmo/reports/{report_id}/review` | decision `ACCEPTED`/`RETURNED`, review_remarks |
| POST | `/cmo/grievances/{grievance_id}/ai-analyze` | No body; separate advisory result |
| POST | `/cmo/grievances/{grievance_id}/detect-duplicates` | No body; protected potential duplicates |
| POST | `/cmo/reports/{report_id}/ai-analyze` | No body; advisory report review |
| GET | `/cmo/feedback` | Paginated feedback; district/department_id/rating/date filters |
| GET | `/cmo/contact-enquiries` | Paginated enquiries; status/sort_order |
| PATCH | `/cmo/contact-enquiries/{enquiry_id}` | `{"status":"REVIEWED"}` |
| GET / POST | `/cmo/faqs` | List / create typed FAQ |
| PATCH / DELETE | `/cmo/faqs/{faq_id}` | Update / remove FAQ |
| GET / PUT | `/cmo/public-content/{page_slug}` | Read / replace typed public page |

Administrative grievance filters extend citizen filters with `priority`, `department_id`, `overdue_only`, `reference`, `subject`, `created_from`, `created_to` (aware datetimes). Feedback supports page/page_size/sort_order and created_from/created_to. Content schemas, publication flags and allowed slugs are specified in OpenAPI; pages contain plain text sections, not arbitrary executable HTML.

Assignment example:

```json
{"department_id":"00000000-0000-4000-8000-000000000001","officer_id":null,"assignment_note":"Synthetic example: investigate the reported road surface.","priority":"MEDIUM"}
```

Replace the illustrative UUID with a verified active department. Assignment notes/reasons/review remarks require 10–2,000 characters. CMO report review example: `{"decision":"RETURNED","review_remarks":"Please clarify the fictional repair completion evidence."}`. Returning preserves `IN_PROGRESS`; accepting an eligible pending report resolves transactionally.

## Department officers

All endpoints require `DEPARTMENT_OFFICER`; current department and active assignment rules also apply.

| Method | Path | Purpose / input |
| --- | --- | --- |
| GET | `/officer/dashboard/stats` | Department workload |
| GET | `/officer/grievances` | Department register |
| GET | `/officer/grievances/assigned-to-me` | Own designated assignments |
| GET | `/officer/grievances/{grievance_id}` | Scoped investigation detail |
| POST | `/officer/grievances/{grievance_id}/updates` | `message`, optional PUBLIC/INTERNAL visibility |
| POST | `/officer/grievances/{grievance_id}/reports` | `report_details` (20–20,000 characters) |
| GET | `/officer/grievances/{grievance_id}/reports` | Authorized report history |

Officer filters extend administrative register filters with mutually exclusive `assigned_to_me` and `unassigned_to_officer`. Example update: `{"message":"Fictional inspection completed; repair details are pending.","visibility":"PUBLIC"}`. Report submission returns a pending report, never a resolved grievance.

## AI response contract

Classification returns suggested_department_id, suggested_category, suggested_priority, summary, department_reasoning, priority_reasoning, missing_information, suggested_department, `is_advisory:true`, analysis_id, model_name and created_at. Unsaved citizen analysis may have null persistence fields. Duplicate responses expose only CMO-authorized candidate references/similarities and advisory reasoning. Report responses contain report_summary, reported_actions, apparently_addressed_issues, potentially_unresolved, missing_evidence and follow_up_questions. None constitutes an official decision.
