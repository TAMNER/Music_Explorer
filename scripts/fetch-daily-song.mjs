#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mulberry32, shuffle, hashString } from "./lib/prng.mjs";
import { fetchBio } from "./fetch-bio.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const COUNTRIES_PATH = resolve(ROOT, "data/countries.json");
const SEEDS_PATH = resolve(ROOT, "data/country-seeds.json");
const SEQUENCE_PATH = resolve(ROOT, "data/sequence.json");
const SONGS_PATH = resolve(ROOT, "data/songs.json");

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

const todayUTC = () => {
  const arg = process.env.FORCE_DATE?.trim();
  if (arg) return arg;
  return new Date().toISOString().slice(0, 10);
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, data) =>
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, options = {}, attempt = 1) {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  if (res.status === 429 && attempt <= 4) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "2", 10);
    console.warn(`429 from ${url}, sleeping ${retryAfter}s (attempt ${attempt})`);
    await sleep(retryAfter * 1000);
    return fetchWithRetry(url, options, attempt + 1);
  }
  if (res.status >= 500 && res.status < 600 && attempt <= 3) {
    const backoff = 2 ** attempt * 1000;
    console.warn(`${res.status} from ${url}, retrying in ${backoff}ms`);
    await sleep(backoff);
    return fetchWithRetry(url, options, attempt + 1);
  }
  return res;
}

async function getAccessToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.access_token;
}

async function getMarkets(token) {
  const res = await fetchWithRetry(`${API_BASE}/markets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`Could not fetch markets list (${res.status}); skipping check`);
    return null;
  }
  const body = await res.json();
  return new Set(body.markets);
}

async function getArtistTopTracks(token, artistId, market) {
  const res = await fetchWithRetry(
    `${API_BASE}/artists/${artistId}/top-tracks?market=${market}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const body = await res.json();
  return body.tracks ?? [];
}

async function searchTracks(token, query, market, limit = 50) {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    market,
    limit: String(limit),
  });
  const res = await fetchWithRetry(`${API_BASE}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = await res.json();
  return body.tracks?.items ?? [];
}

function pickDeterministic(candidates, seedString) {
  if (candidates.length === 0) return null;
  const seed = hashString(seedString);
  const rand = mulberry32(seed);
  const idx = Math.floor(rand() * candidates.length);
  return candidates[idx];
}

function dedupe(tracks) {
  const seen = new Set();
  const out = [];
  for (const t of tracks) {
    if (!t?.id || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

async function findTrackForCountry(token, iso, seed, date, markets) {
  const seedEntry = seed[iso] ?? {};
  const market =
    seedEntry.marketOverride && (!markets || markets.has(seedEntry.marketOverride))
      ? seedEntry.marketOverride
      : markets && !markets.has(iso)
        ? null
        : iso;

  if (!market) {
    console.warn(`Country ${iso} not a Spotify market and no override; skipping`);
    return null;
  }

  let candidates = [];

  if (Array.isArray(seedEntry.artistIds) && seedEntry.artistIds.length > 0) {
    for (const artistId of seedEntry.artistIds) {
      const tracks = await getArtistTopTracks(token, artistId, market);
      candidates.push(...tracks);
    }
    candidates = dedupe(candidates);
  }

  if (candidates.length === 0) {
    candidates = await searchTracks(token, "year:2022-2026", market, 50);
  }

  if (candidates.length === 0 && seedEntry.fallbackQuery) {
    candidates = await searchTracks(token, seedEntry.fallbackQuery, market, 50);
  }

  if (candidates.length === 0) {
    candidates = await searchTracks(token, "popular", market, 50);
  }

  if (candidates.length === 0) return null;

  return pickDeterministic(candidates, `${date}|${iso}`);
}

function nextCountryFromSequence(sequence, countries, day) {
  let cumulative = 0;
  for (const cycle of sequence.cycles) {
    if (day <= cumulative + cycle.order.length) {
      return cycle.order[day - cumulative - 1];
    }
    cumulative += cycle.order.length;
  }
  const lastSeed = sequence.cycles.at(-1).seed;
  const newSeed = hashString(`${lastSeed}|${sequence.cycles.length}`);
  const isos = countries.map((c) => c.iso);
  const rand = mulberry32(newSeed);
  const order = shuffle(isos, rand);
  sequence.cycles.push({ seed: newSeed, order });
  return order[day - cumulative - 1];
}

async function main() {
  const countries = readJson(COUNTRIES_PATH);
  const seeds = readJson(SEEDS_PATH);
  const sequence = readJson(SEQUENCE_PATH);
  const songs = readJson(SONGS_PATH);

  const date = todayUTC();
  if (songs.some((s) => s.date === date)) {
    console.log(`Entry for ${date} already exists; nothing to do`);
    return;
  }

  const day = songs.length + 1;
  const iso = nextCountryFromSequence(sequence, countries, day);
  const country = countries.find((c) => c.iso === iso);
  if (!country) throw new Error(`Country not found: ${iso}`);

  console.log(`Day ${day} — fetching for ${country.name} (${iso}) on ${date}`);

  const token = await getAccessToken();
  const markets = await getMarkets(token);
  const track = await findTrackForCountry(token, iso, seeds, date, markets);

  if (!track) {
    throw new Error(`No track found for ${iso} (${country.name})`);
  }

  const primaryArtist = track.artists?.[0]?.name ?? "";
  const bio = await fetchBio(primaryArtist, track.name);

  const entry = {
    day,
    date,
    iso,
    country: country.name,
    flag: country.flag,
    track: {
      id: track.id,
      name: track.name,
      artist: track.artists?.map((a) => a.name).join(", ") ?? "",
      album: track.album?.name ?? "",
      spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
      albumImage: track.album?.images?.[0]?.url ?? "",
    },
    bio,
  };

  songs.push(entry);
  writeJson(SONGS_PATH, songs);
  writeJson(SEQUENCE_PATH, sequence);

  console.log(`Picked: ${entry.track.name} — ${entry.track.artist}`);
  console.log(`URL: ${entry.track.spotifyUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
