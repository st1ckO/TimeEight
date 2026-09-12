"use client";

import { Download, LogOut, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import type { ThemePreference } from "@/lib/domain/types";
import { clearLocalUser } from "@/lib/offline/db";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/browser";

const zones = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

export function SettingsPage() {
  const app = useTimeEight();
  const router = useRouter();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemePreference | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = nameOverride ?? app.profile.displayName;
  const timezone = timezoneOverride ?? app.profile.timezone;
  const theme = themeOverride ?? app.profile.theme;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    await app.updateProfile({ displayName: name, timezone, theme });
    document.documentElement.dataset.theme = theme === "system" ? "" : theme;
    setMessage("Settings saved for today and future tracking.");
  }

  function exportData() {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: app.profile,
      dailyGoals: app.dailyGoals,
      tasks: app.tasks,
      taskDailyTargets: app.taskDailyTargets,
      entries: app.entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `timeeight-export-${app.today}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    await app.pauseAll();
    await clearLocalUser(app.userId);
    if (isSupabaseConfigured()) await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (app.userId === "local-demo") {
      await app.clearUserData();
      return;
    }
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "x-timeeight-confirm": "delete" },
    });
    if (!response.ok)
      return setMessage(
        "Account deletion could not be completed. Please try again.",
      );
    await clearLocalUser(app.userId);
    router.push("/login?deleted=1");
    router.refresh();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences and privacy</p>
          <h1>Settings</h1>
          <p>
            Make TimeEight feel like yours and keep your data under your
            control.
          </p>
        </div>
      </header>
      <div className="settings-grid">
        <form className="settings-card settings-form" onSubmit={save}>
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Your day</h2>
          </div>
          <label>
            Display name
            <input
              value={name}
              onChange={(event) => setNameOverride(event.target.value)}
              maxLength={80}
            />
          </label>
          <label>
            Timezone
            <select
              value={timezone}
              onChange={(event) => setTimezoneOverride(event.target.value)}
            >
              {[...new Set([timezone, ...zones])].map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
            <small>Changes apply only to future tracking.</small>
          </label>
          <fieldset>
            <legend>Theme</legend>
            <div className="segmented three">
              {(["system", "light", "dark"] as ThemePreference[]).map(
                (option) => (
                  <button
                    type="button"
                    key={option}
                    className={theme === option ? "selected" : ""}
                    onClick={() => setThemeOverride(option)}
                  >
                    {option}
                  </button>
                ),
              )}
            </div>
          </fieldset>
          <button className="primary-button">
            <Save size={18} />
            Save settings
          </button>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </form>
        <aside className="settings-card data-card">
          <div>
            <p className="eyebrow">Your data</p>
            <h2>Portable and private</h2>
            <p>
              Download a readable JSON copy of your settings, tasks, and time
              history.
            </p>
          </div>
          <button className="secondary-button" onClick={exportData}>
            <Download size={18} />
            Export JSON
          </button>
          <button className="secondary-button" onClick={() => void signOut()}>
            <LogOut size={18} />
            Sign out
          </button>
          <hr />
          <div>
            <h3>Delete account</h3>
            <p>
              This permanently removes the account and its synchronized records.
            </p>
          </div>
          {!confirmDelete ? (
            <button
              className="danger-button"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} />
              Delete account
            </button>
          ) : (
            <div className="delete-confirm" role="alert">
              <strong>This cannot be undone.</strong>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className="danger-button"
                  onClick={() => void deleteAccount()}
                >
                  Delete forever
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
