/**
 * Generate committed identity fallback assets from the current Convex snapshot
 * queries.
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";
const outputDir = resolve(process.cwd(), "assets/data");

/**
 * Generate all three committed identity fallback assets.
 */
const main = async () => {
  const convex = new ConvexHttpClient(convexUrl);
  const [vessels, terminals, terminalsTopology] = await Promise.all([
    convex.query(api.functions.vesselLocation.queries.getFrontendVesselsSnapshot),
    convex.query(api.functions.terminals.queries.getFrontendTerminalsSnapshot),
    convex.query(
      api.functions.terminalsTopology.queries
        .getFrontendTerminalsTopologySnapshot
    ),
  ]);

  if (!vessels || !terminals || !terminalsTopology) {
    throw new Error(
      "One or more identity snapshots are missing. Refresh Convex identity " +
        "data before generating assets."
    );
  }

  await Promise.all([
    writeJsonAsset(resolve(outputDir, "vessels.json"), vessels),
    writeJsonAsset(resolve(outputDir, "terminals.json"), terminals),
    writeJsonAsset(
      resolve(outputDir, "terminalsTopology.json"),
      terminalsTopology
    ),
  ]);

  console.log("Identity assets written to assets/data.");
};

/**
 * Write one JSON asset with stable pretty formatting.
 *
 * @param filePath - Absolute asset file path
 * @param value - JSON-serializable payload
 */
const writeJsonAsset = async (filePath: string, value: unknown) => {
  await mkdir(dirname(filePath), { recursive: true });
  await Bun.write(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

await main();
