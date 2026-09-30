"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowDown, ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { BrandWordmark } from "@/components/ui/brand-wordmark";
import {
  LandingFeaturePreviews,
  LandingHeroPreview,
  LandingPrinciples,
} from "./landing-previews";

interface AuthFormProps {
  configured: boolean;
  emailEnabled: boolean;
  turnstileSiteKey?: string;
}

export function AuthForm({
  configured,
  emailEnabled,
  turnstileSiteKey = "",
}: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [captchaToken, setCaptchaToken] = useState("");
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
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
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
    if (!captchaToken) {
      setPending(false);
      return setMessage("Complete the security check first.");
    }
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        captchaToken,
      });
      setMessage(
        error ? error.message : "Check your email for a secure reset link.",
      );
      setPending(false);
      return;
    }
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              captchaToken,
            },
          })
        : await supabase.auth.signInWithPassword({
            email,
            password,
            options: { captchaToken },
          });

    if (result.error) setMessage(result.error.message);
    else if (mode === "signup")
      setMessage("Check your email to confirm your account.");
    else router.push("/today");
    setPending(false);
  }

  return (
    <main className="landing-page">
      <header className="landing-header landing-shell">
        <a
          className="brand landing-brand"
          href="#top"
          aria-label="TimeEight home"
        >
          <BrandWordmark />
        </a>
        <nav aria-label="Landing page">
          <a href="#inside">Inside the app</a>
          <a className="landing-nav-cta" href="#signin">
            Sign in
          </a>
        </nav>
      </header>

      <section className="landing-hero landing-shell" id="top">
        <div className="landing-hero-copy">
          <h1>Start a timer. Understand your day.</h1>
          <p className="landing-lede">
            Run timers for what you want more of, set daily limits for what you
            want less of, and keep a clear history of how your time adds up.
          </p>
          <div className="landing-actions">
            <a className="landing-primary-cta" href="#signin">
              Get started <ArrowRight size={17} />
            </a>
            <a className="landing-secondary-cta" href="#inside">
              See inside the app <ArrowDown size={16} />
            </a>
          </div>
          <LandingPrinciples />
        </div>
        <LandingHeroPreview />
      </section>

      <section className="landing-intro" id="inside">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <p className="eyebrow">One place for the whole picture</p>
            <h2>From the timer you start to the patterns you notice.</h2>
            <p>
              TimeEight stays simple while you are tracking, then gives you
              enough context to understand how your time actually unfolded.
            </p>
          </div>
          <LandingFeaturePreviews />
        </div>
      </section>

      <section className="landing-signin" id="signin">
        <div className="landing-shell landing-signin-layout">
          <div className="landing-signin-copy">
            <p className="eyebrow">Ready when you are</p>
            <h2>Keep your timers and history with you.</h2>
            <p>
              Sign in to carry your tasks across devices. Your task names and
              tracked history stay private to your account.
            </p>
            <span>
              <LockKeyhole size={17} /> Private by design
            </span>
          </div>
          <div className="auth-card">
            <div className="auth-card-header">
              <p className="eyebrow">Your account</p>
              <h2>
                {mode === "reset"
                  ? "Reset your password"
                  : mode === "signin"
                    ? "Continue to TimeEight"
                    : "Create your TimeEight account"}
              </h2>
              <p className="auth-card-intro">
                Use your Google account to keep your timers, tasks, and history
                available across devices.
              </p>
            </div>
            <button
              className="google-button"
              type="button"
              onClick={signInWithGoogle}
              disabled={pending}
              aria-busy={pending}
            >
              <span className="google-mark" aria-hidden="true" />
              <span className="google-button-label">Continue with Google</span>
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
                  {mode !== "reset" && (
                    <label>
                      Password
                      <input
                        type="password"
                        name="password"
                        autoComplete={
                          mode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                        minLength={12}
                        required
                      />
                    </label>
                  )}
                  {turnstileSiteKey ? (
                    <Turnstile
                      siteKey={turnstileSiteKey}
                      onSuccess={setCaptchaToken}
                      onExpire={() => setCaptchaToken("")}
                      options={{ theme: "auto" }}
                    />
                  ) : (
                    <p className="form-message" role="status">
                      Turnstile must be configured before email authentication
                      can be used publicly.
                    </p>
                  )}
                  <button
                    className="primary-button auth-submit"
                    disabled={pending || !turnstileSiteKey}
                  >
                    {mode === "reset"
                      ? "Send reset link"
                      : mode === "signin"
                        ? "Sign in"
                        : "Create account"}
                  </button>
                </form>
                <div className="auth-links">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setMode(mode === "signin" ? "signup" : "signin")
                    }
                  >
                    {mode === "signin"
                      ? "New here? Create an account"
                      : "Return to sign in"}
                  </button>
                  {mode === "signin" && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setMode("reset")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              </>
            )}
            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
          </div>
        </div>
      </section>
      <footer className="landing-footer landing-shell">
        <BrandWordmark />
        <span>Build time. Limit time. See the full picture.</span>
      </footer>
    </main>
  );
}
