import { expect, it } from "vitest";
import { withUserDataLock } from "./user-data-lock";
it("waits for account writes and continues after a failed operation", async () => {
  const order: string[] = [];
  let release: () => void = () => {};
  const first = withUserDataLock("owner", async () => {
    order.push("sync");
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    throw new Error("sync failed");
  });
  const firstFailure = first.catch(() => undefined);
  const restore = withUserDataLock("owner", async () => {
    order.push("restore");
  });
  await Promise.resolve();
  expect(order).toEqual(["sync"]);
  release();
  await firstFailure;
  await restore;
  expect(order).toEqual(["sync", "restore"]);
});
