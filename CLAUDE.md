# CLAUDE.md — PackHub (working name)

Context for Claude Code. Read this before generating or editing anything.
(Repo is still named `doodles` — the brand name is TBD; UI uses the `BRAND`
constant in `src/version.ts`. The doodle community is our launch wedge, but the
product serves **all breeds**.)

## What this is

The all-in-one dog-owner platform: AI dog-care companion, health-records vault,
a services marketplace, and dog travel. We are the **booking middleman /
distributor**: owners book services (grooming, mobile vet, sitters, waste
removal, food, etc.) and we fulfill them through pre-negotiated **affiliate
vendors** now, taking a ~18% commission. As the membership/subscriber base
grows we bring fulfillment **in-house** (our own mobile grooming vans,
veterinary vans, and trucks) — tracked per vendor via `vendors.fulfillment`
(`affiliate` | `in_house`). Aggregator model — we don't own inventory yet.

Membership also anchors an AAA-style perk network (later): traveling members
get access to private dog parks / sniff-spots and dog-welcoming places, plus
member travel rates and concierge logistics.

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

1. Auth + pets + health vault + AI companion + Stripe membership (all breeds)
2. Marketplace booking + Stripe Connect payouts (18% split) + sitters; Capacitor mobile
3. Travel + AAA-style member park/place access network
4. In-house fulfillment fleet (mobile grooming/vet vans, trucks); wearable + custom AI
