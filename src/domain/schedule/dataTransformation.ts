/**
 * WSF schedule → scheduled trip transformation.
 *
 * Ported from `convex/functions/scheduledTrips/sync/dataTransformation.ts`,
 * adjusted for client-side use and ms-based trip representation.
 */

import type { TerminalCombo } from "ws-dottie/wsf-schedule";
import { terminalLocations } from "@/data/terminalLocations";
import { getVesselAbbreviation } from "@/domain/vesselAbbreviations";
import { generateTripKey } from "./tripKeys";
import type { ScheduledTripMs } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export type VesselSailing = TerminalCombo["Times"][number];

export type RouteInfo = {
  routeId: number;
  routeAbbrev: string;
};

// ============================================================================
// MAIN EXPORTS
// ============================================================================

/**
 * Create a scheduled trip record from WSF schedule data (ms timestamps).
 *
 * @param sailing - Raw vessel sailing data from WSF schedule endpoint
 * @param terminalCombo - Terminal combination with route details
 * @param route - Route info (id + abbrev)
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns ScheduledTripMs ready for classification, or null if invalid
 */
export const createScheduledTripMs = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo,
  route: RouteInfo,
  tripDate: string
): ScheduledTripMs | null => {
  const annotations = extractAnnotations(sailing, terminalCombo);

  const abbreviations = resolveTripAbbreviations(
    sailing.VesselName,
    terminalCombo.DepartingTerminalName,
    terminalCombo.ArrivingTerminalName
  );

  if (!abbreviations) return null;

  const { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev } =
    abbreviations;

  const key = generateTripKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    sailing.DepartingTime
  );

  if (!key) {
    throw new Error(
      `Failed to generate key for scheduled trip: ${vesselAbbrev}-${departingTerminalAbbrev}-${arrivingTerminalAbbrev}`
    );
  }

  return {
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: sailing.DepartingTime.getTime(),
    ArrivingTime: sailing.ArrivingTime ? sailing.ArrivingTime.getTime() : undefined,
    SailingNotes: terminalCombo.SailingNotes,
    Annotations: annotations,
    RouteID: route.routeId,
    RouteAbbrev: route.routeAbbrev,
    Key: key,
    SailingDay: tripDate,
    // TripType will be set correctly by classifyTripsByType() during processing
    TripType: "direct",
  };
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Extract annotations from terminal combo using the sailing's annotation indexes.
 *
 * @param sailing - Vessel sailing containing annotation indexes
 * @param terminalCombo - Terminal combination containing annotations
 * @returns Array of annotation strings
 */
const extractAnnotations = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo
): string[] => {
  if (!sailing.AnnotationIndexes) return [];

  return sailing.AnnotationIndexes.filter(
    (index) => index < terminalCombo.Annotations.length
  ).map((index) => terminalCombo.Annotations[index]);
};

/**
 * Get terminal abbreviation by terminal name.
 *
 * @param terminalName - Full terminal name
 * @returns Abbreviation or empty string if not found
 */
const getTerminalAbbreviation = (terminalName: string): string =>
  Object.values(terminalLocations).find((t) => t.TerminalName === terminalName)
    ?.TerminalAbbrev || "";

/**
 * Resolve all required abbreviations for a trip, rejecting if any are missing.
 *
 * @param vesselName - Full vessel name
 * @param departingTerminal - Full departing terminal name
 * @param arrivingTerminal - Full arriving terminal name
 * @returns Abbrev object or null if any abbreviation is missing
 */
const resolveTripAbbreviations = (
  vesselName: string,
  departingTerminal: string,
  arrivingTerminal: string
): {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
} | null => {
  const vesselAbbrev = getVesselAbbreviation(vesselName);
  const departingTerminalAbbrev = getTerminalAbbreviation(departingTerminal);
  const arrivingTerminalAbbrev = getTerminalAbbreviation(arrivingTerminal);

  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    console.warn("Skipping trip due to missing abbreviations:", {
      vessel: vesselName,
      departing: departingTerminal,
      arriving: arrivingTerminal,
    });
    return null;
  }

  return { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev };
};

