# Vercel-to-Firebase Functions Migration Plan

## Objective

Move `sps-api` from Vercel Functions to Firebase Cloud Functions (2nd generation) without changing its public API contract, MongoDB data model, Firebase Storage objects, authentication behavior, or notification semantics.

The migration will keep the existing Express application and expose it through one Firebase HTTPS function. The in-process `node-cron` jobs will become separate Firebase scheduled functions.

## Current branch assessment

The `firebase` branch currently has:

- An Express 5 application mounted at `/api/v1`, plus `/health`.
- A Vercel adapter at `api/index.mjs` that sets `VERCEL=true` and exports the Express application.
- Per-request serverless bootstrapping on Vercel.
- MongoDB through Mongoose, with the connection reused while an instance remains warm.
- Firebase Admin initialized from service-account environment variables.
- Firebase Storage uploads using Multer memory storage, with a 4 MB combined request limit.
- Firebase Cloud Messaging delivery through a MongoDB-backed queue with three total delivery attempts.
- Three in-process schedules:
  - Notification queue worker: every minute.
  - Assignment due reminder: hourly.
  - One-day assignment reminder: daily at 08:00.
- An authenticated internal notification-worker HTTP endpoint intended for external cron invocation.
- Student and Teacher apps with the Vercel API URL embedded in `app.json`.
- An Admin Panel whose API URL is supplied through `NEXT_PUBLIC_API_BASE_URL`.

No existing application data needs to be migrated. MongoDB remains the system of record, and the existing Firebase Storage bucket and FCM project remain in use. A `notificationevents` outbox collection is added so API-triggered notification work remains reliable after an HTTP function invocation ends.

## Implementation status

Implemented on the `firebase` branch:

- Firebase Functions 2nd-generation entry point and Mumbai region configuration.
- Public Express HTTPS function plus the three scheduled functions.
- Node.js 22 runtime, emulator configuration, deploy/log scripts, and project alias.
- Application Default Credentials in Firebase with local service-account fallback.
- Deploy-time environment validation using non-reserved variable names.
- Serverless-safe MongoDB startup, refresh-token cookies, and multipart uploads.
- Durable MongoDB notification-event outbox consumed by the scheduled notification worker.
- Removal of Vercel and in-process cron entry points.
- Automated Firebase configuration, upload, notification, and release checks.

Local emulator discovery and HTTP checks have passed for `/health` and an authenticated API route. Production deployment still requires Firebase CLI access from an account with permission to deploy to `sps-portal-12e39`.

## Proposed target architecture

| Component | Firebase target | Responsibility |
| --- | --- | --- |
| Express API | 2nd-gen HTTPS function named `spsApi` | All existing `/api/v1/**` and `/health` requests |
| Notification worker | Scheduled function named `notificationWorker` | Claim and deliver queued push notifications every minute |
| Hourly assignment reminder | Scheduled function named `hourlyAssignmentReminders` | Queue reminders for assignments due within one hour |
| Daily assignment reminder | Scheduled function named `dailyAssignmentReminders` | Queue reminders approximately one day before the deadline |
| Public API URL | Direct HTTPS URL for `spsApi` | Use the deployed function URL followed by `/api/v1` |
| Database | Existing MongoDB deployment | No data move or schema change |
| Files and push | Existing Firebase project | Storage uploads/downloads and FCM delivery |
| Configuration | Firebase deployment environment file | Supply MongoDB, JWT, cookie, CORS, and runtime values during deployment |

Recommended starting runtime:

- Firebase Functions 2nd generation.
- Node.js 22.
- `asia-south1` (Mumbai) for the HTTP and scheduled functions.
- 512 MiB memory for the HTTP API initially.
- `minInstances: 0` initially; increase to 1 only if measured cold starts are unacceptable.
- A conservative `maxInstances` and concurrency limit initially to protect the MongoDB connection pool.
- Public invocation for the HTTP API; authorization continues to be enforced by the existing API middleware.

## Phase 0 — Confirm project readiness

The infrastructure decisions are confirmed:

