/**
 * Generic document and selector helpers for timeline features.
 *
 * These types capture the shared shape of an ordered timeline document and the
 * render-state derived from it, while leaving feature-specific boundary data,
 * labels, and progress rules to the consuming feature.
 */

import { clamp } from "@/shared/utils";

/** Row sizing mode for the shared timeline primitive. */
export type TimelineLayoutMode = "duration" | "content";

/** Explicit boundary ownership for a row's rendered labels and times. */
export type TimelineBoundaryOwnership = {
  start: true;
  end: boolean;
};

/** Lifecycle phase of a row relative to the current active cursor. */
export type TimelineLifecyclePhase = "upcoming" | "active" | "completed";

/**
 * Canonical ordered row shape shared by timeline features.
 *
 * @typeParam TKind - Feature-specific row kind discriminator
 * @typeParam TBoundary - Feature-specific boundary payload
 * @typeParam TProgressMode - Feature-specific progress mode discriminator
 */
export type TimelineDocumentRow<
  TKind extends string = string,
  TBoundary = unknown,
  TProgressMode extends string = string,
> = {
  id: string;
  segmentIndex: number;
  kind: TKind;
  startBoundary: TBoundary;
  endBoundary: TBoundary;
  boundaryOwnership: TimelineBoundaryOwnership;
  geometryMinutes: number;
  fallbackDurationMinutes: number;
  progressMode: TProgressMode;
  layoutMode: TimelineLayoutMode;
};

/**
 * Canonical ordered timeline document plus the active row cursor.
 *
 * @typeParam TRow - Feature-owned document row type
 */
export type TimelineDocument<
  TRow extends TimelineDocumentRow = TimelineDocumentRow,
> = {
  rows: TRow[];
  activeSegmentIndex: number;
};

/**
 * Active indicator state shared by timeline overlays.
 *
 * @typeParam TLabel - Feature-owned label payload
 */
export type TimelineActiveIndicator<TLabel = string> = {
  rowId: string;
  rowIndex: number;
  positionPercent: number;
  label: TLabel;
};

/**
 * Render-ready row shape consumed by a feature renderer.
 *
 * @typeParam TKind - Feature-specific row kind discriminator
 * @typeParam TBoundary - Feature-specific render-boundary payload
 */
export type TimelineRenderRow<
  TKind extends string = string,
  TBoundary = unknown,
> = {
  id: string;
  kind: TKind;
  segmentIndex: number;
  geometryMinutes: number;
  layoutMode: TimelineLayoutMode;
  startBoundary: TBoundary;
  endBoundary?: TBoundary;
};

/**
 * Render-ready document state derived from the canonical timeline document.
 *
 * @typeParam TRow - Feature-owned render row type
 * @typeParam TIndicator - Feature-owned indicator type
 */
export type TimelineRenderState<
  TRow extends TimelineRenderRow = TimelineRenderRow,
  TIndicator extends TimelineActiveIndicator = TimelineActiveIndicator,
> = {
  rows: TRow[];
  activeIndicator: TIndicator | null;
};

/**
 * Resolves the row that currently owns the active indicator.
 *
 * @param document - Canonical ordered timeline document
 * @returns Active row, or undefined when the document has no rows
 */
export const getActiveTimelineRow = <TRow extends TimelineDocumentRow>(
  document: TimelineDocument<TRow>
): TRow | undefined => {
  const { rows, activeSegmentIndex } = document;

  if (rows.length === 0) {
    return undefined;
  }

  if (activeSegmentIndex < 0) {
    return rows.at(0);
  }

  if (activeSegmentIndex >= rows.length) {
    return rows.at(-1);
  }

  return rows.at(activeSegmentIndex);
};

/**
 * Derives a row lifecycle phase from ordered position and the active cursor.
 *
 * @param rowIndex - Zero-based row index
 * @param activeSegmentIndex - Active row cursor
 * @returns Lifecycle phase for the row
 */
export const getTimelineRowPhase = (
  rowIndex: number,
  activeSegmentIndex: number
): TimelineLifecyclePhase => {
  if (activeSegmentIndex < 0) {
    return "upcoming";
  }

  if (rowIndex < activeSegmentIndex) {
    return "completed";
  }

  if (rowIndex === activeSegmentIndex) {
    return "active";
  }

  return "upcoming";
};

/**
 * Calculates full-row completion from the active indicator location.
 *
 * @param rowIndex - Row being rendered
 * @param activeIndicator - Active overlay indicator state
 * @returns Percent complete for the shared timeline primitive
 */
export const getTimelineRowPercentComplete = (
  rowIndex: number,
  activeIndicator: Pick<
    TimelineActiveIndicator,
    "rowIndex" | "positionPercent"
  > | null
): number => {
  if (!activeIndicator) {
    return 0;
  }

  const delta = activeIndicator.rowIndex - rowIndex;

  return delta === 0 ? activeIndicator.positionPercent : clamp(delta, 0, 1);
};
