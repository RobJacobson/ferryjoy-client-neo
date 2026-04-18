/**
 * Resolves raw WSF schedule segments against backend vessel and terminal
 * snapshots.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { resolveTerminalByName } from "./resolveWsfTerminal";
import { tryResolveVessel } from "./resolveWsfVessel";

type ResolvedScheduleSegment = {
  vessel: VesselIdentity;
  departingTerminal: TerminalIdentity;
  arrivingTerminal: TerminalIdentity;
};

/**
 * Resolves the backend vessel and terminal rows for a raw WSF schedule segment.
 *
 * @param segment - Raw schedule segment from WSF
 * @param vessels - Backend vessel identity rows
 * @param terminals - Backend terminal identity rows
 * @returns Resolved vessel and terminal rows, or `null` when any are unknown
 */
export const resolveScheduleSegment = (
  segment: RawWsfScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ResolvedScheduleSegment | null => {
  const vessel = tryResolveVessel(segment.VesselName, vessels);
  const departingTerminal = resolveTerminalByName(
    segment.DepartingTerminalName,
    terminals
  );
  const arrivingTerminal = resolveTerminalByName(
    segment.ArrivingTerminalName,
    terminals
  );

  if (!vessel || !departingTerminal || !arrivingTerminal) {
    return null;
  }

  return {
    vessel,
    departingTerminal,
    arrivingTerminal,
  };
};
