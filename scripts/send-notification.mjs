#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SONGS_PATH = resolve(ROOT, "data/songs.json");

const APP_ID = process.env.ONESIGNAL_APP_ID;
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const SITE_URL = process.env.SITE_URL;

if (!APP_ID || !REST_API_KEY) {
  console.log("OneSignal credentials missing; skipping notification.");
  process.exit(0);
}

const songs = JSON.parse(readFileSync(SONGS_PATH, "utf8"));
const today = process.env.FORCE_DATE?.trim() || new Date().toISOString().slice(0, 10);
const entry = songs.find((s) => s.date === today) ?? songs.at(-1);

if (!entry) {
  console.log("No songs entry available; nothing to notify about.");
  process.exit(0);
}

const title = `${entry.flag} Today: ${entry.country}`;
const body = `${entry.track.name} — ${entry.track.artist}`;
const url = SITE_URL || undefined;

const payload = {
  app_id: APP_ID,
  included_segments: ["Subscribed Users"],
  headings: { en: title },
  contents: { en: body },
  ...(url ? { url, web_url: url } : {}),
};

const res = await fetch("https://api.onesignal.com/notifications", {
  method: "POST",
  headers: {
    Authorization: `Key ${REST_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
console.log(`OneSignal status: ${res.status}`);
console.log(text);

if (!res.ok) {
  process.exit(1);
}
