# Sagawa Project Status / Handoff

_Last updated: 2026-09-21_

This file is the current handoff/status note for the Sagawa project. Use it before making changes so work continues inside the existing architecture instead of creating replacement projects or redoing completed setup.

## Project identity

- App name: **Sagawa**
- Admin name: **Sagawa Admin / Sagawa Control Center**
- Repository: `kya295810-a11y/Sagawa`
- Default branch: `main`
- Android package: `com.kyawsanlin.sagawa`
- iOS bundle identifier: `com.kyawsanlin.sagawa`
- Deep-link scheme: `sagawa://`
- Support email: `sagawaap@gmail.com`

Sagawa is a mobile app for Myanmar users in Malaysia. It includes News, MYR/MMK exchange rates, Services, user accounts, profiles, notifications, analytics, and related informational content.

## Engineering rules

Continue working inside the existing Sagawa repository. Do not create unrelated replacement projects. Preserve the current backend, authentication, PostgreSQL, API, Render deployment, and security architecture unless a change is specifically required.

Preferred engineering style:

- production-quality and maintainable changes
- root-cause fixes rather than rewrites
- secure defaults and least privilege
- Git-driven deployment
- environment-based configuration
- no production secrets in Git
- one clear source of truth for production data
- verify logs/builds after deployment instead of assuming a change is live

## Current architecture

### Mobile

- Expo SDK 57
- React Native
- TypeScript
- Expo Router
- Zustand
- TanStack React Query
- Expo SecureStore
- `expo-notifications`
- `expo-video`
- `expo-image`
- `expo-file-system`
- native Google sign-in packages
- environment-based backend configuration through `EXPO_PUBLIC_API_URL`

Main tabs:

`Home | News | Exchange | Services | Profile`

There is one bottom tab bar controlled by `src/app/(tabs)/_layout.tsx`.

### Backend

- Node.js / Express
- PostgreSQL
- migrations run before server startup
- production API deployed on Render
- mobile app talks to the API, never directly to PostgreSQL

Production flow:

`Sagawa mobile app -> Render API -> Render PostgreSQL`

### Admin

The admin dashboard is a separate Vite/React project inside the same repository under `malay-mm-admin/`.

Main sections include Dashboard, News, Services, Exchange Rate, Users, Media Library, Notifications, Analytics, and Settings.

## Render / production state

The API, admin dashboard, and PostgreSQL database are already deployed on Render.

The production database is the Render PostgreSQL database and is separate from local PostgreSQL. Production mobile traffic must use the Render API through `EXPO_PUBLIC_API_URL`.

The database does **not** need to be redeployed as part of the current Android push setup.

Earlier push-related backend deployment attempts had failures reported, so the core Render deployment exists, but Render logs/deploy status should still be checked before assuming every newest backend push change is live.

## Home screen

Home includes:

- welcome message and username/Guest state
- light/dark mode toggle
- Kuala Lumpur day/night visual
- current MYR -> MMK exchange-rate card
- latest published News cards
- bottom navigation

Home and News now share normalized media handling so video news can use `thumbnailUrl` and display a play indicator instead of an empty placeholder.

## News

News is PostgreSQL-backed and supports:

- title
- description
- published status
- image media
- video media
- video thumbnail
- date
- views
- clicks
- reach

API routes include:

- `GET /api/news`
- `GET /api/news/:id`
- `POST /api/news`
- `PUT /api/news/:id`
- `DELETE /api/news/:id`

Uploaded media is validated by MIME type, extension, and file signature. Video news requires both video and thumbnail. Maximum intended News count is 10.

Known remaining issue: the video detail screen previously reproduced an Expo shared-object cleanup crash:

`Cannot use shared object that was already released.`

Treat this as unresolved unless a later fix is verified.

## Services

Services are backend/database-backed and support:

- title
- description
- details
- icon
- contact
- phone
- location
- opening hours
- website
- image
- published status
- date
- analytics

The mobile app displays up to 25 Services and supports Service detail navigation.

Analytics track views, clicks, and reach.

## Exchange rate

Current focus:

`MYR <-> MMK`

USD was removed from the intended final flow.

Exchange rates are admin-controlled and stored in PostgreSQL. Home and the Exchange screen should always read the latest saved value from the API.

## Authentication

Mobile account functionality includes:

- signup
- login
- forgot password
- password reset
- Google Sign-In
- Guest Mode
- profile completion
- token refresh/session handling

User sessions are separate from admin authentication.

Password reset protections include time-limited reset codes, attempt limits, and session revocation after successful reset.

## Google Sign-In

Google OAuth work includes:

- backend Google OAuth
- ID-token verification
- secure state/nonce handling
- account linking
- single-use OAuth handoff
- `user_identities` database support
- callback `sagawa://auth/google`

Native Android work uses:

- `react-native-nitro-google-signin`
- `react-native-nitro-modules`

The failing Expo Nitro config plugin was removed while keeping the packages. Native Android sign-in is configured around the backend web client ID.

Use a native development build for native Google Sign-In; Expo Go is not equivalent.

## Profiles

Profile fields include:

