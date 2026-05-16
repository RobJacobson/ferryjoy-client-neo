/**
 * Build reload actual rows in an event-keyed object.
 *
 * Source phases add rows in priority order. Adding the same event key more
 * than once is stable because the first row is retained.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { buildActualDockEvent } from "../actual";
import type { ActualBoundary } from "./buildActualRowsShared";

type ActualRowsByEventKey = Record<string, ConvexActualDockEvent>;

/**
 * Adds one actual row when the event key is absent.
 *
 * @param rowsByEventKey - Mutable actual rows keyed by event key
 * @param boundary - Boundary identity selected by a source phase
 * @param updatedAt - Timestamp to stamp onto the materialized row
 * @param actualTime - Optional observed timestamp selected by a source phase
 * @returns The same rows object after applying the idempotent add
 */
const addActualRowIfAbsent = (
  rowsByEventKey: ActualRowsByEventKey,
  boundary: ActualBoundary | undefined,
  updatedAt: number,
  actualTime?: number
): ActualRowsByEventKey => {
  if (
    boundary === undefined ||
    rowsByEventKey[boundary.EventKey] !== undefined ||
    !canMaterializeActualRow(boundary, actualTime)
  ) {
    return rowsByEventKey;
  }

  rowsByEventKey[boundary.EventKey] = toActualRow(
    boundary,
    updatedAt,
    actualTime
  );

  return rowsByEventKey;
};

/**
 * Returns whether a boundary can produce a persisted actual row.
 *
 * @param boundary - Boundary identity selected by a source phase
 * @param actualTime - Optional observed timestamp selected by a source phase
 * @returns True when the row has either an actual timestamp or schedule anchor
 */
const canMaterializeActualRow = (
  boundary: ActualBoundary,
  actualTime: number | undefined
): boolean =>
  actualTime !== undefined || boundary.ScheduledDeparture !== undefined;

/**
 * Builds one persisted actual row from a boundary.
 *
 * @param boundary - Boundary identity selected by a source phase
 * @param updatedAt - Timestamp to stamp onto the materialized row
 * @param actualTime - Optional observed timestamp selected by a source phase
 * @returns Validator-shaped actual dock-event row
 */
const toActualRow = (
  boundary: ActualBoundary,
  updatedAt: number,
  actualTime?: number
): ConvexActualDockEvent =>
  buildActualDockEvent(
    {
      EventKey: boundary.EventKey,
      TripKey: boundary.TripKey,
      VesselAbbrev: boundary.VesselAbbrev,
      SailingDay: boundary.SailingDay,
      ScheduledDeparture: boundary.ScheduledDeparture,
      TerminalAbbrev: boundary.TerminalAbbrev,
      EventType: boundary.EventType,
      EventActualTime: actualTime,
    },
    updatedAt
  );

export type { ActualRowsByEventKey };
export { addActualRowIfAbsent };
