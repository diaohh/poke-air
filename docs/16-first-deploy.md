# 16 — First deploy (spike S6): Render + Vercel and real phones

Plan and record of the first deploy (decision D-23 deferred it until now; roadmap in `09-roadmap.md`,
hosting options in `07-hosting-and-deployment.md`). Where it disagrees with `07`, this file is newer.

## Status (2026-10-03): prepared and rehearsed locally, deploy pending (done by hand)

Everything the repo needs is in place and was rehearsed on this machine; the deploy itself needs the
team's Render and Vercel accounts, so it is a manual step (§ Step by step). After it, the real-phone
checklist (§ S6 checklist) closes the spike.

What was built:

- **`render.yaml`** (Render Blueprint, free plan, region Virginia): filtered install of the server and
  its workspace packages (`--prod=false`, because `NODE_ENV=production` would skip tsup), `pnpm
build:server`, start with plain `node apps/server/dist/index.js`, health check `/healthz`,
  `NODE_OPTIONS=--max-old-space-size=384`, `ALLOWED_ORIGINS` asked on creation, build filter (web-only
  changes don't redeploy the server).
- **`vercel.json`** (repo root): `pnpm build:web:deploy`, output `apps/web/dist`, SPA rewrite to
  `index.html` (`/host`, `/j/:code`, `/teams`), long cache for hashed `/assets`, one day for sprites
  and audio.
- **`pnpm build:web:deploy`**: restores the asset cache → `fetch:sprites --lenient` →
  `fetch:audio --lenient` → `build:data` → `build:locales` → saves the asset cache → web build.
- **Asset cache** (`packages/data/scripts/asset-cache.ts`, D-64): sprites, cries and the translation
  sources are parked in `node_modules/.cache/poke-air-assets/`, which Vercel restores between builds,
  so only the first build downloads them (polite, sequential: ~12 min) and later ones take seconds.
- **`--lenient`** for the download scripts: failed downloads are listed but don't fail the build (a
  failed build never saves Vercel's cache, so one network hiccup would throw away the whole first
  download); the next build retries the missing files.
- **Backend warm-up** (D-66): every page load pings `/healthz` (fire-and-forget), so a sleeping free
  backend starts waking while the Host page loads and the players scan the QR. The existing
  "Warming up the stadium…" message stays for the remaining wait.
- **E2E against a deployment** (D-67): `E2E_BASE_URL=https://<app> pnpm test:e2e` runs the same specs
  against the deployed site (no local servers, longer timeouts).

## Analysis

