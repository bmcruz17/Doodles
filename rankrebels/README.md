# RankRebels — Landing Page + Lead Pipeline

The marketing site for **RankRebels** (rankrebels.ai) — a website-building business
run by Brandon (build/product, 65%) and Eric (growth/acquisition, 35%).

It's a single self-contained file: **`index.html`**. No build step, no dependencies,
no framework. Open it in a browser and it just works.

## What's inside

- **Landing page** — hero, services, 4-step process, pricing (Launch / Rank / Dominate),
  founders, and a contact form.
- **Lead Pipeline (Kanban)** — click **"Pipeline"** in the nav. Drag leads across stages
  (New Lead → Contacted → Proposal → Building → Won). It tracks:
  - Open pipeline value and count
  - Won revenue
  - The **65/35 split** (Brandon $ / Eric $) auto-calculated on won deals
  - Export to CSV, add/edit/delete leads
  - Contact-form submissions drop straight into the "New Lead" column
- **Persistence** — leads are saved to the browser's `localStorage`. It's a single-user
  tool per browser (great for getting started; see "Going multi-user" below to share it
  between you and Eric in real time).

## Run it locally

Just open `rankrebels/index.html` in any browser. Or serve it:

```bash
cd rankrebels
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Deploy + activate rankrebels.ai (Cloudflare Pages — recommended, free)

I can't touch your registrar or Cloudflare account, so here are the exact steps.
Pick **one** path. Either gets the domain live in ~10–15 min.

### Path A — Cloudflare Pages via Git (auto-deploys on every push)
1. Push this repo to GitHub (this branch is already set up).
2. In the **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**,
   pick this repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `rankrebels`
4. Deploy. You'll get a `*.pages.dev` URL to confirm it works.

### Path B — Cloudflare Pages direct upload (fastest, no Git needed)
1. **Workers & Pages → Create → Pages → Upload assets.**
2. Drag in the contents of the `rankrebels/` folder (the `index.html` + `_headers`).
3. Deploy → you get a `*.pages.dev` URL.

### Point rankrebels.ai at it
1. Move the domain's DNS to Cloudflare (only needed once):
   - Cloudflare → **Add a site** → `rankrebels.ai` → it scans your DNS.
   - Cloudflare gives you **2 nameservers**. Log into wherever you bought
     `rankrebels.ai` and replace its nameservers with those two. (DNS can take a few
     hours to propagate.)
2. In your Pages project → **Custom domains → Set up a custom domain** →
   add `rankrebels.ai` **and** `www.rankrebels.ai`. Cloudflare adds the DNS records
   and provisions HTTPS automatically.

That's it — `https://rankrebels.ai` will serve this page with a free SSL cert.

> **Alternatives:** the same `index.html` works as-is on Netlify, Vercel, GitHub Pages,
> or any static host. Cloudflare is recommended because you'll likely manage the
> `.ai` DNS there anyway.

## Editing the essentials

Everything lives in `index.html`:
- **Prices / plans** — search for `class="plan"`.
- **Services** — search for `id="services"`.
- **Founder bios** — search for `id="founders"`.
- **Revenue split** — search for `var SPLIT` (currently `brandon:0.65, eric:0.35`).
- **Pipeline stages** — search for `var STAGES`.

## Going multi-user (when you want Brandon + Eric on the same board)

Right now the pipeline is per-browser. To make it a shared, real-time CRM that
syncs between you and Eric, the natural next step is to back it with **Supabase**
(this repo already uses Supabase) — a single `leads` table + the existing client.
Say the word and I'll wire that up: shared board, login, and live updates.
