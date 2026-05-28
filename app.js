const SONGS_URL = "data/songs.json";
const COUNTRIES_URL = "data/countries.json";

const SPOTIFY_LOGO_SVG = `<svg class="spotify-logo" viewBox="0 0 168 168" aria-hidden="true">
  <path fill="currentColor" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.251 37.494 83.741 83.743 83.741 46.254 0 83.744-37.49 83.744-83.741 0-46.246-37.49-83.738-83.745-83.738zm38.404 120.78a5.217 5.217 0 01-7.18 1.73c-19.662-12.01-44.414-14.73-73.564-8.07a5.222 5.222 0 01-6.249-3.93 5.213 5.213 0 013.926-6.25c31.9-7.291 59.263-4.15 81.337 9.34 2.46 1.51 3.24 4.72 1.73 7.18zm10.25-22.805c-1.89 3.07-5.91 4.04-8.98 2.16-22.51-13.84-56.823-17.846-83.448-9.764-3.453 1.043-7.1-.903-8.148-4.35a6.538 6.538 0 014.354-8.143c30.413-9.228 68.222-4.758 94.072 11.127 3.07 1.89 4.04 5.91 2.15 8.97zm.88-23.744c-26.99-16.031-71.52-17.505-97.289-9.684-4.138 1.255-8.514-1.081-9.768-5.219a7.835 7.835 0 015.221-9.771c29.581-8.98 78.756-7.245 109.83 11.202a7.823 7.823 0 012.74 10.733c-2.2 3.722-7.02 4.949-10.73 2.739z"/>
</svg>`;

const $ = (id) => document.getElementById(id);

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function renderEmpty(card) {
  card.removeAttribute("aria-busy");
  card.innerHTML = `
    <p class="status">
      No songs yet. The first discovery lands tomorrow.
    </p>
  `;
}

function renderEntry(card, entry) {
  card.removeAttribute("aria-busy");
  const { country, flag, day, date, track } = entry;
  const albumImg = track.albumImage
    ? `<img class="album-art" src="${escapeHTML(track.albumImage)}" alt="Album art for ${escapeHTML(track.name)} by ${escapeHTML(track.artist)}" loading="lazy" />`
    : "";
  card.innerHTML = `
    <div class="country-row">
      <span class="country-flag" aria-hidden="true">${escapeHTML(flag)}</span>
      <h2 class="country-name">${escapeHTML(country)}</h2>
      <span class="day-label">Day ${day} · ${escapeHTML(formatDate(date))}</span>
    </div>
    <div class="track">
      ${albumImg}
      <div class="track-info">
        <p class="track-name">${escapeHTML(track.name)}</p>
        <p class="track-artist">${escapeHTML(track.artist)}</p>
      </div>
    </div>
    <a
      class="spotify-button"
      href="${escapeHTML(track.spotifyUrl)}"
      target="_blank"
      rel="noopener"
    >${SPOTIFY_LOGO_SVG}Open in Spotify</a>
  `;
}

function renderHistory(list, entries) {
  if (entries.length <= 1) {
    list.parentElement.style.display = "none";
    return;
  }
  const past = entries.slice(0, -1).reverse();
  list.innerHTML = past
    .map(
      (e) => `
    <li>
      <a href="${escapeHTML(e.track.spotifyUrl)}" target="_blank" rel="noopener">
        <span class="history-flag" aria-hidden="true">${escapeHTML(e.flag)}</span>
        <strong>${escapeHTML(e.country)}</strong>
        — ${escapeHTML(e.track.name)}
        <span class="history-meta">· ${escapeHTML(e.track.artist)}</span>
      </a>
    </li>
  `,
    )
    .join("");
}

function renderProgress(el, entries, totalCountries) {
  if (entries.length === 0) {
    el.textContent = "";
    return;
  }
  const seenIsos = new Set(entries.map((e) => e.iso));
  const unique = seenIsos.size;
  el.textContent = `${entries.length} day${entries.length === 1 ? "" : "s"} explored · ${unique} of ${totalCountries} countries visited`;
}

async function loadJSON(url) {
  const res = await fetch(`${url}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

async function init() {
  const card = $("card");
  const historyList = $("history-list");
  const progress = $("progress");

  try {
    const [entries, countries] = await Promise.all([
      loadJSON(SONGS_URL),
      loadJSON(COUNTRIES_URL),
    ]);

    if (entries.length === 0) {
      renderEmpty(card);
    } else {
      renderEntry(card, entries.at(-1));
      renderHistory(historyList, entries);
    }
    renderProgress(progress, entries, countries.length);
  } catch (err) {
    console.error(err);
    card.removeAttribute("aria-busy");
    card.innerHTML = `<p class="status">Could not load today's song. Please try again later.</p>`;
  }
}

init();
