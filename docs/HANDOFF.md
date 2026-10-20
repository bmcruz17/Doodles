# PackHub — cold-start engineering handoff

**Last updated:** 2026-10-20 (from repo `main` + read-only Supabase checks)  
**Audience:** A new engineer or coding agent with no other context.  
**Repo:** GitHub `bmcruz17/Doodles` (folder/product name: **PackHub**; npm package name: `doodles`).

---

## 1. What this is and who uses it

**Product (working name: PackHub, brand TBD)** — An all-in-one dog-owner platform:

- AI dog-care companion (grounded in pet profile + health vault)
- Health-records vault (private storage + smart upload parsing)
- Services marketplace (vendors, booking requests; Stripe membership billing started)
- Social feed, friends, sitters, creator campaigns, retail shop, wearables, travel foundations
- Closed-beta / “Founding Pawthers” funnel (waitlist, passcode gate, founding-member rate lock)

**Users today (intended):**

- **Dog owners** — sign up, add pets, vault, AI, marketplace, shop, feed, membership
- **Internal ops** — `/admin` dashboard (requires `users.is_admin`; seeded in migration `0006`)
- **Vendors / creators / sitters** — partner flows (partial; payouts/Connect are Phase 2 per `README.md`)
- **Public** — landing, waitlist, legal pages; showcase photos via `showcase` edge function

**Launch wedge:** Doodle community (`CLAUDE.md`), but copy and schema target **all breeds**.

**Current build label:** `BUILD_VERSION` in `src/version.ts` (shown in nav) — was `v0.14.1` at handoff time.

---

## 2. Stack and hosting

| Layer | Technology |
|--------|------------|
| Frontend | Vite 5, React 18, TypeScript, Tailwind, React Router (static SPA) |
| Mobile (planned) | Capacitor 6 (`CAPACITOR.md`; `ios/` / `android/` **not** in repo yet) |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions (Deno) |
| AI | Anthropic Claude API — **only** from Edge Functions (`ai-chat`, `parse-records`, `device-insights`) |
| Payments | Stripe Checkout for membership (`create-checkout`); webhook handler in repo (`stripe-webhook`) |
| Email | Resend via `beta-mail` Edge Function |
| Hosting | **Cloudflare Pages** — project name `doodles` (`wrangler.toml`: `pages_build_output_dir = "dist"`) |

