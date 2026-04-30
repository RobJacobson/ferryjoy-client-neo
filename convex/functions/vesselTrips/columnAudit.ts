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

const readField = (
  row: Doc<"completedVesselTrips">,
  name: StartField | EndField
): number | undefined => row[name];

/** True iff every value is `===` to the first (literal equality). */
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
 * Scans all `completedVesselTrips` and checks whether the “start” and “end”
 * timestamp field groups are each constant per row (literal `===` equality to
 * the first field in the group).
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
