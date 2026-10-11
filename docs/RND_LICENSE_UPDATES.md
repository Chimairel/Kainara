# RND license renewal and recorded-detail corrections

## Workflow

An expired registered RND can open **RND profile → License renewal or correction**. Clinical queues, meal library and review actions remain protected by the current credential. Expiry is inclusive of its entire date in Asia/Manila.

The RND selects renewal or correction and supplies the PRC number, correct expiry, reason, consent and one PDF/JPG/PNG document (maximum 4 MiB). Only one pending request is allowed. The current credential remains unchanged while pending; an eligible RND retains review access.

An admin opens **People → RNDs → License updates**, checks previous/proposed details, downloads the evidence and records an approval or rejection reason of at least ten characters. Successful document access is audited and required by the backend before approval. Downloading does not prove authenticity: the administrator must check identity, number and expiry.

Approval replaces only the recorded number/expiry and verifier attribution. It never removes a suspension or activates an unverified application. Changed credentials, duplicate decisions, expired proposals and ineligible accounts prevent approval. Rejection preserves the current credential and permits another submission. The RND receives a notification; both roles can read saved request/decision history.

## Access and storage

- Own profile maintenance permits biography/specialization edits only; clients cannot set credentials or verification flags.
- Evidence uses the existing AES-256-GCM document key and hash verification. Preserve `CLINICAL_DOCUMENT_ENCRYPTION_KEY` during deployment.
- Downloads are authenticated, owner/admin scoped, audited attachments with `private, no-store`. Lists exclude encrypted document bytes.
- Submissions allow six attempts per authenticated RND per minute. Server checks file size, MIME and content signatures.
- Requests snapshot previous/proposed credentials, purpose, reason, decision, reviewer name and time. Audit events record submission, access and decisions. Account deletion follows the existing privacy lifecycle; retention is not perpetual.
- Presentation reads are account scoped, with 60-second fallback polling paused in hidden tabs. Clinical authorization is always checked on the server.

## API

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/nutritionist/credential-status` | RND | Current eligibility and maintenance status |
| `GET/PATCH /api/nutritionist/profile` | RND | Own maintenance; no credential edits |
| `GET/POST /api/nutritionist/license-updates` | RND | Own history / multipart submission |
| `GET /api/nutritionist/license-updates/:id/document` | Owner RND | Download own evidence |
| `GET /api/admin/license-updates` | Admin | Paginated requests, optional status |
| `GET /api/admin/license-updates/:id/document` | Admin | Audited evidence download |
| `POST /api/admin/license-updates/:id/decision` | Admin | Guarded decision |

## Rollout

Apply additive migration `202610110001_nutritionist_license_updates` to an explicitly confirmed target after backup. Deploy backend before frontend. The migration changes no current credentials. Preserve signing, encryption and provider secrets. A code rollback leaves additive history tables intact; do not delete audit/evidence to reverse deployment.

Normal localhost and hosted Neon require separate README target confirmations. Isolated verification does not mean the public site is upgraded.

## Verification — October 11, 2026

- Final migration applied to a new empty disposable PostgreSQL 17 database, `kainara_license_acceptance` on loopback. No existing or hosted accounts were modified.
- Six HTTP/database groups cover expired maintenance/blocked reviews, role/owner boundaries, invalid and oversized uploads, unchanged pending credentials, database uniqueness/decision constraints, encrypted evidence round-trip, audited access, concurrent approval, final decision protection, rejection/correction, stale credentials and suspension.
- Real Chromium normal logins with separate synthetic RND/admin contexts verified submission, evidence-gated approval, restored access, valid pending access, rejection and history. Captures cover light/dark desktop and narrow RND profiles. An initial harness used a nonexistent ARIA tab role; using the shared rail's actual button semantics completed the flow without an application change.
- Expiry labels use actual access status. Missing school/license/specialization values display as unrecorded instead of invented defaults.
- Private logs, fixtures and screenshots: `backend/.local/defense-recovery/1791696253565/license-updates/` (ignored; never commit credentials).

PRC authenticity requires administrator verification; credentials are never automatically extended.
