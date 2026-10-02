import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, isSupabaseConfigured } = vi.hoisted(() => ({
  getUser: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured }));

import SettingsRoute from "./page";

describe("SettingsRoute", () => {
  beforeEach(() => {
    getUser.mockReset();
    isSupabaseConfigured.mockReset();
  });

  it("passes the authenticated account email to Settings", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue({
      data: { user: { email: "person@example.com" } },
    });

    const page = await SettingsRoute();

    expect(page.props.accountEmail).toBe("person@example.com");
  });

  it("omits an account email in local demo mode", async () => {
    isSupabaseConfigured.mockReturnValue(false);

    const page = await SettingsRoute();

    expect(page.props.accountEmail).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
