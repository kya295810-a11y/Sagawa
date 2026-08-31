# Sagawa Admin

## Authentication setup

The admin uses bcrypt password verification, an in-memory expiring session identified by an HTTP-only cookie, and WebAuthn passkeys. Passkey public keys are stored in `server/data/passkeys.json`; biometric data and private keys never reach this server.

Create `malay-mm-admin/.env` from `.env.example`, then replace every server-only placeholder. Generate a password hash without putting the password in source control:

```sh
node -e "require('bcryptjs').hash(process.argv[1], 12).then(console.log)" 'choose-a-long-password'
```

Use a long random `SESSION_SECRET`. Set `ADMIN_ORIGIN` to the exact browser origin. For a Cloudflare tunnel, use its HTTPS origin and hostname for `WEBAUTHN_RP_ID`; WebAuthn requires HTTPS outside localhost.

## Run locally

Start the backend from `malay-mm-admin/server`:

```sh
node server.js
```

In another terminal, set the admin URL and start Vite:

```sh
cd malay-mm-admin
cp .env.example .env.local
npm run dev
```

Set `VITE_API_URL` in `.env.local` to the backend URL. For a Cloudflare tunnel, use its HTTPS URL instead of `http://localhost:3000`, then restart Vite. Keep `ADMIN_ORIGIN` in the server `.env` aligned with the URL used in the browser.

After signing in with the password, click `Register Fingerprint / Passkey` in the sidebar and approve Touch ID, Windows Hello, or the device passkey prompt. Log out, then use `Sign in with Fingerprint / Touch ID`.

The exchange endpoints are:

- `GET /api/exchange-rate`
- `PUT /api/exchange-rate` with `{ "rate": "1055" }`

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
