# Supabase Schema

This folder contains a Supabase/Postgres schema generated from the TypeORM
`EntitySchema` models in `src/models`.

## Apply

For a fresh Supabase project, run the migration with the Supabase CLI:

```bash
supabase db push
```

Or paste `migrations/20260516000000_initial_schema.sql` into the Supabase SQL
editor for a one-off setup.

## Notes

- Column names intentionally keep the repo's camelCase TypeORM names, such as
  `"userId"` and `"createdAt"`. Quote those identifiers in hand-written SQL.
- This backend has its own `users` table and JWT/password flow. It does not use
  Supabase Auth's `auth.users` table yet.
- Row Level Security policies are not included. If the tables will be exposed
  through Supabase REST/Realtime clients, enable RLS and add policies before
  shipping. If Supabase is only used as Postgres behind this Express API, the
  current schema is enough to start.
- Seed data still comes from `src/jobs/seed.js`.