1. Use the existing Firebase project that already provides Storage and FCM.
2. Deploy all functions to `asia-south1` (Mumbai).
3. Use the direct HTTPS function URL; do not add Firebase Hosting.
4. Keep MongoDB Atlas on its existing public connectivity configuration; no VPC connector or static egress IP is required.
5. Use a Firebase deployment environment file rather than Secret Manager.

Before deployment, verify that the Firebase project is on the Blaze plan and that Cloud Scheduler is enabled. Record the Firebase project ID and the exact HTTPS URL printed by the Firebase CLI after deployment.

## Phase 1 — Add the Firebase deployment scaffold

1. Add `firebase-functions` and `firebase-tools` at versions compatible with Node.js 22.
2. Add Firebase project files:
   - `firebase.json` for Functions, emulators, runtime, and deployment ignores.
   - `.firebaserc` with project aliases such as `staging` and `production`.
3. Use the existing `sps-api` directory as the Functions codebase so the Express source and dependencies are not duplicated.
4. Add a dedicated Firebase entry file, separate from `server.js`.
5. Add scripts for:
   - Starting the Functions emulator.
   - Deploying only the HTTP function.
   - Deploying only scheduled functions.
   - Deploying all functions.
   - Reading recent function logs.
6. Add Firebase-generated local and emulator files to `.gitignore` without ignoring the committed deployment configuration.

The local `npm run dev` server remains available on port 5000 during and after the migration.

## Phase 2 — Separate application startup from hosting runtime

Refactor startup so the same Express application runs correctly in local Node and Firebase HTTPS.

1. Remove Vercel-specific bootstrap middleware from `src/app.js`.
2. Make the Firebase HTTPS handler explicitly await `bootstrap({ startJobs: false })` before passing the request to Express.
3. Keep `server.js` responsible only for the standalone local server.
4. Replace the Vercel-only runtime check with explicit local-server and Firebase entry-point behavior.
5. Change `connectDB()` to throw connection errors instead of calling `process.exit(1)` in any serverless runtime.
6. Keep the module-scoped bootstrap promise and Mongoose connection reuse, but make a failed initialization retryable on a later invocation.
7. Add graceful local shutdown for MongoDB where useful; do not disconnect at the end of a Firebase invocation.

Acceptance checks:

- Local server still starts normally.
- Firebase emulator can serve `/health` and `/api/v1/**`.
- A warm function invocation reuses the existing MongoDB connection.
- A failed initial connection returns a controlled 5xx response and does not terminate the function process.

## Phase 3 — Export the HTTPS and scheduled functions

Create four Firebase exports:

1. `spsApi`: wraps the existing Express application with `onRequest`.
2. `notificationWorker`: runs every minute and invokes `runNotificationWorker()` directly.
3. `hourlyAssignmentReminders`: runs at minute zero of every hour and invokes `runHourlyAssignmentDueReminders()` directly.
4. `dailyAssignmentReminders`: runs at 08:00 in `Asia/Kolkata` and invokes `runDailyAssignmentReminders()` directly.

Rules for scheduled functions:

- Call service/job functions directly; do not call the API over HTTP.
- Await all work and let failures reject so Cloud Logging and Scheduler record them.
- Configure timezone explicitly.
- Keep the notification worker's existing database lock/claim behavior.
- Add or verify idempotency for assignment reminders because scheduled functions can overlap or be delivered more than once.
- Ensure a reminder event has a deterministic uniqueness key, such as assignment + reminder type + deadline window, before enabling production schedules.
- Keep the existing three-total-attempt notification behavior unchanged.

After production verification:

- Remove `node-cron` startup from production bootstrap.
- Remove the `node-cron` dependency if it is no longer needed for opt-in local testing.
- Remove or restrict `/api/v1/internal/notification-worker`; Firebase Scheduler no longer needs it.
- Ensure only Firebase schedules are enabled so reminders and push deliveries are not duplicated.

## Phase 4 — Migrate environment configuration and Firebase Admin initialization

### Deployment environment file

Use the Firebase CLI environment-file flow. Keep a local, uncommitted `.env.<firebase-project-id>` file in the Functions source directory so the CLI loads it during deployment. Continue maintaining `.env.example` with placeholders only.

