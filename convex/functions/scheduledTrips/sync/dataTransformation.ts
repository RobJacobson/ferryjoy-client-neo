import type { Route, TerminalCombo } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";
import { getTerminalAbbreviation, getVesselAbbreviation } from "../schemas";
import type { VesselSailing } from "./types";

/**
 * Extracts annotations from terminal combo using the sailing's annotation indexes.
 *
 * @param sailing - Vessel sailing data containing annotation indexes
 * @param terminalCombo - Terminal combination data containing annotations
 * @returns Array of annotation strings
 */
export const extractAnnotations = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo
): string[] => {
  if (!sailing.AnnotationIndexes) return [];

  return sailing.AnnotationIndexes.filter(
    (index) => index < terminalCombo.Annotations.length
  ).map((index) => terminalCombo.Annotations[index]);
};

/**
 * Resolves all required abbreviations for a trip, rejecting if any are missing.
 *
 * @param vesselName - Full vessel name
 * @param departingTerminal - Full departing terminal name
 * @param arrivingTerminal - Full arriving terminal name
 * @returns Object with resolved abbreviations or null if any abbreviation is missing
 */
export const resolveTripAbbreviations = (
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
    console.warn(`Skipping trip due to missing abbreviations:`, {
      vessel: vesselName,
      departing: departingTerminal,
      arriving: arrivingTerminal,
    });
    return null;
  }

  return { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev };
};

/**
 * Creates a complete scheduled trip record directly from WSF API data.
 * Generates the composite key and resolves all abbreviations in one step.
 *
 * @param sailing - Raw vessel sailing data from WSF API
 * @param terminalCombo - Terminal combination with route details
 * @param route - Route information from WSF API
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns Complete scheduled trip record ready for Convex storage, or null if invalid
 */
export const createScheduledTrip = (
  sailing: VesselSailing,
  terminalCombo: TerminalCombo,
  route: Route,
  tripDate: string
): ConvexScheduledTrip | null => {
  const annotations = extractAnnotations(sailing, terminalCombo);

  const abbreviations = resolveTripAbbreviations(
    sailing.VesselName,
    terminalCombo.DepartingTerminalName,
    terminalCombo.ArrivingTerminalName
  );

  if (!abbreviations) return null;

  const { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev } =
    abbreviations;

  // Generate the composite key that uniquely identifies this trip
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

  const trip: ConvexScheduledTrip = {
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: sailing.DepartingTime.getTime(),
    ArrivingTime: sailing.ArrivingTime
      ? sailing.ArrivingTime.getTime()
      : undefined,
    SailingNotes: terminalCombo.SailingNotes,
    Annotations: annotations,
    RouteID: route.RouteID,
    RouteAbbrev: route.RouteAbbrev || "",
    Key: key,
    SailingDay: tripDate,
  };

  return trip;
};

// Import shared key generation function
import { generateTripKey } from "shared";
