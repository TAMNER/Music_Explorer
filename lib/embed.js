const API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

let apiPromise = null;

function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.SpotifyIframeApi) {
      resolve(window.SpotifyIframeApi);
      return;
    }
    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api;
      resolve(api);
    };
    const s = document.createElement("script");
    s.src = API_SRC;
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export async function createPlayer({ trackId, container, onEnded }) {
  const api = await loadApi();
  return new Promise((resolve) => {
    api.createController(
      container,
      {
        uri: `spotify:track:${trackId}`,
        width: "100%",
        height: "152",
      },
      (controller) => {
        let endedFired = false;
        controller.addListener("playback_update", (e) => {
          const { position, duration } = e.data ?? {};
          if (!endedFired && duration > 0 && position >= duration - 200) {
            endedFired = true;
            onEnded?.();
          }
          if (position < (duration ?? 0) - 1000) {
            endedFired = false;
          }
        });
        resolve(controller);
      },
    );
  });
}
