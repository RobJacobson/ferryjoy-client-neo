/**
 * Pure functions for deriving content kinds from row kind.
 */

import type { LeftContentKind, RightContentKind, RowKind } from "../types";

/**
 * Returns the left content kind for a row kind.
 *
 * @param kind - Segment kind (at-dock or at-sea)
 * @returns Left slot content kind
 */
export const getLeftContentKind = (_kind: RowKind): LeftContentKind =>
  "terminal-label";

/**
 * Returns the right content kind for a row kind.
 *
 * @param kind - Segment kind (at-dock or at-sea)
 * @returns Right slot content kind
 */
export const getRightContentKind = (_kind: RowKind): RightContentKind =>
  "time-events";
