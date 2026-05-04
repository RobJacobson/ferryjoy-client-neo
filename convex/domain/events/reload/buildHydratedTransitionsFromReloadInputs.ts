/**
 * Composes schedule seeding and history hydration for one reload pass.
 *
 * The reload mutation supplies fetched schedule segments and vessel-history
 * rows from the action layer. This module turns those raw inputs into the
 * hydrated dock-transition records consumed by buildDockEventRowsForSailingDayReload,
 * keeping schedule-to-transition seeding and history merge in a single
 * pure-function pipeline so the mutation handler stays linear.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { hydrateActualDockEvents } from "../actual/hydrateActualDockEvents";
import { buildScheduledDockEventRecords } from "../scheduled/buildScheduledDockEventRecords";
import type { DockBoundaryEventRecord } from "../types";

type BuildHydratedTransitionsFromReloadInputsArgs = {
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  existingTransitions?: DockBoundaryEventRecord[];
};

/**
 * Builds hydrated dock-transition records for one sailing-day reload pass.
 *
 * Seeds boundary records from the WSF schedule slice, then layers vessel
 * history actuals and prior-slice state on top via hydrateActualDockEvents.
 * The composer is intentionally thin so domain stages stay testable in
 * isolation while the mutation handler reads as one linear flow.
 *
 * @param args.scheduleSegments - Raw fetch-layer WSF schedule segments
 * @param args.historyRecords - Raw fetch-layer WSF vessel history rows
 * @param args.vessels - Backend vessel identity rows for resolution
 * @param args.terminals - Backend terminal identity rows for resolution
 * @param args.existingTransitions - Optional prior hydrated rows for incremental reload; defaults to empty
 * @returns Hydrated dock-transition records ready for buildDockEventRowsForSailingDayReload
 */
const buildHydratedTransitionsFromReloadInputs = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
  existingTransitions = [],
}: BuildHydratedTransitionsFromReloadInputsArgs): DockBoundaryEventRecord[] => {
  const seededEvents = buildScheduledDockEventRecords(
    scheduleSegments,
    vessels,
    terminals
  );

  return hydrateActualDockEvents({
    seededEvents,
    existingEvents: existingTransitions,
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });
};

export { buildHydratedTransitionsFromReloadInputs };
