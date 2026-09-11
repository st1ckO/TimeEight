"use client";

import { useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

interface AuthFormProps {
  configured: boolean;
  emailEnabled: boolean;
}

export function AuthForm({ configured, emailEnabled }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    if (!configured)
      return setMessage(
        "Add your Supabase project values to .env.local to enable sign-in.",
      );
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage(error.message);
      setPending(false);
    }
  }

  async function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || !emailEnabled) return;
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = createClient();
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) setMessage(result.error.message);
    else if (mode === "signup")
      setMessage("Check your email to confirm your account.");
    else router.push("/today");
    setPending(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About TimeEight">
        <a className="brand auth-brand" href="/today">
          <span>8</span>
          <strong>TimeEight</strong>
        </a>
        <div>
          <p className="eyebrow">Time it your way</p>
          <h1>A clearer relationship with your time.</h1>
          <p>
            Build up the things you want more of. Put a gentle limit on the
            things you want less of. TimeEight keeps the timer and leaves the
            judgment behind.
          </p>
        </div>
        <div className="auth-promise">
          <Clock3 size={20} />
          <span>
            Your task names and time history stay private to your account.
          </span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Welcome</p>
          <h2>
            {mode === "signin"
              ? "Continue to your timers"
              : "Create your TimeEight account"}
          </h2>
          <button
            className="google-button"
            type="button"
            onClick={signInWithGoogle}
            disabled={pending}
          >
            <span aria-hidden>G</span>Continue with Google
            <ArrowRight size={18} />
          </button>
          {emailEnabled && (
            <>
              <div className="or-divider">
                <span>or use email</span>
              </div>
              <form className="auth-form" onSubmit={submitEmail}>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    minLength={12}
                    required
                  />
                </label>
                <button
                  className="primary-button auth-submit"
                  disabled={pending}
                >
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
              <button
                className="text-button"
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </button>
            </>
          )}
          {!emailEnabled && (
            <p className="auth-note">
              Email sign-in will open after secure mail delivery is configured.
            </p>
          )}
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
          {!configured && (
            <a className="demo-link" href="/today">
              Explore the local demo <ArrowRight size={17} />
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
