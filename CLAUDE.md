# CLAUDE.md — Doodle Platform

Context for Claude Code. Read this before generating or editing anything.

## What this is

The doodle-owner platform: AI doodle companion, health-records vault, services
marketplace (~18% commission), and doodle travel. Aggregator model — we don't
own inventory. Doodles first, other breeds later.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind, static SPA, deployed to
  Cloudflare Pages.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions in Deno).
- **Payments:** Stripe + Stripe Connect via Edge Functions; webhook handler is
  an Edge Function.
- **AI:** Anthropic Claude API, called ONLY from a Supabase Edge Function (key
  stays server-side).
- **Mobile (later):** Capacitor wrapping the web build.

## Repo layout

```
/src
  /components       reusable UI
  /pages            route-level views (Dashboard, Pet, Vault, Market, Travel)
  /lib
    supabase.ts     Supabase client
    api.ts          typed calls to Edge Functions
  /hooks
  App.tsx
  main.tsx
/supabase
  /migrations       SQL migrations (source of truth for schema)
  /functions
    ai-chat/        Claude companion endpoint
    stripe-webhook/ Stripe + Connect events
    create-checkout/ membership + bookings
.env.example
README.md
```

## Commands

- Dev: `npm run dev`
- Build: `npm run build` (outputs to `dist/`)
- Preview: `npm run preview`
- Supabase local (optional): `supabase start`
- Apply migrations: `supabase db push`
- Deploy functions: `supabase functions deploy <name>`

## Env vars (see .env.example)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client
- Supabase secrets (server-side, set via `supabase secrets set`):
  `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Rules

- Never commit `.env` or any secret. Client only ever sees the anon key.
- Claude API and Stripe secret keys live in Edge Functions only.
- Schema changes go in `/supabase/migrations` as SQL, never manual-only console
  edits.
- Money moves through Stripe Connect so the 18% split is automatic.
- Show a `BUILD_VERSION` string in the nav so I can confirm what Cloudflare is
  serving (Cloudflare caches aggressively — also set a cache rule).
- Watch large JSONB columns (`pets.ai_profile`, `ai_conversations.messages`) —
  Supabase can silently drop oversized JSONB. Paginate/offload if needed.

## Core schema (full version in the migration)

users, pets, health_records, vaccinations, vendors, services, bookings,
subscriptions, travel_bookings, ai_conversations. See
`/supabase/migrations/0001_init.sql`.

## Build order

1. Auth + pets + health vault + AI companion + Stripe membership
2. Marketplace + Connect + bookings + sitters; Capacitor mobile
3. Travel
4. Wearable + custom AI + more breeds
