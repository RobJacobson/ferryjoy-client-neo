/**
 * Compatibility re-exports for actual event domain write types.
 *
 * New code should import actual-domain write types from types.ts. This module
 * stays as a narrow bridge for existing callers that historically used schemas.
 */

export type {
  ActualDockWriteAnchor,
  ConvexActualDockWrite,
  ConvexActualDockWriteBase,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
} from "./types";
