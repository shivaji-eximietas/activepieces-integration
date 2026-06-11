# Frontend

Client-side code for Activepieces: web app, embed SDK, and E2E tests.

## Packages

| Path | Description |
|------|-------------|
| `packages/web` | React web application (Vite) |
| `packages/ee/embed-sdk` | Enterprise embed SDK |
| `packages/tests-e2e` | Playwright end-to-end tests |

## Commands (from repo root)

```bash
npm run dev:frontend         # Web + API + engine
npm run serve:frontend       # Web only
npm run test:e2e             # Playwright E2E tests
npm run i18n:extract         # Extract i18n strings
npm run pull-i18n            # Pull translations from Crowdin
```
