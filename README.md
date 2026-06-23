# Doodles 🐩

The operating system for doodle ownership — an AI doodle companion, a
health-records vault, a curated services marketplace (~18% commission), and a
doodle-first travel ecosystem. Aggregator model: we don't own inventory.

This repo contains the **Phase 1** web platform: auth, pet profiles, the health
vault, the AI companion, and Stripe membership, with marketplace/travel
foundations in place.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind (static SPA → Cloudflare Pages)
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions in Deno)
- **AI:** Anthropic Claude API — called **only** from the `ai-chat` Edge Function
- **Payments:** Stripe + Stripe Connect (Phase 2 payouts) via Edge Functions

## Project layout

```
src/
  components/   reusable UI (Navbar, Layout, ProtectedRoute)
  pages/        route views (Dashboard, PetDetail, HealthVault, AICompanion,
                Marketplace, Travel, Membership, Login, SignUp, CreatePet)
  hooks/        useAuth (auth context)
  lib/          supabase.ts (client), api.ts (Edge Function calls), types.ts
  version.ts    BUILD_VERSION (shown in the nav)
supabase/
  migrations/   0001_init.sql — schema + RLS + storage + seed (source of truth)
  functions/    ai-chat, create-checkout, stripe-webhook
public/         _redirects (SPA), _headers (cache rules), doodle.svg
```

## 1. Prerequisites

- Node 18+ and npm
- A [Supabase](https://supabase.com) project
- The [Supabase CLI](https://supabase.com/docs/guides/cli): `npm i -g supabase`
- A [Stripe](https://stripe.com) account (test mode is fine)
- An [Anthropic API key](https://console.anthropic.com)

## 2. Environment variables

Copy the example and fill in your Supabase values:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

The client **only** ever sees the anon key. Server-side secrets live as Supabase
Edge Function secrets (next section) and must never be committed.

## 3. Install & run dev

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # outputs to dist/
npm run preview      # preview the production build
```

The nav bar shows `BUILD_VERSION` (from `src/version.ts`) so you can confirm
exactly what's deployed — handy because Cloudflare caches aggressively.

## 4. Apply the database migration

Link the CLI to your project, then push the migration. This creates all tables,
Row Level Security policies, the private `pet-documents` storage bucket, and a
small seeded marketplace catalog.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

> RLS is on for every table — a user can only read/write their own data.
> `vendors`/`services` are a public catalog.

## 5. Deploy the Edge Functions

Set the server-side secrets, then deploy each function:

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: use pre-created Stripe Prices instead of inline price_data
supabase secrets set STRIPE_PRICE_BASIC=price_... STRIPE_PRICE_PREMIUM=price_...

supabase functions deploy ai-chat
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook   # config.toml sets verify_jwt = false
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected into functions automatically by Supabase.

### Wire up the Stripe webhook

In the Stripe Dashboard → Developers → Webhooks, add an endpoint:

```
https://<project-ref>.functions.supabase.co/stripe-webhook
```

Subscribe to at least: `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret into
`STRIPE_WEBHOOK_SECRET` (above).

## 6. Deploy the frontend to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → select the `doodles` repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   under the Pages project settings (Production **and** Preview).
5. Deploy. `public/_redirects` handles SPA routing; `public/_headers` keeps
   `index.html` uncached while hashing assets immutably.

### Custom domain

Pages project → **Custom domains** → **Set up a domain** → enter your domain.
If the domain is on Cloudflare, the DNS record (a `CNAME` to your
`*.pages.dev`) is added automatically; otherwise add the `CNAME` at your
registrar. Then, to beat aggressive caching, add a **Cache Rule**
(Rules → Caching) that bypasses cache for `/index.html` (the `_headers` file
already sets this; the rule is belt-and-suspenders).

## Roadmap

1. **Phase 1 (this repo):** auth + pets + health vault + AI companion + Stripe membership
2. **Phase 2:** marketplace bookings + Stripe Connect payouts (18% split) + sitters; Capacitor mobile
3. **Phase 3:** travel booking
4. **Phase 4:** wearable + custom AI + more breeds

## Notes & cautions

- **Secrets:** never commit `.env`. Claude/Stripe secret keys live only in Edge
  Functions.
- **Large JSONB:** `pets.ai_profile` and `ai_conversations.messages` are JSONB.
  Supabase can silently drop oversized JSONB — the `ai-chat` function only sends
  recent turns to the model; paginate/offload if histories grow large.
- **Not medical advice:** the AI companion's system prompt includes a clear
  "not a substitute for your vet" disclaimer.
