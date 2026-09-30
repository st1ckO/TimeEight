import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX_LENGTH, normalizeDisplayName } from "./profile";

describe("normalizeDisplayName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeDisplayName("  Ada Lovelace  ")).toBe("Ada Lovelace");
  });

  it("rejects non-text provider metadata", () => {
    expect(normalizeDisplayName({ fullName: "Not a string" })).toBe("");
  });

  it("limits provider and cached names to the display-name maximum", () => {
    expect(normalizeDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH + 5))).toBe(
      "a".repeat(DISPLAY_NAME_MAX_LENGTH),
    );
  });
});
