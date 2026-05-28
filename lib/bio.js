function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function renderBio(container, bio) {
  if (!container) return;
  if (!bio || (!bio.artist && !bio.track)) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  container.hidden = false;
  const sections = [];
  if (bio.artist) {
    sections.push(`
      <article class="bio-section">
        ${bio.artist.thumbnail ? `<img class="bio-thumb" src="${escapeHTML(bio.artist.thumbnail)}" alt="" loading="lazy" />` : ""}
        <div class="bio-body">
          <h3 class="bio-heading">About the artist</h3>
          <p class="bio-text">${escapeHTML(bio.artist.extract)}</p>
          <a class="bio-source" href="${escapeHTML(bio.artist.url)}" target="_blank" rel="noopener">Read more on Wikipedia →</a>
        </div>
      </article>
    `);
  }
  if (bio.track) {
    sections.push(`
      <article class="bio-section">
        <div class="bio-body">
          <h3 class="bio-heading">About the song</h3>
          <p class="bio-text">${escapeHTML(bio.track.extract)}</p>
          <a class="bio-source" href="${escapeHTML(bio.track.url)}" target="_blank" rel="noopener">Read more on Wikipedia →</a>
        </div>
      </article>
    `);
  }
  container.innerHTML = sections.join("");
}
