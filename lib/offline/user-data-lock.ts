const tails = new Map<string, Promise<void>>();
export async function withUserDataLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(userId) ?? Promise.resolve();
  const result = previous.then(operation);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  tails.set(userId, settled);
  try {
    return await result;
  } finally {
    if (tails.get(userId) === settled) tails.delete(userId);
  }
}