- name
- age
- gender
- location
- profile image
- completion status

Profile sections include Personal Information, Notifications, Help & Support, About Sagawa, and theme/appearance.

Profile image upload supports JPEG, PNG, and WebP with validation and size limits.

Recent mobile work changed profile image upload to use `expo-file-system`'s `File` with `FormData` on native, while preserving web file handling.

## Admin security

Admin authentication/security includes:

- email/password
- two-step verification for new/untrusted password logins
- trusted-browser handling
- HttpOnly session cookies
- SameSite cookie settings
- rate limiting
- password hashing
- WebAuthn/passkeys
- recent-auth checks
- email verification
- login-attempt protection
- environment-only secrets

Successful passkey/fingerprint authentication should not require an unnecessary second email verification step.

## PostgreSQL / migrations

PostgreSQL is the source of truth.

Known tables/features include:

- `profiles`
- `news`
- `services`
- `exchange_rates`
- `user_identities`
- password-reset data
- passkeys
- admin profile
- `content_analytics`
- `content_reach`
- notification-token storage

Migrations live under:

`malay-mm-admin/server/migrations/`

The server runs migrations automatically through its prestart flow.

## Analytics

News and Services analytics include:

- views
- clicks
- reach

Deleting News/Services should delete their associated analytics.

## Push notifications: implemented behavior

The mobile app uses `expo-notifications`.

Implemented push work includes:

- notification permission handling
- Expo push-token registration
- PostgreSQL token storage
- platform storage
- backend delivery through Expo Push Service
- stale `DeviceNotRegistered` token cleanup
- optional `EXPO_ACCESS_TOKEN`
- News payloads
- Service payloads
- notification taps route to the exact News/Service item
- push when Admin creates an already-published News/Service
- push when a draft changes from unpublished -> published
- no push for ordinary edits to already-published content
- in-app unread News/Services badges
- baseline behavior so old content does not suddenly become unread after update

### Recent push/runtime fixes completed

Recent mobile fixes completed and pushed to `main`:

- Android Expo Go/web notification runtime gating was isolated in `src/services/notifications/runtime.ts`.
- The blanket physical-device rejection was removed so supported Android emulators / modern iOS simulators can attempt supported push flows.
- Push registration now uses an in-flight shared promise to prevent concurrent startup/manual registration races and duplicate POSTs.
- Notification listener setup remains single-instance with cleanup.
- Last notification responses are cleared after routing.
- Cold/background notification taps route to exact News/Service details.
- News/Profile messaging no longer incorrectly claims every push flow requires a physical device.
- `expo-notifications` uses Android default channel `default`.
- Missing EAS project ID is treated as an explicit configuration error.

## API client fixes completed

`src/services/api/client.ts` was hardened to:

- use `expo/fetch`
- preserve caller cancellation
- preserve API timeout behavior even when the caller passes an AbortSignal
- distinguish caller cancellation from a true timeout
- ensure the first abort source wins
- parse an error response body once
- retain the underlying network error in normalized error details
- preserve access-token attachment and authenticated 401/session handling

## Expo SDK 57 dependency alignment

The SDK 57 package set was aligned using Expo tooling.

Validation after alignment:

- `npx expo install --check` -> passed
- `npx expo-doctor` -> **21/21 checks passed**
- `npm run typecheck` -> passed
- `git diff --check` -> passed
- targeted Prettier check -> passed
- `npm ls --depth=0` -> passed

Notable dependency/config changes:

- Expo upgraded to the expected SDK 57 patch line
- Expo Router and SDK modules aligned to compatible patch versions
- `expo-notifications` updated
- `expo-file-system` added and used
- `expo-video` and `expo-web-browser` config plugins added by Expo alignment
- unused root/mobile `multer` dependency removed
- backend `malay-mm-admin/server` keeps its own required Multer dependency

Current audit note: after removing the unused root Multer issue, npm audit still reported **6 high and 15 moderate** transitive advisories in Expo/Metro-related tooling. No forced audit fix was used because breaking dependency upgrades should not be applied blindly.

## EAS project migration completed

The old linked EAS project used the legacy slug `malay-mm`.

The mobile app is now linked to the correct Sagawa EAS project:

- EAS full name: `@kya295810s-team/sagawa`
- EAS owner: `kya295810s-team`
- EAS project ID: `41a8c754-f8ae-412d-ab01-f7bb60580bd5`
- local Expo slug: `sagawa`
- display name: `Sagawa`

`app.json` now contains the public EAS project ID and owner.

Do not switch the local slug back to `malay-mm`.

The old EAS project should not be deleted until the new Sagawa project has passed native build and real push testing, so it remains a rollback/reference path.

## Firebase / Android push setup completed

Firebase Android configuration is now connected for:

`com.kyawsanlin.sagawa`

Completed:

- `google-services.json` added at the mobile project root
- `app.json` points to `./google-services.json`
- Firebase project used for Android push: `sagawa-37474`
- Google Service Account key for **FCM V1** uploaded to EAS
- FCM V1 key assigned to `com.kyawsanlin.sagawa`
- FCM Legacy remains unassigned, which is expected
- Play Store submission service-account credentials are not configured yet; they are not required for push testing

