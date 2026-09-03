# Billqo Black Crystal

Personal finance app with the Black Crystal interface. Firebase Authentication identifies the user, and Google Sheets is the single source of truth for all financial data.

## Data Architecture

- Firebase Authentication (project `billqo`): Google sign-in/sign-out and ID token validation.
- Firebase Firestore: only technical OAuth connection metadata (Sheet ID, status, scopes, OAuth states, idempotency, and encrypted refresh token). It does not store transactions, categories, budgets, or financial metrics.
- Google Cloud `billqo`: dedicated project with Google Sheets API, Google Drive API, Firebase Authentication, and Cloud Firestore enabled.
- Google OAuth for Drive/Sheets: uses the web client configured in `GOOGLE_OAUTH_CLIENT_ID`, keeps its secret in the backend only, and requires exact environment callback URLs. Sheets/Drive APIs are enabled in `billqo`.
- Google Drive/Sheets: each user authorizes access to their own account, and the app creates `Billqo - My Finances` in their Drive. The file belongs to the user and is not shared with a Firebase account or a service account.

The backend uses OAuth 2.0 Authorization Code + PKCE. The refresh token never reaches the browser and is never stored in localStorage; it is encrypted with AES-256-GCM on the server. `drive.file` is the only data scope: it limits access to the file Billqo creates or the file explicitly authorized for the app, and the Sheets API accepts that same scope for reading and updating tabs.

## Sheet Structure

When the file is created, these tabs are initialized with no sample transactions:

- `MOVIMIENTOS`: rows with stable IDs, dates, amounts, categories, audit metadata, and soft deletion.
- `CATEGORÍAS`: initial category catalog, editable in the spreadsheet.
- `PRESUPUESTOS`: limits and periods.
- `RECURRENTES`: structure for recurring charges.
- `CONFIGURACIÓN`: currency, format, timezone, and schema version.

All creates, edits, deletions, budgets, preferences, charts, and insights are calculated from a fresh read of the spreadsheet.

## Privacy and Deletion

- `/privacy` explains in the UI what Billqo collects, what it does not collect, and where data is stored.
- Deleting a transaction from the list archives it with `deleted_at` to preserve traceability and stop counting it in the app.
- `Delete Sheet Data` is a separate explicit action: it permanently deletes transactions, budgets, and recurring entries from the document while preserving categories and configuration to keep the structure intact.
- `Disconnect Google` revokes access and removes Billqo technical metadata, but does not delete the user file from Drive. The user can delete the full file directly in Google Drive.

## Local Development

1. Copy `.env.example` to `.env.local` and fill in the OAuth web client that has the environment callbacks registered, its secret, the callback URL, and a random 32-byte base64 key.
2. Keep credentials only in `.env.local`; this file is ignored by `.gitignore`.
3. Run:

```powershell
npm install
npm run dev
```

The app will be available at `http://127.0.0.1:3001`.

The OAuth client must include this exact redirect URI:
`http://127.0.0.1:3001/api/google/oauth/callback`.

The Drive/Sheets OAuth client belongs to project `billqo`. In Google Auth Platform > Clients, register exactly `https://billqo.vercel.app/api/google/oauth/callback`, `http://127.0.0.1:3001/api/google/oauth/callback`, and `http://localhost:3001/api/google/oauth/callback`. In testing mode, add as test users the accounts that will connect their Google Sheet.

## Production

Billqo is deployed on Vercel: `https://billqo.vercel.app`.

- Vercel build runs `npm run vercel-build` and outputs a single Express function for `/api`.
- Firebase Admin, OAuth, and encryption variables live in Vercel as sensitive Production environment variables and are never bundled into the browser.
- In Production, `APP_URL` is `https://billqo.vercel.app` and callback is `https://billqo.vercel.app/api/google/oauth/callback`.
- Firebase Authentication authorizes `billqo.vercel.app`, keeps Google sign-in enabled, and has email/password disabled.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

For manual flow verification: landing -> Firebase auth -> authorize Google Sheets -> create/open `Billqo - My Finances` -> add transaction -> sync. Accessing `/app` without a session redirects to `/auth`.

## Key Files

- `src/lib/firebase.ts`: Firebase App and Authentication, without client-side Firestore.
- `src/lib/api.ts`: authenticated `/api` backend client.
- `src/Dashboard.tsx`: connection loading, onboarding, and financial operations.
- `src/components/CrystalWorkspace.tsx`: Black Crystal shell and views.
- `src/components/AddTransactionModal.tsx`: transaction creation and editing.
- `server/googleAuth.ts`: Google OAuth, PKCE, and refresh tokens.
- `server/connectionStore.ts`: encrypted technical metadata, no financial rows.
- `server/sheets.ts` and `server/sheetsSchema.ts`: spreadsheet structure, CRUD, sync, and validation.
- `server/auth.ts`: Firebase ID token verification and explicit rejection of any provider other than `google.com`.

Direct Firestore writes from the browser were removed. Firestore rules block client access; the backend uses Firebase Admin only for identity and technical metadata.
