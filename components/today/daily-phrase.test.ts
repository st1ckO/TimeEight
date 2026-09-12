import { describe, expect, it } from "vitest";
import { dailyPhrases, phraseForDate } from "./daily-phrase";

describe("daily rhythm phrases", () => {
  it("keeps the same phrase for a local day across repeated selections", () => {
    const phrase = phraseForDate("2026-09-13");
    for (let i = 0; i < 10; i++)
      expect(phraseForDate("2026-09-13")).toBe(phrase);
    expect(dailyPhrases).toContain(phrase);
  });

  it("uses all approved phrases over time, including year rollover", () => {
    const selected = new Set<string>();
    let previous: string | undefined;
    for (let i = 0; i < 180; i++) {
      const date = new Date(Date.UTC(2026, 11, 1 + i))
        .toISOString()
        .slice(0, 10);
      const phrase = phraseForDate(date);
      expect(dailyPhrases).toContain(phrase);
      expect(phrase).not.toBe(previous);
      previous = phrase;
      selected.add(phrase);
    }
    expect(selected.size).toBe(13);
    expect(phraseForDate("2026-12-31")).not.toBe(phraseForDate("2027-01-01"));
  });
});
