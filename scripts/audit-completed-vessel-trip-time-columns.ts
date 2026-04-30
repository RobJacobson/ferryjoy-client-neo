/**
 * Runs a full-table audit on `completedVesselTrips`: for each row, checks that
 * the “start” and “end” timestamp field groups are literally equal within the
 * group (same value per field, including `undefined`).
 *
 * Uses `internalQuery` in Convex (server-side scan). No local download needed.
 *
 * Usage:
 *   bun scripts/audit-completed-vessel-trip-time-columns.ts
 *   bun scripts/audit-completed-vessel-trip-time-columns.ts --prod
 *   bun scripts/audit-completed-vessel-trip-time-columns.ts -- --maxSamples 200
 *
 * The schema stores `TripEnd` (not `ArrivedDest`).
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const args = process.argv.slice(2);
const useProd = args.includes("--prod");
const jsonPathIdx = args.indexOf("--out");
const outPath =
  jsonPathIdx >= 0 && args[jsonPathIdx + 1]
    ? path.resolve(args[jsonPathIdx + 1] as string)
    : null;

const maxIdx = args.indexOf("--maxSamples");
const maxSamples =
  maxIdx >= 0 && args[maxIdx + 1] ? Number(args[maxIdx + 1]) : undefined;

const extra: Record<string, unknown> = {};
if (maxSamples !== undefined && !Number.isNaN(maxSamples)) {
  extra.maxMismatchSamples = maxSamples;
}

const payload = JSON.stringify(extra);
const cmd = "bunx";
const argv = [
  "convex",
  "run",
  ...(useProd ? ["--prod"] : []),
  "functions/vesselTrips/columnAudit:auditCompletedVesselTripsTimeColumns",
  payload,
];

const json = execFileSync(cmd, argv, {
  cwd: root,
  encoding: "utf-8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (outPath) {
  fs.writeFileSync(outPath, json, "utf-8");
  process.stdout.write(`Wrote ${outPath}\n`);
}

process.stdout.write(json);
if (!json.endsWith("\n")) {
  process.stdout.write("\n");
}
