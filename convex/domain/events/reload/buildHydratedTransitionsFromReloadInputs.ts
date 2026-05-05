/**
 * Composes schedule seeding and history hydration for one reload pass.
 *
 * The reload mutation supplies numeric schedule segments and vessel-history
 * rows from the action layer. This module turns those inputs into hydrated
 * dock-transition records consumed by the actual reload row builder.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { hydrateActualDockEvents } from "../actual/hydrateActualDockEvents";
import { buildScheduledDockEventRecords } from "../scheduled/buildScheduledDockEventRecords";
import type { DockBoundaryEventRecord } from "../types";
import type {
  EventReloadHistoryRecord,
  EventReloadScheduleSegment,
} from "./types";

type BuildHydratedTransitionsFromReloadInputsArgs = {
  scheduleSegments: EventReloadScheduleSegment[];
  historyRecords: EventReloadHistoryRecord[];
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
 * @param args.scheduleSegments - Numeric reload schedule segments
 * @param args.historyRecords - Numeric reload vessel history rows
 * @param args.vessels - Backend vessel identity rows for resolution
 * @param args.terminals - Backend terminal identity rows for resolution
 * @param args.existingTransitions - Optional prior hydrated rows for incremental reload; defaults to empty
 * @returns Hydrated dock-transition records ready for actual row building
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
