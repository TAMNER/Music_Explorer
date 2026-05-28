const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKI_REST = "https://en.wikipedia.org/api/rest_v1/page/summary";
const UA = "MusicExplorer/1.0 (https://github.com/tamner/music_explorer)";

async function searchWikipedia(query) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    origin: "*",
    srlimit: "1",
  });
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.query?.search?.[0]?.title ?? null;
}

async function getSummary(title) {
  const res = await fetch(`${WIKI_REST}/${encodeURIComponent(title)}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type === "disambiguation" || !data.extract) return null;
  return {
    extract: data.extract,
    url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    thumbnail: data.thumbnail?.source ?? null,
  };
}

async function lookup(query) {
  const title = await searchWikipedia(query);
  if (!title) return null;
  return getSummary(title);
}

export async function fetchBio(artist, track) {
  try {
    const artistBio = artist ? await lookup(`${artist} musician`) : null;
    const trackBio = artist && track ? await lookup(`${track} ${artist} song`) : null;
    if (!artistBio && !trackBio) return null;
    return { artist: artistBio, track: trackBio };
  } catch (err) {
    console.warn("Wikipedia bio fetch failed:", err.message);
    return null;
  }
}
