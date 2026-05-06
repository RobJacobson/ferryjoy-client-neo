/**
 * Compatibility type re-exports for legacy dock-event imports.
 *
 * New event-domain code should import from table-owned types modules or common
 * primitives directly. This file remains only to avoid noisy test churn while
 * production imports migrate to explicit scheduled, actual, or predicted paths.
 */

export type {
  ActualDockWriteAnchor,
  ConvexActualDockWrite,
  ConvexActualDockWriteBase,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
} from "./actual/types";
export type { DockEventType, ScheduledBoundaryContext } from "./common/types";
export type {
  ConvexInferredScheduledSegment,
  DockBoundaryEventRecord,
  DockTransitionRecord,
} from "./scheduled/types";
