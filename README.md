# Music Explorer

A daily song from a new country, every day. Random without replacement across all 195 UN nations.

## How it works

- A scheduled GitHub Action runs each day at 00:05 UTC.
- It picks the next country from a deterministic shuffled sequence (`data/sequence.json`).
- It queries the Spotify API for a track popular in that country and appends the result to `data/songs.json`.
- A static frontend (this repo's root) reads `data/songs.json` and renders the most recent entry.
- Deployed via GitHub Pages.

## Setup

### 1. Spotify credentials

Create a Spotify app at <https://developer.spotify.com/dashboard>. Add two repo secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

The script uses the Client Credentials flow — no user OAuth required.

### 2. Enable GitHub Pages

Settings → Pages → Source: **GitHub Actions**.

### 3. OneSignal (for daily push notifications)

1. Create a free account at <https://onesignal.com> and add a new **Web** app.
2. Enter the Pages URL as the site URL; upload an icon (use `icons/icon-512.png`).
3. From the OneSignal app's *Settings → Keys & IDs*, copy:
   - **App ID** → repo variable `ONESIGNAL_APP_ID`
   - **REST API Key** → repo secret `ONESIGNAL_REST_API_KEY`
4. Add a repo variable `SITE_URL` = your Pages URL (e.g. `https://USER.github.io/music_explorer/`).
5. Paste the App ID into `config.js` (`oneSignalAppId`) and commit, so the frontend can initialize the SDK.

On iOS, the site must be installed to the home screen before push works — the page shows that hint automatically to iPhone visitors.

### 4. Supabase (accounts + saved favorites)

1. Create a project at <https://supabase.com>.
2. In the SQL editor, run `db/schema.sql` to create tables and row-level security policies.
3. In *Authentication → Providers → Spotify*, enable the provider and paste the same `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` you used above. Copy the OAuth redirect URL Supabase shows and add it to your Spotify app's **Redirect URIs** list.
4. Copy the project **URL** and **anon public key** from *Settings → API*, paste them into `config.js`.

Email/password sign-in works out of the box. Email confirmation can be toggled in *Authentication → Settings*.

### 5. Generate the initial sequence (one-time)

```sh
node scripts/generate-sequence.mjs
git add data/sequence.json
git commit -m "Bootstrap country sequence"
```

A custom integer seed can be passed: `node scripts/generate-sequence.mjs 12345`.

### 6. Regenerate icons (only when changing the source)

Edit `icons/icon.svg`, then:

```sh
npm install
npm run icons
```

This rasterizes the SVG into all required PNG sizes (committed to the repo).

### 7. Run the fetcher locally (optional)

```sh
export SPOTIFY_CLIENT_ID=...
export SPOTIFY_CLIENT_SECRET=...
node scripts/fetch-daily-song.mjs
```

To backfill for a specific UTC date: `FORCE_DATE=2026-05-29 node scripts/fetch-daily-song.mjs`.

## Repository layout

```
index.html, styles.css, app.js     Static frontend (ES module)
config.js                          Public client config (OneSignal + Supabase keys)
manifest.webmanifest               PWA manifest
OneSignalSDKWorker.js              Service worker (push + PWA shell)
lib/supabase.js                    Supabase client + auth helpers + engagement read/write
lib/auth-ui.js                     Sign in dropdown (Spotify OAuth + email)
lib/embed.js                       Spotify Embed IFrame API wrapper
lib/bio.js                         Wikipedia bio card rendering
icons/                             App icons (SVG source + generated PNGs)
data/countries.json                195 UN countries (iso, name, flag)
data/country-seeds.json            Curated artist seeds per country
data/sequence.json                 Shuffled order (the "without replacement" list)
data/songs.json                    Append-only history of daily picks (now includes bio)
db/schema.sql                      Supabase tables + row-level security policies
scripts/generate-sequence.mjs      Bootstrap / regenerate the shuffle
scripts/fetch-daily-song.mjs       Daily worker (called by the Action)
scripts/fetch-bio.mjs              Wikipedia bio lookup (used by daily worker)
scripts/send-notification.mjs      OneSignal notification step
scripts/generate-icons.mjs         SVG → PNG icon rasterizer
scripts/lib/prng.mjs               Seeded PRNG + Fisher-Yates shuffle
.github/workflows/daily-song.yml   Scheduled fetch + notification
.github/workflows/deploy.yml       Pages deploy
```

## Adding or improving country seeds

Edit `data/country-seeds.json`. Each entry can include:

- `artistIds` — Spotify artist IDs; the fetcher pulls each artist's top tracks in the country's market.
- `fallbackQuery` — used when artist lookups return nothing (`/search?q=…&market=<iso>`).
- `marketOverride` — for countries Spotify doesn't serve (KP, IR, etc.), substitute a neighboring market.

Unmapped countries are fine: the fetcher falls back to a generic year-range search in that market.

## Why pick "most recent" instead of "today's date"?

The frontend renders `entries.at(-1)`, not the entry whose `date` matches today. This:

- Stays correct if the Action runs late or fails (yesterday's song remains visible).
- Avoids client-side timezone math entirely.

## Out of scope (v1)

- Per-user randomness
- Embedded Spotify player
- Multiple songs per day
- Account features

## License

MIT
