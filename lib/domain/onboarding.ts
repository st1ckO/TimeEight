import type { Profile } from "./types";

export function shouldSeedExampleTasks(
  profile: Pick<Profile, "onboardingCompleted">,
  taskCount: number,
  isLocalDemo = false,
) {
  return taskCount === 0 && (isLocalDemo || !profile.onboardingCompleted);
}
