"use client";

import { Check, Download, LogOut, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { ConfirmTaskAction } from "@/components/tasks/confirm-task-action";
import { ImportBackupDialog } from "@/components/settings/import-backup-dialog";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { TimezonePicker } from "@/components/settings/timezone-picker";
import { useTimeEight } from "@/components/app/app-provider";
import type { ThemePreference } from "@/lib/domain/types";
import { clearLocalUser } from "@/lib/offline/db";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/browser";

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const zones = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "UTC",
];
const timezoneRegions = [
  "Asia",
  "Europe",
  "Americas",
  "Africa",
  "Australia & Pacific",
  "UTC",
  "Other",
];

export function SettingsPage() {
  const app = useTimeEight();
  const timezoneLabelId = useId();
  const deviceTimezone =
    app.now > 0 ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const offsetMinute = Math.floor(app.now / 60_000);
  const timezoneOptions = useMemo(() => {
    const now = new Date(offsetMinute * 60_000);
    const available =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : zones;
    return [
      ...new Set([
        app.profile.timezone,
        ...available,
        "UTC",
        ...(deviceTimezone ? [deviceTimezone] : []),
      ]),
    ]
      .sort()
      .map((value) => {
        const offset =
          new Intl.DateTimeFormat("en", {
            timeZone: value,
            timeZoneName: "longOffset",
          })
            .formatToParts(now)
            .find((part) => part.type === "timeZoneName")
            ?.value.replace("GMT", "UTC") ?? "UTC";
        return {
          value,
          region: value.startsWith("America/")
            ? "Americas"
            : /^(Australia|Pacific)\//.test(value)
              ? "Australia & Pacific"
              : timezoneRegions.includes(value.split("/")[0] ?? "Other")
                ? (value.split("/")[0] ?? "Other")
                : "Other",
          label: `${value.replaceAll("_", " ")} (${offset === "UTC" ? "UTC+00:00" : offset})`,
        };
      });
  }, [app.profile.timezone, offsetMinute, deviceTimezone]);
  const router = useRouter();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const signOutButton = useRef<HTMLButtonElement>(null);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemePreference | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const name = nameOverride ?? app.profile.displayName;
  const timezone = timezoneOverride ?? app.profile.timezone;
  const theme = themeOverride ?? app.profile.theme;
  const hasChanges =
    name !== app.profile.displayName ||
    timezone !== app.profile.timezone ||
    theme !== app.profile.theme;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!hasChanges || saving) return;
    setSaving(true);
    setMessage(null);
    setSaved(false);
    try {
      await app.updateProfile({ displayName: name, timezone, theme });
      document.documentElement.dataset.theme = theme === "system" ? "" : theme;
      setNameOverride(null);
      setTimezoneOverride(null);
      setThemeOverride(null);
      setSaved(true);
    } catch {
      setMessage("Couldn't save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function exportData() {
    const payload = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      profile: app.profile,
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
    if (!response.ok) throw new Error("Account deletion failed");
    await clearLocalUser(app.userId);
    router.push("/login?deleted=1");
    router.refresh();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p>
            Make TimeEight feel like yours and keep your data under your
            control.
          </p>
        </div>
      </header>
      <div className="settings-grid">
        <form className="settings-card settings-form" onSubmit={save}>
          <label>
            Display name
            <input
              value={name}
              disabled={saving}
              onChange={(event) => {
                setNameOverride(event.target.value);
                setMessage(null);
                setSaved(false);
              }}
              maxLength={80}
            />
          </label>
          <div className="entry-task-field">
            <span id={timezoneLabelId}>Timezone</span>
            <TimezonePicker
              value={timezone}
              options={timezoneOptions}
              commonZones={[...zones, deviceTimezone]}
              labelId={timezoneLabelId}
              disabled={saving}
              onChange={(value) => {
                setTimezoneOverride(value);
                setMessage(null);
                setSaved(false);
              }}
            />
            <button
              type="button"
              className="timezone-device"
              disabled={
                saving || !deviceTimezone || timezone === deviceTimezone
              }
              onClick={() => {
                setTimezoneOverride(deviceTimezone);
                setMessage(null);
                setSaved(false);
              }}
              title={deviceTimezone}
            >
              Use device timezone
            </button>
            {deviceTimezone && (
              <small>Detected: {deviceTimezone.replaceAll("_", " ")}</small>
            )}
            <small id="timezone-help">
              Changes apply only to future tracking. Offsets shown are current
              and may change with daylight saving time.
            </small>
          </div>
          <fieldset className="settings-theme-field" disabled={saving}>
            <legend>Theme</legend>
            <div className="settings-theme-options">
              {themes.map(({ value, label }) => (
                <label
                  className="settings-theme-choice"
                  data-preview={value}
                  key={value}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => {
                      setThemeOverride(value);
                      setMessage(null);
                      setSaved(false);
                    }}
                  />
                  <span className="theme-preview" aria-hidden="true">
                    <span className="theme-preview-window">
                      <span className="theme-preview-sidebar" />
                      <span className="theme-preview-content">
                        <span className="theme-preview-heading" />
                        <span className="theme-preview-card" />
                        <span className="theme-preview-line" />
                      </span>
                    </span>
                  </span>
                  <span className="theme-choice-caption">
                    <span className="theme-choice-dot" aria-hidden="true" />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            className="primary-button settings-save"
            disabled={!hasChanges || saving}
          >
            {saved ? (
              <Check size={16} aria-hidden />
            ) : (
              <Save size={16} aria-hidden />
            )}
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
          <span className="settings-save-announcement" role="status">
            {saved ? "Changes saved." : ""}
          </span>
          {message && (
            <p className="form-message" role="alert">
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
          <button
            className="secondary-button"
            disabled={!app.hydrated}
            onClick={exportData}
          >
            <Download size={18} />
            Export JSON
          </button>
          <ImportBackupDialog
            disabled={!app.hydrated}
            onRestore={async (backup) => {
              await app.restoreBackup(backup);
              setNameOverride(null);
              setTimezoneOverride(null);
              setThemeOverride(null);
              setSaved(false);
              setMessage(null);
            }}
          />
          <button
            ref={signOutButton}
            className="secondary-button"
            onClick={() => setConfirmSignOut(true)}
          >
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
          <DeleteAccountDialog onDelete={deleteAccount} />
        </aside>
      </div>
      <ConfirmTaskAction
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        compact
        title="Sign out?"
        description={
          app.userId === "local-demo"
            ? "Running timers will pause. This clears your demo tasks, settings, and history from this device. You can reopen the local demo, but your changes will be lost."
            : "Running timers will pause and local data will be cleared from this device. Synced data stays in your account; unsynced changes may be lost. You can sign in again."
        }
        confirmLabel="Sign out"
        pendingLabel="Signing out…"
        errorMessage="Couldn't sign out. Please try again."
        returnFocusRef={signOutButton}
        onConfirm={signOut}
      />
    </>
  );
}
