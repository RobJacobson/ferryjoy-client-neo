/**
 * Composes schedule seeding and history hydration for actual reloads.
 *
 * Actual reloads need schedule-derived boundary seeds as context, but the
 * composition belongs to actual event hydration because only eventsActual rows
 * consume the history actualization output.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { buildScheduledDockEventRecords } from "../scheduled/buildScheduledDockEventRecords";
import type {
  DockBoundaryEventRecord,
  EventReloadScheduleSegment,
} from "../scheduled/types";
import { hydrateActualDockEvents } from "./hydrateActualDockEvents";
import type { EventReloadHistoryRecord } from "./reloadTypes";

type HydrateActualTransitionsFromReloadInputsArgs = {
  scheduleSegments: EventReloadScheduleSegment[];
  historyRecords: EventReloadHistoryRecord[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  existingTransitions?: DockBoundaryEventRecord[];
};

/**
 * Builds hydrated dock transitions for one actual reload pass.
 *
 * The actual table uses schedule seeds only to address the physical boundaries
 * that history rows can actualize. Keeping this composer in the actual domain
 * prevents the reload path from becoming a fourth cross-table events domain.
 *
 * @param args - Numeric schedule, history, and identity context for one reload
 * @returns Hydrated boundary records ready for actual row construction
 */
const hydrateActualTransitionsFromReloadInputs = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
  existingTransitions = [],
}: HydrateActualTransitionsFromReloadInputsArgs): DockBoundaryEventRecord[] => {
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

export type { HydrateActualTransitionsFromReloadInputsArgs };
export { hydrateActualTransitionsFromReloadInputs };
