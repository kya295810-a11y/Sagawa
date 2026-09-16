# Database Preparation

## Status

This schema is intentionally provisional and will evolve with real backend requirements. The mobile application does not connect directly to the database.

## Backend boundary

```text
Mobile App -> Secure Backend API -> PostgreSQL
```

The backend is responsible for authentication, authorization, rate limiting, validation, auditing, and database access.

## Planned entities

- `users`
- `profiles`
- `news`
- `exchange_rates`
- `gold_prices`
- `notifications`
- `services`
- `shops`
- `products`
- `jobs`
- `messages`
- `reports`
- `audit_logs`

## Example responsibilities

- `users`: account identity and auth linkage.
- `profiles`: public and private user profile data.
- `news`: articles, categories, summaries, source metadata.
- `exchange_rates`: current and historical rates with source attribution.
- `gold_prices`: price snapshots by purity, unit, and source.
- `notifications`: message content, channel preferences, delivery state.
- `services`, `shops`, `products`, `jobs`: future marketplace and community-service expansion.
- `messages`: future direct or group communication flows.
- `reports`: moderation and abuse-reporting workflows.
- `audit_logs`: backend traceability for sensitive actions.

## Notes

- Table names and relationships are not final.
- Indexing, partitioning, and retention strategies should be decided with real traffic expectations.
- The backend should expose stable API contracts before frontend data screens are built.

## User profile migration

`malay-mm-admin/server/migrations/001_user_profiles.sql` is an additive migration. It creates
`users` and `user_sessions`, then adds per-user ownership, age, gender, optional location,
completion state, and creation time to the existing `profiles` table. The legacy profile row is
preserved and remains unassigned (`user_id IS NULL`).

After taking a database backup, apply it from `malay-mm-admin/server`:

```sh
npm run db:migrate-user-profiles
```

The API derives profile ownership from the hashed bearer-session record. It does not accept a
client-supplied owner ID, and the partial unique index on `profiles.user_id` enforces one profile
per registered user.