The deployment environment file will contain:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `COOKIE_SECRET`
- `NOTIFICATION_WORKER_SECRET` only while the legacy internal worker endpoint exists

- `NODE_ENV`
- `ALLOWED_ORIGINS`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `COOKIE_SAME_SITE`
- `FIREBASE_STORAGE_BUCKET`
- `NOTIFICATION_BATCH_SIZE`
- log level and optional instance/concurrency tuning values

Update `.gitignore` to exclude `.env`, `.env.*`, and Firebase local overrides while explicitly retaining `.env.example`. Do not commit the production deployment environment file.

### Firebase Admin

1. In Firebase Functions, initialize Firebase Admin with Application Default Credentials.
2. Do not deploy `FIREBASE_PRIVATE_KEY` or `FIREBASE_CLIENT_EMAIL` to Firebase Functions.
3. Retain a safe local initialization path using Application Default Credentials or a locally referenced service-account file.
4. Keep initialization idempotent using the Admin SDK app registry.
5. Verify the function service account has permission to use FCM and the existing Storage bucket.

### Configuration validation

Add a startup validator that reports missing configuration by name without logging secret values. Deployment and cold-start failures should be explicit rather than appearing later as authentication, storage, or database errors.

## Phase 5 — Direct function routing, cookies, CORS, and uploads

### Routing

Direct function routing:

- Export the HTTPS function as `spsApi`.
- Keep Express mounted at `/api/v1`, preserving every current endpoint.
- Use the Firebase CLI-reported function URL as `FUNCTION_URL`.
- Configure clients with `${FUNCTION_URL}/api/v1`.
- Access health at `${FUNCTION_URL}/health`.

For the conventional Firebase URL format, the API base will resemble `https://asia-south1-<project-id>.cloudfunctions.net/spsApi/api/v1`. The deployment output is the source of truth; do not construct or hardcode the hostname independently.

### Authentication and cookies

1. Preserve the existing JWT secrets so access tokens and mobile refresh tokens remain valid across the infrastructure migration.
2. Test refresh-token rotation through both:
   - Browser httpOnly cookies used by the Admin Panel.
   - Request-body refresh tokens used by the Android apps.
3. Set production cookies to `Secure` and `SameSite=None` when the Admin Panel and API remain on different sites.
4. Update CORS origins to include the deployed Admin Panel origin. Native Android requests do not require an origin entry.
5. Expect browser users to sign in again when the API hostname changes because the old refresh cookie belongs to the Vercel domain.

### Uploads

1. Retain Multer memory uploads and the app's 4 MB combined limit.
2. Remove Vercel-specific wording from upload constants and errors.
3. Run multipart tests for assignments, notices, report cards, and assessments.
4. Verify upload, public URL generation, download, and deletion against the existing Storage bucket from the deployed function service account.

## Phase 6 — Client and tooling cutover

### Admin Panel

- Set `NEXT_PUBLIC_API_BASE_URL` to `${FUNCTION_URL}/api/v1`.
- Redeploy the Admin Panel.
- Verify cookie refresh, CORS, all create/update flows, and file uploads.

### Teacher and Student Android apps

- Change `app.json` and the EAS production environment from the Vercel URL to the Firebase URL.
- Remove or generalize Teacher App error handling that specifically checks `x-vercel-id`.
- Produce new builds or a compatible EAS Update.
- Verify login, token refresh, device registration, FCM deep links, and attachment upload/download on physical devices.

## Phase 7 — Verification

Use the real database with uniquely prefixed test records and remove those records after the verification run.

### Local/emulator verification

- Firebase entry file loads under Node.js 22.
- Functions emulator serves health and API routes.
- Missing environment configuration fails clearly.
- MongoDB bootstrap is cached and retryable.
- Each scheduled handler can be invoked directly in tests.
- Scheduler handlers do not start `node-cron`.

### Deployed API smoke tests

