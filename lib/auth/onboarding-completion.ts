export const ONBOARDING_SAVE_TIMEOUT_MS = 20_000;

export class OnboardingSaveTimeoutError extends Error {
  constructor() {
    super("Saving is taking longer than expected.");
    this.name = "OnboardingSaveTimeoutError";
  }
}

export async function waitForOnboardingSave<T>(
  operation: Promise<T>,
  timeoutMs = ONBOARDING_SAVE_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new OnboardingSaveTimeoutError()),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
