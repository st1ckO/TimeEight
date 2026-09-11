import { AuthForm } from "@/components/auth/auth-form";
import {
  isEmailAuthEnabled,
  isSupabaseConfigured,
  turnstileSiteKey,
} from "@/lib/supabase/config";

export default function LoginPage() {
  return (
    <AuthForm
      configured={isSupabaseConfigured()}
      emailEnabled={isEmailAuthEnabled}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}