- `/health` and a representative unauthenticated validation response.
- Admin, Teacher, and Student login.
- Access-token authorization and role restrictions.
- Browser and mobile refresh-token rotation.
- Dashboard, students, classes, assignments, notices, timetable, report cards, assessments, transfers, and notifications.
- Create/update/delete flows and soft-delete behavior.
- Multipart uploads and attachment deletion.
- Firebase Storage and FCM permissions.
- CORS preflight from the Admin Panel origin.
- Request logs contain trace IDs and useful error metadata without secrets.

### Scheduled-work verification

- Notification queue claims eligible records once.
- Successful delivery updates campaign totals.
- Transient failures stop after three total attempts.
- Invalid tokens are disabled.
- Daily and hourly assignment reminder reruns do not create duplicate notifications.
- Overlapping worker invocations respect locks.

### Load and runtime verification

- Measure cold and warm response times.
- Confirm MongoDB connection counts remain within the cluster limit.
- Test concurrent list and upload requests.
- Tune memory, concurrency, `maxInstances`, timeout, and Mongoose pool size using measured results.

## Phase 8 — Production rollout and rollback

### Rollout

1. Deploy functions with scheduled functions disabled or omitted.
2. Run deployed API smoke and integration tests.
3. Point the Admin Panel to Firebase and verify it.
4. Enable Firebase scheduled functions while confirming all local in-process schedules are disabled in production.
5. Release the mobile client URL update.
6. Monitor Cloud Logging, function errors, latency, instance count, MongoDB connections, notification backlog, and Scheduler execution.
7. Remove test records created during validation.

### Rollback

- Tag the last accepted API revision before deploying the Firebase migration.
- Roll back by redeploying that revision to Firebase and restoring the previous client API configuration if necessary.
- Disable the new Firebase schedules before enabling any replacement scheduler.
- Because the database schema and storage layout do not change, no data rollback should be required.

## Phase 9 — Cleanup

After the Firebase deployment passes acceptance:

- Remove `api/index.mjs`, `vercel.json`, `VERCEL`, and Vercel-only runtime branches.
- Remove the old worker secret and internal cron endpoint if no longer required.
- Remove `node-cron` and local production-like scheduling unless explicitly retained.
- Remove Firebase service-account private-key variables from hosted environments.
- Remove Vercel-specific client error detection.
- Update API operations documentation with deployment, emulator, environment configuration, schedule, logs, and rollback commands.
- Add an Artifact Registry cleanup policy for function deployment images.

## Expected code areas

### API

- `package.json` and lockfile
- New Firebase Functions entry file
- New `firebase.json` and `.firebaserc`
- `server.js`
- `src/app.js`
- `src/bootstrap.js`
- `src/config/db.js`
- `src/config/firebase.js`
- `src/utils/env.js`
- `src/jobs/assignmentReminder.job.js`
- `src/jobs/notificationWorker.job.js`
- `src/controllers/internal.controller.js` and related routes
- `src/constants/uploads.js`
- Environment examples and deployment documentation
- Tests for the new handlers and runtime bootstrap

### Clients

- `sps-admin` deployment environment
- `sps-teacher-app/app.json`, EAS environment, and Vercel-specific API error detection
- `sps-student-app/app.json` and EAS environment

## Completion criteria

The migration is complete when:

- All current API routes behave the same through the Firebase URL.
- Authentication and refresh work for browser and Android clients.
- Uploads and downloads work against the existing bucket.
- All three scheduled jobs run only on Firebase and are idempotent.
- Notification retries remain capped at three total attempts.
- Updated Admin, Teacher, and Student clients use Firebase successfully.
- Logs, alerts, deployment steps, and rollback steps are documented.
- The direct `spsApi` function URL is the configured production API endpoint.

## Official Firebase references

- [Get started with Cloud Functions for Firebase](https://firebase.google.com/docs/functions/get-started)
- [Manage function runtime options](https://firebase.google.com/docs/functions/manage-functions)
- [Configure the Functions environment](https://firebase.google.com/docs/functions/config-env)
- [Schedule functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Initialize the Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Cloud Functions locations](https://firebase.google.com/docs/functions/locations)
- [Cloud Functions quotas and limits](https://firebase.google.com/docs/functions/quotas)