| Constraint                                                                                                          | Consequence                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprites (2 716 files, ≈ 95 MB) + cries are never committed (`03`)                                                   | A Git-based build must download them. Vercel Hobby limits CLI uploads to **100 MB** and the built `dist` is ≈ 100 MB, so "build locally + `vercel deploy --prebuilt`" is not an option |
| Vercel keeps `node_modules/**` between builds (1 GB cache, one month, per branch); a failed build doesn't update it | Park the assets in `node_modules/.cache` (D-64) and never fail the build for a missing file (`--lenient`)                                                                              |
| Build time limit 45 min                                                                                             | First build ≈ 12–15 min (downloads), later ones ≈ 2 min                                                                                                                                |
| Render free: 512 MB RAM, sleeps after 15 min without HTTP **or WebSocket** traffic, ~1 min cold start, 750 h/month  | A game in progress keeps it awake; the cold start is covered by the warm-up ping + message. One service = ~744 h/month: fits                                                           |
| `NODE_ENV=production` in Render's env also applies to the build                                                     | `pnpm install --prod=false` (else no tsup)                                                                                                                                             |
| The server refuses to start in production without `ALLOWED_ORIGINS`                                                 | Set it to the Vercel production URL (Vercel preview URLs are not allowed: use production deploys for phone tests)                                                                      |
| `VITE_*` variables are baked in at build time                                                                       | Changing `VITE_BACKEND_URL` needs a Vercel redeploy                                                                                                                                    |
| HTTPS everywhere                                                                                                    | The Wake Lock API works on phones (it can't on plain-HTTP LAN dev): S6 is the first real test of it                                                                                    |

## Local rehearsal (2026-10-03)

- **Render build** in a clean worktree with `NODE_ENV=production`: filtered install + `build:server` in
  **8 s** (warm pnpm store), bundle 89 KB. The server refuses to start without `ALLOWED_ORIGINS`;
  with it: `/healthz` → `{"ok":true,"rooms":0}`, CORS only reflects the allowed origin, `/api/info`
  returns no LAN addresses, RSS **70 MB** at idle (≈ 210 MB after battles, spike S1).
- **Vercel build** (`pnpm build:web:deploy`) in a clean worktree with a seeded asset cache: restore
  4/4 entries, 0 sprite downloads (2 715 present), data + locales, save, Vite build; `dist` = 3 099
  files, **100 MB**, `VITE_BACKEND_URL` baked into the bundle.
- `pnpm test:e2e` (4 specs: singles, doubles 2v2, Spanish room, team editor) passes locally.

## Decisions (recorded in `08-decisions.md`)

- **D-64** Frontend on **Vercel through its Git integration**; the build downloads sprites and cries
  (`pnpm build:web:deploy`) and parks them in `node_modules/.cache/poke-air-assets/` between builds;
  download failures don't fail a deploy build (`--lenient`). No assets in git, no prebuilt uploads.
- **D-65** Backend on **Render free via `render.yaml`** (Blueprint): region Virginia (players are in
  UTC-5), filtered install with `--prod=false`, `node apps/server/dist/index.js`, `/healthz` health
  check, V8 heap capped at 384 MB.
- **D-66** Backend warm-up: every page load sends a fire-and-forget `GET /healthz` (`no-cors`).
- **D-67** `E2E_BASE_URL` points the Playwright specs at a deployed frontend.

## Step by step (manual)

Prerequisites: the repo on GitHub (private is fine), a Render account and a Vercel account (both can
sign in with GitHub). Commit and push `main` first: both services build from GitHub.

### 1. Backend on Render

1. Render dashboard → **New → Blueprint** → connect the GitHub repo → it reads `render.yaml` and
   proposes the `poke-air-server` web service (free plan, Virginia).
2. It asks for **`ALLOWED_ORIGINS`**: if you don't know the Vercel URL yet, enter a placeholder such
   as `https://poke-air.vercel.app` (fixed in step 3).
3. **Apply**. The first build takes ~2–3 min. When it is live, open
   `https://<service>.onrender.com/healthz` → `{"ok":true,"rooms":0}`. Note the URL (Render may add a
   suffix if the name is taken).

### 2. Frontend on Vercel

1. Vercel → **Add New → Project** → import the GitHub repo. **Root Directory: the repo root** (leave
   `./`). Framework preset: **Other** (`vercel.json` sets the commands).
2. **Environment variables** (Production): `VITE_BACKEND_URL=https://<service>.onrender.com` and
   `ENABLE_EXPERIMENTAL_COREPACK=1` (so Vercel uses the pinned pnpm 10.33.2 of `packageManager`).
   `VITE_PUBLIC_APP_URL` is not needed (the QR uses the page's own origin).
3. Settings → **Node.js Version: 22.x**.
4. **Deploy**. The first build downloads every sprite and cry from Showdown (~12–15 min, polite pace);
   watch the log for `Sprites: N downloaded…`. Later deploys reuse the cache (~2 min).
5. Note the production URL (e.g. `https://poke-air.vercel.app`, or a custom domain).

### 3. Connect them

1. Render → service → **Environment** → `ALLOWED_ORIGINS=https://<vercel-production-url>` (comma-separate
   several, no trailing slash) → save (Render redeploys).
2. If the Render URL changed after step 2, update `VITE_BACKEND_URL` on Vercel and **Redeploy**.
3. Smoke test from the PC: open `https://<vercel-url>/host` → lobby with a QR whose link is
   `https://<vercel-url>/j/XXXX`. Optional: `E2E_BASE_URL=https://<vercel-url> pnpm test:e2e`.

### Day to day

- Push to `main` → Vercel redeploys the web; Render redeploys the server only when server-side paths
  change (`buildFilter`).
- New species / sprites: the next Vercel build downloads only the missing files.
- To start the asset cache from scratch: Vercel → Redeploy without "Use existing Build Cache".
- Music (`apps/web/public/audio/music/*.mp3`) only reaches the deploy if it is committed (CC0 files +
  `CREDITS.md`, D-32); otherwise the Host plays without music.

## S6 checklist (real phones, real network)

Use at least one iPhone (Safari) and one Android (Chrome), on mobile data and on Wi-Fi. Write the results
in the table below.

1. **Cold start:** with the backend asleep (> 15 min idle), open `/host` on the PC: time until the
   lobby shows; the "Warming up the stadium…" message appears meanwhile.
2. **Join:** scan the QR with each phone; name, avatar, team switch.
3. **Screen lock in the lobby:** lock a phone 30 s and 2 min, unlock → it is back in the room (same
   seat, Host shows it connected again).
4. **Screen lock mid-battle:** lock during a turn and after choosing; unlock → menu or waiting view
   restored, the choice kept; the turn timer fills the move if it stayed locked.
5. **Wake Lock:** during team building and battle, the phone screen doesn't turn off by itself
   (default auto-lock 30 s).
6. **Switch apps / network:** go to another app 1 min and back; switch Wi-Fi ↔ mobile data mid-game.
7. **Latency:** tap a move → the waiting view appears at once (optimistic); the Host animates the turn
   within ~1 s of the last choice.
8. **Host refresh:** F5 on the Host mid-battle → the scene resyncs.
9. **A whole session:** singles + doubles 2v2 + rematch, without the backend sleeping or restarting
   (Render logs: no restarts / out-of-memory).

| #   | iPhone (Safari) | Android (Chrome) | Notes |
| --- | --------------- | ---------------- | ----- |
| 1   |                 |                  |       |
| 2   |                 |                  |       |
| 3   |                 |                  |       |
| 4   |                 |                  |       |
| 5   |                 |                  |       |
| 6   |                 |                  |       |
| 7   |                 |                  |       |
| 8   |                 |                  |       |
| 9   |                 |                  |       |

## Known limits and follow-ups

- **Rate limits behind the proxy:** the server reads the first `X-Forwarded-For` entry in production;
  a client could spoof it to dodge the per-IP limits (low risk for a private fan game). Check which
  header Render guarantees if abuse ever matters.
- **Preview deployments** can't reach the backend (CORS): test on the production URL.
- **Cache-Control** for `/data/*.json` stays Vercel's default (revalidate): they change with
  `build:data` versions.
- No CI yet (D-23): `pnpm check` still runs by hand before pushing.
