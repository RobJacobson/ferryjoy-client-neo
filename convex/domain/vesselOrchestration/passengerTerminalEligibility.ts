/**
 * Passenger-terminal allow-list and trip-pipeline eligibility gates for orchestrator
 * ticks.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * Collect the passenger-terminal abbreviations that are eligible for trip
 * processing.
 *
 * Non-passenger marine locations can still be stored in `vesselLocations`,
 * but they are intentionally excluded from trip lifecycle derivation.
 *
 * @param terminals - Backend terminal snapshot
 * @returns Set of terminal abbreviations eligible for trip processing
 */
export const getPassengerTerminalAbbrevs = (
  terminals: ReadonlyArray<{
    TerminalAbbrev: string;
    IsPassengerTerminal?: boolean;
  }>
) =>
  new Set(
    terminals
      .filter((terminal) => terminal.IsPassengerTerminal !== false)
      .map((terminal) => terminal.TerminalAbbrev)
  );

/**
 * Test whether a terminal abbreviation participates in passenger trip logic.
 *
 * @param terminalAbbrev - Candidate terminal abbreviation
 * @param passengerTerminalAbbrevs - Allow-list derived from the terminals table
 * @returns True when the abbreviation is trip-eligible
 */
export const isPassengerTerminalAbbrev = (
  terminalAbbrev: string | undefined,
  passengerTerminalAbbrevs: ReadonlySet<string>
) =>
  terminalAbbrev !== undefined && passengerTerminalAbbrevs.has(terminalAbbrev);

/**
 * Decide whether a resolved vessel location should enter the trip pipeline.
 *
 * The location branch stores more raw fidelity than the trip branch. This gate
 * keeps trip derivation constrained to passenger-terminal movements only.
 *
 * @param location - Converted vessel location for the current tick
 * @param passengerTerminalAbbrevs - Allow-list derived from the terminals table
 * @returns True when the location should be processed by `vesselTrips`
 */
export const isTripEligibleLocation = (
  location: Pick<
    ConvexVesselLocation,
    "DepartingTerminalAbbrev" | "ArrivingTerminalAbbrev"
  >,
  passengerTerminalAbbrevs: ReadonlySet<string>
) =>
  isPassengerTerminalAbbrev(
    location.DepartingTerminalAbbrev,
    passengerTerminalAbbrevs
  ) &&
  (location.ArrivingTerminalAbbrev === undefined ||
    isPassengerTerminalAbbrev(
      location.ArrivingTerminalAbbrev,
      passengerTerminalAbbrevs
    ));
