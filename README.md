Kandi

# PuREPower Dealer Lead Router

A small React dashboard backed by Firebase Authentication and Cloud Firestore, plus a Node.js importer for the legacy lead CSV. Dealer routing uses the first three pincode digits from `data/dealers.csv`; unmatched valid pincodes use the fallback dealer configured in `config/lead-options.json`.

`data/dealers.csv` is the single dealer source: the browser parses it at build time, the importer reads it with `data/legacy_leads.csv`, and the rules generator builds pincode assignments from it. Products, sources, statuses, fallback routing, access policy, plant location, and input length limits live in `config/lead-options.json`. `config/firestore.rules.template` plus that JSON and `data/dealers.csv` generate the required root `firestore.rules`. The legacy leads file is only used by the importer, not loaded into the browser as seed data.

## Run locally

Requirements: Node.js 22.12+ and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

For a local UI walkthrough without Firebase, set `VITE_ENABLE_DEMO_MODE=true` in `.env`. Demo leads stay in browser storage and are never sent to Firestore. Leave it empty for Firebase and every deployed build.

## Firebase setup and deploy

1. Create a Firebase project, register a Web app, and create its Cloud Firestore database in the `asia-south1` region in the Firebase Console.
2. In Authentication, enable Google sign-in. Add the Hosting domain (`<project-id>.web.app`) to authorized domains if Firebase does not add it automatically.
3. Copy the Web app's API key and App ID into `.env`; set `VITE_FIREBASE_PROJECT_ID` to the Firebase project ID. `VITE_FIREBASE_AUTH_DOMAIN` is optional and defaults to `<project-id>.firebaseapp.com`. To approve additional verified Google accounts, add their comma-separated email addresses to `VITE_FIREBASE_ALLOWED_EMAILS` in `.env`.
4. Install the Firebase CLI and sign in once:

	```powershell
	npm install -g firebase-tools
	firebase login
	```

5. Deploy from the project folder:

	```powershell
	npm run deploy
	```

	The command regenerates Firestore rules from `data/dealers.csv` and `config/lead-options.json`, builds the app, then deploys rules and Hosting to the project ID in `.env`. The live URL is `https://<project-id>.web.app`.

The Firebase Web API key and App ID identify the client app; they are not service-account secrets. Keep `.env` and service-account JSON files out of Git. Never put a service-account key in browser code or the repository. Firestore rules and verified-email access checks protect lead data. By default, only verified `purenergy.co.in` accounts can sign in; explicitly authorized accounts can be added to `access.allowedEmails` in `config/lead-options.json` or the comma-separated `VITE_FIREBASE_ALLOWED_EMAILS` variable in `.env`. The same allowlist is applied to the app and generated Firestore rules by `npm run deploy`. Each allowlisted account can read and modify lead records, so only add addresses authorized for that data. A reviewer using a different email needs that authorization to sign in; they can still clone the repo and run the local-only demo to inspect the UI and code.

New web leads are saved to `leads` with their dealer assignment. A transaction also creates a `mobileIndex/{10-digit-phone}` document so two submissions cannot claim the same mobile. Verified company-domain users and explicitly allowlisted emails from `config/lead-options.json` can read lead data; status values come from the same configuration.

Firestore rules enforce the configured verified domains and email allowlist. Project modules are grouped by responsibility: `config` for project policy/rules template, `src/components` for UI, `src/services` for Firebase/repository/CSV access, `src/shared` for access, routing, and lead policy, `scripts/lib` for CSV/OAuth/rules generation, `tests` for behavior and emulator checks, and `reports` for generated outputs.

## Legacy cleanup and import

```powershell
npm run import:legacy
$env:FIREBASE_SERVICE_ACCOUNT_PATH = "C:\secure\service-account.json"
npm run import:legacy -- --write-firestore
```

The first command writes `reports/reconciliation.csv` only. Set `FIREBASE_SERVICE_ACCOUNT_PATH` to the private key stored outside the repository; project ID defaults from `.firebaserc`, with `FIREBASE_PROJECT_ID` available as an optional override. The optional flag imports accepted rows to the same `leads` collection through Firestore's REST API. Node's built-in crypto signs the service-account OAuth assertion, and Node's built-in `fetch` exchanges it for an access token; credentials stay outside the repository. The import is idempotent for records it already imported and stops if a mobile belongs to a different lead.

Run checks with `npm test`, `npm run test:rules` (Firebase CLI and emulator download required), and `npm run build`.

## Assumptions and data findings

- Mobile numbers are Indian numbers: common formatting punctuation and an optional `+91` prefix are removed, and the final number must be ten digits beginning 6-9. A normalized duplicate mobile keeps its first valid input row; later rows are marked `merged`.
- Only six-digit Indian pincodes (first digit cannot be zero), recognized products/sources/statuses, a nonblank name, and real `YYYY-MM-DD` dates are accepted. Invalid required fields reject the row rather than guessing.
- A repeated `lead_id` with a different mobile is retained under a row-based Firestore document ID and called out in the report. The final repeated `L1033` row also repeats a mobile, so it is merged and both collisions are noted. Existing source lead IDs remain in each imported document.
- The 40-row file contains duplicate mobiles, a repeated `L1033`, a missing name, a five-digit mobile, a four-digit pincode, an impossible date (`31/09/2026`), inconsistent product/source/status casing, and a valid pincode (`110001`) with no listed dealer.
- Current reconciliation: 25 imported unchanged, 5 fixed, 5 merged, 4 rejected, and 1 assigned to in-house sales. Every input row has one report row.
