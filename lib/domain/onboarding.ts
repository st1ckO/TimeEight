import type { Profile } from "./types";

export function shouldSeedExampleTasks(
  profile: Pick<Profile, "onboardingCompleted">,
  taskCount: number,
) {
  return !profile.onboardingCompleted && taskCount === 0;
}
