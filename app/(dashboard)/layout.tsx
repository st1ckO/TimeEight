import { AppProvider } from "@/components/app/app-provider";
import { AppShell } from "@/components/app/app-shell";
import { localDateAt } from "@/lib/domain/time";
import type { Profile } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fallback: Profile = {
    id: "local-demo",
    displayName: "Ralph",
    timezone: "Asia/Manila",
    theme: "system",
    onboardingCompleted: true,
  };

  let profile = fallback;
  let accountStart = localDateAt(new Date(), fallback.timezone);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();
      profile = {
        id: authData.user.id,
        displayName:
          data?.display_name ||
          authData.user.user_metadata.full_name ||
          "Friend",
        timezone: data?.timezone || "UTC",
        theme: data?.theme || "system",
        onboardingCompleted: data?.onboarding_completed ?? false,
      };
      accountStart = localDateAt(
        data?.created_at ? new Date(data.created_at) : new Date(),
        profile.timezone,
      );
    }
  }

  return (
    <AppProvider
      userId={profile.id}
      initialProfile={profile}
      initialAccountStart={accountStart}
    >
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