**Production web origin (code references):** `https://packhub.atmxhq.com` (`create-checkout` `PRODUCTION_ORIGIN`).  
**Legacy host still in `main` meta tags / email fallbacks:** `https://hidonutman.com` (see open PR #2).

**Supabase project (inferred from committed client fallback in `src/lib/supabase.ts`):** project ref `eejmocneacfleltspedl`.  
**Important:** That Supabase project also carries **many non–PackHub migrations** (RankRebels and other ATMX products). PackHub shares the database with other apps — treat schema and RLS changes with extreme care.

---

## 3. Repository layout (essentials)

```
src/
  pages/          Route-level UI (Dashboard, Vault, AI, Marketplace, Shop, Admin, …)
  components/     Navbar, Layout, JoinWaitlist, SitePasscode, …
  hooks/          useAuth
  lib/            supabase.ts, api.ts (edge invocations), types.ts, founding, cart, …
  version.ts      BRAND, BUILD_VERSION
supabase/
  migrations/     0001–0021 SQL (source of truth for PackHub schema **in this repo**)
  functions/      Edge Functions (see §8)
  tests/          RLS regression SQL (run via npm test)
public/           _redirects (SPA), _headers (cache), PWA manifest, OG image
docs/           This file
```

Deeper product context: `CLAUDE.md`, `README.md`.

---

## 4. Run locally

**Prerequisites:** Node 18+, npm; optional Supabase CLI for DB/functions; Postgres server binaries for `npm test`.

```bash
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (names only — get values from Supabase dashboard)

npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run preview  # production build locally
npm run lint     # tsc --noEmit
```

**Note:** If `.env` is empty, the app still boots using **hardcoded fallbacks** in `src/lib/supabase.ts` (points at `eejmocneacfleltspedl`). Prefer explicit `.env` for local dev against a dedicated project if you spin one up.

**Database (local or staging):**

```bash
supabase link --project-ref <your-ref>
supabase db push    # applies supabase/migrations/*.sql in order
```

**Edge Functions (manual deploy per function):**

```bash
supabase secrets set ANTHROPIC_API_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
# optional: STRIPE_PRICE_BASIC, STRIPE_PRICE_PREMIUM, RESEND_API_KEY, BETA_* (see §7)

supabase functions deploy <name>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase at runtime.

---

## 5. Tests

| Command | What it does |
|---------|----------------|
| `npm test` | Runs `scripts/test-db.sh`: temporary Postgres (or `DATABASE_URL`), applies `supabase/tests/supabase_stub.sql` + **all** `supabase/migrations/*.sql`, then `supabase/tests/*.test.sql` (RLS lockdown regressions) |
| `npm run lint` | Typecheck only (`tsc --noEmit`) |
| `npm run build` | `tsc -b && vite build` |

**CI in repo:** No `.github/workflows` in tree. **Cloudflare Pages** builds on git push (seen on PR #2: build `npm run build`, output `dist`).

**Local test caveat:** This environment had no `initdb`; install Postgres or set `DATABASE_URL` to an **empty** scratch DB (never production).

---

## 6. Environment variable names (never commit values)

### Client (Vite — `.env`, Cloudflare Pages)

| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (RLS-enforced) |

Documented in `.env.example` and `README.md`.

### Edge Function secrets (Supabase `supabase secrets set`)

| Name | Used by (in repo) |
|------|-------------------|
| `ANTHROPIC_API_KEY` | `ai-chat`, `parse-records`, `device-insights` |
| `STRIPE_SECRET_KEY` | `create-checkout`, `stripe-webhook` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |
| `STRIPE_PRICE_BASIC` | `create-checkout` (optional; else inline `price_data`) |
| `STRIPE_PRICE_PREMIUM` | `create-checkout` (optional) |
| `RESEND_API_KEY` | `beta-mail` |
| `BETA_MAIL_FROM` | `beta-mail` |
| `BETA_SITE_URL` | `beta-mail` (invite/welcome links + footer) |
| `BETA_PASSCODE` | `beta-mail` (invite email body; should match client gate) |
| `BETA_MAIL_REPLY_TO` | `beta-mail` (optional) |

**Auto-injected by Supabase (do not set manually in secrets):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Client-side “secrets” (not env vars — shipped in bundle):**

- `BETA_PASSCODE` in `src/lib/gate.ts` (`goodboy2026` at handoff time)
- Fallback Supabase URL + anon key in `src/lib/supabase.ts`

---

## 7. Database: migrations, tables, apply state

### Source of truth in this repo

`supabase/migrations/` — **21 files**, `0001_init.sql` through `0021_ai_rate_limits.sql`.

Apply order: lexicographic filename order (what `scripts/test-db.sh` uses).

### PackHub tables (by migration)

| Migration | Tables / major objects |
|-----------|-------------------------|
| `0001_init` | `users`, `pets`, `health_records`, `vaccinations`, `vendors`, `services`, `bookings`, `subscriptions`, `travel_bookings`, `ai_conversations`; storage bucket `pet-documents`; RLS; seed vendors/services |
| `0002` | Security hardening (storage limits, revoke RPC execute) |
| `0003` | `posts`, `post_comments`, `post_likes` |
| `0004` | `sitter_profiles` |
| `0005` | `friendships` |
| `0006` | Vendor posts on feed; `users.is_admin` |
| `0007` | Audience columns on `pets` / `posts` |
| `0008` | `creator_profiles`, `campaigns`, `campaign_deals` |
| `0009` | `devices`, `device_daily`, `device_alerts` |
| `0010` | Device provider fields (see file) |
| `0011` | **Stub only** — comments reference `products`, `shop_orders`, `shop_subscriptions`; **no DDL in file** |
| `0012` | `waitlist`, `feedback` |
| `0013` | `push_tokens` |
| `0014` | `pack_profiles` |
| `0015` | Founding member columns + RPCs (`claim_founding_spot`, `founding_stats`, …) |
| `0016` | Waitlist invite/welcome tracking columns + guards |
| `0017`–`0020` | Lock down client writes to money/status/trust columns (vendors, users/billing, bookings, creator deals) |
| `0021` | `ai_usage_events`, `consume_ai_quota()` — AI rate limits |

**RPCs / functions worth knowing:** `my_vendors()`, `consume_ai_quota()`, founding/waitlist guards (see migrations).

### Migrations that may not apply cleanly from repo alone

| Issue | Detail |
|-------|--------|
| **`0011_retail.sql` is empty of DDL** | Fresh `supabase db push` from **only** this repo will **not** create `products` / `shop_orders` / `shop_subscriptions`. Comment says full DDL was applied remotely under migration name `retail`. **Shop page will break** on a DB that only has repo migrations. |
| **Filename vs remote history** | Remote project uses timestamped migration names; PackHub lockdowns appear as `packhub_0017` … `packhub_0021` (applied 2026-10-10 on `eejmocneacfleltspedl`). |
| **Shared Supabase project** | Hundreds of other migrations exist on production that are **not** in this repo. Do not assume a clean PackHub-only database. |

### Production apply state (read-only check, 2026-10-20, project `eejmocneacfleltspedl`)

Verified present:

- PackHub tables sample: `users`, `pets`, `waitlist`, `pack_profiles`, `products`, `shop_orders`, `subscriptions`, `ai_usage_events`
- Functions: `consume_ai_quota`, `my_vendors`
- Remote migrations: `packhub_0017`–`packhub_0021` applied

**Unknown without Brandon:** Whether every `0001`–`0016` repo file was applied under matching names on every environment; whether a **new** Supabase project was ever provisioned solely for PackHub.

---

## 8. Edge Functions (in repo)

| Function | JWT (`config.toml` / deployed) | Role |
|----------|--------------------------------|------|
| `ai-chat` | verify (true in repo) | Claude companion |
| `parse-records` | default true | Vault document parsing |
| `device-insights` | default true | Wearable AI summaries |
| `create-checkout` | true | Stripe membership checkout URL |
| `stripe-webhook` | **false** in `config.toml` | Stripe subscription lifecycle → DB |
| `beta-mail` | false (deployed) | Waitlist welcome/invite email |
| `showcase` | false (deployed) | Public landing feed |
| `admin` | true | Ops overview/actions |
| `add-friend` | true | Friend requests by email |
| `delete-account` | true | User deletion |
| `device-ingest` | false (deployed) | Wearable data ingest |
| `tractive-sync` | true (deployed) | Tractive integration |

**Deployed on `eejmocneacfleltspedl` (2026-10-20):** All of the above **except `stripe-webhook`** (not in deployed function list). Same project also runs **unrelated** functions (`notify-lead`, `notify-site-note`, `notify-client-activity`, …).

**AI quota:** `ai-chat`, `device-insights`, and `parse-records` call `consume_ai_quota()`; migration `0021` must be applied before they work (fail closed if missing).

---

## 9. Deploy flow and what ships from `main`

| Artifact | How it deploys |
|----------|----------------|
| **Frontend (`dist/`)** | Cloudflare Pages connected to GitHub; **`main` → production**; PRs get preview builds (per PR #2 checks). Build: `npm run build`, output `dist`. Env: `VITE_SUPABASE_*` in Pages settings. |
| **SQL migrations** | **Not** auto-deployed from `main`. Operator runs `supabase db push` (or Supabase dashboard) against the target project. |
| **Edge Functions** | **Not** auto-deployed from `main`. Operator runs `supabase functions deploy <name>`. |

**Cache behavior:** `public/_headers` sets `index.html` to no-cache; hashed `/assets/*` immutable. README suggests an optional Cloudflare Cache Rule for `/index.html`.

**Do not merge doc-only or domain PRs without Brandon** (see open PR #2).

---

## 10. External services

| Service | PackHub usage |
|---------|----------------|
| **Supabase** | Auth, Postgres, RLS, Storage (`pet-documents`), Edge Functions |
| **Anthropic** | Claude in AI edge functions |
| **Stripe** | Checkout sessions; webhook handler in repo (deploy status uncertain) |
| **Resend** | Transactional mail in `beta-mail` |
| **Cloudflare** | Pages hosting (`doodles` project), DNS/custom domain (operator) |
| **Tractive** | `tractive-sync` (user credentials flow — review security) |
| **Apple / Google** | Push via Capacitor (native projects not in repo) |

**Stripe webhook URL (when deployed):**  
`https://<project-ref>.functions.supabase.co/stripe-webhook` — events documented in `README.md`.

---

## 11. App routes (frontend)

Public: `/`, `/login`, `/signup`, `/privacy`, `/terms`  
Authenticated (under `Layout`): `/dashboard`, `/feed`, `/profile`, `/u/:handle`, `/friends`, `/admin`, `/creator`, `/pets/...`, `/marketplace`, `/shop`, `/partner`, `/sitters`, `/travel`, `/membership`, `/account`

Beta gate: `SitePasscode` / `src/lib/gate.ts` (localStorage; not strong auth).

---

## 12. Known risks and security notes

1. **Shared production database** — PackHub tables coexist with RankRebels and other products on `eejmocneacfleltspedl`. Cross-app blast radius on migrations and service-role usage is high.
2. **`0011_retail.sql` stub** — Repo migrations alone are insufficient for retail; shop depends on DDL that lives only in production history unless restored to the repo.
3. **`stripe-webhook` not deployed** on production (2026-10-20) — Membership checkout may create Stripe sessions while DB subscription state does not update via webhooks until deployed and configured.
4. **Secrets in client bundle** — Hardcoded Supabase anon key + URL; beta passcode in `gate.ts` (and default in `beta-mail`). Use Cloudflare Access or server-side gates for real access control (`gate.ts` comment).
5. **CORS `Access-Control-Allow-Origin: *`** on Edge Functions — common pattern here; still review for sensitive actions.
6. **Admin bootstrap** — Migration `0006` sets `is_admin` for a specific email; protect admin routes and service-role keys.
7. **Large JSONB** — `pets.ai_profile`, `ai_conversations.messages` — risk of silent truncation (called out in `README.md` / `CLAUDE.md`).
8. **Not medical advice** — AI disclaimers in product copy; not HIPAA-covered but sensitive data posture in `0002`.
9. **Domain / auth redirect drift** — `main` still advertises `hidonutman.com` in `index.html` OG tags; `beta-mail` default `BETA_SITE_URL` matches. Supabase Auth Site URL / redirect allowlist must match production host (`packhub.atmxhq.com` per checkout code).
10. **Leaked password protection** — Documented as manual Supabase dashboard step in `0002` (unknown if enabled).

---

## 13. Open pull requests (2026-10-20)

| PR | Branch | State | Summary |
|----|--------|-------|---------|
| [#2](https://github.com/bmcruz17/Doodles/pull/2) | `cursor/update-site-domain-5dd2` | **DRAFT** | Point public URLs at `packhub.atmxhq.com` (`index.html` OG/Twitter; `beta-mail` `BETA_SITE_URL` fallback). CI: Cloudflare Pages **success**; Claude Code Review neutral. **Does not** do DNS, Supabase Site URL, Resend domain verify, or Stripe dashboard URLs — see PR body checklist. |
| #3 | `cursor/rls-write-lockdown-4b07` | **MERGED** | RLS audit / lockdown (migrations 0017–0021 in repo) |

Other PRs: #1 closed (unrelated RankRebels landing).

---

## 14. Prioritized next steps

1. **Brandon sign-off on PR #2** + complete external checklist (DNS/Cloudflare custom domain, Supabase Auth Site URL + redirects, `BETA_SITE_URL` secret, Resend domain, Stripe portal links, Search Console).
2. **Deploy and wire `stripe-webhook`** — deploy function, set `STRIPE_WEBHOOK_SECRET`, confirm Stripe dashboard endpoint and events; test membership end-to-end.
3. **Restore retail DDL to repo** — Replace or supplement `0011_retail.sql` so `npm test` and fresh projects create `products` / `shop_orders` / `shop_subscriptions`.
4. **Run `npm test` in CI or locally** with Postgres — lock RLS regressions on every change to migrations 0017–0021.
5. **Reduce client-exposed beta credentials** — align `gate.ts`, `BETA_PASSCODE`, and Cloudflare Access; rotate passcode when going wider.
6. **Decide long-term Supabase topology** — dedicated PackHub project vs shared `eejmocneacfleltspedl` (strongly recommended before scale).
7. **Phase 2 marketplace** — Stripe Connect payouts (~18% split) per `README.md` / `CLAUDE.md` (not fully implemented in handoff snapshot).

---

## 15. Quick reference commands

```bash
npm run dev
npm run build
npm run lint
npm test                    # needs Postgres
supabase db push
supabase functions deploy ai-chat
supabase secrets set KEY=value   # names from §6
```

**Nav build stamp:** `BUILD_VERSION` in `src/version.ts` — bump when releasing so Cloudflare cache debugging is possible.

---

*This document is docs-only. It does not change infrastructure. Update it when migrations, deploy targets, or open PRs change materially.*
