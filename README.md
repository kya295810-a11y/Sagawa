# Expo Foundation Shell

This repository contains a production-oriented Expo Router foundation for a future Malaysia/Myanmar community application. It intentionally avoids a final brand, fake backend, and polished product UI so the next task can focus on premium screen design instead of architecture cleanup.

## What is included

- Expo Router route structure with an expandable bottom-tab shell
- Strict TypeScript setup with `@/*` path aliases
- Theme foundation for light, dark, and system preferences
- Zustand stores for app settings and authentication session state
- React Query setup for server-state and offline-first query defaults
- Secure token storage via Expo SecureStore
- Localization scaffolding for English and Burmese
- Centralized API client with timeout, cancellation, and normalized errors
- Architecture and security documentation for the future backend and database

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file from `.env.example` and point `EXPO_PUBLIC_API_URL` at your backend.

3. Start the app:

   ```bash
   npm run start
   ```

## Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run lint
npm run typecheck
npm run format
npm run format:check
```

## Android Google sign-in

Google sign-in requires a Web OAuth client for the backend and an Android OAuth client in the same Google Cloud project for every signing certificate used to build the app. The mobile app receives the Web client ID from the backend and passes it to the native sign-in SDK.

For local Android development, create an Android OAuth client in Google Cloud with:

- Package name: `com.kyawsanlin.sagawa`
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

After adding the Android client, allow several minutes for Google to propagate the change and try again. Release and Play App Signing certificates have different SHA-1 fingerprints and must be registered separately.

Set the backend's `GOOGLE_ANDROID_CLIENT_IDS` to the comma-separated Android OAuth client IDs that may request tokens for its Web client. The server validates both the token audience and this authorized-party allowlist.

## Project structure

```text
app/
├── assets/
├── docs/
├── src/
│   ├── app/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── locales/
│   ├── services/
│   ├── store/
│   ├── theme/
│   ├── types/
│   └── utils/
├── .env.example
└── README.md
```

## Architecture notes

- The mobile app is prepared to talk only to a secure backend API, never directly to PostgreSQL.
- The current screens are route placeholders, not product UI.
- Feature directories and typed service contracts are prepared for exchange rates, gold prices, news, services, and profile/auth flows.
- Sensitive tokens belong in SecureStore, while ordinary user preferences can live in AsyncStorage-backed persisted state.

## Documents

- `docs/architecture.md`
- `docs/database.md`
- `docs/security.md`
- `docs/development.md`
- `docs/roadmap.md`

## Intentionally not implemented yet

- Final brand name, logo, and visual identity
- Real backend endpoints or production credentials
- Fake authentication screens or fake production data
- Premium home screen UI and full feature screens
# Sagawa
