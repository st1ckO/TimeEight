export const dailyPhrases = [
  "You’re building a day you can see.",
  "Your time is taking shape.",
  "Eight hours, at your own pace.",
  "Make room for what matters to you.",
  "Every moment adds to the picture.",
  "Let your day take shape.",
  "Your time, at your pace.",
  "A clearer picture of your time.",
  "Watch your day come together.",
  "Small moments make a day.",
  "Notice where your time goes.",
  "See how your day adds up.",
  "Your day, one moment at a time.",
] as const;

// Treat the already-resolved local date as a calendar-day number, not a timestamp.
export function phraseForDate(localDate: string): string {
  const day = Math.floor(Date.parse(localDate + "T00:00:00Z") / 86_400_000);
  const cycle = Math.floor(day / dailyPhrases.length);
  const position =
    ((day % dailyPhrases.length) + dailyPhrases.length) % dailyPhrases.length;
  let seed = cycle >>> 0;
  const order = Array.from(
    { length: dailyPhrases.length - 1 },
    (_, index) => index,
  );
  for (let index = order.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const other = seed % (index + 1);
    [order[index], order[other]] = [order[other]!, order[index]!];
  }
  // A fixed final phrase cannot repeat at the next cycle's shuffled beginning.
  order.push(dailyPhrases.length - 1);
  return dailyPhrases[order[position] ?? 0] ?? dailyPhrases[0];
}
