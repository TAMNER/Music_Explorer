#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mulberry32, shuffle } from "./lib/prng.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const COUNTRIES_PATH = resolve(ROOT, "data/countries.json");
const SEQUENCE_PATH = resolve(ROOT, "data/sequence.json");

const SEED = parseInt(process.argv[2] ?? "20260528", 10);

const countries = JSON.parse(readFileSync(COUNTRIES_PATH, "utf8"));
const isos = countries.map((c) => c.iso);
const rand = mulberry32(SEED);
const order = shuffle(isos, rand);

const sequence = {
  seed: SEED,
  generatedAt: new Date().toISOString(),
  cycles: [{ seed: SEED, order }],
};

writeFileSync(SEQUENCE_PATH, JSON.stringify(sequence, null, 2) + "\n", "utf8");

console.log(`Wrote ${SEQUENCE_PATH}`);
console.log(`Seed: ${SEED}, countries: ${order.length}`);
console.log(`First 5: ${order.slice(0, 5).join(", ")}`);
