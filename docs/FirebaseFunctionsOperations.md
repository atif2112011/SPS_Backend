# Firebase Functions Operations

## Deployment target

- Firebase project: `sps-portal-12e39`
- Runtime: Node.js 22, Firebase Functions 2nd generation
- Region: `asia-south1` (Mumbai)
- HTTPS function: `spsApi`
- Scheduled functions:
  - `notificationWorker`: every minute
  - `hourlyAssignmentReminders`: hourly
  - `dailyAssignmentReminders`: daily at 08:00 Asia/Kolkata

The Firebase CLI prints the exact HTTPS URL after deployment. The API base URL used by the apps is that URL followed by `/api/v1`. The health endpoint is the same function URL followed by `/health`.

## Environment preparation

Firebase loads the root `.env` file while deploying this codebase. Before deployment, ensure it contains production values for:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `COOKIE_SECRET`
- `SPS_FIREBASE_STORAGE_BUCKET`
- `ALLOWED_ORIGINS`

Set `ALLOWED_ORIGINS` to the deployed Admin Panel origin before deployment. Mobile applications are not browser-CORS clients, but the web Admin Panel is.

Do not put `FIREBASE_*`, `PORT`, `FUNCTION_*`, `K_SERVICE`, or other Firebase-reserved keys in `.env`. Firebase supplies its runtime identity automatically. The optional `SPS_FIREBASE_PROJECT_ID`, `SPS_FIREBASE_PRIVATE_KEY`, and `SPS_FIREBASE_CLIENT_EMAIL` values are only used by the standalone local server or emulator when local Application Default Credentials are unavailable.

## Verification before deployment

Run:

```powershell
npm run test:firebase
npm run test:uploads
npm run test:release-validation
npm run test:notifications
npm run test:notification-events
npm run test:notification-outbox
```

For a complete local Firebase check:

```powershell
npm run firebase:emulators
```

Then open:

```text
http://127.0.0.1:5001/sps-portal-12e39/asia-south1/spsApi/health
```

## Deployment order

Sign in with a Firebase account that has permission to deploy Functions in `sps-portal-12e39`, then deploy the HTTP API first:

```powershell
npx firebase login
npm run firebase:deploy:api
```

Verify the printed function URL and `/health`, then deploy the scheduled functions:

```powershell
npm run firebase:deploy:schedules
```

To deploy all four functions in one operation later:

```powershell
npm run firebase:deploy
```

## Post-deployment checks

1. Confirm `/health` returns a successful response.
2. Log in through the Admin Panel and both Android apps.
3. Refresh an access token and confirm the refreshed session works.
4. Create a notice or assignment and confirm a `notificationevents` row is processed by the next worker run.
5. Upload and download one approved attachment.
6. Confirm the three schedules exist in Google Cloud Scheduler and are enabled.
7. Update the Student App, Teacher App, and Admin Panel to use the deployed function URL plus `/api/v1`.

Read recent logs with:

```powershell
npm run firebase:logs
```

## Rollback

If the scheduled functions cause a problem, disable their Cloud Scheduler jobs first. Point the clients back to the previous API URL while the issue is investigated. MongoDB and Firebase Storage remain shared, so no data copy or restoration is required for this hosting rollback.
