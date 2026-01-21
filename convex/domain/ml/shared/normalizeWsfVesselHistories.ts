// ============================================================================
// WSF VESSEL HISTORY NORMALIZATION
// Fill missing fields (Arriving / EstArrival) for ML + reporting
// ============================================================================

import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { config, formatTerminalPairKey } from "./config";
import type { TerminalAbbrev, TerminalPairKey } from "./types";

// ============================================================================
// Types
// ============================================================================

export type ArrivingSource = "wsf" | "inferred_from_next_departing";

export type EstArrivalSource = "wsf" | "projected_mean_at_sea";

export type NormalizedWsfTrip = {
  vesselRaw: string;
  departingName: string;
  arrivingName: string;

  departingAbbrev: TerminalAbbrev;
  arrivingAbbrev: TerminalAbbrev;
  pairKey: TerminalPairKey;

  scheduledDepartMs: number;
  actualDepartMs: number;
  estArrivalMs: number;

  arrivingSource: ArrivingSource;
  estArrivalSource: EstArrivalSource;
};

export type WsfNormalizationRejectReason =
  | "missing_required_fields"
  | "terminal_abbrev_unmapped"
  | "terminal_invalid"
  | "cannot_infer_arriving_no_next_trip"
  | "cannot_infer_arriving_next_missing_departing"
  | "cannot_infer_arriving_next_missing_actual_depart"
  | "cannot_infer_arriving_missing_actual_depart"
  | "cannot_project_est_arrival_missing_mean_at_sea"
  | "inference_guard_failed";

export type WsfNormalizationReject = {
  reason: WsfNormalizationRejectReason;
  details: Record<string, unknown>;
  record: VesselHistory;
};

export type NormalizeWsfVesselHistoriesOptions = {
  /**
   * If a record is missing `Vessel`, we can fall back to the vessel name we
   * queried for (scripts do this per-vessel). ML bulk loaders can leave it
   * undefined.
   */
  vesselNameFallback?: string;
};

