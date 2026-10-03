import { SettingsPage } from "@/components/settings/settings-page";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsRoute() {
  let accountEmail: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    accountEmail = data.user?.email ?? null;
  }

  return <SettingsPage accountEmail={accountEmail} />;
}
