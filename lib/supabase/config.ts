const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    url &&
    publishableKey &&
    !url.includes("your-project") &&
    !publishableKey.includes("replace_me"),
  );
}

export function getSupabaseConfig(): { url: string; publishableKey: string } {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and add the project values.",
    );
  }

  return { url: url!, publishableKey: publishableKey! };
}

export const isEmailAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "true";

export const turnstileSiteKey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
