/**
 * One-off / ops helpers to audit redundancy among stored timestamp fields on
 * `completedVesselTrips`.
 */

import type { Doc } from "_generated/dataModel";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";

const startGroup = [
  "TripStart",
  "TripStart",
  "TripStart",
  "TripStart",
] as const;

const endGroup = ["TripEnd", "TripEnd", "TripEnd", "TripEnd"] as const;

type StartField = (typeof startGroup)[number];
type EndField = (typeof endGroup)[number];

/**
 * Reads one timestamp field from a completed trip row by name.
 *
 * Thin indirection so audit loops can treat start/end group names uniformly.
 *
 * @param row - Stored completed trip document
 * @param name - One of the audited parallel timestamp columns
 * @returns Epoch ms or `undefined` when unset
 */
const readField = (
  row: Doc<"completedVesselTrips">,
  name: StartField | EndField
): number | undefined => row[name];

/**
 * Returns whether every element is strictly equal to the first (`===`).
 *
 * Treats `undefined` like any other value; used to compare parallel timestamp
 * columns that should be redundant copies.
 *
 * @param values - Numeric or undefined field values from one trip row
 * @returns `true` when the slice is empty or all entries match the first
 */
const allLiterallyEqual = (
  values: readonly (number | undefined)[]
): boolean => {
  if (values.length === 0) {
    return true;
  }
  const first = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== first) {
      return false;
    }
  }
  return true;
};

/**
 * Collects named timestamp fields from one row into a string-keyed map.
 *
 * Maps stored `undefined` to JSON-friendly `null` in the audit payload.
 *
 * @param row - Completed trip document
 * @param names - Field names in one redundancy group
 * @returns Map of field name to epoch ms or `null`
 */
const pick = (
  row: Doc<"completedVesselTrips">,
  names: readonly (StartField | EndField)[]
): Record<string, number | null> => {
  const out: Record<string, number | null> = {};
  for (const n of names) {
    const val = readField(row, n);
    out[n] = val === undefined ? null : val;
  }
  return out;
};

type MismatchRow = {
  _id: string;
  TripKey: string;
  VesselAbbrev: string;
  /** Always includes every field in the group; `null` means stored `undefined`. */
  values: Record<string, number | null>;
};

/**
 * Audits redundant start/end timestamp columns on `completedVesselTrips`.
 *
 * For each row, checks whether parallel “start” and “end” field groups are
 * literally equal; collects mismatch samples up to `maxMismatchSamples`.
 *
 * @param ctx - Convex internal query context
 * @param args.maxMismatchSamples - Cap on mismatch examples per group (default 100)
 * @returns Summary counts and sample rows for each group
 */
export const auditCompletedVesselTripsTimeColumns = internalQuery({
  args: {
    maxMismatchSamples: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxSamples = args.maxMismatchSamples ?? 100;
    const rows = await ctx.db.query("completedVesselTrips").collect();

    let startGroupEqualRows = 0;
    let endGroupEqualRows = 0;
    const startMismatches: MismatchRow[] = [];
    const endMismatches: MismatchRow[] = [];

    for (const row of rows) {
      const startVals = startGroup.map((n) => readField(row, n));
      const endVals = endGroup.map((n) => readField(row, n));

      if (allLiterallyEqual(startVals)) {
        startGroupEqualRows++;
      } else if (startMismatches.length < maxSamples) {
        startMismatches.push({
          _id: row._id,
          TripKey: row.TripKey,
          VesselAbbrev: row.VesselAbbrev,
          values: pick(row, startGroup),
        });
      }

      if (allLiterallyEqual(endVals)) {
        endGroupEqualRows++;
      } else if (endMismatches.length < maxSamples) {
        endMismatches.push({
          _id: row._id,
          TripKey: row.TripKey,
          VesselAbbrev: row.VesselAbbrev,
          values: pick(row, endGroup),
        });
      }
    }

    return {
      table: "completedVesselTrips" as const,
      totalRows: rows.length,
      schemaNote: "Stored field is TripEnd (not ArrivedDest).",
      startGroup: {
        fields: [...startGroup],
        rowsWhereAllFieldsLiterallyEqual: startGroupEqualRows,
        rowCountWhereMismatch: rows.length - startGroupEqualRows,
        mismatchSamples: startMismatches,
        allEqualAcrossTable: startGroupEqualRows === rows.length,
      },
      endGroup: {
        fields: [...endGroup],
        rowsWhereAllFieldsLiterallyEqual: endGroupEqualRows,
        rowCountWhereMismatch: rows.length - endGroupEqualRows,
        mismatchSamples: endMismatches,
        allEqualAcrossTable: endGroupEqualRows === rows.length,
      },
    };
  },
});
