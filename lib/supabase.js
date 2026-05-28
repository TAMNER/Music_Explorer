const SUPABASE_CDN = "https://esm.sh/@supabase/supabase-js@2";

let clientPromise = null;
let cachedClient = null;

export async function getClient() {
  if (cachedClient) return cachedClient;
  const cfg = window.MUSIC_EXPLORER_CONFIG ?? {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
  if (!clientPromise) {
    clientPromise = import(SUPABASE_CDN).then(({ createClient }) => {
      cachedClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      return cachedClient;
    });
  }
  return clientPromise;
}

export async function getSession() {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function onAuthChange(callback) {
  const supabase = await getClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithSpotify(redirectTo) {
  const supabase = await getClient();
  if (!supabase) throw new Error("Supabase not configured");
  return supabase.auth.signInWithOAuth({
    provider: "spotify",
    options: {
      redirectTo: redirectTo ?? window.location.href,
      scopes: "user-read-email",
    },
  });
}

export async function signInWithEmail(email, password) {
  const supabase = await getClient();
  if (!supabase) throw new Error("Supabase not configured");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email, password) {
  const supabase = await getClient();
  if (!supabase) throw new Error("Supabase not configured");
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  const supabase = await getClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function recordEngagement(songDate, kind) {
  const supabase = await getClient();
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("engagements")
    .upsert(
      { user_id: session.user.id, song_date: songDate, kind },
      { onConflict: "user_id,song_date,kind", ignoreDuplicates: true },
    )
    .select();
  if (error) console.warn("recordEngagement:", error.message);
  return data;
}

export async function removeEngagement(songDate, kind) {
  const supabase = await getClient();
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;
  const { error } = await supabase
    .from("engagements")
    .delete()
    .eq("song_date", songDate)
    .eq("kind", kind);
  if (error) console.warn("removeEngagement:", error.message);
}

export async function isFavorited(songDate) {
  const supabase = await getClient();
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;
  const { data, error } = await supabase
    .from("engagements")
    .select("id")
    .eq("song_date", songDate)
    .eq("kind", "favorited")
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export function displayNameOf(session) {
  if (!session?.user) return "";
  const meta = session.user.user_metadata ?? {};
  return meta.full_name || meta.name || session.user.email?.split("@")[0] || "Explorer";
}
