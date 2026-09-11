"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    if (password.length < 12) return setMessage("Use at least 12 characters.");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) return setMessage(error.message);
    router.push("/today");
  }

  return (
    <main className="auth-panel reset-page">
      <section className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        <form className="auth-form" onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <button className="primary-button auth-submit">
            Update password
          </button>
          {message && (
            <p className="form-message" role="alert">
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
