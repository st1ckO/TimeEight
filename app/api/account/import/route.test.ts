import { beforeEach, expect, it, vi } from "vitest";
const { getUser, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
import { POST } from "./route";
const owner = "11111111-1111-4111-8111-111111111111";
const backup = {
  schemaVersion: 1,
  exportedAt: "2026-09-13T12:00:00Z",
  profile: {
    id: "foreign-owner",
    displayName: "Restore",
    timezone: "UTC",
    theme: "system",
    onboardingCompleted: true,
  },
  tasks: [],
  dailyGoals: [],
  entries: [],
};
function request(body: unknown = backup, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/account/import", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "x-timeeight-confirm": "CONFIRM",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: owner, created_at: "2026-09-13T00:00:00Z" } },
  });
  rpc.mockResolvedValue({ error: null });
});
it("requires matching origin and typed confirmation", async () => {
  expect(
    (await POST(request(backup, { origin: "http://elsewhere.test" }))).status,
  ).toBe(403);
  expect(
    (await POST(request(backup, { "x-timeeight-confirm": "confirm" }))).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it("requires an authenticated account", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await POST(request())).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects invalid backups before calling the replacement transaction", async () => {
  expect((await POST(request({ ...backup, schemaVersion: 99 }))).status).toBe(
    400,
  );
  expect(rpc).not.toHaveBeenCalled();
});
it("uses current account ownership and a single restore RPC", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.profile.id).toBe(owner);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0]![0]).toBe("restore_account_backup");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("reports transaction failures without claiming completion", async () => {
  rpc.mockResolvedValue({ error: { message: "failed" } });
  expect((await POST(request())).status).toBe(500);
});
it("limits the actual streamed request size", async () => {
  const response = await POST(
    request({ padding: "x".repeat(5 * 1024 * 1024) }),
  );
  expect(response.status).toBe(413);
  expect(rpc).not.toHaveBeenCalled();
});
