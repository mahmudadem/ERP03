# Deployment Diagnostics

## Who Can Use This

Only Super Admin users can open this page.

## Where To Find It

Open:

```text
Super Admin -> System -> Deployment Diagnostics
```

Direct route:

```text
/super-admin/deployment-diagnostics
```

## What It Shows

The page helps you answer:

- Which frontend is loaded.
- Which API URL the frontend is using.
- Which database mode the backend is using.
- Whether the backend can reach the database.
- Whether Firebase Auth is working.
- Which Firebase project the app is connected to.
- Which backend runtime/revision is serving the request, when the hosting platform exposes it.

## What It Does Not Show

For security, it does not show:

- API keys.
- Database passwords or URLs.
- Service account JSON.
- Auth tokens.
- Secret environment variables.
- Customer financial data.

## How To Use It During Deployment QA

1. Open the page after a deploy.
2. Check the top status card.
3. Confirm the database type is what you expect.
4. Confirm backend, auth, and Firebase checks are `OK`.
5. Confirm the frontend host and API base URL point to production.
6. Click `Refresh` after a backend redeploy or cold start.

If any check is red, treat production as not fully verified until the failed service is fixed.
