import {
  getClient,
  getSession,
  onAuthChange,
  signInWithSpotify,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  displayNameOf,
} from "./supabase.js";

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function renderSignedOut(slot) {
  slot.innerHTML = `
    <details class="auth-menu">
      <summary class="auth-trigger">Sign in</summary>
      <div class="auth-panel" role="dialog" aria-label="Sign in options">
        <button type="button" class="auth-spotify" id="auth-spotify-btn">
          Continue with Spotify
        </button>
        <div class="auth-divider"><span>or</span></div>
        <form class="auth-email-form" id="auth-email-form">
          <label class="auth-field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span>Password</span>
            <input type="password" name="password" required minlength="8" autocomplete="current-password" />
          </label>
          <div class="auth-actions">
            <button type="submit" class="auth-submit" data-mode="signin">Sign in</button>
            <button type="button" class="auth-link" id="auth-toggle">New here? Create an account</button>
          </div>
          <p class="auth-message" id="auth-message" role="status"></p>
        </form>
      </div>
    </details>
  `;

  slot.querySelector("#auth-spotify-btn").addEventListener("click", async () => {
    try {
      await signInWithSpotify();
    } catch (err) {
      showMessage(slot, err.message);
    }
  });

  const form = slot.querySelector("#auth-email-form");
  const submit = form.querySelector(".auth-submit");
  const toggle = slot.querySelector("#auth-toggle");
  let mode = "signin";

  toggle.addEventListener("click", () => {
    mode = mode === "signin" ? "signup" : "signin";
    submit.textContent = mode === "signin" ? "Sign in" : "Create account";
    submit.dataset.mode = mode;
    toggle.textContent =
      mode === "signin"
        ? "New here? Create an account"
        : "Already have an account? Sign in";
    showMessage(slot, "");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage(slot, "");
    const email = form.email.value.trim();
    const password = form.password.value;
    try {
      const { error } =
        mode === "signin"
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);
      if (error) {
        showMessage(slot, error.message);
      } else if (mode === "signup") {
        showMessage(slot, "Check your inbox to confirm your email.");
      }
    } catch (err) {
      showMessage(slot, err.message);
    }
  });
}

function showMessage(slot, text) {
  const msg = slot.querySelector("#auth-message");
  if (msg) msg.textContent = text;
}

function renderSignedIn(slot, session) {
  const name = displayNameOf(session);
  slot.innerHTML = `
    <details class="auth-menu">
      <summary class="auth-trigger is-signed-in">${escapeHTML(name)}</summary>
      <div class="auth-panel" role="menu">
        <button type="button" class="auth-link" id="auth-signout">Sign out</button>
      </div>
    </details>
  `;
  slot.querySelector("#auth-signout").addEventListener("click", async () => {
    await signOut();
  });
}

export async function mountAuthUI(slot, { onSession } = {}) {
  if (!slot) return;
  const supabase = await getClient();
  if (!supabase) {
    slot.innerHTML = "";
    return;
  }

  const apply = (session) => {
    if (session) renderSignedIn(slot, session);
    else renderSignedOut(slot);
    onSession?.(session);
  };

  const initial = await getSession();
  apply(initial);

  await onAuthChange((session) => {
    apply(session);
  });
}
