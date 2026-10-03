# 07 — Hosting and deployment ($0 budget)

Constraint: non-commercial project, **no money for hosting**. Everything must fit in free tiers.

## What the app needs from hosting

| Piece                                   | Needs                                                                                                                                                                                   | Notes                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Frontend SPA + dex JSON + locale tables | Static hosting + CDN                                                                                                                                                                    | Easy, many free options              |
| Sprites (~a few thousand small files)   | Static hosting / object storage                                                                                                                                                         | Must be self-hosted (see `03`)       |
| Game backend                            | **Long-lived WebSocket connections** + **shared in-memory state per room** (all phones of a room must reach the same process holding the battle) + ~150–300 MB RAM for the Showdown sim | This is the hard part for free tiers |

## Can Vercel host both front and back?

**Frontend: yes** — Vercel Hobby is free for non-commercial use, which fits.

**Backend: not recommended.** Vercel announced native WebSocket support in Functions (public beta,
June 2026), but:

- Connections have a **default 5-minute duration cap**.
- There's **no built-in broadcast** to connections held by other instances, and no shared memory
  between instances: the Host and 4 phones of one room could land on different instances.
- Functions are stateless → the battle (a live Showdown `Battle` object) would have to be serialized to an
  external store after every message, plus an external pub/sub (Redis/Ably) for fan-out.

That turns a simple Socket.IO server into a distributed system. Not worth it for this project.

## Recommended setup (MVP) — $0

```
┌──────────── Vercel Hobby (free) ────────────┐        ┌──────── Render free web service ────────┐
│ SPA (host + controller), dex JSON, locales  │  WSS   │ Node 22 · Fastify · Socket.IO ·          │
│ sprites (or Cloudflare R2 free tier)        │◄──────►│ pokemon-showdown sim · rooms in memory  │
└─────────────────────────────────────────────┘        └─────────────────────────────────────────┘
```

**Render free web service** for the backend:

- Supports WebSockets; 750 free instance hours/month per workspace (enough for one always-available
  service).
- Spins down after **15 minutes without inbound traffic**; since Feb 24, 2026 **WebSocket messages count
  as traffic**, so an active game keeps it awake. It only sleeps when nobody is playing — which is fine,
  because rooms are ephemeral anyway.
- Cold start ≈ **1 minute**. Mitigation (built into the UX): the Host page, served instantly by Vercel,
  calls the backend's `/healthz` as soon as it loads and shows _"Warming up the stadium…"_. By the time
  friends have scanned the QR, the backend is up. Phones hitting a sleeping backend get the same message.
- Free tier resources are small (≈512 MB RAM, fractional CPU). Enough for a few concurrent rooms; spike
  S1 measures the sim's real memory footprint with only the Champions mod loaded.

Cross-origin setup: Socket.IO CORS restricted to the frontend domain; room QR points to the frontend URL.

## Alternatives

| Option                                                                | Cost | Pros                                                                                                                                                                                                                                                                           | Cons                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Vercel + Render free** (recommended)                             | $0   | Simplest; standard Node server; same code runs locally                                                                                                                                                                                                                         | ~1 min cold start after idle; small instance                                                                                                                                                                                                 |
| B. Cloudflare Pages/Workers static assets + Render                    | $0   | Cloudflare has no bandwidth limits for static assets, R2 for sprites in the same account                                                                                                                                                                                       | Same backend trade-offs as A                                                                                                                                                                                                                 |
| C. Oracle Cloud "Always Free" VM (or GCP e2-micro) + Docker + Caddy   | $0   | Always on, no cold start, generous resources (Oracle ARM)                                                                                                                                                                                                                      | You manage a VM (updates, TLS, uptime); account approval can be tricky                                                                                                                                                                       |
| D. **Host-authoritative + Cloudflare Durable Objects relay** (future) | $0   | No cold start; closest to the original "PC is the server" idea: the sim runs in the **Host browser** (Web Worker); a Durable Object per room only relays messages and routes private data to each phone; DOs are available on the Workers free plan with WebSocket hibernation | The official `pokemon-showdown` package is not browser-ready (`@pkmn/sim` is, but lacks the Champions mod today); Host browser holds hidden info (acceptable for casual local play); Host refresh must restore the battle from the input log |
| ~~Koyeb free~~                                                        | —    | —                                                                                                                                                                                                                                                                              | Free tier closed to new signups (Feb 2026)                                                                                                                                                                                                   |
| ~~Fly.io~~                                                            | paid | —                                                                                                                                                                                                                                                                              | No free tier for new users                                                                                                                                                                                                                   |

**Why `packages/core` is transport-agnostic:** it keeps option D open. If Render's limits become a
problem, the same room/battle core can move into the Host browser with a thin relay, without rewriting
game logic.

## Deployment recipe (D-64, D-65) — see `16-first-deploy.md`

The recipe is versioned in the repo; the step-by-step guide, the rehearsal results and the real-phone
checklist (spike S6) are in `16-first-deploy.md`.

**Backend — Render (Web Service, free) — `render.yaml` Blueprint:**

- Region Virginia. `NODE_VERSION=22.22.0`, `NODE_ENV=production`, `LOG_LEVEL=info`,
  `NODE_OPTIONS=--max-old-space-size=384`, `ALLOWED_ORIGINS=https://<vercel-domain>` (asked on creation).
- Build: `corepack enable && pnpm install --frozen-lockfile --prod=false --filter "@poke-air/server..." && pnpm build:server`
  (`--prod=false`: with `NODE_ENV=production` pnpm would skip tsup).
- Start: `node apps/server/dist/index.js`. Health check: `/healthz`. Build filter: server-side paths only.

**Frontend — Vercel (Hobby) — `vercel.json` at the repo root:**

- Root directory: the repo root; framework "Other"; Node 22.x; env `VITE_BACKEND_URL=https://<render-service>.onrender.com`
  and `ENABLE_EXPERIMENTAL_COREPACK=1` (pinned pnpm). `VITE_PUBLIC_APP_URL` is optional (the QR uses the page origin).
- Build: `pnpm build:web:deploy` (asset cache restore → `fetch:sprites --lenient` → `fetch:audio --lenient` →
  `build:data` → `build:locales` → asset cache save → web build). Output `apps/web/dist`.
- SPA fallback: rewrite `/(.*)` → `/index.html`; long cache for `/assets`, one day for sprites and audio.
- Sprites and cries are never in git: they are downloaded by the first build and kept in Vercel's build
  cache (`node_modules/.cache/poke-air-assets/`). A local build + `vercel deploy --prebuilt` is not
  possible on Hobby (CLI uploads are capped at 100 MB; `dist` is ≈ 100 MB).

**Later:** GitHub Actions running `pnpm check` on every push.
