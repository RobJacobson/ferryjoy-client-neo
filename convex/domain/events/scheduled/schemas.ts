/**
 * Compatibility re-export for inferred scheduled segment types.
 *
 * New code should import scheduled-domain types from types.ts. This file remains
 * for callers that still use the historical schemas path during migration.
 */

export type { ConvexInferredScheduledSegment } from "./types";
