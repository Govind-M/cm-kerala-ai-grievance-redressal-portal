# AI Integration

## Implemented tasks

The backend uses LangChain Core prompt/runnable abstractions and `langchain-google-genai` for Gemini structured chat. The Google GenAI SDK supplies embeddings. Default chat model: `gemini-3.5-flash-lite`. Default embedding model: `gemini-embedding-001`, with 768 dimensions. Configuration also accepts `gemini-embedding-2`; that alternative has not been live-verified. Provider model availability remains account-dependent.

| Task | Input | Result |
| --- | --- | --- |
| Citizen classification | District, subject, description and allowed departments | Category/department/priority suggestions, summary, reasoning, missing information |
| CMO case analysis | Authorized stored grievance | Same structured advice, stored separately from official fields |
| Duplicate assessment | Protected vector shortlist and source grievance | Potential-duplicate flags and grounded reasoning, not rejection/merging |
| Report review | Grievance, relevant updates and selected report | Claimed actions, apparently addressed issues, gaps, missing evidence and follow-up questions |

Task-specific prompts request native structured output. Strict Pydantic models constrain lengths, enum values, UUIDs and extra fields. Suggested departments are checked against active records. Unsupported or malformed responses fail safely; ordinary non-AI workflows continue independently.

## Retrieval and provenance

Embedding content is minimized and associated with model name, dimensions and a source fingerprint. Vectors must be finite, normalized and compatible with the selected model. PostgreSQL/pgvector cosine retrieval uses a bounded same-district shortlist; defaults are five candidates and similarity threshold 0.75. Gemini assesses that shortlist rather than receiving every grievance. This is focused duplicate retrieval, not a general knowledge-base RAG system.

There is no automatic historical embedding backfill at startup. The guarded indexing utility requires operator review. Embeddings and AI JSONB records remain protected application data. Saved analyses include requester/model/type and optional report provenance; they do not overwrite category, priority, assignment or status.

## Human review and provider safety

- Citizen assistance requires a deliberate interface action and consent; original descriptions are not silently rewritten.
- A suggested category can be applied explicitly, with feedback; applying it clears that field's obsolete validation error without discarding other errors.
- CMO users confirm official decisions. AI never assigns departments, accepts reports, resolves cases or merges duplicates autonomously.
- Prompts treat complaint/report text as untrusted data. Privacy minimization redacts common contact/credential patterns, but it is not a guarantee of complete anonymization.
- Requests are bounded by input/output limits, timeout, worker-local rate limiting and short-lived caching. Automatic retries default to zero.
- `AI_ENABLED` and `AI_LIVE_REQUESTS_ENABLED` both default false. A configured key alone does not enable requests. Keep tracing disabled for sensitive material.
- Pytest blocks external sockets and the Gemini SDK transmission boundary; all provider responses are mocked. Mocked failures include quotas, timeout, malformed output and authorization boundaries.

## Verification evidence and limits

A prior, explicitly authorized development verification recorded nine budgeted application attempts: eight successful Gemini transmissions and one locally blocked embedding operation before transmission. The successful transmissions covered provider verification, Citizen and CMO classifications, three embeddings, duplicate assessment and report analysis. Automatic retries were disabled. A related synthetic road pair was flagged; an unrelated synthetic case was not. Results persisted separately, and official fields remained unchanged. This historical evidence is not a claim that the new hosted deployment has been verified.

After that run, the classification prompt was refined offline to avoid soliciting redacted identity/contact details. That final prompt refinement has mocked coverage but no subsequent live verification. AI recommendations varied in priority between analyses, illustrating their advisory nature. Report analysis cannot verify physical repairs or evidence authenticity.

This submission preparation makes **zero** real Gemini requests and performs no embedding backfill. Hosted AI remains disabled until separately authorized and securely configured. Future live verification must use an explicit bounded approval and counted attempts; do not rerun historical private verification fixtures. `scripts.ai_live_smoke` is opt-in and limited to one chat and one embedding, with zero retries and fail-fast behavior.
