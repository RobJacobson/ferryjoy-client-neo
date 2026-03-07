/**
 * Pure functions for resolving marker icon sources from row kind.
 */

import ANCHOR_ICON from "assets/icons/anchor.png";
import VESSEL_ICON from "assets/icons/vessel.png";
import type { RowKind } from "../types";

/** Kind → marker icon source (at-dock = anchor, at-sea = vessel). */
const KIND_MARKER_SOURCE: Record<RowKind, number> = {
  "at-dock": ANCHOR_ICON,
  "at-sea": VESSEL_ICON,
};

/**
 * Returns the marker icon source for a row kind.
 *
 * @param kind - Segment kind (at-dock or at-sea)
 * @returns Image source (require result for PNG assets)
 */
export const getMarkerSourceForKind = (kind: RowKind): number =>
  KIND_MARKER_SOURCE[kind];
