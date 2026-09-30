"use client";

import { ArrowRight, Check, Clock3, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTimeEight } from "@/components/app/app-provider";
import { profileSchema } from "@/lib/domain/schemas";

const suggestedZones = [
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

function subscribeToBrowserTimezone() {
  return () => undefined;
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function OnboardingForm() {
  const app = useTimeEight();
  const router = useRouter();
  const detected = useSyncExternalStore(
    subscribeToBrowserTimezone,
    browserTimezone,
    () => app.profile.timezone,
  );
  const [displayName, setDisplayName] = useState(app.profile.displayName);
  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null);
  const timezone =
    selectedTimezone ??
    (suggestedZones.includes(detected) ? detected : app.profile.timezone);
  const [keepExamples, setKeepExamples] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const profile = profileSchema.safeParse({
      displayName,
      timezone,
      theme: app.profile.theme,
    });
    if (!profile.success) {
      setMessage("Check your name and timezone.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      await app.completeOnboarding(profile.data, keepExamples);
      router.replace("/today");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Couldn't finish setup. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <section className="onboarding-card">
      <div className="onboarding-intro">
        <p className="eyebrow">Your day, your timezone</p>
        <h1>Make TimeEight feel like yours.</h1>
        <p>
          Your timezone decides where midnight falls. The daily ring has a fixed
          eight-hour goal; your streak still starts at three hours.
        </p>
      </div>
      <form className="onboarding-form" onSubmit={submit}>
        <label>
          <span>
            <Check size={18} />
            What should we call you?
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            placeholder="Your name"
          />
        </label>
        <label>
          <span>
            <MapPin size={18} />
            Your timezone
          </span>
          <select
            value={timezone}
            onChange={(event) => setSelectedTimezone(event.target.value)}
          >
            {[...new Set([timezone, detected, ...suggestedZones])].map(
              (zone) => (
                <option key={zone}>{zone}</option>
              ),
            )}
          </select>
          <small>
            Detected as {detected}. Future tracking uses this timezone.
          </small>
        </label>
        <div>
          <p>
            Daily ring goal: <strong>8 hours</strong>
          </p>
          <small>
            Track time at your own pace. Unedited timer or recovered time
            qualifies for the streak at three hours.
          </small>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={keepExamples}
            onChange={(event) => setKeepExamples(event.target.checked)}
          />
          <span>
            <Clock3 size={18} />
            Keep three editable example timers
          </span>
        </label>
        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
        <button
          className="primary-button onboarding-submit"
          disabled={pending || !app.hydrated}
        >
          {!app.hydrated ? "Loading…" : pending ? "Saving…" : "Open my day"}
          <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}
