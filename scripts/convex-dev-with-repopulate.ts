/**
 * Optional: runs `convex dev` and, once the deployment accepts RPC calls,
 * invokes the backend-vessel refresh (same as `convex:repopulate-vessels`).
 */

import { spawn } from "node:child_process";

const REFRESH_RUN = [
  "bunx",
  "convex",
  "run",
  "functions/vessels/actions:runRefreshBackendVessels",
  "{}",
  "--typecheck=disable",
] as const;

const INITIAL_DELAY_MS = 2500;
const RETRY_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 45;

const convexArgs = ["dev", ...process.argv.slice(2)];

const child = spawn("bunx", ["convex", ...convexArgs], {
  stdio: "inherit",
  env: process.env,
});

let devAlive = true;

/**
 * Retries `convex run` until the dev deployment is ready or `convex dev`
 * exits.
 *
 * @returns When a successful refresh completes or retries are exhausted
 */
const runRefreshWhenReady = async (): Promise<void> => {
  await Bun.sleep(INITIAL_DELAY_MS);

  for (let attempt = 0; attempt < MAX_ATTEMPTS && devAlive; attempt++) {
    const proc = Bun.spawn([...REFRESH_RUN], {
      stdout: "ignore",
      stderr: "ignore",
      env: process.env,
    });
    const code = await proc.exited;

    if (code === 0) {
      console.log(
        "[convex:dev:with-repopulate] Backend vessels refreshed " +
          "(runRefreshBackendVessels)."
      );
      return;
    }

    await Bun.sleep(RETRY_INTERVAL_MS);
  }

  if (devAlive) {
    console.warn(
      "[convex:dev:with-repopulate] Timed out waiting to refresh. Run:\n" +
        "  bun run convex:repopulate-vessels"
    );
  }
};

void runRefreshWhenReady().catch((error: unknown) => {
  console.error(
    "[convex:dev:with-repopulate] runRefreshWhenReady failed:",
    error
  );
});

await new Promise<void>((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", () => {
    devAlive = false;
    resolve();
  });
});
