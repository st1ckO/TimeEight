import type { SyncState } from "./app-provider";

const labels: Record<SyncState, string> = {
  local: "Local demo",
  synced: "Synced",
  pending: "Syncing",
  offline: "Offline",
  error: "Sync error",
};

export function SyncStatus({
  state,
  error,
}: {
  state: SyncState;
  error: string | null;
}) {
  const detail = state === "error" ? error : null;

  return (
    <div
      className={`app-status ${detail ? "has-detail" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={`sync-dot ${state}`} aria-hidden="true" />
      <span className="app-status-copy">
        <span>{labels[state]}</span>
        {detail && (
          <span className="sync-error-detail" title={detail}>
            {detail}
          </span>
        )}
      </span>
    </div>
  );
}