export type NormalizeWsfVesselHistoriesResult = {
  trips: NormalizedWsfTrip[];
  rejects: WsfNormalizationReject[];
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Normalize WSF vessel history records for downstream ML + reporting.
 *
 * Key behaviors:
 * - Uses ML terminal mapping/validation from `config`
 * - If `Arriving` is missing, attempts to infer it from the next trip's
 *   `Departing`, guarded by duration plausibility checks
 * - If `Arriving` is inferred and `EstArrival` is missing, projects `EstArrival`
 *   via `meanAtSeaDuration` for the inferred pair.
 *
 * @param records - Raw WSF history records (mixed vessels allowed)
 * @param options - Normalization options
 * @returns Normalized trips + rejects (with raw records)
 */
export const normalizeWsfVesselHistories = (
  records: VesselHistory[],
  options: NormalizeWsfVesselHistoriesOptions = {}
): NormalizeWsfVesselHistoriesResult => {
  const groups = groupByVessel(records, options.vesselNameFallback);

  const trips: NormalizedWsfTrip[] = [];
  const rejects: WsfNormalizationReject[] = [];

  for (const vesselRecords of Object.values(groups)) {
    const sorted = vesselRecords
      .slice()
      .sort(
        (a, b) =>
          (a.ScheduledDepart?.getTime() ?? 0) -
          (b.ScheduledDepart?.getTime() ?? 0)
      );

    for (let i = 0; i < sorted.length; i += 1) {
      const record = sorted[i];
      const next = sorted[i + 1];

      const normalized = normalizeSingleRecord(record, next, options);
      if (normalized.kind === "ok") {
        trips.push(normalized.trip);
        continue;
      }

      rejects.push({
        reason: normalized.reason,
        details: normalized.details,
        record,
      });
    }
  }

  return { trips, rejects };
};

// ============================================================================
// Internal helpers
// ============================================================================

type NormalizeSingleResult =
  | {
      kind: "ok";
      trip: NormalizedWsfTrip;
    }
  | {
      kind: "rejected";
      reason: WsfNormalizationRejectReason;
      details: Record<string, unknown>;
    };

/**
 * Normalize one record, optionally using the next record for inference.
 *
 * @param record - Current record
 * @param next - Next record for same vessel (chronological)
 * @param options - Options
 * @returns Normalized trip or a reject
 */
const normalizeSingleRecord = (
  record: VesselHistory,
  next: VesselHistory | undefined,
  options: NormalizeWsfVesselHistoriesOptions
): NormalizeSingleResult => {
  const vesselRaw = String(record.Vessel ?? options.vesselNameFallback ?? "");
  const missing = [
    !vesselRaw ? "Vessel" : null,
    !record.Departing ? "Departing" : null,
    !record.ScheduledDepart ? "ScheduledDepart" : null,
    !record.ActualDepart ? "ActualDepart" : null,
  ].filter((v): v is string => v != null);

  if (missing.length > 0) {
    return {
      kind: "rejected",
      reason: "missing_required_fields",
      details: { missing },
    };
  }

  const departingName = record.Departing as string;
  const departingAbbrev = getTerminalAbbrev(departingName);
  if (!departingAbbrev) {
    return {
      kind: "rejected",
      reason: "terminal_abbrev_unmapped",
      details: { terminalName: departingName, which: "Departing" },
    };
  }
  if (!config.isValidTerminal(departingAbbrev)) {
    return {
      kind: "rejected",
      reason: "terminal_invalid",
      details: { terminalAbbrev: departingAbbrev, which: "Departing" },
    };
  }

  const scheduledDepartMs = (record.ScheduledDepart as Date).getTime();
  const actualDepartMs = (record.ActualDepart as Date).getTime();

  // If Arriving is present, we keep it (and still require terminal mapping).
  if (record.Arriving) {
    const arrivingName = record.Arriving;
    const arrivingAbbrev = getTerminalAbbrev(arrivingName);
    if (!arrivingAbbrev) {
      return {
        kind: "rejected",
        reason: "terminal_abbrev_unmapped",
        details: { terminalName: arrivingName, which: "Arriving" },
      };
    }
    if (!config.isValidTerminal(arrivingAbbrev)) {
      return {
        kind: "rejected",
        reason: "terminal_invalid",
        details: { terminalAbbrev: arrivingAbbrev, which: "Arriving" },
      };
    }

    // For ML, we need EstArrival (proxy arrival). If it's missing, we cannot
    // safely infer it without a next trip constraint, so reject here.
    if (!record.EstArrival) {
      return {
        kind: "rejected",
        reason: "missing_required_fields",
        details: { missing: ["EstArrival"] },
      };
    }

    const estArrivalMs = record.EstArrival.getTime();
    const pairKey = formatTerminalPairKey(
      departingAbbrev,
      arrivingAbbrev
    ) as TerminalPairKey;

    return {
      kind: "ok",
      trip: {
        vesselRaw,
        departingName,
        arrivingName,
        departingAbbrev,
        arrivingAbbrev,
        pairKey,
        scheduledDepartMs,
        actualDepartMs,
        estArrivalMs,
        arrivingSource: "wsf",
        estArrivalSource: "wsf",
      },
    };
  }

  // Arriving is missing: attempt inference from the next record.
  if (!next) {
    return {
      kind: "rejected",
      reason: "cannot_infer_arriving_no_next_trip",
      details: {},
    };
  }

  if (!next.Departing) {
    return {
      kind: "rejected",
      reason: "cannot_infer_arriving_next_missing_departing",
      details: { nextHasDeparting: false },
    };
  }

  const nextDepartingName = next.Departing;
  const nextDepartingAbbrev = getTerminalAbbrev(nextDepartingName);
  if (!nextDepartingAbbrev) {
    return {
      kind: "rejected",
      reason: "terminal_abbrev_unmapped",
      details: { terminalName: nextDepartingName, which: "NextDeparting" },
    };
  }
  if (!config.isValidTerminal(nextDepartingAbbrev)) {
    return {
      kind: "rejected",
      reason: "terminal_invalid",
      details: { terminalAbbrev: nextDepartingAbbrev, which: "NextDeparting" },
    };
  }

  const inferredArrivingName = nextDepartingName;
  const inferredArrivingAbbrev = nextDepartingAbbrev;
  const inferredPairKey = formatTerminalPairKey(
    departingAbbrev,
    inferredArrivingAbbrev
  ) as TerminalPairKey;

  if (!record.ActualDepart) {
    return {
      kind: "rejected",
      reason: "cannot_infer_arriving_missing_actual_depart",
      details: {},
    };
  }

  if (!next.ActualDepart) {
    return {
      kind: "rejected",
      reason: "cannot_infer_arriving_next_missing_actual_depart",
      details: {},
    };
  }

  const nextActualDepartMs = next.ActualDepart.getTime();

  const meanAtSeaMinutes = config.getMeanAtSeaDuration(inferredPairKey);

  // Determine arrival proxy (EstArrival). If missing, project it ONLY for this
  // inference case (per your selected behavior).
  const { estArrivalMs, estArrivalSource } = record.EstArrival
    ? { estArrivalMs: record.EstArrival.getTime(), estArrivalSource: "wsf" as const }
    : meanAtSeaMinutes > 0
      ? {
          estArrivalMs: actualDepartMs + meanAtSeaMinutes * 60_000,
          estArrivalSource: "projected_mean_at_sea" as const,
        }
      : {
          estArrivalMs: 0,
          estArrivalSource: "projected_mean_at_sea" as const,
        };

  if (!record.EstArrival && meanAtSeaMinutes <= 0) {
    return {
      kind: "rejected",
      reason: "cannot_project_est_arrival_missing_mean_at_sea",
      details: { inferredPairKey },
    };
  }

  // Duration guard (ML thresholds).
  const atSeaMinutes = minutesBetween(actualDepartMs, estArrivalMs);
  const atDockMinutes = minutesBetween(estArrivalMs, nextActualDepartMs);
  const arriveArriveTotalMinutes = atSeaMinutes + atDockMinutes;

  const guard = {
    atSeaMinutes,
    atDockMinutes,
    arriveArriveTotalMinutes,
    minAtSea: config.getMinAtSeaDuration(),
    maxAtSea: config.getMaxAtSeaDuration(),
    minAtDock: config.getMinAtDockDuration(),
    maxAtDock: config.getMaxAtDockDuration(),
    maxArriveArriveTotal: config.getMaxTotalDuration(),
  } as const;

  const passesGuard =
    atSeaMinutes >= guard.minAtSea &&
    atSeaMinutes <= guard.maxAtSea &&
    atDockMinutes >= guard.minAtDock &&
    atDockMinutes <= guard.maxAtDock &&
    arriveArriveTotalMinutes <= guard.maxArriveArriveTotal;

  if (!passesGuard) {
    return {
      kind: "rejected",
      reason: "inference_guard_failed",
      details: {
        inferredPairKey,
        estArrivalSource,
        meanAtSeaMinutes,
        actualDepartMs,
        estArrivalMs,
        nextActualDepartMs,
        guard,
      },
    };
  }

  return {
    kind: "ok",
    trip: {
      vesselRaw,
      departingName,
      arrivingName: inferredArrivingName,
      departingAbbrev,
      arrivingAbbrev: inferredArrivingAbbrev,
      pairKey: inferredPairKey,
      scheduledDepartMs,
      actualDepartMs,
      estArrivalMs,
      arrivingSource: "inferred_from_next_departing",
      estArrivalSource,
    },
  };
};

/**
 * Map terminal name -> abbreviation (ML mapping).
 *
 * @param terminalName - Terminal name from WSF data
 * @returns Terminal abbreviation or null if unmapped
 */
const getTerminalAbbrev = (terminalName: string): TerminalAbbrev | null => {
  const abbrev = config.getTerminalAbbrev(terminalName);
  if (!abbrev || abbrev === terminalName) {
    return null;
  }
  return abbrev;
};

/**
 * Group records by vessel identifier for per-vessel normalization.
 *
 * @param records - Raw WSF records
 * @param vesselNameFallback - Optional vessel name fallback
 * @returns Records grouped by vessel
 */
const groupByVessel = (
  records: VesselHistory[],
  vesselNameFallback?: string
): Record<string, VesselHistory[]> =>
  records.reduce(
    (groups, r) => {
      const key = String(r.Vessel ?? vesselNameFallback ?? "unknown");
      groups[key] ??= [];
      groups[key].push(r);
      return groups;
    },
    {} as Record<string, VesselHistory[]>
  );

/**
 * Calculate time difference in minutes.
 *
 * @param earlierMs - Earlier timestamp in milliseconds
 * @param laterMs - Later timestamp in milliseconds
 * @returns Time difference in minutes
 */
const minutesBetween = (earlierMs: number, laterMs: number): number =>
  (laterMs - earlierMs) / 60_000;

