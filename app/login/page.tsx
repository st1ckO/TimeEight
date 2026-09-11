import { AuthForm } from "@/components/auth/auth-form";
import {
  isEmailAuthEnabled,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

export default function LoginPage() {
  return (
    <AuthForm
      configured={isSupabaseConfigured()}
      emailEnabled={isEmailAuthEnabled}
    />
  );
}