Security handling:

- private Firebase service-account JSON is local-only
- local private credentials live under `secrets/`
- `secrets/` is ignored by Git
- never commit or paste the service-account private key
- `google-services.json` is Android app client configuration and is intentionally tracked

Latest Firebase config commit on `main`:

`Configure Firebase for Android push notifications`

## Current EAS / app.json state

Expected important values:

```json
{
  "expo": {
    "name": "Sagawa",
    "slug": "sagawa",
    "scheme": "sagawa",
    "owner": "kya295810s-team",
    "android": {
      "package": "com.kyawsanlin.sagawa",
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "bundleIdentifier": "com.kyawsanlin.sagawa"
    },
    "extra": {
      "eas": {
        "projectId": "41a8c754-f8ae-412d-ab01-f7bb60580bd5"
      }
    }
  }
}
```

## Recent Git history relevant to push setup

Recent completed commits include:

- `Fix push notifications and align Expo SDK 57`
- `Configure Firebase for Android push notifications`
- `Add real device build profiles for push notification testing`
- `Support secured Expo push delivery`
- `Document optional Expo push security setting`

Do not rely on commit hashes in normal handoff instructions unless specifically needed.

## Google Sheets user sync

A Google Sheet called approximately `Sagawa User Details` was created/planned for user information.

Fields/work include user details, platform, status, role, gender, and planned location support.

Design requirements:

- server-side only
- non-blocking
- batched
- deduplicated
- service-account protected
- Status/Role admin-managed

The Sheets work was being isolated through a feature branch/PR during setup.

## Branding

Brand direction:

- sky blue / white
- simple premium icon
- Myanmar + Malaysia feeling
- subtle Petronas Twin Towers
- subtle Bagan
- subtle Myanmar/Malaysia flag influence
- Sagawa flower influence
- transparent/no white corners where possible

About Sagawa uses the Sagawa flower/logo rather than the older generic icon.

## Privacy / legal positioning

Sagawa is positioned as an informational, educational, awareness, and case-study application.

Important positioning:

- not designed for illegal activity
- does not promote unlawful activity
- external service information is not guaranteed
- exchange-rate information is for general informational use
- users must follow applicable laws
- users should independently verify important information

Privacy Policy and Terms have been added.

## Security priorities

Maintain these rules across the project:

- HTTPS
- secrets only in environment variables / credential stores
- no secrets in Git
- production PostgreSQL safety
- parameterized SQL
- secure authentication/session handling
- strong password hashing
- rate limiting
- restricted CORS
- upload MIME/extension/signature validation
- least privilege
- secure cookies
- stale token cleanup
- logs without secrets
- rollback/recovery
- Git-based deployments
- no hard-coded private production endpoints
- one clear source of truth

## Git workflow

Normal sync:

```sh
git status
git pull origin main
```

Prefer explicit staging for security-sensitive work instead of `git add .`.

Use normal human commit messages that describe the reason for a change.

Never commit accidental directories such as `node_modules 2/`.

## Current remaining work / next steps

The immediate next step is **not database deployment**. Database/API infrastructure already exists.

### 1. Build the Android development client

Run:

```sh
npx eas-cli@latest build --platform android --profile development
```

The development profile should use `developmentClient: true`.

Because notification/Firebase settings are native configuration, a fresh native build is required. Metro/OTA JavaScript alone is not enough.

### 2. Install and run on Android

Install the generated APK on the Android test phone/device.

Then:

```sh
npx expo start --dev-client
```

### 3. End-to-end News push test

Expected flow:

`Admin publishes News -> Render API -> Expo Push Service / FCM V1 -> Android receives notification -> tap -> exact News detail opens`

Confirm:

- notification permission behavior
- token registration succeeds
- token reaches backend/PostgreSQL
- notification arrives
- tap opens correct News item
- no duplicate token registration / duplicate notification caused by app startup race

### 4. End-to-end Service push test

Repeat the same flow for Services and confirm the exact Service detail route opens.

### 5. Verify Render production state

Before declaring push complete:

- verify latest `sagawa-api` Render deployment
- verify push-token migration is applied in production
- inspect logs during registration and send
- confirm no secret values are logged

### 6. iOS

When preparing iOS:

- configure Apple/APNs/EAS credentials
- make a new native iOS build
- repeat News and Service push/tap tests

### 7. Remaining engineering issues

- Re-test/fix the Expo video-detail shared-object cleanup crash if it still reproduces.
- Continue reviewing the remaining transitive npm audit advisories without forced breaking updates.
- Re-check any recent admin frontend build/deployment failures before calling the latest admin changes fully deployed.
- Continue production log/security checks after deployments.

## Current stop/resume point

As of this note, the Android Firebase/FCM V1 credential setup is complete and committed configuration is on `main`.

Resume from:

```sh
npx eas-cli@latest build --platform android --profile development
```

Then install the development build and perform real News/Service push tests.

Do not repeat database deployment, recreate the Sagawa EAS project, or reconfigure Firebase from scratch unless a verified failure requires it.
